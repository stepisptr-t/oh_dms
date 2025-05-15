const {Constants, getItemAndValidate, updateItem, PossiblePredictionLevels} = require('jslib');

const logger = log("SolarForecast");

rules.JSRule({
  name: "Weather and solar irradiation forecast Categorization",
  description: "Every 15 minutes categorizes today's and tomorrow's weather and solar irradiation forecasts",
  triggers: [triggers.GenericCronTrigger("0 /15 * * * *"),
    triggers.ItemStateUpdateTrigger(Constants.PREDICTIONS.___MANUAL_RECALCULATION_ITEM)],
  execute: (event) => {
      const weatherToday = categorizeWeatherToday();
      updateItem(Constants.PREDICTIONS.WEATHER.TODAY.LEVEL_ITEM, Constants.PREDICTIONS.LEVELS[weatherToday]);
      const solarToday = categorizeSolarToday();
      updateItem(Constants.PREDICTIONS.SOLAR.TODAY.LEVEL, Constants.PREDICTIONS.LEVELS[solarToday]);
      const todayValue = getTotalValue(solarToday, solarToday);
      logger.info('Resulting todays prediction is {}', todayValue);
      updateItem(Constants.PREDICTIONS.TOTAL.TODAY.LEVEL, todayValue);

      const weatherTomorrow = categorizeWeatherTomorrow();
      updateItem(Constants.PREDICTIONS.WEATHER.TOMORROW.LEVEL_ITEM, Constants.PREDICTIONS.LEVELS[weatherTomorrow]);
      const solarTomorrow = categorizeSolarTomorrow();
      updateItem(Constants.PREDICTIONS.SOLAR.TOMORROW.LEVEL, Constants.PREDICTIONS.LEVELS[solarTomorrow]);
      const tomorrowValue = getTotalValue(solarTomorrow, weatherTomorrow); 
      logger.info('Resulting tomorrows prediction is {}', tomorrowValue);
      updateItem(Constants.PREDICTIONS.TOTAL.TOMORROW.LEVEL, tomorrowValue);
  }
})

rules.JSRule({
  name: "Updates the historical maximum of solar irradiation predictions aggregates",
  triggers: [triggers.TimeOfDayTrigger('23:59'),
    triggers.ItemStateUpdateTrigger(Constants.PREDICTIONS.___MANUAL_RECALCULATION_ITEM)],
  execute: (event) => {
    const predictionTodayItem = getItemAndValidate(Constants.PREDICTIONS.SOLAR.TODAY.VALUE);

    if(predictionTodayItem.history == null){
        logger.error("Persistence service is not set.");
        return;
    }

    const twoWeeksAgo = time.ZonedDateTime.now().minusDays(14);
    const history = predictionTodayItem.history.getAllStatesSince(twoWeeksAgo);
  
    // group by target date and keep only the latest entry in the day
    const dailyMax = new Map();
    history?.forEach(entry => {
      if (!entry || entry.state === null) return;
      
      // Calculate target date (value timestamp + 1 day)
      const targetDate = entry.timestamp.plusDays(1).toLocalDate().toString();
      const currentEntry = {
        timestamp: entry.timestamp,
        value: parseFloat(entry.state)
      };
      
      // Keep only the latest entry for each target date
      if (!dailyMax.has(targetDate) || 
          currentEntry.timestamp.isAfter(dailyMax.get(targetDate).timestamp)) {
            dailyMax.set(targetDate, currentEntry);
      }
    });
    
    const values = Array.from(dailyMax.values()).map(v => v.value).filter(v => !isNaN(v));
    if (values.length === 0) {
      logger.error("No historical data available");
      return;
    }
    
    const absoluteMax = Math.max(...values);

    updateItem(Constants.PREDICTIONS.SOLAR.HIST_MAX_ITEM, absoluteMax);
  }
});

