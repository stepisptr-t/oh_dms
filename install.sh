#!/usr/bin/env bash
# setting current shell directory as the directory of the shell script
parent_path=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )
cd "$parent_path"

sudo docker compose up -d

# this will not be needed once the binding is pushed upstream
echo 'Building the energymanager addon.'
if [ $(ls -la addons | wc -l) -lt 2 ] ; then
    echo 'Please clone the submodules as well with git "submodule update --init --recursive"'
    exit 1
fi

cd addons
git checkout energymanager
mvn spotless:apply clean install -Pj17 -pl :org.openhab.binding.energymanager -Dohc.version=4.3.5 -Dkaraf.version=4.4.7

if [ $? -ne 0 ] ; then  
    echo 'Failed to build the energymanager addon.'
    exit 1
fi 
cd ..
sudo cp -r ./addons/bundles/org.openhab.binding.energymanager/target/org.openhab.binding.energymanager-5.0.0-SNAPSHOT.jar ./data/openhab/addons_jar/org.openhab.binding.energymanager.jar

echo "Installing energy manager addon"
sudo docker exec -t openhab bash -c '/openhab/runtime/bin/client -p habopen -l 0 -- bundle:install file:///openhab/addons_jar/org.openhab.binding.energymanager.jar'
sudo docker exec -t openhab bash -c '/openhab/runtime/bin/client -p habopen -l 0 -- bundle:restart file:///openhab/addons_jar/org.openhab.binding.energymanager.jar'

# assuming that docker compose up -d has been run already and a .env file is defined in the root
echo 'Installing config from template'
sudo cp -r ./data/openhab/template/userdata/jsondb/* ./data/openhab/userdata/jsondb
sudo cp -r ./data/openhab/template/conf/* ./data/openhab/conf
sudo cp .env ./data/openhab/conf/things/

sudo docker exec -it openhab chown -R openhab:openhab /openhab/conf

echo 'Creating thing definition from .env variables'
sudo docker exec -it openhab chmod +x /openhab/conf/things/dep_predictions.sh
sudo docker exec -it openhab /openhab/conf/things/dep_predictions.sh
