#! /bin/bash

#### 도커 다운로드 ####

sudo ufw allow 3000 # expose port 3000

# install Docker on server
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
add-apt-repository \
"deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
apt-get update
apt-get install docker-ce
apt-get install docker-compose

#remove all containers - by wonseok (2017/01/15)
## 도커 이미지가 존재한다면, 모두 지우고 다시 빌드하여 컨테이너 시작할 수 있도록 해줌 ##
## 재실행을 했을 때를 위한 스크립트 ##
 docker rm -f $(docker ps -a -q)
 for f in `docker images | grep -v IMAGE | awk '{split($0,array," ")} {print array[3]}'`
 do
  echo "==> delete image : $f"
  docker rmi $f
done

# create necessary images
# gobble-server과 gobble-nginx 뒤에 붙은 app은 태그이다
docker build --tag server:gobble .
cd nginx
docker build --tag nginx:gobble .
cd ../

# run docker-compose up
docker-compose up -d
