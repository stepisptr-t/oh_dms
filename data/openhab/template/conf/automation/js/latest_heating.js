const {Constants, updateItem} = require('jslib');

const logger = log("LatestHeatingPlan");

rules.JSRule({
    name: "Determines the latest time of heating",
    triggers: [
      triggers.GroupStateUpdateTrigger(Constants.HOME.LATEST_HEATING_PLAN_OF_DAY_GROUP),
      triggers.TimeOfDayTrigger('23:59')
    ],
    execute: (event) => {
        const heatingPlanTimes = items.getItems().filter(it=>it.groupNames.includes(Constants.HOME.LATEST_HEATING_PLAN_OF_DAY_GROUP)).map(it=>time.toZDT(it.state));
        logger.info("heatplan items {}", JSON.stringify(heatingPlanTimes));
        const latestHeatingPlan = heatingPlanTimes.reduce((prev, curr)=>{
            logger.info('prev{}, curr{}',JSON.stringify(prev), JSON.stringify(curr));
            if(!prev || (curr.hour() >= prev.hour() && curr.minute() >= prev.minute())){
                return curr;
            }
            return prev;
        }, null);

        if(latestHeatingPlan){
            updateItem(Constants.HOME.LATEST_HEATING_PLAN_OF_DAY_ITEM, latestHeatingPlan);
        } else {
            logger.error("Latest heating plan of day could not be determined.");
        }
    }
});