function getTotalValue(solar, weather){
  return Math.abs(weather - solar) <= 1 ? Constants.PREDICTIONS.LEVELS[solar] : 'INCONCLUSIVE'; 
}

function categorizeSolarTomorrow() {
  return categorizeSolarForecast(Constants.PREDICTIONS.SOLAR.TOMORROW.VALUE);
}

function categorizeSolarToday() {
  return categorizeSolarForecast(Constants.PREDICTIONS.SOLAR.TODAY.VALUE);
}

/**
 * Categorizes solar forecast based on given item into 4 groups using adaptive thresholds of historical data
 * @return {PossiblePredictionLevels} prediction level 
 */
function categorizeSolarForecast(predictionItemName) {

  const currentValue = getItemAndValidate(predictionItemName).numericState;

  const absoluteMax = getItemAndValidate(Constants.PREDICTIONS.SOLAR.HIST_MAX_ITEM).numericState;
  
  const solarThresholds = {
    sunny: 0.7 * absoluteMax,
    partlyCloudy: 0.4 * absoluteMax,
    cloudy: 0.2 * absoluteMax,
  };

  logger.info("Solar max: {}, curent {}", absoluteMax, currentValue);
  logger.info("Solar threshold values: sunny: {}, partlyCloudy {}, cloudy {}", solarThresholds.sunny, solarThresholds.partlyCloudy, solarThresholds.cloudy);

  
  let solarPrediction;
  if (currentValue >= solarThresholds.sunny) {
    solarPrediction = PossiblePredictionLevels.SUNNY;
  } else if (currentValue >= solarThresholds.partlyCloudy) {
    solarPrediction = PossiblePredictionLevels.PARTLY_CLOUDY;
  } else if (currentValue >= solarThresholds.cloudy) {
    solarPrediction = PossiblePredictionLevels.CLOUDY_RAINY;
  } else {
    solarPrediction = PossiblePredictionLevels.STAY_HOME;
  }
   
  logger.info(`Solar categorized: Irradiance potential=${currentValue} Wh/m² → ${Object.getOwnPropertyNames(PossiblePredictionLevels)[solarPrediction]}`);
  return solarPrediction;
}

function categorizeWeatherTomorrow(){
  const cloudiness = getItemAndValidate(Constants.PREDICTIONS.WEATHER.TOMORROW.CLOUDINESS_ITEM)?.numericState || 0;
  const precipProb = getItemAndValidate(Constants.PREDICTIONS.WEATHER.TOMORROW.PRECIPITATION_ITEM)?.numericState || 0;
  const rain = getItemAndValidate(Constants.PREDICTIONS.WEATHER.TOMORROW.RAIN_ITEM)?.numericState || 0;
  const snow = getItemAndValidate(Constants.PREDICTIONS.WEATHER.TOMORROW.SNOW_ITEM)?.numericState || 0;
  const condition = getItemAndValidate(Constants.PREDICTIONS.WEATHER.TOMORROW.CONDITION_ITEM).state.toLowerCase();
  const daylightHours = getDaylightHoursTomorrow();
  return categorizeWeatherForcast(cloudiness, precipProb, rain, snow, condition, daylightHours);
}


function categorizeWeatherToday(){
  const cloudiness = getItemAndValidate(Constants.PREDICTIONS.WEATHER.TODAY.CLOUDINESS_ITEM)?.numericState || 0;
  const precipProb = getItemAndValidate(Constants.PREDICTIONS.WEATHER.TODAY.PRECIPITATION_ITEM)?.numericState || 0;
  const rain = getItemAndValidate(Constants.PREDICTIONS.WEATHER.TODAY.RAIN_ITEM)?.numericState || 0;
  const snow = getItemAndValidate(Constants.PREDICTIONS.WEATHER.TODAY.SNOW_ITEM)?.numericState || 0;
  const condition = getItemAndValidate(Constants.PREDICTIONS.WEATHER.TODAY.CONDITION_ITEM).state.toLowerCase();
  const daylightHours = getDaylightHoursToday();
  return categorizeWeatherForcast(cloudiness, precipProb, rain, snow, condition, daylightHours);
}

