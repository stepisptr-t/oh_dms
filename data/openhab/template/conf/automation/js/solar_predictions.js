const {Constants} = require('jslib');

const prediction = 'Predicted_energy_';
const todayIt = prediction+'today_';
const todayItValue = todayIt+'value';
const todayItDate = todayIt + 'date'
const todayItTotal = todayIt + 'total';
const tomorrowIt = prediction+'tomorrow_';
const tomorrowItValue = tomorrowIt + 'value';
const tomorrowItDate = tomorrowIt + 'date'
const tomorrowItTotal = tomorrowIt + 'total';
const panelArea = 'PanelArea';

var logger = log('pvforecast');

const dateEnum = {
    TODAY: 'today',
    TOMORROW: 'tomorrow'
}

const predEnum = {
    VALUE: 'value',
    DATE: 'date',
    TOTAL: 'total'
}

function getItemName(date, pred) {
    return prediction + date + '_' +pred;
}

function getNumericItem(name){
    const item = items.getItem(name);
    return item?.numericState;
}

function getNumericItemEnum(date, pred) {
    const itemName = getItemName(date, pred);
    return getNumericItem(itemName);
}

function assert(condition, message) {
    if (!condition) {
        throw message || "Assertion failed";
    }
}

function getDateValue(date){
    assert(date === dateEnum.TODAY || date === dateEnum.TOMORROW)
    try {
        const dateItemState = items.getItem(getItemName(date, predEnum.DATE)).state;
        logger.debug('date {}',dateItemState);
        const ldt = time.toZDT(dateItemState)
        return ldt;
    } catch (e) {
        logger.debug('Failed to parse date: {}', e.toString());
        return null;
    }
}

function calculateTotal(date, validDate) {
    assert(date === dateEnum.TODAY || date === dateEnum.TOMORROW)
    const panelEfficiencyPct = getNumericItem(Constants.SOLAR.PANEL_EFFICIENCY_ITEM) ?? 20;
    const panelEfficiencyFactor = panelEfficiencyPct / 100;
    const predictionCoefficient = getNumericItem(Constants.SOLAR.USER_SOLAR_PREDICTION_COEFFICIENT) ?? 0.9;
    logger.debug('panelEfficiencyFactor={}', panelEfficiencyFactor);
    logger.debug('date={}, validDate={}', getDateValue(date).toLocalDate().toString(), validDate.toLocalDate().toString())
    if(getDateValue(date).toLocalDate().equals(validDate.toLocalDate())){
        try {
            const value = getNumericItemEnum(date, predEnum.VALUE);
            const area = getNumericItem(Constants.SOLAR.PANEL_AREA_ITEM);
            if (!isNaN(value) && !isNaN(area)) {
                logger.info('value={}, eff {}, area={}', value, panelEfficiencyFactor, area);
                const result = ((value * panelEfficiencyFactor) * area / 1000) * predictionCoefficient;
                logger.debug('updating {} to value {}', date, result)
                items.getItem(getItemName(date, predEnum.TOTAL))
                    .sendCommandIfDifferent(result); 
            } else {
                items.getItem(getItemName(date, predEnum.TOTAL))
                    .sendCommandIfDifferent('NULL');
            }
        } catch(e) {
            logger.debug(e.toString())
        }
    }
}

rules.JSRule({
    name: "Calculate predictions",
    description: "Will calculate predictions of solar energy generation",
    triggers: [
        triggers.ItemStateUpdateTrigger(Constants.SOLAR.PANEL_AREA_ITEM),
        triggers.ItemStateUpdateTrigger(Constants.SOLAR.PANEL_EFFICIENCY_ITEM),
        triggers.ItemStateUpdateTrigger(getItemName(dateEnum.TODAY, predEnum.VALUE)),
        triggers.ItemStateUpdateTrigger(getItemName(dateEnum.TOMORROW, predEnum.VALUE))],
    execute: (event) => {
        const now = time.ZonedDateTime.now();
        if(event.itemName === getItemName(dateEnum.TODAY, predEnum.VALUE)
            || event.itemName === panelArea || event.itemName === Constants.SOLAR.PANEL_EFFICIENCY_ITEM){
            calculateTotal(dateEnum.TODAY, now);
        }
        if(event.itemName === getItemName(dateEnum.TOMORROW, predEnum.VALUE)
            || event.itemName === panelArea || event.itemName === Constants.SOLAR.PANEL_EFFICIENCY_ITEM){
                calculateTotal(dateEnum.TOMORROW, now.plusHours(24))
        }
    }
});