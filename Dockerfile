FROM node:16

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
RUN git clone https://github.com/tubist2004/Mqtt2Influx

#COPY Mqtt2Influx/package*.json ./

RUN mv Mqtt2Influx/* .
RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
#COPY Mqtt2Influx/ .

CMD [ "npm", "run", "start" ]