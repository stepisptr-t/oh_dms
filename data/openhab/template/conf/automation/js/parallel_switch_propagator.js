const { Constants, updateItem} = require('jslib');
var logger = log('ProxiedSwitchesGroupPropagator');

rules.JSRule({
  name: "Automatic ProxiedSwitches Group State Propagation",
  description: "Automatically controls target switches based on groups in ProxiedSwitches",
  triggers: [
    triggers.GroupStateChangeTrigger(Constants.AUTOMATION.PROXYGROUP_NAME)
  ],
  execute: (event) => {
    try {
      logger.debug("Triggered by item: {}", event.itemName);
      const changedItem = items.getItem(event.itemName);
      // 1. Check if the changed item is itself an OR group in ProxiedSwitches
      
      // 4. Derive target name from OR group name
      const targetName = changedItem.name
        .replace(/Parallel$/i, '')      // Remove "Parallel" suffix
        .replace(/Serial$/i, '')        // Remove "Serial" suffix
        .replace(/(Switch)$/i, '')      // Remove "Switch" if present
        + 'Switch';                     // Standardize suffix

      const targetItem = items.getItem(targetName);
      
      if (!targetItem) {
        logger.warn("Target item {} not found for OR group {}", targetName, changedItem.name);
        return;
      }
      logger.debug("Target item: {} type: {}, groupType: {}, groupNames: {}", targetItem.name, targetItem.type, targetItem.groupType, targetItem.groupNames.join(', '));
      updateItem(targetName, changedItem.state);
    } catch(e) {
      logger.error("Processing error: {}", e.message, e.stack);
    }
  }
});