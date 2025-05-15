const {Constants, getItemAndValidate, updateItem, getBESSStatsInWh, getEarliestYieldTimeToday, getLatestHeatingTimeToday, getApproxValueForTimestamp, getWattageW, getEnergyWh} = require('jslib');

var logger = log('BaselineLoad');

rules.JSRule({
    name: "Rule calculating the baseline and average load of house",
    description: "Goes through the historic data and calculates the baseline and average wattage of the house through various heuristics.",
    triggers: [
        triggers.TimeOfDayTrigger('23:59'),
        triggers.ItemStateUpdateTrigger(Constants.PREDICTIONS.___MANUAL_RECALCULATION_ITEM)
    ],
    execute: (event) => {
        const baseline = getBaselineFromHistory();
        const dayAverage = getAverageDayLoad();
        const nightAverage = getAverageNightLoad();
        logger.info("Calculated baseline load: {}, average day load: {}, average night load {}", baseline, dayAverage, nightAverage);
        updateItem(Constants.HOME.BASELINE_WATTAGE_ITEM, baseline);
        updateItem(Constants.HOME.AVERAGE_DAILY_WATTAGE_ITEM, dayAverage);
        updateItem(Constants.HOME.AVERAGE_NIGHT_WATTAGE_ITEM, nightAverage);
    }
});

rules.JSRule({
    name: "Calculating the time to discharge the battery.",
    description: "Calculation of discharge time by baseload power draw and current power draw from battery.",
    triggers: [triggers.ItemStateChangeTrigger(Constants.SOLAR.ESS.POWER_ITEM),
        triggers.ItemStateUpdateTrigger(Constants.PREDICTIONS.___MANUAL_RECALCULATION_ITEM)
    ],
    execute: (event) => {
        const batteryChargeRate = getItemAndValidate(Constants.SOLAR.ESS.POWER_ITEM).numericState;
        
        const baselineLoad = getItemAndValidate(Constants.HOME.BASELINE_WATTAGE_ITEM)?.numericState;
        if(!baselineLoad || !isFinite(baselineLoad)){
            throw new Error("Baseline load is not set, cannot calculate time to discharge.");
        }
                
        const { maxSOCInWh, currentSOCInWh, minSOCInWh, usableEnergyWh } = getBESSStatsInWh();
        
        logger.debug("Battery SOC in Wh: {}, minReserveSOCInWh: {}, maxSOCInWh: {}", currentSOCInWh, minSOCInWh, maxSOCInWh);
        logger.debug("Battery charge/discharge rate in W: {}", batteryChargeRate);

        let dischargeTimeCurrentLoad;
        if(batteryChargeRate < 0){
            dischargeTimeCurrentLoad = (usableEnergyWh / -batteryChargeRate) * 60;
        } else {
            // setting to null, as no energy is drawn from the battery
            dischargeTimeCurrentLoad = null;
        }
        updateItem(Constants.SOLAR.ESS.TTDISCHARGE_CURRENT_ITEM, Math.trunc(dischargeTimeCurrentLoad).toString());

        let dischargeTimeBaselineLoad;
        if(currentSOCInWh < minSOCInWh){
            dischargeTimeBaselineLoad = 0;
        } else {
            dischargeTimeBaselineLoad = (usableEnergyWh / baselineLoad) * 60;
        }
        updateItem(Constants.SOLAR.ESS.TTDISCHARGE_BASELINE_ITEM, Math.trunc(dischargeTimeBaselineLoad).toString());
        
        logger.debug("Discharge time in minutes under current load {}, and under baselineLoad {} ", dischargeTimeCurrentLoad, dischargeTimeBaselineLoad);
    }
});

function getAverageNightLoad() {
    return getAggregatedLoad(
        (current) => getAverageLoadOfNight(current),
        (results) => results.reduce((a, b) => a + b, 0) / results.length  
    );
}

function getAverageDayLoad() {
    return getAggregatedLoad(
        (current) => getAverageLoadOfDay(current),
        (results) => results.reduce((a, b) => a + b, 0) / results.length
    );
}

function getBaselineFromHistory() {
    let result = getAggregatedLoad(
        (current) => getBaselineLoadOfDay(current, Constants.PREDICTIONS.BASELINE_APPROX_DELTA_FACTOR),
        (results) => Math.max(...results)        
    );
    // if the baseline is not found, we try it with a more relaxed delta factor
    // this is just an insurance if the house load is highly volatile even during baseline hours
    if(!result){
        result = getAggregatedLoad(
            (current) => getBaselineLoadOfDay(current, Constants.PREDICTIONS.BASELINE_APPROX_DELTA_FACTOR * 2),
            (results) => Math.max(...results)      
        );
    }
    return result;
}


