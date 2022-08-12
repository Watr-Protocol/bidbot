FROM node:18
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY ["package.json", "yarn-lock.json*", "tsconfig.json","./"]
RUN yarn install && mv node_modules ../
COPY . .
RUN chown -R node /usr/src/*
USER node
CMD ["yarn", "start"]
