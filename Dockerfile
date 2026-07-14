FROM node:22-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --omit=dev

COPY --chown=node:node . .

# serverData/logs must exist and be writable before the volume is first created,
# so the named volume inherits node ownership instead of root
RUN mkdir -p serverData logs && chown -R node:node serverData logs

USER node

EXPOSE 5001

CMD ["npm", "start"]
