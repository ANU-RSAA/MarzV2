FROM ubuntu:20.04
RUN mkdir /code
WORKDIR /code
RUN apt-get update && apt-get install -y curl nginx
RUN cd / && curl https://raw.githubusercontent.com/creationix/nvm/v0.34.0/install.sh | bash