function getAggregatedLoad(valueExtractor, resultsFunction){
    const end = time.toZDT();
    var current = end.minusDays(Constants.PREDICTIONS.DAYS_TO_CHECK_BASELINE);
    var results = [];
    while(current.isBefore(end)) {
        const result = valueExtractor(current);
        if(result && result > 0){
            results.push(result);
        }else {
            logger.debug("Load from day {} is invalid {}, skipping.", JSON.stringify(current), result);
        }
        current = current.plusDays(1); 
    }
    logger.debug("Load history: {}", JSON.stringify(results));

    return Math.round(resultsFunction(results));
}


function getAverageLoadOfNight(timestamp){
    const [earliestYieldTimeToday, ] = getEarliestYieldTimeToday();
    const endOfHeating = getLatestHeatingTimeToday(timestamp);

    const startTime = time.toZDT(timestamp).minusDays(1).withHour(endOfHeating.hour()).withMinute(endOfHeating.minute()).withSecond(endOfHeating.second());
    const midnight = startTime.withHour(23).withMinute(45);
    const midnightAndMinute = midnight.plusMinutes(30); // missing data will be later compensated
    const endTime = time.toZDT(timestamp).withHour(earliestYieldTimeToday.hour()).withMinute(earliestYieldTimeToday.minute()).withSecond(earliestYieldTimeToday.second());
    const lengthUntilMidnight = time.Duration.between(startTime, midnight).toMinutes();
    const lengthAfterMidnight = time.Duration.between(midnightAndMinute, endTime).toMinutes();
    const energyBeforeMidnight = getItemAndValidate(Constants.HOME.DAY_AGG_CONSUMPTION_ITEM).history.deltaBetween(startTime, midnight) * 1000;
    const energyAfterMidnight = getItemAndValidate(Constants.HOME.DAY_AGG_CONSUMPTION_ITEM).history.deltaBetween(midnightAndMinute, endTime) * 1000;
    const totalEnergy = energyBeforeMidnight + energyAfterMidnight;
    const totalLength = lengthUntilMidnight + lengthAfterMidnight;
    const averageWattage = getWattageW(totalEnergy, totalLength);

    // compensation for the missing 30 minutes around midnight
    const missingEnergy = getEnergyWh(averageWattage, 30);
    return getWattageW(totalEnergy + missingEnergy, totalLength + 30);
}

function getAverageLoadOfDay(timestamp){
    const [earliestYieldTimeToday, ] = getEarliestYieldTimeToday();
    const endOfHeating = getLatestHeatingTimeToday(timestamp);
    const startTime = time.toZDT(timestamp).withHour(earliestYieldTimeToday.hour()).withMinute(earliestYieldTimeToday.minute()).withSecond(earliestYieldTimeToday.second());
    const endTime = time.toZDT(timestamp).withHour(endOfHeating.hour()).withMinute(endOfHeating.minute()).withSecond(endOfHeating.second());
    const dayLengthInMinutes = time.Duration.between(startTime, endTime).toMinutes();
    const energyInDayWh = getItemAndValidate(Constants.HOME.DAY_AGG_CONSUMPTION_ITEM).history.deltaBetween(startTime, endTime) * 1000;
    return getWattageW(energyInDayWh, dayLengthInMinutes);
}

function getBaselineLoadOfDay(timestamp, deltaFactor){
    const startTime = time.toZDT(timestamp).minusDays(1).withHour(0).withMinute(0).withSecond(0);
    const endTime = time.toZDT(timestamp).minusDays(1).withHour(23).withMinute(59).withSecond(59);
    let current = startTime;
    let lastValue = undefined;
    let resultCandidates = [];
    let currentPeriod = [];
    let inPeriod = false;

    while (current.isBefore(endTime)) {
        const value = getApproxValueForTimestamp(Constants.HOME.CURRENT_LOAD_ITEM, current);
        if (value !== undefined && lastValue !== undefined) {
            const isStable = Math.abs(value - lastValue) < lastValue * deltaFactor;
            if (isStable && !inPeriod) {
                currentPeriod.push(lastValue, value);
                inPeriod = true;
            } else if (isStable && inPeriod){
                currentPeriod.push(value);
            } else if (inPeriod) {
                resultCandidates.push(Math.max(...currentPeriod));
                currentPeriod = [];
                inPeriod = false;
            }
        } else if (inPeriod) {
            resultCandidates.push(Math.max(...currentPeriod));
            currentPeriod = [];
            inPeriod = false;
        }

        lastValue = value;
        current = current.plusMinutes(15);
    }

    if (inPeriod) {
        resultCandidates.push(Math.max(...currentPeriod));
    }

    return Math.min(...resultCandidates);
}
