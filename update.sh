#!/usr/bin/env bash
# setting current shell directory as the directory of the shell script
parent_path=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )
cd "$parent_path"

sudo rm -rf ./data/openhab/conf/*
sudo cp -r ./data/openhab/template/conf ./data/openhab/
sudo cp .env ./data/openhab/conf/things/

sudo docker exec -it openhab chown -R openhab:openhab /openhab/conf

echo 'Creating thing definition from .env variables'
sudo docker exec -it openhab chmod +x /openhab/conf/things/dep_predictions.sh
sudo docker exec -it openhab /openhab/conf/things/dep_predictions.sh
