#!/usr/bin/env bash
# setting current shell directory as the directory of the shell script
parent_path=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )
cd "$parent_path"

sudo docker compose down

sudo rm -rf ./data/db-data/*
sudo rm -rf ./data/openhab/conf/*
sudo rm -rf ./data/openhab/userdata/*
