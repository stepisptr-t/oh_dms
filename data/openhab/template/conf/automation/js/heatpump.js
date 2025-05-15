const {thermostat, Constants, getItemAndValidate, updateItem} = require('jslib');

const triggeringNames = [Constants.HOME.TEMP.CURR_ITEM, Constants.HOME.TEMP.MIN_ITEM];
const triggerDefs = triggeringNames.map(name => triggers.ItemStateChangeTrigger(name));
const logger = log('HeatpumpRule');

rules.JSRule({
  name: "Heatpump minimal comfortable temperature signalizator rule",
  description: "Signals possibility to heat up above the comfortable temperature.",
  triggers: triggerDefs,
  execute: (event) => {
    thermostat (
      Constants.HOME.TEMP.CURR_ITEM, 
      Constants.HOME.TEMP.MIN_ITEM,
      Constants.HOME.TEMP.SIG.MIN_TEMP_NOT_REACHED,
      (current, min) => current < min
    )
}});
