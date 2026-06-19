import logger from "./utils/logger.js";

let io = null;

export const setIO = (ioInstance) => {
  io = ioInstance;
};

export const getIO = () => io;

export const emitGameAdded = (game, user) => {
  if (io) {
    io.emit("game:added", { game, user });
    logger.info("[Socket] game:added broadcast sent");
  }
};
