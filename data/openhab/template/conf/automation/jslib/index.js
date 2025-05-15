const {Constants, PossiblePredictionLevels} = require('./constants.js');

function getItemAndValidate(itemName){
  const item = items.getItem(itemName);
  if (!item) {
    if(logger) logger.error("{} item is not set.", itemName);
      throw new Error(itemName + "item is not set");
  }
  return item;
  }
  
  
function updateItem(signalizatorName, desiredState) {
  if(signalizatorName == null) {
      throw new Error("Signalizator name not specified.");
  }
  if(typeof desiredState === 'boolean'){
      desiredState = desiredState ? "ON" : "OFF";
  }
  const signalizator = getItemAndValidate(signalizatorName);
  if(signalizator.state != desiredState) {
      if(logger) logger.info("Rule is setting {} to {}", signalizatorName, desiredState);
      signalizator.sendCommand(desiredState);
  }
}

function getBESSStatsInWh() {
  const currentSOC = getItemAndValidate(Constants.SOLAR.ESS.CURR_SOC_ITEM).numericState;
  const minReserveSOCInPCt = getItemAndValidate(Constants.SOLAR.ESS.MIN_USER_RESERVE_SOC_ITEM).numericState;
  const maxSOCInPct = getItemAndValidate(Constants.SOLAR.ESS.MAX_SOC_ITEM).numericState;
  const batterySizeInWh = getItemAndValidate(Constants.SOLAR.ESS.MAX_CAP_ITEM)?.numericState;
  
  const minSOCInWh = (minReserveSOCInPCt / 100) * batterySizeInWh;
  const maxSOCInWh = (maxSOCInPct / 100) * batterySizeInWh;
  const currentSOCInWh = (currentSOC / 100) * batterySizeInWh;
  const usableEnergyWh = currentSOCInWh - minSOCInWh;
  const storeableEnergyWh = maxSOCInWh - currentSOCInWh;
  return { maxSOCInWh, currentSOCInWh, minSOCInWh, usableEnergyWh, storeableEnergyWh };
}

/**
 * 
 * @returns {number} energy which is predicted yet to be produced
 */
function getPredictedEODYieldInWh(){
  const solarToday = getItemAndValidate(Constants.SOLAR.ENERGY_TODAY_ITEM)?.numericState;
  const predictedEnergyToday = getItemAndValidate(Constants.PREDICTIONS.SOLAR.TODAY.TOTAL)?.numericState ?? 0;
  return (predictedEnergyToday-solarToday) * 1000;
}

function isPredictionGoodYield(prediction, notGoodCallback = () => {}, notValidCallback = ()=>{}){
  if(!isPredictionValid(prediction)){
    notValidCallback();
    return false;
  }
  if (!Constants.PREDICTIONS.GOOD_YIELD_LEVELS.some(it => it === prediction)) {
    notGoodCallback();
    return false;
  }
  return true;
}

function isPredictionValid(prediction){
  return prediction !== 'INCONCLUSIVE';
} 

function isTodayPredictionValid(){
  const todayPrediction = getItemAndValidate(Constants.PREDICTIONS.TOTAL.TODAY.LEVEL).state;
  return isPredictionValid(todayPrediction);
}

function isTomorrowPredictionValid(){
  const tomorrowPrediction = getItemAndValidate(Constants.PREDICTIONS.TOTAL.TOMORROW.LEVEL).state;
  return isPredictionValid(tomorrowPrediction);
}

function isTomorrowPredictedGoodYield(notGoodCallback = () => {}, notValidCallback = () => {}){
  const tomorrowPrediction = getItemAndValidate(Constants.PREDICTIONS.TOTAL.TOMORROW.LEVEL).state;
  return isPredictionGoodYield(tomorrowPrediction, notGoodCallback, notValidCallback);
}

function isTomorrowPredictedBadYield (notGoodCallback = () => {}, notValidCallback = () => {}) {
  return !isTomorrowPredictedGoodYield(notGoodCallback, notValidCallback) && isTomorrowPredictionValid();
}


function isTodayPredictedGoodYield(notGoodCallback = () => {}, notValidCallback = () => {}) {
  const todayPrediction = getItemAndValidate(Constants.PREDICTIONS.TOTAL.TODAY.LEVEL).state;
  return isPredictionGoodYield(todayPrediction, notGoodCallback, notValidCallback);
}

function isTodayPredictedBadYield (notGoodCallback = () => {}, notValidCallback = () => {}){
  return !isTodayPredictedGoodYield(notGoodCallback, notValidCallback) && isTodayPredictionValid();
}

