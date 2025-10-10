const formatUptime = (uptime) => {
  const days = Math.floor(uptime / (24 * 60 * 60));
  const hours = Math.floor((uptime % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((uptime % (60 * 60)) / 60);
  const seconds = Math.floor(uptime % 60);

  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};

/**
 * Health check rapide pour vérifier si le serveur est en ligne
 * Route: GET /api/server/health
 */
export const getServerHealth = async (req, res) => {
  try {
    res.status(200).json({
      status: "online",
      timestamp: Date.now(),
      ok: true,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      ok: false,
      message: error.message,
    });
  }
};

/**
 * Status détaillé du serveur avec uptime et infos système
 * Route: GET /api/server/status
 */
export const getServerStatus = async (req, res) => {
  try {
    const uptime = process.uptime();
    const status = {
      status: "online",
      uptime: formatUptime(uptime),
      uptimeSeconds: Math.floor(uptime),
      message: "Server is running ...",
      timestamp: Date.now(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: "MB",
      },
    };
    res.status(200).json(status);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving server status" });
  }
};
