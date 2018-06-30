#! /bin/bash

# starting Gobble without Docker

### Gobble.js deployment automation ###

sudo apt-get update
curl -sL https://deb.nodesource.com/setup_8.x -o nodesource_setup.sh
sudo bash nodesource_setup.sh
sudo apt-get install nodejs
sudo apt-get install npm

sudo apt-get install build-essential
sudo apt-get install gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget

# define the project directory for Gobble.js
sudo chmod +x ./gobble.js
npm install # install all npm packages (including Puppeteer)

### installing PM2 ###
sudo npm install -g pm2

# run your Express Gobble server
pm2 start ./gobble.js

### install Nginx ###
sudo apt-get install nginx
sudo cp ./nginx/gobble.conf /etc/nginx/sites-available/gobble.conf
sudo ln -s /etc/nginx/sites-available/gobble.conf /etc/nginx/sites-enabled
sudo nginx -t
sudo systemctl restart nginx

# changing firewall options
sudo ufw allow 'Nginx Full'
sudo ufw allow 3000

# last step configuring uwsgi and nginx
sudo systemctl enable nginx
