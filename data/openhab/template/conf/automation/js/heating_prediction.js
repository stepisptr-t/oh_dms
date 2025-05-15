const {Constants, getItemAndValidate, updateItem, getApproxValueForTimestamp} = require('jslib');

const logger = log('BoilerPredictedTimeToHeatRule');

rules.JSRule({
    name: "Boiler heat rate prediction",
    description: "Calculates the heat rate of the boiler based on historical data.",
    triggers: [triggers.TimeOfDayTrigger('23:59'),
        triggers.ItemStateUpdateTrigger(Constants.PREDICTIONS.___MANUAL_RECALCULATION_ITEM)],
    execute: (event) => {
        const heatRate = getFastestHeatrateFromHistory(time.toZDT());
        if(!heatRate){
            logger.error("No heat rate data available");
            return null;
        }
        logger.info("Calculated heat rate as {} %/min", heatRate.getHeatRate());
        updateItem(Constants.HOME.BOILER.HEAT_RATE_ITEM, heatRate.getHeatRate());
}})

const triggerDefs = Constants.HOME.BOILER.TEMPERATURE_PROBE_ITEMS.map(itemName => triggers.ItemStateChangeTrigger(itemName))
    .concat([triggers.ItemStateUpdateTrigger(Constants.PREDICTIONS.___MANUAL_RECALCULATION_ITEM)]);

rules.JSRule({
  name: "Rule updating predicted time to heat from current state",
  description: "Calculates the time to heat based on historical data.",
  triggers: triggerDefs,
  execute: (event) => {
    const timeToHeatItem = getItemAndValidate(Constants.HOME.BOILER.TTHEAT_ITEM);
    var timeToHeat = getTimeToHeatUp();
    logger.info("Calculated time to heat as {} minutes", timeToHeat);
    if(timeToHeatItem.numericState !== timeToHeat){
        timeToHeatItem.sendCommand(timeToHeat);
    }
}});

function getTimeToHeatUp(){
    var heatRate = getItemAndValidate(Constants.HOME.BOILER.HEAT_RATE_ITEM)?.numericState;
    if(!heatRate){
        updateItem(Constants.HOME.BOILER.HEAT_RATE_ITEM, getFastestHeatrateFromHistory(time.toZDT()).getHeatRate());
        return getTimeToHeatUp();
    }
    const currentSOC = getCurrentBoilerSOC();
    updateItem(Constants.HOME.BOILER.SOC_ITEM, currentSOC);
    const targetSOC = 100;
    logger.info("BOILER currentSOC={} %, targetSOC={} %, calculated heat rate={} %/min", currentSOC, targetSOC, heatRate);
    const socDelta = targetSOC - currentSOC;
    return Math.round(socDelta / heatRate);
}

function getFastestHeatrateFromHistory(timestamp) {
    var current = timestamp.minusDays(Constants.HOME.BOILER.HEAT_RATE_DAYS_TO_CHECK);
    const end = timestamp;
    var fastestHeatRate = null; 
    while(current.isBefore(end)) {
        const candidate = getFastestHeatrateInDay(current);
        if(candidate && (!fastestHeatRate || candidate.getHeatRate() > fastestHeatRate.getHeatRate())){
            fastestHeatRate = candidate;
        }
        current = current.plusDays(1); 
    }
    return fastestHeatRate;
}

function getFastestHeatrateInDay(timestamp) {
    let maxItem = null;
    let minItem = null;
    let previousSOC = null;
    let previousDelta = null;
    let bestCandidate = null;
    const DELTA_STANDARD_DIFF = 3;
    const DELTA_UNUSUAL_DIFF = 30;
    const calculationEnd = time.toZDT(timestamp).with(time.LocalTime.of(23,59));
    var current = timestamp.with(time.LocalTime.of(0,0));
    while(current.isBefore(calculationEnd)) {
        const soc = getBoilerSOCForTimestamp(current);
        const delta = soc-previousSOC;
        // if the temperature delta dips significantly since the last datapoint it is likely caused by user consumption and no further data should be considered for the candidate
        if (previousSOC && Math.abs(delta-previousDelta) > DELTA_STANDARD_DIFF && Math.abs(delta-previousDelta) < DELTA_UNUSUAL_DIFF){
            const candidate = getHeatRate(minItem, maxItem);
            if(candidate && (!bestCandidate || candidate.getHeatRate() > bestCandidate.getHeatRate())){
                bestCandidate = candidate;
            }
            maxItem = null;
            minItem = new MinMaxItem(soc, current);
            current = current.plusMinutes(15);
            previousSoc = soc;
            previousDelta = delta;
            continue;
        }
        if(!maxItem || soc > maxItem.soc){
            maxItem = new MinMaxItem(soc, current);
        }
        if(!minItem || soc < minItem.soc){
            minItem = new MinMaxItem(soc, current);
        }
        current = current.plusMinutes(15);
        previousSOC = soc;
        previousDelta = delta;
    }
    if(bestCandidate == null){
        return getHeatRate(minItem, maxItem)
    }
    return bestCandidate;
}

