const {Constants, unlockInverter, lockInverter} = require('jslib');

const logger = log("LockUnlockInverter");

rules.JSRule({
    name: "Locks/unlocks inverter",
    description: "Locks/unlocks the inverter using the user defined password item.",
    triggers: [
      triggers.ItemStateChangeTrigger(Constants.SOLAR.INVERTER.UNLOCK.UNLOCK_USER_ITEM),
    ],
    execute: (event) => {
        const state = event.newState === "ON";
        if(state){
            unlockInverter();
        } else {
            lockInverter();
        }
    }
});