function getDaylightHoursTomorrow(){
  return getDaylightHours(Constants.PREDICTIONS.WEATHER.TOMORROW.SUNRISE_ITEM, Constants.PREDICTIONS.WEATHER.TOMORROW.SUNSET_ITEM)
}

function getDaylightHoursToday(){
  return getDaylightHours(Constants.PREDICTIONS.WEATHER.TODAY.SUNRISE_ITEM, Constants.PREDICTIONS.WEATHER.TODAY.SUNSET_ITEM)
}

function getDaylightHours(sunrise, sunset){
  return time.Duration.between(
    time.toZDT(getItemAndValidate(sunrise).state), 
    time.toZDT(getItemAndValidate(sunset).state)
  ).toHours();
}

/**
 * Categorizes tomorrow's weather using OpenWeatherMap predictions
 */
function categorizeWeatherForcast(cloudiness, precipProb, rain, snow, condition, daylightHours) {
  
  // could not find an easier way to deep copy object in JS smh
  // imagine taking this "language" seriously lmfaooo
  const thresholds = JSON.parse(JSON.stringify(Constants.PREDICTIONS.WEATHER.THRESHOLDS));

  if (daylightHours < 8) {
    thresholds.sunny.maxCloudiness += 10;
    thresholds.partlyCloudy.maxCloudiness += 10;
  }
    
  let weatherPrediction;

  // Check extreme conditions first
  if (rain > 16 || snow > 16 || condition.includes("thunderstorm")) {
      weatherPrediction = PossiblePredictionLevels.STAY_HOME;
  } else if (precipProb >= 85 && (rain >= 5 || snow >= 3)) {
      weatherPrediction = PossiblePredictionLevels.STAY_HOME;
  } else if (cloudiness <= thresholds.sunny.maxCloudiness 
      && precipProb <= thresholds.sunny.maxPrecipProb 
      && rain <= thresholds.sunny.maxRain 
      && snow <= thresholds.sunny.maxSnow) {
        weatherPrediction = PossiblePredictionLevels.SUNNY;
  } else if (cloudiness <= thresholds.partlyCloudy.maxCloudiness 
      && precipProb <= thresholds.partlyCloudy.maxPrecipProb 
      && rain <= thresholds.partlyCloudy.maxRain 
      && snow <= thresholds.partlyCloudy.maxSnow) {
        weatherPrediction = PossiblePredictionLevels.PARTLY_CLOUDY;
  } else if (cloudiness <= thresholds.cloudyRainy.maxCloudiness
    || precipProb <= thresholds.cloudyRainy.maxPrecipProb 
    || rain > thresholds.partlyCloudy.maxRain 
    || snow > thresholds.partlyCloudy.maxSnow) {
      weatherPrediction = PossiblePredictionLevels.CLOUDY_RAINY;
  } else {
      weatherPrediction = PossiblePredictionLevels.STAY_HOME;
  }

  // insurance aginst overcast clouds
  if((weatherPrediction !== PossiblePredictionLevels.CLOUDY_RAINY 
      || weatherPrediction !== PossiblePredictionLevels.STAY_HOME) 
    && condition.contains("overcast clouds")) {
      weatherPrediction = PossiblePredictionLevels.CLOUDY_RAINY;
  }

  logger.info(`Weather categorized: Cloudiness=${cloudiness}%, PrecipProb=${precipProb}%, Rain=${rain}mm, Snow=${snow}mm → ${Object.getOwnPropertyNames(PossiblePredictionLevels)[weatherPrediction]}`);
  return weatherPrediction
}

function switchOnSingleItemOf(allItemNames, onIndex){
  allItemNames.forEach((switchItem, index) => updateItem(switchItem,index === onIndex));
}


