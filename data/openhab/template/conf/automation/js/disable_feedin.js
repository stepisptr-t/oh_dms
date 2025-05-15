const {Constants, getItemAndValidate, updateItem} = require('jslib');

var logger = log('SpotPriceFeedInRule');

rules.JSRule({
    name: "Inverter feed in disabling rule",
    description: "If the signalizator is on the item gets updated to zero, othervise set to user defined value in item.",
    triggers: [
      triggers.ItemStateChangeTrigger(Constants.PREDICTIONS.SPOT.SIG.DISABLE_FEEDIN),
      triggers.ItemStateChangeTrigger(Constants.SOLAR.USER_SET_FEEDIN_ITEM)
    ],
    execute: (event) => {
        const feedInDisallowed = getItemAndValidate(Constants.PREDICTIONS.SPOT.SIG.DISABLE_FEEDIN).state === "ON";
        const userAllowedFeedIn = getItemAndValidate(Constants.SOLAR.USER_SET_FEEDIN_ITEM).numericState;
        const feedInFactoryLimit = getItemAndValidate(Constants.SOLAR.FEEDIN_FACTORY_LIMIT_ITEM).numericState;
        const resultFeedIn = Math.min(userAllowedFeedIn, feedInFactoryLimit);
        var desiredFeedIn = feedInDisallowed ? 0 : Math.round(resultFeedIn).toString();
        updateItem(Constants.SOLAR.ALLOWED_FEEDIN_ITEM, desiredFeedIn);
        logger.info("Setting allowed feed in to {}.", desiredFeedIn);
    }
  });