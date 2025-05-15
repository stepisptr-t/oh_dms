const {Constants, updateForGroup, isTodayPredictedGoodYield, getLatestYieldTimeToday, getEarliestYieldTimeTomorrow, getEarliestYieldTimeToday, getItemAndValidate, updateItem, isTomorrowPredictedGoodYield, getWattageW, getPredictedEODYieldInWh, getApproxDaytimeWattage, getBESSStatsInWh, isTomorrowPredictionValid, isTodayPredictionValid, getEnergyWh, getLatestHeatingTimeToday} = require('jslib');
const logger = log('SpotSwitching');

rules.JSRule({
    name: "Sufficient battery triggering discharge to the grid",
    description: "Every time the spot price gets changed, the current state of charge is checked and the" 
                +"determined energy surplus (or lack thereof) is determined. Subsequent price check are needed to be handled elsewhere.",
    triggers: [
    // assuming that both price and level are updated roughly at the same time and it is not needed to be updated based
    // on both
    //   triggers.ItemStateChangeTrigger(Constants.PREDICTIONS.SPOT.CURRENT_LEVEL),
      triggers.ItemStateChangeTrigger(Constants.PREDICTIONS.SPOT.CURRENT_PRICE),
      triggers.ItemStateUpdateTrigger(Constants.PREDICTIONS.___MANUAL_RECALCULATION_ITEM)
    ],
    switchItemName: Constants.AUTOMATION.FUNC.ENABLE_PREDICTIVE_ESS_CHARGE_DISCHARGE,
    execute: (event) => {
        const [earliestYieldTimeToday, ] = getEarliestYieldTimeToday();
        const [latestYieldTimeToday, ] = getLatestYieldTimeToday();

        const now = time.toZDT();
        const latestHeatingTimeToday = getLatestHeatingTimeToday(now);

        const minutesUntilNewPrice = getMinutesUntilNewPrice(now);
        const isNightTime = now.isAfter(latestHeatingTimeToday) || now.isBefore(earliestYieldTimeToday);
        const predictedYieldEOD = getPredictedEODYieldInWh();

        const productionExpectedInDischargeWindow = now.plusMinutes(minutesUntilNewPrice).isBefore(latestYieldTimeToday) && predictedYieldEOD > 0;

        // positive means feed in, negative means power draw
        let desiredEnergy = 0;

        let isDischargeDesiredNightTime = false;
        let isNightSelfUseEnergyMissing = false;
        let isDayAndThereIsSurplusEnergy = false;
        let isDayAndYieldSelfUseEnergyMissing = false;

        if (isNightTime) {
            desiredEnergy = calculateNightTimeSurplusEnergy(now);
            logger.info("calculated surplus energy {}, currentSOInWh {}", desiredEnergy, getBESSStatsInWh().currentSOCInWh);

            isDischargeDesiredNightTime = isNightTime && 
                ((now.hour()<12 && isTodayPredictedGoodYield())
                    || now.hour()>=12 && isTomorrowPredictedGoodYield())
                && desiredEnergy > 0;
            logger.info("isDischargeDesiredNightTime {}", isDischargeDesiredNightTime);

            isNightSelfUseEnergyMissing = desiredEnergy < 0 && ((now.hour()<12 && isTodayPredictionValid()) || now.hour()>=12 && isTomorrowPredictionValid());
            logger.info("isNightSelfUseEnergyMissing {}", isNightSelfUseEnergyMissing);
        } else {
            desiredEnergy = calculateDayTimeSurplusEnergy(now, minutesUntilNewPrice);
            logger.info("calculated surplus energy {}, currentSOInWh {}", desiredEnergy, getBESSStatsInWh().currentSOCInWh);
            
            isDayAndThereIsSurplusEnergy = !isNightTime && productionExpectedInDischargeWindow && isTodayPredictedGoodYield() && desiredEnergy > 0;
            logger.info("isDischargeDesiredDaytime {}", isDayAndThereIsSurplusEnergy)

            isDayAndYieldSelfUseEnergyMissing = isTodayPredictionValid() && desiredEnergy < 0;
            logger.info("isDayAndYieldSelfUseEnergyMissing {}", isDayAndYieldSelfUseEnergyMissing)
        }

        updateItem(Constants.SOLAR.ESS.GRID_CHARGE_DISCHARGE_WATTAGE_ITEM, getWattageW(desiredEnergy, minutesUntilNewPrice));
        
        let dischargeToGridDesired = false;
        if (isDayAndThereIsSurplusEnergy || isDischargeDesiredNightTime){
            dischargeToGridDesired = true;
        }
        updateItem(Constants.AUTOMATION.ESS.PREDICTIONS.DISCHARGE_TO_GRID, dischargeToGridDesired);

        let chargeFromGridDesired = false;
        if (isDayAndYieldSelfUseEnergyMissing || isNightSelfUseEnergyMissing) {
            chargeFromGridDesired = true;
        }
        updateItem(Constants.AUTOMATION.ESS.PREDICTIONS.CHARGE_FROM_GRID, chargeFromGridDesired);
    }
});

