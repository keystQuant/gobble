#! /bin/bash

sudo ufw allow 3000 # expose port 3000

# install Docker on server
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
add-apt-repository \
"deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
apt-get update
apt-get install docker-ce
apt-get install docker-compose

#remove all containers - by wonseok (2017/01/15)
 docker rm -f $(docker ps -a -q)
 for f in `docker images | grep -v IMAGE | awk '{split($0,array," ")} {print array[3]}'`
 do
  echo "==> delete image : $f"
  docker rmi $f
done

# create necessary images
docker build --tag gobble-server:app .
cd nginx
docker build --tag gobble-nginx:app .
cd ../

# run docker-compose up
docker-compose up -d
