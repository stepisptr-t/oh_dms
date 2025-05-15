const {Constants, updateForGroup, getItemAndValidate} = require('jslib');

logger = log("SOCSignalizator");

rules.JSRule({
    name: "Signalizes \"annotated\" items that their desired SOC is satisfied",
    description: "SOC signalizator based on metadata and group membership.",
    triggers: [
      triggers.ItemStateChangeTrigger(Constants.SOLAR.ESS.CURR_SOC_ITEM),
    ],
    execute: (event) => {
        const currentSOC = getItemAndValidate(Constants.SOLAR.ESS.CURR_SOC_ITEM).numericState;
        const itemArr = items.getItems();
        updateForGroupSOC(itemArr, Constants.AUTOMATION.ESS.SOC_GROUPS.INSUFFICIENT, currentSOC);
        updateForGroupSOC(itemArr, Constants.AUTOMATION.ESS.SOC_GROUPS.SUFFICIENT, currentSOC);
  }});


  function updateForGroupSOC(itemArr, groupName, currentSOC) {
      const relevantGroups = [Constants.AUTOMATION.ESS.SOC_GROUPS.INSUFFICIENT, Constants.AUTOMATION.ESS.SOC_GROUPS.SUFFICIENT];
      const metadataKeyName = Constants.AUTOMATION.ESS.SOC_GROUPS.METADATA_KEYNAME;
      updateForGroup(itemArr, groupName, currentSOC, relevantGroups, metadataKeyName,
          (curr, threshold, groupName) => {
              if(groupName === Constants.AUTOMATION.ESS.SOC_GROUPS.INSUFFICIENT){
                  return curr <= threshold;
              } else if (groupName === Constants.AUTOMATION.ESS.SOC_GROUPS.SUFFICIENT){
                  return curr >= threshold;
              }
          }
      );
  }