FROM node:25-alpine

WORKDIR /the/app/server

COPY package* .

RUN npm install 

COPY . .

RUN npx prisma generate 

EXPOSE 3000

CMD [ "npm", "run", "dev" ]
