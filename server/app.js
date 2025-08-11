import express from "express";
import { createServer } from "http";
import Ytmp3Converter from "./lib/ytmp3-converter.js";

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS middleware for all endpoints
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

const client = new Ytmp3Converter();

// Main download endpoint
app.all('/api/convert', async (req, res) => {
  try {
    const input = req.method === "GET" ? req.query : req.body;
    const params = { ...input };

    if (!params.url) {
      return res.status(400).json({
        error: `Missing required field: url`
      });
    }

    const result = await client.download({
      url: params.url,
      format: params.format || "mp4",
      userIdentifier: params.userIdentifier || null
    });
    
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
    version: "2.0.0",
    description: "Convert YouTube videos to MP3 or MP4 format with direct download URLs",
    endpoints: {
      "/api/convert": {
        methods: ["GET", "POST"],
        description: "Convert YouTube video and get download URL",
        required_params: ["url"],
        optional_params: ["format", "userIdentifier"],
        example: {
          url: "https://youtube.com/watch?v=dQw4w9WgXcQ",
          format: "mp3"
        },
        response: {
          title: "Video Title",
          format: "mp3",
          downloadURL: "https://download-link.com/file.mp3",
          identifier: "conversion_id"
        }
      }
    },
    formats: ["mp3", "mp4"],
    notes: [
      "Video duration must be less than 90 minutes",
      "API waits for conversion to complete before returning response",
      "Response includes direct download URL when ready",
      "No task tracking needed - single request/response"
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

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: "YouTube Converter API",
    version: "1.0.0",
    endpoints: {
      docs: "/api/docs",
      health: "/api/health", 
      convert: "/api/convert"
    }
  });
});

const httpServer = createServer(app);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`[express] YouTube Converter API serving on port ${PORT}`);
  console.log(`[express] Documentation available at http://localhost:${PORT}/api/docs`);
});