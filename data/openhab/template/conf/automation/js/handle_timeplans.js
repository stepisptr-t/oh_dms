var logger = log('TimePlanRule');

const epsilon = 0.01;
const MIN_TEMP_PROXY_NAME = 'minTempProxyItem';
const PLANT_MIN_TEMP = 'plantMinTemp';

rules.JSRule({
    name: "Handle time plans based on item names",
    description: "Switches items on/off based on defined time intervals every minute",
    triggers: [triggers.GenericCronTrigger('0 /1 * * * *')],
    execute: () => {
        logger.debug("Evaluating time plans.");
        const now = new Date();
        const intervals = {};

        items.getItems().forEach(item => {
            try {
                const itemName = item.name;
                if (item.type === 'NumberItem' && item.state) {
                    const match = itemName.match(/^(.*?)(MINTEMP)(.*?)$/);
                    if(match){
                        const [, baseName, type, proxy] = match;
                    
                        logger.debug("found temperature {} with proxy {} for item {}", item.numericState, proxy, baseName)
                        
                        intervals[baseName] = intervals[baseName] ?? {};
                        intervals[baseName][PLANT_MIN_TEMP] = item.numericState;
                        intervals[baseName][MIN_TEMP_PROXY_NAME] = proxy;
                    }
                }
                // Handle Enable switches
                else if (item.type === 'SwitchItem' && itemName.endsWith('ENABLE')) {
                    logger.debug("found enabling item {}", itemName);
                    const baseName = itemName.replace(/ENABLE$/, '');
                    intervals[baseName] = intervals[baseName] ?? {};
                    intervals[baseName].enabled = item.state === 'ON';
                } else if (item.type === 'DateTimeItem' && item.state !== 'NULL') {
                    const match = itemName.match(/^(.*?)(START|END)$/);

                    if (match) {
                        const [, baseName, type] = match;
                        logger.debug("Found schedule time item: {} for base {}", itemName, baseName);
                        
                        intervals[baseName] = intervals[baseName] ?? {};
                        
                        const zdt = time.toZDT(item.state.toString());
                        const localZdt = zdt.withZoneSameInstant(time.ZoneId.systemDefault())
                        
                        const scheduleTime = new Date(now);
                        scheduleTime.setHours(localZdt.hour());
                        scheduleTime.setMinutes(localZdt.minute());
                        scheduleTime.setSeconds(localZdt.second());
                        scheduleTime.setMilliseconds(localZdt.nano() / 1000000);
                        
                        intervals[baseName][type.toLowerCase()] = scheduleTime;
                        logger.debug("Parsed time: {} → {}", itemName, scheduleTime.toLocaleTimeString());
                    }
                }
            } catch(e) {
                logger.error("Error processing {}: {}", item.name, e.message, e.stack);
            }
        });


        // 2. Calculate active plans and temperature requirements
        const tempRequirements = {};
        const activePlans = Object.entries(intervals).filter(([baseName, data]) => {
            if (!data?.enabled) return false;
            
            // Check if within time window
            if (data.start && data.end) {
                const start = new Date(data.start);
                let end = new Date(data.end);
                
                // Handle overnight intervals
                if (end < start) end.setDate(end.getDate() + 1);
                return now >= start && now <= end;
            }
            return false;
        });

        // 3. Process only active plans for temperature
        activePlans.forEach(([baseName, data]) => {            
            const proxyGroup = data[MIN_TEMP_PROXY_NAME];
            const requiredTemp = data[PLANT_MIN_TEMP];
            
            if (proxyGroup && requiredTemp) {
                tempRequirements[proxyGroup] = Math.max(
                    tempRequirements[proxyGroup] ?? -Infinity,
                    requiredTemp
                );
            }
        });

        // 4. Update proxy groups
        Object.entries(tempRequirements).forEach(([groupName, requiredTemp]) => {
            const group = items.getItem(groupName);
            const equalsPervious = Math.abs(group.numericState - requiredTemp) < epsilon;
            if (!equalsPervious) {
                group.sendCommand(requiredTemp);
            }
        });

        activePlans.forEach(([baseName, data]) => {
            const targetItem = items.getItem(baseName);
            if (targetItem?.state !== 'ON') {
                targetItem.sendCommand('ON');
            }
        });

        Object.keys(intervals).forEach(baseName => {
            if (!activePlans.find(([name]) => name === baseName)) {
                const targetItem = items.getItem(baseName);
                if (targetItem?.state === 'ON') {
                    targetItem.sendCommand('OFF');
                }
            }
        });
    }
});