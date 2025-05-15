const {Constants, getItemAndValidate, keepAliveModeControl, gridChargeDischargeESS, updateItem} = require('jslib');

const logger = log("GridChargeDischarge");


rules.JSRule({
    name: "Controls the desired wattage to/from the grid",
    description: "Caution - this is specific to individual inverter type.",
    triggers: [
      triggers.GenericCronTrigger("0 /1 * * * *")
    ],
    execute: () => {
        const minSOC        = getItemAndValidate(Constants.SOLAR.ESS.MIN_USER_RESERVE_SOC_ITEM).numericState;
        const maxSOC        = getItemAndValidate(Constants.SOLAR.ESS.MAX_SOC_ITEM).numericState;
        const currentSOC    = getItemAndValidate(Constants.SOLAR.ESS.CURR_SOC_ITEM).numericState;
        
        const hardACLimit = getItemAndValidate(Constants.SOLAR.INVERTER.HARD_AC_LIMIT_ITEM).numericState;
        const allowedFeedIn = getItemAndValidate(Constants.SOLAR.ALLOWED_FEEDIN_ITEM).numericState;
        const desiredChargeDischargeWattage = getItemAndValidate(Constants.SOLAR.ESS.GRID_CHARGE_DISCHARGE_WATTAGE_ITEM).numericState;

        const allowedDischargeWattage = getItemAndValidate(Constants.SOLAR.ESS.MAX_GRID_DISCHARGE_WATTAGE_ITEM)?.numericState ?? desiredChargeDischargeWattage;
        const allowedGridChargeWattage = getItemAndValidate(Constants.SOLAR.ESS.MAX_GRID_CHARGE_WATTAGE_ITEM)?.numericState ?? -desiredChargeDischargeWattage;

        let dischargeWattage = Math.min(allowedDischargeWattage, desiredChargeDischargeWattage, allowedFeedIn, hardACLimit);
        let chargeWattage = Math.min(allowedGridChargeWattage, -desiredChargeDischargeWattage, hardACLimit);
        
        const shouldBeDischarged =  getItemAndValidate(Constants.AUTOMATION.ESS.CONTROL.DISCHARGE_TO_GRID).state === "ON" 
            // insurance for potentially incorrect usage in grid discharge scenarios
            && currentSOC > minSOC && dischargeWattage >= 0;
        const shouldBeCharged = getItemAndValidate(Constants.AUTOMATION.ESS.CONTROL.CHARGE_FROM_GRID).state === "ON"
            // insurance for potentially incorrect usage in grid discharge scenarios
            && currentSOC < maxSOC && chargeWattage >= 0;

        const controlDesired = (shouldBeCharged || shouldBeDischarged) && !(shouldBeCharged && shouldBeDischarged);

        // desired energy flow of the battery. negative - discharging, positive - charging 
        let desiredEnergyFlow = undefined;
        let targetSOC = undefined;
        if (controlDesired && shouldBeCharged) {
            desiredEnergyFlow = chargeWattage;
            targetSOC = maxSOC;
        } else if (controlDesired && shouldBeDischarged) {
            desiredEnergyFlow = -dischargeWattage;
            targetSOC = minSOC;
        }
        
        keepAliveModeControl(controlDesired, 61);
        
        gridChargeDischargeESS(targetSOC, desiredEnergyFlow, controlDesired);
    }
});
