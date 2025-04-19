const formatUptime = (uptime) => {
  const days = Math.floor(uptime / (24 * 60 * 60));
  const hours = Math.floor((uptime % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((uptime % (60 * 60)) / 60);
  const seconds = Math.floor(uptime % 60);

  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};

export const getServerStatus = async (req, res) => {
  try {
    const uptime = process.uptime();
    const status = {
      uptime: formatUptime(uptime),
      message: "Server is running ...",
    };
    res.status(200).json(status);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving server status" });
  }
};