function getHeatRate(minItem, maxItem){
    if(!minItem || !maxItem){
        return null;
    }
    const heatRate =  new HeatRate(minItem, maxItem);
    // ignoring nonsense values
    if(maxItem.timestamp.isBefore(minItem.timestamp)
        // too low difference or too long time betwen is not relevant
        || heatRate.socDelta <= 5 || heatRate.minutesBetween >= 190){
        return null;
    }

    // ignoring nonsense values due to errors in the data
    if(heatRate.getHeatRate() > 10){
        return null;
    }
    return heatRate;
}

class HeatRate {
    constructor(minItem, maxItem ) {
        this.minutesBetween = time.Duration.between(minItem.timestamp, maxItem.timestamp).toMinutes();
        this.socDelta = maxItem.soc - minItem.soc;
        this.heatRate = Math.round((this.socDelta/this.minutesBetween) * 100) / 100; // two decimal places
    }
    getHeatRate(){
        return this.heatRate;
    }
}

class MinMaxItem {
    constructor(soc, timestamp) {
        this.soc = soc;
        this.timestamp = timestamp;
    }
}


function getCurrentBoilerSOC() {
    const temperatures = Constants.HOME.BOILER.TEMPERATURE_PROBE_ITEMS.map(itemName => getItemAndValidate(itemName).numericState);
    const intakeTemp = getItemAndValidate(Constants.HOME.BOILER.INTAKE_TEMP_ITEM).numericState;
    const maxTemp = getItemAndValidate(Constants.HOME.BOILER.MAX_TEMP_ITEM).numericState; 
    return calculateBoilerSOC(temperatures, intakeTemp, maxTemp);
}

function getBoilerSOCForTimestamp(timestamp) {
    const temperatures = getBoilerTempsForTimestamp(timestamp);
    const intakeTemp = getApproxValueForTimestamp(Constants.HOME.BOILER.INTAKE_TEMP_ITEM, timestamp) || 20;
    const maxTemp = getItemAndValidate(Constants.HOME.BOILER.MAX_TEMP_ITEM).numericState; 
    return calculateBoilerSOC(temperatures, intakeTemp, maxTemp);
}

function getBoilerTempsForTimestamp(timestamp) {
    return Constants.HOME.BOILER.TEMPERATURE_PROBE_ITEMS.map(itemName => {
        tempItem = getItemAndValidate(itemName);
        return tempItem.history.averageBetween(timestamp.minusMinutes(1), timestamp.plusMinutes(1));
    });
}

// calculates the SOC of each section and returns the average
function calculateBoilerSOC(temperatureItems, intakeTemp, maxTemp) {
    const minTemp = Math.min(...temperatureItems.concat([intakeTemp]));

    const clampedTemps = temperatureItems.map(temp => 
        Math.max(minTemp, Math.min(temp, maxTemp))
    );
    
    const tempRange = maxTemp - minTemp;
    if (tempRange <= 0) return 0;

    let weightedSum = 0;
    let totalWeight = 0;
    clampedTemps.forEach((temp, index) => {
        const weight = Constants.HOME.BOILER.PROBE_WEIGHTS[index] || 1;
        const normalized = (temp - minTemp) / tempRange;

        weightedSum += normalized * weight; 
        totalWeight += weight;
    });

    const result = ((weightedSum / totalWeight)) * 100;
    
    // round to two decimal places
    return Math.round(result * 100) / 100; 
}
