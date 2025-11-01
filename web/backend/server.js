const express = require('express');
const cors = require('cors');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');

const DownloadManager = require('./DownloadManager');
const BookService = require('./BookService');

/**
 * WebServer Class
 * Main server application
 */
class WebServer {
    constructor(port = 3000) {
        this.port = port;
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({ server: this.server });
        this.downloadManager = new DownloadManager();
        this.bookService = new BookService();
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
    }

    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, '../frontend')));
        this.app.use('/downloads', express.static('/output'));
    }

    /**
     * Setup API routes
     */
    setupRoutes() {
        // Health check
        this.app.get('/api/health', (req, res) => {
            res.json({ status: 'ok', timestamp: new Date() });
        });

        // Validate cookie
        this.app.post('/api/validate', async (req, res) => {
            try {
                const { site, cookie } = req.body;
                const result = await this.bookService.validateCookie({ site, cookie });
                res.json(result);
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        });

        // Get books
        this.app.post('/api/books', async (req, res) => {
            try {
                const { site, cookie } = req.body;
                const books = await this.bookService.fetchBooks({ site, cookie });
                res.json(books);
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        });

        // Start download
        this.app.post('/api/download', (req, res) => {
            try {
                const { site, cookie, bookId } = req.body;
                
                if (!site || !cookie || !bookId) {
                    return res.status(400).json({ error: 'Missing required parameters' });
                }

                const job = this.downloadManager.createJob({ site, cookie, bookId });
                this.downloadManager.startDownload(job.id, { site, cookie, bookId });
                
                res.json({ jobId: job.id, status: job.status });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Get job status
        this.app.get('/api/jobs/:jobId', (req, res) => {
            const job = this.downloadManager.getJob(req.params.jobId);
            if (!job) {
                return res.status(404).json({ error: 'Job not found' });
            }
            res.json(job);
        });

        // Get all jobs
        this.app.get('/api/jobs', (req, res) => {
            const jobs = this.downloadManager.getAllJobs();
            res.json(jobs);
        });

        // Cancel job
        this.app.post('/api/jobs/:jobId/cancel', (req, res) => {
            const success = this.downloadManager.cancelJob(req.params.jobId);
            if (!success) {
                return res.status(404).json({ error: 'Job not found' });
            }
            res.json({ success: true });
        });

        // Delete job
        this.app.delete('/api/jobs/:jobId', (req, res) => {
            const success = this.downloadManager.deleteJob(req.params.jobId);
            if (!success) {
                return res.status(404).json({ error: 'Job not found' });
            }
            res.json({ success: true });
        });

        // Serve frontend
        this.app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, '../frontend/index.html'));
        });
    }

    /**
     * Setup WebSocket for real-time updates
     */
    setupWebSocket() {
        this.wss.on('connection', (ws) => {
            console.log('WebSocket client connected');

            // Send job updates every second
            const interval = setInterval(() => {
                const jobs = this.downloadManager.getAllJobs();
                ws.send(JSON.stringify({ type: 'jobs_update', data: jobs }));
            }, 1000);

            ws.on('close', () => {
                console.log('WebSocket client disconnected');
                clearInterval(interval);
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                clearInterval(interval);
            });
        });
    }

    /**
     * Start the server
     */
    start() {
        this.server.listen(this.port, () => {
            console.log(`🚀 bSmart Downloader Web UI running on http://localhost:${this.port}`);
        });
    }
}

// Start server
const server = new WebServer(process.env.PORT || 3000);
server.start();

module.exports = WebServer;