function getTimeWithDelta(timeItemName, fn = (delta) => delta){
  const timeItem = time.toZDT(getItemAndValidate(timeItemName));
  return  [timeItem.plusMinutes(fn(Constants.PREDICTIONS.DELTA_SUNRISE_SUNSET_YIELD)), timeItem];
};
function getEarliestYieldTimeToday(){
  return getTimeWithDelta(Constants.PREDICTIONS.WEATHER.TODAY.SUNRISE_ITEM);
}
function getEarliestYieldTimeTomorrow(){
  return getTimeWithDelta(Constants.PREDICTIONS.WEATHER.TOMORROW.SUNRISE_ITEM);
}
function getLatestYieldTimeToday(){
  return getTimeWithDelta(Constants.PREDICTIONS.WEATHER.TODAY.SUNSET_ITEM, (delta)=>delta * -1);
}
function getLatestYieldTimeTomorrow(){
  return getTimeWithDelta(Constants.PREDICTIONS.WEATHER.TOMORROW.SUNSET_ITEM, (delta)=>delta * -1);
}

function getLatestHeatingTimeToday(now = time.toZDT()){
  const latestHeatingPlanItem = getItemAndValidate(Constants.HOME.LATEST_HEATING_PLAN_OF_DAY_ITEM);
  return time.toZDT(latestHeatingPlanItem.state).withDayOfYear(now.dayOfYear()).withYear(now.year())
}

function getWattageW(energyWh, minutes){
  return energyWh / (minutes/60);
}

function getEnergyWh(wattage, minutes){
  return wattage * (minutes/60);
}

function getTimeToDischargeByBaselineWithCushion(){
  const timeToDischarge = getItemAndValidate(Constants.SOLAR.ESS.TTDISCHARGE_BASELINE_ITEM)?.numericState;
  return timeToDischarge - Constants.PREDICTIONS.SUBTRACT_FROM_TTDISCHARGE_BASELINE > 0
    ? timeToDischarge - Constants.PREDICTIONS.SUBTRACT_FROM_TTDISCHARGE_BASELINE 
    : 0;
}

function getApproxDaytimeWattage() {
  return getItemAndValidate(Constants.HOME.AVERAGE_DAILY_WATTAGE_ITEM)?.numericState;
}


function unlockInverter(callback = ()=>{}){
  const passphrase = getItemAndValidate(Constants.SOLAR.INVERTER.UNLOCK.TARGET_UNLOCK_PASSPHRASE_ITEM)?.numericState;
  if(!passphrase){
    throw new Error("Unlock passphrase item is not set to any value. Please set it in the UI or karaf console.");
  }
  logger.info("Using passphrase {} to unlock", passphrase);
  updateItem(Constants.SOLAR.INVERTER.UNLOCK.TARGET_ITEM, passphrase);
  const stateItem = getItemAndValidate(Constants.SOLAR.INVERTER.UNLOCK.LOCK_STATE_ITEM);
  stateItem.sendCommand("REFRESH");

  if(logger) logger.info("Inverter asked to be unlocked.");
  setTimeout(()=>{
    let stateItem = getItemAndValidate(Constants.SOLAR.INVERTER.UNLOCK.LOCK_STATE_ITEM);
    stateItem.sendCommand("REFRESH");
    stateItem = getItemAndValidate(Constants.SOLAR.INVERTER.UNLOCK.LOCK_STATE_ITEM);
    const state = stateItem.numericState;
    if (Constants.SOLAR.INVERTER.UNLOCK.LOCK_STATE_UNLOCKED.includes(state)) {
      if(typeof callback === 'function') {
        callback();
      }
      if(logger) logger.info("Inverter has been unlocked.");
    } else {
      if(logger) logger.info("Inverter is still locked. Probably incorrect password.");
    }
  }, 500);
}

function unlockInverterAndExecute(callback = ()=>{}){
  unlockInverter(callback);
  setTimeout(()=>lockInverter(), Constants.SOLAR.INVERTER.UNLOCK.LOCK_STATE_RESPONSE_INTERVAL);
}

function lockInverter(){
  updateItem(Constants.SOLAR.INVERTER.UNLOCK.TARGET_ITEM, Constants.SOLAR.INVERTER.UNLOCK.TARGET_LOCK_PASSPHRASE);
  const stateItem = getItemAndValidate(Constants.SOLAR.INVERTER.UNLOCK.LOCK_STATE_ITEM);
  setTimeout(()=>stateItem.sendCommand("REFRESH"), 100);
  if(logger) logger.info("Inverter asked to be locked.");
}

function thermostat(current, threshold, signalizator, compare = (current,threshold) => current < threshold){
  if(current == null || threshold == null){
    throw new Error("Current or threshold is not set.");
  }
  if(signalizator == null){
    throw new Error("Signalizer is not set.");
  }

  let currentVal;
  if(typeof current === 'string'){
    currentVal = getItemAndValidate(current).numericState;
  } else if (typeof current === 'number'){
    currentVal = current;
  } else {
    throw new Error("Current is neither a number or a string.");
  }
  
  let thresholdVal;
  if(typeof threshold === 'string'){
    thresholdVal = getItemAndValidate(threshold).numericState;
  }else if(typeof threshold === 'number'){
    thresholdVal = threshold;
  } else {
    throw new Error("Threshold is neither a number or a string.");
  }
  const comparisonRes = compare(currentVal, thresholdVal);
  updateItem(signalizator, comparisonRes);
}



