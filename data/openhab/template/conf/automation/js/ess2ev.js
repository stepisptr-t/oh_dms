const {Constants, unlockInverterAndExecute, getItemAndValidate, updateItem} = require('jslib');

const logger = log("ESS2EV");

rules.JSRule({
    name: "Allows discharge of battery to the EV",
    description: "Allows discharging the battery to the EV. Caution - this is specific to individual inverter type.",
    triggers: [
      triggers.ItemStateChangeTrigger(Constants.SOLAR.ESS.ESS2EV.USER_SET_ITEM)
    ],
    execute: (event) => {
        unlockInverterAndExecute(()=>{
          const enable = Math.trunc(Constants.SOLAR.ESS.ESS2EV.ENABLED).toString();
          const disable = Math.trunc(Constants.SOLAR.ESS.ESS2EV.DISABLED).toString();
          const finalValue = getItemAndValidate(Constants.SOLAR.ESS.ESS2EV.USER_SET_ITEM).state === "ON" ? enable : disable;
          updateItem(Constants.SOLAR.ESS.ESS2EV.ITEM, finalValue);
        })   
    }
});