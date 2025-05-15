#!/usr/bin/env bash

SCRIPT_DIR=$(dirname "$(realpath "$0")")
cd $SCRIPT_DIR

# Read .env file
set -a
. ./.env
set +a

# Validate required variables
required_vars="LAT LON PVFORECAST_KEY OPENWEATHER_KEY INVERTER_IP"
missing_vars=""

for var in $required_vars; do
    eval "value=\${$var}"
    [ -z "$value" ] && missing_vars="$missing_vars $var"
done

if [ -n "$missing_vars" ]; then
    echo "ERROR: Missing required variables:$missing_vars"
    exit 1
fi

# Process templates
sed -e "s/<LATITUDE>/$LAT/g" \
    -e "s/<LONGITUDE>/$LON/g" \
    -e "s/<PVF_API_KEY>/$PVFORECAST_KEY/g" \
    -e "s/<OMW_API_KEY>/$OPENWEATHER_KEY/g" \
    ./prediction.things_template > ./prediction.things

sed -e "s/<INVERTER_IP>/$INVERTER_IP/g" \./solar.things_template > ./solar.things

echo "Configuration generated successfully"