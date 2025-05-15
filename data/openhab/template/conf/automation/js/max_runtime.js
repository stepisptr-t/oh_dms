const {Constants, getItemAndValidate, updateItem} = require('jslib');
const logger = log('MaxRuntime');


if(Constants.HOME.POOL.ENABLED){
    let lastTurnOnTime = undefined;

    require('@runtime').lifecycleTracker.addDisposeHook(() => {
        const currentRuntime = getItemAndValidate(Constants.HOME.POOL.CURR_DAILY_RUNTIME_ITEM)?.numericState;
        if(lastTurnOnTime){
            updateCurrentRuntime(lastTurnOnTime, currentRuntime); 
        }
    });

    rules.JSRule({
    name: "Pool pump runtime calculation and max runtime not exceeded signalizator",
    description: "",
    triggers: [triggers.ItemStateChangeTrigger(Constants.HOME.POOL.MAX_DAILY_RUNTIME_ITEM), 
        triggers.ItemStateChangeTrigger(Constants.HOME.POOL.RELAY_ITEM),
        triggers.GenericCronTrigger('0 /1 * * * *')],
    execute: (event) => {
        const currentRuntime = getItemAndValidate(Constants.HOME.POOL.CURR_DAILY_RUNTIME_ITEM)?.numericState;
        const maxRuntime = getItemAndValidate(Constants.HOME.POOL.MAX_DAILY_RUNTIME_ITEM)?.numericState;
        if(event.itemName === Constants.HOME.POOL.RELAY_ITEM){
            const turnedOn = event.newState === 'ON';
            if(turnedOn){
                lastTurnOnTime = time.toZDT();
            } else if(lastTurnOnTime) {
                lastTurnOnTime = updateCurrentRuntime(lastTurnOnTime, currentRuntime);
            }
        }
       
        let actualCurrentRuntime = currentRuntime
        if(lastTurnOnTime){
            actualCurrentRuntime += time.Duration.between(lastTurnOnTime, time.ZonedDateTime.now()).toMinutes();
        }
        if(actualCurrentRuntime >= maxRuntime){
            updateItem(Constants.HOME.POOL.SIG.MAX_DAILY_RUNTIME_NOT_REACHED, false);
        } else {
            updateItem(Constants.HOME.POOL.SIG.MAX_DAILY_RUNTIME_NOT_REACHED, true);
        }
    }});

    rules.JSRule({
        name: "Pool pump runtime midnight zeriong rule",
        description: "Sets the current daily runtime to zero at midnight.",
        triggers: [triggers.TimeOfDayTrigger('00:00')],
        execute: (event) => {
            updateItem(Constants.HOME.POOL.CURR_DAILY_RUNTIME_ITEM, 0);
        }
    });
}

function updateCurrentRuntime(lastTurnOnTime, currentRuntime) {
    const turnedOffTime = time.toZDT();
    const addToTime = time.Duration.between(lastTurnOnTime, turnedOffTime).toMinutes();
    lastTurnOnTime = undefined;
    updateItem(Constants.HOME.POOL.CURR_DAILY_RUNTIME_ITEM, Math.trunc(currentRuntime + addToTime).toString());
    return lastTurnOnTime;
}
