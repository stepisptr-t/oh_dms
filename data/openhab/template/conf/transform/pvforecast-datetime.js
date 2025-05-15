(function(response) {
    var log = Java.type("org.slf4j.LoggerFactory").getLogger('pvforecast-datetime');
    const LocalDateTime = Java.type('java.time.LocalDateTime');
    const DateTimeFormatter = Java.type('java.time.format.DateTimeFormatter');
    const ZoneOffset = Java.type('java.time.ZoneOffset')
    
    
    try {
        const jsonData = JSON.parse(response);
        const dateString = jsonData[0][0];

        const localDateTime = LocalDateTime.parse(
            dateString,
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
        );
        // hacky way to store as ISO datetime in openhab
        const result = localDateTime.atOffset(ZoneOffset.UTC).format(DateTimeFormatter.ISO_INSTANT);
        log.debug('time now={}', time.ZonedDateTime.now().toString());
        log.debug('input={}, ldt={}', dateString, localDateTime.toString());
        log.debug('iso={}', result.toString());
        return result;
    } catch(e) {
        log.debug(e.toString());
        // OpenHAB will ignore invalid updates
        return null; 
    }
})(input)