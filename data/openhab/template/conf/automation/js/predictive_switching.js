const {Constants, isTodayPredictedGoodYield, getItemAndValidate, updateItem, getEarliestYieldTimeToday} = require('jslib');
const logger = log("NightPredictionsJustInTimeHeating");

rules.JSRule({
    name: "Night heatpump and boiler switching based on predictions",
    description: "Switches on heatpump and boiler just in time before sunrise to maximize utilization from solar photovoltaic based on weather predictions for the next day.",
    triggers: [triggers.GenericCronTrigger('0 /5 4-9 * * *'), // check every 5 minutes between 4:00 and 9:00
        triggers.ItemStateUpdateTrigger("Prediction_manual_recalculation"),
    ],
    switchItemName: Constants.AUTOMATION.FUNC.ENABLE_PREDICTIVE_JIT_HEATING_ITEM,
    execute: (event) => {
        const predictionIsGood = isTodayPredictedGoodYield(()=>{
            logger.info("Prediction is not valid.");
        }, () => {
            logger.info("Todays prediction is not good, setting signalizators to OFF.");
        })

        if(!predictionIsGood){
            updateItem(Constants.HOME.BOILER.SIG.WEATHER_PREDICTIONS, false);
            updateItem(Constants.HOME.HEATPUMP.SIG.WEATHER_PREDICTIONS, false);
            return;
        }

        let boilerDesiredState = false;
        let heatPumpDesiredState = false;

        const now = time.toZDT();
        const [earliestYieldTime, ] = getEarliestYieldTimeToday()
        const isStillNightTime = now.isBefore(earliestYieldTime);
        if (isStillNightTime) {
            const timeToHeatBoiler = getItemAndValidate(Constants.HOME.BOILER.TTHEAT_ITEM).numericState; 
            const minutesUntilYield = time.Duration.between(now, earliestYieldTime).toMinutes();
            boilerDesiredState = minutesUntilYield <= timeToHeatBoiler; 
            logger.info("Calculated time to heat as {} minutes and minutesUntilYield as {} minutes resulting in desired state of boiler {}", timeToHeatBoiler, minutesUntilYield, boilerDesiredState);
        
            // it is not desired to heat up the house if its going to be hot outside anyways
            const dayTemp = getItemAndValidate(Constants.PREDICTIONS.WEATHER.TODAY.DAY_TEMPERATURE_ITEM).numericState;
            const maxOutsideTemp = getItemAndValidate(Constants.HOME.TEMP.MAX_OUTSIDE_ITEM).numericState
            heatPumpDesiredState =  dayTemp <= maxOutsideTemp;
            logger.info("Day temp {}, maxOutsideTemp {}, heatpumpState {}", dayTemp, maxOutsideTemp, heatPumpDesiredState);
        }
        

        // check if the SOC is not below the user set reserve limit
        const limitSOC = getItemAndValidate(Constants.SOLAR.ESS.MIN_SOC_ITEM).numericState;
        const soc = getItemAndValidate(Constants.SOLAR.ESS.CURR_SOC_ITEM).numericState;
        if (soc <= limitSOC) {
            boilerDesiredState = false;
            heatPumpDesiredState = false;
            logger.info("soc limit setting both to false");
        }

        // check if loads are not discharging the ESS too fast too early
        if(getItemAndValidate(Constants.HOME.BOILER.SIG.WEATHER_PREDICTIONS).state === "ON" 
            || getItemAndValidate(Constants.HOME.HEATPUMP.SIG.WEATHER_PREDICTIONS).state === "ON"
            ){
            if (dischargeTooFast()) {
                heatPumpDesiredState = false;
                boilerDesiredState = false;
                logger.info("discharging too fast setting both to false");
            }
        }

        updateItem(Constants.HOME.BOILER.SIG.WEATHER_PREDICTIONS, boilerDesiredState);
        updateItem(Constants.HOME.HEATPUMP.SIG.WEATHER_PREDICTIONS, heatPumpDesiredState);
    }
});

function dischargeTooFast(){
    const [earliestYieldTime, ] = getEarliestYieldTimeToday()
    const timeToDischarge = getItemAndValidate(Constants.SOLAR.ESS.TTDISCHARGE_CURRENT_ITEM).numericState;
    const now = time.toZDT();
    return time.Duration.between(now, now.plusMinutes(timeToDischarge)).toMinutes() < time.Duration.between(now, earliestYieldTime).toMinutes();
}