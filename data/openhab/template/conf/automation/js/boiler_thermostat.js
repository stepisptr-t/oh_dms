const {thermostat, Constants} = require("jslib");

const logger = log('BoilerThermostatSignalizator');

const triggeringNames = [Constants.HOME.BOILER.ACT_MIN_TEMP_ITEM, Constants.HOME.BOILER.MAX_TEMP_ITEM];
const triggerDefs = triggeringNames.map(name => triggers.ItemStateChangeTrigger(name));
rules.JSRule({
  name: "Boiler thermostat signalizator updating rule",
  description: "Signals possibility to heat the boiler.",
  triggers: triggerDefs,
  execute: (event) => {
    thermostat(
      Constants.HOME.BOILER.ACT_MIN_TEMP_ITEM,
      Constants.HOME.BOILER.MAX_TEMP_ITEM,
      Constants.HOME.BOILER.SIG.MAX_TEMP_NOT_REACHED,
      (act, max) => act < max
    )
}});

const triggeringNames2 = [Constants.HOME.BOILER.DES_MIN_TEMP_ITEM, Constants.HOME.BOILER.ACT_MIN_TEMP_ITEM];
const triggerDefs2 = triggeringNames2.map(name => triggers.ItemStateChangeTrigger(name)).concat([triggers.GenericCronTrigger('0 /1 * * * *')]);
rules.JSRule({
    name: "Boiler minimal heating signalizator",
    description: "Signals that minimal desired temperature of the boiler has not been reached.",
    triggers: triggerDefs2,
    execute: (event) => {
      thermostat(
        Constants.HOME.BOILER.ACT_MIN_TEMP_ITEM,
        Constants.HOME.BOILER.DES_MIN_TEMP_ITEM,
        Constants.HOME.BOILER.SIG.MIN_TEMP_NOT_REACHED,
        (act, max) => {
          return act < max
        }
      )
  }});