rules.JSRule({
  name: "Signalizes \"annotated\" items that their desired spot price level is satisfied",
  description: "Price level signalizator based on metadata and group membership.",
  triggers: [
    triggers.ItemStateChangeTrigger(Constants.PREDICTIONS.SPOT.CURRENT_LEVEL)
  ],
  execute: (event) => {
    try {
        const currentLevel = Number(event?.newState);
        const itemArr = items.getItems();
        updateForGroupLevel(itemArr, Constants.AUTOMATION.SPOT.LEVEL.EXPENSIVE_GROUP_NAME, currentLevel);
        updateForGroupLevel(itemArr, Constants.AUTOMATION.SPOT.LEVEL.CHEAP_GROUP_NAME, currentLevel);
    } catch (e) {
      logger.error("Processing error: {}", e.message, e.stack);
    }
}});

rules.JSRule({
    name: "Signalizes \"annotated\" items that their desired spot price is satisfied",
    description: "Price signalizator based on metadata and group membership.",
    triggers: [
      triggers.ItemStateChangeTrigger(Constants.PREDICTIONS.SPOT.CURRENT_PRICE)
    ],
    execute: (event) => {
        const currentPrice = Number(event?.newState);
        const itemArr = items.getItems();
        updateForGroupPrice(itemArr, Constants.AUTOMATION.SPOT.PRICE.EXPENSIVE_GROUP_NAME, currentPrice);
        updateForGroupPrice(itemArr, Constants.AUTOMATION.SPOT.PRICE.CHEAP_GROUP_NAME, currentPrice);
}});

/**
 * If time now is during the night and next day predictions indicate high yield 
 * and there is enough energy stored in the ESS to cover our own consumption until the sunrise
 */
function calculateNightTimeSurplusEnergy(now) {
    const nightEnergyUse = calculateExpectedEnergyUsageInWhThisNight(now);
    logger.info("calculated night energy use {}", nightEnergyUse);
    const { usableEnergyWh } =  getBESSStatsInWh();
    return usableEnergyWh - nightEnergyUse;
}

/**
 * Returns the amount of energy which is expected to be producted until the end of the day minus the amount of energy 
 * needed to cover the house load until the end of the next day.
 */
function calculateDayTimeSurplusEnergy(now){
    const predictedEODYield = getPredictedEODYieldInWh();
    const assumedEODPowerDrawInWh = calculateExpectedEnergyUsageInWhUntilEOD(now);
    const assumedNightPowerDrawInWh = calculateExpectedEnergyUsageInWhThisNight();
    const selfUseUntilNextSunrise = assumedEODPowerDrawInWh + assumedNightPowerDrawInWh;
    const { usableEnergyWh } = getBESSStatsInWh();
    return usableEnergyWh + predictedEODYield - selfUseUntilNextSunrise;
}

function calculateExpectedEnergyUsageInWhUntilEOD(now) {
    const endOfHeatingPeroid = getLatestHeatingTimeToday(now)
    const minutesUntilEOD = time.Duration.between(now, endOfHeatingPeroid).toMinutes();
    const approxDayPowerDraw = getApproxDaytimeWattage(); 
    return getEnergyWh(approxDayPowerDraw, minutesUntilEOD);
}

