const { Constants, getItemAndValidate, updateItem} = require('jslib');

const logger = log("HeatPumpTemperatureSigalizator");

rules.JSRule({
  name: "Heat pump temperature and SOC signalizator rule",
  description: "Pool pump demand signalizator based on SOC and max in/outdoor temperature thresholds",
  triggers: [
    triggers.ItemStateChangeTrigger(Constants.HOME.TEMP.CURR_OUTSIDE_ITEM),
    triggers.ItemStateChangeTrigger(Constants.HOME.TEMP.MAX_OUTSIDE_ITEM),
    triggers.ItemStateChangeTrigger(Constants.HOME.TEMP.CURR_ITEM),
    triggers.ItemStateChangeTrigger(Constants.HOME.TEMP.MAX_ITEM),
  ],
  execute: (event) => {
      const outTemperature = getItemAndValidate(Constants.HOME.TEMP.CURR_OUTSIDE_ITEM).numericState;
      const maxOutTemperature = getItemAndValidate(Constants.HOME.TEMP.MAX_OUTSIDE_ITEM).numericState;
      const inTemperature = getItemAndValidate(Constants.HOME.TEMP.CURR_ITEM).numericState;
      const maxInTemperature = getItemAndValidate(Constants.HOME.TEMP.MAX_ITEM).numericState;
      
      const desiredState = outTemperature < maxOutTemperature && inTemperature < maxInTemperature;
      updateItem(Constants.HOME.HEATPUMP.SIG.IN_OUT_TEMPERATURES, desiredState);
}});