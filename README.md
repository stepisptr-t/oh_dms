### openHAB Demand Management System for PV powered homes
This repository works as a template to be used as a starting point to run a self hosted demand management system for your own home.

Currently the implementation is limited to Solax X3 G4 Solar Inverter, because that is the one I could test. Feel free to modify with your own version. 

Before running the instance, explore the configuration located in `data/openhab/template/conf`. Specifically fimiliarize yourself with the contents of the file `home.items` which covers the basic home appliances which the author could test.

The provided `docker-compose.yml` provides two other handy services. PostgreSQL database and MQTT broker. Both of these are widely used in home automation, so I thought of including them for you so you dont have to figure out how to set them up. They are prepared to be used by the openHAB container.

Due to limitations of the openHAB docker container, and the fact that manually installed bindings via the karaf console get unloaded at shutdown, it is needed to run the `install.sh` script after the startup of the container. This is a work in progress, and is planned to be fixed once I defend the thesis and finish the exams.

If you want to edit the configuration files located in `data/openhab/template/conf`, please do so. Use the provided `update.sh` to push the configuration into the docker container. The script asks for sudo. This is because the container takes ownership of the shared folders and we need to override it to copy the new configuration there.

This was created as a part of my bachelor thesis at the CTU in Prague.