
// is this the only way to create an enum in js ???
const PossiblePredictionLevels = Object.freeze({
    SUNNY: 0,
    PARTLY_CLOUDY: 1,
    CLOUDY_RAINY: 2,
    STAY_HOME: 3
});


const Constants = {
    PREDICTIONS: {
        DELTA_SUNRISE_SUNSET_YIELD: 90, // some cushion to adjust for the time between sunrise and sunset and PV producing meaningful wattage
        SUBTRACT_FROM_TTDISCHARGE_BASELINE: 90, // minutes to subtract from the time to discharge to allow for some cushion
        DAYS_TO_CHECK_BASELINE: 14,
        BASELINE_APPROX_DELTA_FACTOR: 0.1, // factor used when approximating the baseline load. DO NOT change unless baseline wattage is much lower than expected
        SPOT:{
            INTERVAL_LEN_MINUTES_ITEM: "SpotIntervalLengthMinutes",
            INTERVAL_LEN_MINUTES_DEFAULT_VALUE: 60,
            CURRENT_PRICE: "Spot_price_current_czk",
            CURRENT_LEVEL: "Spot_price_hour_level",
            SIG: {
                DISABLE_FEEDIN: "DisableFeedInSignalizator"
            }
        },
        GOOD_YIELD_LEVELS: ["SUNNY", "PARTLY_CLOUDY"],
        LEVELS: Object.keys(PossiblePredictionLevels),
        TOTAL: {
            TODAY:{
                LEVEL: 'PredictionsToday',
            },
            TOMORROW:{
                LEVEL: 'PredictionsTomorrow',
            }
        },
        SOLAR: {
            THRESHOLDS:(absMax) => {
                return {
                    sunny: 0.7 * absMax,
                    partlyCloudy: 0.5 * absMax,
                    cloudy: 0.3 * absMax,
                }
            },
            HIST_MAX_ITEM: "MovingHistoricalMaximum",
            TODAY:{
                VALUE: 'Predicted_energy_today_value',
                TOTAL: 'Predicted_energy_today_total',
                LEVEL: 'PredictionIrradiationLevelToday',
            },
            TOMORROW:{
                VALUE: 'Predicted_energy_tomorrow_value',
                LEVEL: 'PredictionIrradiationLevelTomorrow',
            }
        },
        WEATHER: {
            THRESHOLDS: {
                sunny: {
                    maxCloudiness: 30,
                    maxPrecipProb: 30,
                    maxRain: 0,
                    maxSnow: 0
                },
                partlyCloudy: {
                    maxCloudiness: 60,
                    maxPrecipProb: 50,
                    maxRain: 3,
                    maxSnow: 1
                },
                cloudyRainy: {
                    maxCloudiness: 80,
                    maxPrecipProb: 75,
                    maxRain: 7,
                    maxSnow: 3
                }
            },
            TODAY:{
                DAY_TEMPERATURE_ITEM: 'WeatherDayTemperature_today',
                LEVEL_ITEM: 'PredictionWeatherLevelToday',
                CLOUDINESS_ITEM: "Weather_cloudiness_today",
                PRECIPITATION_ITEM: "Weather_precipitation_today",
                RAIN_ITEM: "Weather_rain_today",
                SNOW_ITEM: "Weather_snow_today",
                CONDITION_ITEM: "Weather_condition_today",
                SUNRISE_ITEM: "Sunrise_today",
                SUNSET_ITEM: "Sunset_today",
            },
            TOMORROW:{
                DAY_TEMPERATURE_ITEM: 'WeatherDayTemperature_tomorrow',
                LEVEL_ITEM: 'PredictionWeatherLevelTomorrow',
                CLOUDINESS_ITEM: "Weather_cloudiness_tomorrow",
                PRECIPITATION_ITEM: "Weather_precipitation_tomorrow",
                RAIN_ITEM: "Weather_rain_tomorrow",
                SNOW_ITEM: "Weather_snow_tomorrow",
                CONDITION_ITEM: "Weather_condition_tomorrow",
                SUNRISE_ITEM: "Sunrise_tomorrow",
                SUNSET_ITEM: "Sunset_tomorrow",
            }
        },
        ___MANUAL_RECALCULATION_ITEM: "Prediction_manual_recalculation", // used for debugging the rules
    },
    AUTOMATION: {
        DESIRED_IN_OUT_ENERGY: "DesiredInOutEnergy",
        ESS: {
            // Items used to signalize a certain state of the predictions and system
            PREDICTIONS: {
                DISCHARGE_TO_GRID: "PredictiveDischargeToGridSignalizator",
                CHARGE_FROM_GRID: "PredictiveChargeFromGridSignalizator",
            },
            // Items actually coupled with the invertor setting of ESS charge/discharge
            CONTROL: {
                DISCHARGE_TO_GRID: "DischargeToGridSignalizator",
                CHARGE_FROM_GRID: "ChargeFromGridSignalizator"
            },
            SOC_GROUPS: {
                SUFFICIENT: "TriggeredBySufficientSOC",
                INSUFFICIENT: "TriggeredByInsufficientSOC",
                METADATA_KEYNAME: "SOC"
            }
        },
        PROXYGROUP_NAME: "ProxiedSwitches",
        SPOT: {
            LEVEL: {
                CHEAP_GROUP_NAME: "TriggeredByCheapestSpotPriceLevel",
                EXPENSIVE_GROUP_NAME: "TriggeredByExpensiveSpotPriceLevel",
                METADATA_KEYNAME: "spotLevels",
            },
            PRICE: {
                CHEAP_GROUP_NAME: "TriggeredByCheapestSpotPrice",
                EXPENSIVE_GROUP_NAME: "TriggeredByExpensiveSpotPrice",
                METADATA_KEYNAME: "spotPrice",
            }
        },
        // items allowing certain functionalities
        FUNC: {
            ENABLE_PREDICTIVE_ESS_CHARGE_DISCHARGE: "AllowPredictiveESSGridChargeDischarge",
            ENABLE_PREDICTIVE_JIT_HEATING_ITEM: "AllowPredictiveJITHeating"
        }
    },
    SOLAR: {
        ESS: {
            MIN_SOC_ITEM: "Solax_SelfUseMinSOC",
            MIN_USER_RESERVE_SOC_ITEM: "MinESSReserveSOC",
            MAX_SOC_ITEM: "Solax_MaxSOC",
            CURR_SOC_ITEM: "Solax_BatterySOC",
            POWER_ITEM: "Solax_BatteryPowerCharge", // Assumes positive values for charging and negative for discharging
            MAX_CAP_ITEM: "Solax_BatteryCapacity", // in Wh
            ESS2EV: {
                USER_SET_ITEM: "ESS2EVEnabled",
                ITEM: "Solax_BatteryToEVEnabled",
                ENABLED: 0,
                DISABLED: 1,
            },
            MAX_GRID_CHARGE_WATTAGE_ITEM: "MaxGridChargeWattage",
            GRID_CHARGE_DISCHARGE_WATTAGE_ITEM: "GridChargeDischargeWattage",
            MAX_GRID_DISCHARGE_WATTAGE_ITEM: "MaxGridDischargeWattage",
            TTDISCHARGE_BASELINE_ITEM: "TimeToDischargeByBaseline",
            TTDISCHARGE_CURRENT_ITEM: "TimeToDischargeByCurrentLoad",
        },
        USER_SOLAR_PREDICTION_COEFFICIENT: "UserDefinedSolarPredictionCoefficient",
        PANEL_EFFICIENCY_ITEM: "PanelEfficiency",
        PANEL_AREA_ITEM: "PanelArea",
        ENERGY_TODAY_ITEM: "Solax_SolarEnergyToday",
        FEEDIN_FACTORY_LIMIT_ITEM: "Solax_FactoryExportLimit",
        ALLOWED_FEEDIN_ITEM: "Solax_ExportControlUserLimit",
        USER_SET_FEEDIN_ITEM: "StandardFeedin",
        INVERTER: {
            AC_POWER: "Solax_ACPower",
            HARD_AC_LIMIT_ITEM: "Solax_HardACPowerLimit",
            UNLOCK: {
                UNLOCK_USER_ITEM: "Solax_LockSwitch",
                LOCK_STATE_RESPONSE_INTERVAL: 5000, // in ms, used because modbus poller gets updated every once in a while 
                LOCK_STATE_ITEM: "Solax_LockSTATE",
                LOCK_STATE_UNLOCKED: [1, 2],
                TARGET_ITEM: "Solax_Password",
                TARGET_UNLOCK_PASSPHRASE_ITEM: "Solax_UserPassword",
                TARGET_LOCK_PASSPHRASE: 1, // can be anything, but should be different from the unlock passphrase
            },
            POWER_CONTROL: {
                ITEM: "MBPowerControlMode",
                MODES: {
                    DISABLED: 0,
                    POWER_CONTROL: 1,
                    ENERGY_CONTROL: 2, 
                    SOC_CONTROL: 3,
                },
                TARGET_SOC_ITEM: "MBTargetSOC", // IN %
                DISCHARGE_POWER_ITEM: "MBTargetChargeDischargePower", // IN WATTS
                DISCHARGE_POWER_DURATION_ITEM: "MBTargetChargeDischargePowerDuration",
                TARGET_ENERGY_ITEM: "MBTargetEnergy", // IN WATTHOURS
                CONTROL_TIMEOUT_ITEM: "MBRemoteControlTimeout", // IN SECONDS
            }
        }
    },
    EV: {
        SIG: {
            PREDICTION_CHARGING_FROM_ESS_ITEM: "PredictionsDischargeESSToEV",
        }
    },
    HOME: {
        DAY_AGG_CONSUMPTION_ITEM: "gDayConsumption",
        CURRENT_LOAD_ITEM: "gPowerTotal",
        AVERAGE_NIGHT_WATTAGE_ITEM: "AverageNighttimeWattage",
        AVERAGE_DAILY_WATTAGE_ITEM: "AverageDaytimeWattage",
        BASELINE_WATTAGE_ITEM: "HouseBaselineWattage",
        LATEST_HEATING_PLAN_OF_DAY_GROUP: "LatestHeatingPlanGroup",
        LATEST_HEATING_PLAN_OF_DAY_ITEM: "LatestHeatingPlan",
        TEMP: {
            MAX_OUTSIDE_ITEM: "MaxTemperatureOutside",
            MAX_ITEM: "MaxHomeTemperature",
            MIN_ITEM: "MinHomeTemperature",
            CURR_ITEM: "TemperatureLivingroom",
            CURR_OUTSIDE_ITEM: "TemperatureOutside",
            SIG:{
                MIN_TEMP_NOT_REACHED: "InsufficientHomeTemperatureSignalizator",
                
            }
        },
        BOILER: {
            ACT_MIN_TEMP_ITEM: "BoilerMinimalTemperature", // actual MIN temperature
            DES_MIN_TEMP_ITEM: "MinTempProxy", // MIN desired temperature
            MAX_TEMP_ITEM: "BoilerTargetTemperature", // MAX desired temperature
            SIG: {
                MAX_TEMP_NOT_REACHED: "BoilerTargetTemperatureNotReached",
                MIN_TEMP_NOT_REACHED: "BoilerMinimalTempNotReachedSignalizator",
                WEATHER_PREDICTIONS: "BoilerWeatherPredictionsSignalizator",
            },
            TEMPERATURE_PROBE_ITEMS: ["TemperatureBoilerTop3", "TemperatureBoilerTop4", "TemperatureBoilerTop5", "TemperatureBoilerTop6"],
            PROBE_WEIGHTS: [1, 1, 0.97, 0.95], // weights for the temperatures probes. Can be used if they are not evenly spaced out
            HEAT_RATE_DAYS_TO_CHECK: 7, // number of days of historic data to check to determine the heat rate
            HEAT_RATE_ITEM: "BoilerPredictedHeatRate",
            SOC_ITEM: "BoilerSOC",
            TTHEAT_ITEM: "BoilerPredictedTimeToHeat", // time to heat in minutes
            INTAKE_TEMP_ITEM: "BoilerInputTemperature", // temperature at the intake to the heating tank
        },
        HEATPUMP:{
            SIG: {
                IN_OUT_TEMPERATURES: "HeatPumpTemperatureSignalizator",
                WEATHER_PREDICTIONS: "HeatPumpPredictionSignalizator"
            }
        },
        POOL:{
            RELAY_ITEM: "PoolPumpSwitch", // actual relay switch item which controls the pump
            ENABLED: true, // used to disable pool rules if not needed
            MAX_DAILY_RUNTIME_ITEM: "PoolPumpMaxDailyRuntime", // max runtime in minutes
            CURR_DAILY_RUNTIME_ITEM: "PoolPumpRuntimeToday", // automatically updated via rules
            SIG: {
                MAX_DAILY_RUNTIME_NOT_REACHED: "DailyMaxRuntimeNotReached"
            }
        },
        CIRCULATION: {
            SIG: "CirculationThermostat",
            MIN_TEMP_ITEM: "CirculationThresholdTemperature",
            THR_INCREASE_ITEM: "CirculationThresholdIncrease",
            CURR_TEMP_ITEM: "CirculationTemperatureCurrent"
        }
    }
};


  
Object.freeze(Constants);

module.exports = {
    PossiblePredictionLevels,
    Constants
}