/**
 * @param {boolean} shouldBeKeptAlive indicating that the timeout should be updated 
 * @param {number} duration time to set the timeout duration
 */
function keepAliveModeControl(shouldBeKeptAlive, duration) {
  const timeoutItem = getItemAndValidate(Constants.SOLAR.INVERTER.POWER_CONTROL.CONTROL_TIMEOUT_ITEM);
  if (shouldBeKeptAlive && typeof duration === 'number'){
      timeoutItem.sendCommand(duration);
  }else if(timeoutItem.numericState !== 0){
      timeoutItem.sendCommand(0);
  }
}

function getApproxValueForTimestamp(itemName, timestamp) {  
  const item = getItemAndValidate(itemName);
  return item.history.averageBetween(timestamp.minusMinutes(1), timestamp.plusMinutes(1));
}

/**
* @param {number} targetSOC target SOC when to stop operation. (if charging it is the maximum if discharging it is the minimum)
* @param {number} allowedWattage Positive for charging from grid, negative for discharging to grid 
* @param {boolean} shouldBeControlled boolean indicating that the ESS should be charged/discharged or disabled
*/
function gridChargeDischargeESS(targetSOC, allowedWattage, shouldBeControlled) {
  const powerControlItem = getItemAndValidate(Constants.SOLAR.INVERTER.POWER_CONTROL.ITEM);
  if (allowedWattage != 0
      && shouldBeControlled) {
          powerControlItem.sendCommand(Constants.SOLAR.INVERTER.POWER_CONTROL.MODES.SOC_CONTROL);
          const feedInLimitItem = getItemAndValidate(Constants.SOLAR.INVERTER.POWER_CONTROL.DISCHARGE_POWER_ITEM); 
          feedInLimitItem.sendCommand(allowedWattage);
          const targetSOCItem = getItemAndValidate(Constants.SOLAR.INVERTER.POWER_CONTROL.TARGET_SOC_ITEM); 
          targetSOCItem.sendCommand(targetSOC);
  } else if (powerControlItem.numericState !== 0) {
      powerControlItem.sendCommand(Constants.SOLAR.INVERTER.POWER_CONTROL.MODES.DISABLED);
  }
}

/**
 * @param {item[]} itemArr items array
 * @param {string} groupName desired group name update
 * @param {number} currentValue current value
 * @param {string[]} relevantGroups relevant groups
 * @param {string} metadataKeyName key for relevant metadata which can be either a number or an item which contains the number
 * @param {(curr: number, threshold: number, groupname:string) => any} desiredStateFunction function to apply current value compared to metadata value which gives the desired state for given item 
 */
function updateForGroup(itemArr, groupName, currentValue, relevantGroups,  metadataKeyName, desiredStateFunction = (curr, threshold, groupName) => undefined) {
  if(!relevantGroups.includes(groupName)){
      logger.error("Invalid group name: {}", groupName);
      return;
  }
  itemArr.filter(item => item.groupNames.includes(groupName))
      .forEach(item=>{
          const metadata = item.getMetadata(metadataKeyName)?.value;
          if(!metadata){
              logger.error("Item {} is missing relevant metadata {} but is a descendant of group {}", item.name, metadataKeyName, groupName);
              return;
          }
          let threshold = parseInt(metadata,10);
          if(isNaN(threshold)){
              threshold = getItemAndValidate(metadata)?.numericState;
          }
          var desiredState = desiredStateFunction(currentValue, threshold, groupName);
          if(desiredState !== undefined){
              updateItem(item.name, desiredState);
          }
      });
}

module.exports = {
  thermostat,
  updateForGroup,
  gridChargeDischargeESS,
  keepAliveModeControl,
  unlockInverter,
  lockInverter,
  unlockInverterAndExecute,
  getTimeToDischargeByBaselineWithCushion,
  getEarliestYieldTimeToday,
  getEarliestYieldTimeTomorrow,
  getLatestYieldTimeToday,
  getLatestYieldTimeTomorrow,
  getLatestHeatingTimeToday,
  isTodayPredictionValid,
  isTodayPredictedGoodYield,
  isTodayPredictedBadYield,
  isTomorrowPredictionValid,
  isTomorrowPredictedGoodYield,
  isTomorrowPredictedBadYield,
  getPredictedEODYieldInWh,
  getBESSStatsInWh,
  getWattageW,
  getEnergyWh,
  getApproxValueForTimestamp,
  getApproxDaytimeWattage,
  getItemAndValidate,
  updateItem,
  Constants,
  PossiblePredictionLevels,
};