FROM node:14

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# For Development testing
RUN npm install
# For production builds
# RUN npm ci --only=production

#Bundle app source (excluding things in .dockerignore)
COPY . .

RUN npm run test