function calculateExpectedEnergyUsageInWhThisNight(since = getLatestHeatingTimeToday()) {
    let earliestYieldTimeTomorrow;
    if(since.hour() > 12){
        [earliestYieldTimeTomorrow, ] = getEarliestYieldTimeTomorrow(); 
    } else {
        [earliestYieldTimeTomorrow, ] = getEarliestYieldTimeToday();    
    }
    const approxNightPowerDraw = getItemAndValidate(Constants.HOME.AVERAGE_NIGHT_WATTAGE_ITEM).numericState;
    const minutesOfNoYield = time.Duration.between(since, earliestYieldTimeTomorrow).toMinutes();
    return getEnergyWh(approxNightPowerDraw, minutesOfNoYield);
}

function getMinutesUntilNewPrice(now) {
    let spotPriceIntervalLengthMin = getItemAndValidate(Constants.PREDICTIONS.SPOT.INTERVAL_LEN_MINUTES_ITEM)?.numericState;
    if(!spotPriceIntervalLengthMin){
        // assuming default value as 60 minutes
        spotPriceIntervalLengthMin = 60;
        updateItem(Constants.PREDICTIONS.SPOT.INTERVAL_LEN_MINUTES_ITEM, 60);
    }

    const minutes = now.minute();
    if ((60 % spotPriceIntervalLengthMin) != 0) {
        throw new Error("Spot price interval length {} is unsupported. Only values where their mod(60)=0 are allowed.", spotPriceIntervalLengthMin);
    }
    const currentBlockInHourIndex = Math.floor(minutes / spotPriceIntervalLengthMin);
    const nextBlockStartMinute = (currentBlockInHourIndex + 1) * spotPriceIntervalLengthMin;
    logger.debug("nowminute {}, intervalLen {}, currentHourIndex {}, nextBlockStartMinute {}",
        minutes, spotPriceIntervalLengthMin, currentBlockInHourIndex, nextBlockStartMinute
    );
    return time.Duration.between(now, now.withMinute(0).withSecond(0).plusMinutes(nextBlockStartMinute)).toMinutes();
}



function updateForGroupLevel(itemArr, groupName, level){
    relevantGroups = [Constants.AUTOMATION.SPOT.LEVEL.CHEAP_GROUP_NAME, Constants.AUTOMATION.SPOT.LEVEL.EXPENSIVE_GROUP_NAME];
    metadataKeyName = Constants.AUTOMATION.SPOT.LEVEL.METADATA_KEYNAME;
    updateForGroup(itemArr,groupName, level, relevantGroups, metadataKeyName,
        (curr, threshold, groupName) => {
            if(threshold <= 0 || threshold > 24){
                logger.error("Invalid threshold value. Please use values between 1-24 to specify number of cheap/expensive hours to run.")
                return undefined;
            }
            if(groupName === Constants.AUTOMATION.SPOT.LEVEL.EXPENSIVE_GROUP_NAME){
                return curr >= 25 - threshold; // subtracting from 25 because the levels are <1 .. 24>
            } else if (groupName === Constants.AUTOMATION.SPOT.LEVEL.CHEAP_GROUP_NAME){
                return curr <= threshold;
            }
        }
    );
}

function updateForGroupPrice(itemArr, groupName, price) {
    relevantGroups = [Constants.AUTOMATION.SPOT.PRICE.CHEAP_GROUP_NAME, Constants.AUTOMATION.SPOT.PRICE.EXPENSIVE_GROUP_NAME];
    metadataKeyName = Constants.AUTOMATION.SPOT.PRICE.METADATA_KEYNAME;
    updateForGroup(itemArr, groupName, price, relevantGroups, metadataKeyName,
        (curr, threshold, groupName) => {
            if(groupName === Constants.AUTOMATION.SPOT.PRICE.EXPENSIVE_GROUP_NAME){
                return curr >= threshold;
            } else if (groupName === Constants.AUTOMATION.SPOT.PRICE.CHEAP_GROUP_NAME){
                return curr <= threshold;
            }
        }
    );
}