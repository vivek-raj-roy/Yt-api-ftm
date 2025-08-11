import { createServer } from "http";
import Ytmp3Converter from "./lib/ytmp3-converter.js";

export async function registerRoutes(app) {
  const client = new Ytmp3Converter();

  // CORS middleware for API endpoints
  app.use('/api/*', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Main converter endpoint
  app.all('/api/convert', async (req, res) => {
    try {
      const input = req.method === "GET" ? req.query : req.body;
      const action = input.action || "download";
      const params = { ...input };

      let result;
      switch (action) {
        case "download":
          if (!params.url) {
            return res.status(400).json({
              error: `Missing required field: url (required for ${action})`
            });
          }
          result = await client.download({
            url: params.url,
            format: params.format || "mp4",
            userIdentifier: params.userIdentifier || null
          });
          break;
        case "status":
          if (!params.task_id) {
            return res.status(400).json({
              error: `Missing required field: task_id (required for ${action})`
            });
          }
          result = await client.status({
            task_id: params.task_id
          });
          break;
        default:
          return res.status(400).json({
            error: `Invalid action: ${action}. Allowed: download | status`
          });
      }
      return res.status(200).json(result);
    } catch (error) {
      console.error('[API ERROR]', error);
      return res.status(500).json({
        error: `Processing error: ${error.message}`
      });
    }
  });

  // API documentation endpoint
  app.get('/api/docs', (req, res) => {
    res.json({
      name: "YouTube Converter API",
      version: "1.0.0",
      description: "Convert YouTube videos to MP3 or MP4 format",
      endpoints: {
        "/api/convert": {
          methods: ["GET", "POST"],
          actions: {
            download: {
              description: "Start a new conversion task",
              required_params: ["url"],
              optional_params: ["format", "userIdentifier"],
              example: {
                action: "download",
                url: "https://youtube.com/watch?v=dQw4w9WgXcQ",
                format: "mp3"
              }
            },
            status: {
              description: "Check the status of a conversion task",
              required_params: ["task_id"],
              example: {
                action: "status",
                task_id: "encrypted_task_identifier"
              }
            }
          }
        }
      },
      formats: ["mp3", "mp4"],
      notes: [
        "Video duration must be less than 90 minutes",
        "Task IDs are encrypted and contain all necessary conversion information",
        "Conversion is asynchronous - use status endpoint to check progress"
      ]
    });
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "YouTube Converter API"
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}