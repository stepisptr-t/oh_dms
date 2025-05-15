const {Constants, getItemAndValidate, updateItem} = require('jslib');

const triggeringNames = [Constants.HOME.CIRCULATION.MIN_TEMP_ITEM, Constants.HOME.CIRCULATION.CURR_TEMP_ITEM, Constants.HOME.CIRCULATION.THR_INCREASE_ITEM];
const triggerDefs = triggeringNames.map(name => triggers.ItemStateChangeTrigger(name));
const logger = log('CirculationThermostatSignalizator');

let tempWhenBelowTarget = null;

rules.JSRule({
  name: "Circulation thermostat signalizator updating rule",
  description: "Signals possibility to circulate the water circulation.",
  triggers: triggerDefs,
  execute: (event) => {
    const currentTemperature = getItemAndValidate(Constants.HOME.CIRCULATION.CURR_TEMP_ITEM)?.numericState;
    const thresholdIncrease = getItemAndValidate(Constants.HOME.CIRCULATION.THR_INCREASE_ITEM)?.numericState;
    const thresholdTemperature = getItemAndValidate(Constants.HOME.CIRCULATION.MIN_TEMP_ITEM)?.numericState;
    
    var desiredState = "OFF";

    // turns on when below target
    if (currentTemperature < thresholdTemperature) {
        if (tempWhenBelowTarget == null) {
            tempWhenBelowTarget = currentTemperature
        }
        desiredState = "ON";
    }

    // turns off if the temperature rises by the specified threshold value 
    if(tempWhenBelowTarget && currentTemperature >= tempWhenBelowTarget + thresholdIncrease){
        desiredState = "OFF";
        tempWhenBelowTarget = null;
    }

    logger.debug("current temp {}, threshold temp {}, belowTargetTemp {}, thresholdIncrease {}, desired state {}",
        currentTemperature, thresholdTemperature, tempWhenBelowTarget, thresholdIncrease, desiredState
    );

    updateItem(Constants.HOME.CIRCULATION.SIG, desiredState);
}});
