FROM bfosses/node-ffmpeg-docker:9-alpine
LABEL maintainer="bfosses"

COPY src /app

WORKDIR /app

RUN yarn install

ENTRYPOINT [ "yarn", "start" ]