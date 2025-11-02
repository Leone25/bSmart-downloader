const { spawn } = require("child_process");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

/**
 * DownloadManager Class
 * Manages download jobs and their lifecycle
 */
class DownloadManager {
  constructor() {
    this.jobs = new Map();
    this.outputDir = process.env.OUTPUT_DIR || "/output";
  }

  /**
   * Create a new download job
   * @param {Object} params - Download parameters
   * @returns {Object} Job information
   */
  createJob(params) {
    const jobId = uuidv4();
    const job = {
      id: jobId,
      status: "pending",
      progress: 0,
      total: 0,
      current: 0,
      bookId: params.bookId,
      site: params.site,
      startTime: new Date(),
      output: [],
      error: null,
    };

    this.jobs.set(jobId, job);
    return job;
  }

  /**
   * Start a download job
   * @param {string} jobId - Job ID
   * @param {Object} params - Download parameters
   */
  startDownload(jobId, params) {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    job.status = "running";
    job.bookTitle = params.bookTitle || `Book ${params.bookId}`;

    const args = [
      path.join(__dirname, "../../index.js"),
      "--site",
      params.site,
      "--cookie",
      params.cookie,
      "--bookId",
      String(params.bookId),
    ];

    console.log(
      `[DownloadManager] Starting download for book ${params.bookId}`
    );
    console.log(`[DownloadManager] Command: node ${args.join(" ")}`);

    const child = spawn("node", args, {
      env: { ...process.env, OUTPUT_DIR: this.outputDir },
    });

    job.process = child;

    child.stdout.on("data", (data) => {
      const output = data.toString();
      console.log(`[Job ${jobId}] stdout:`, output);
      job.output.push(output);
      this._parseProgress(job, output);
    });

    child.stderr.on("data", (data) => {
      const errorMsg = data.toString();
      console.error(`[Job ${jobId}] stderr:`, errorMsg);
      job.output.push(`Error: ${errorMsg}`);
      job.errorOutput = (job.errorOutput || "") + errorMsg;
    });

    child.on("error", (error) => {
      console.error(`[Job ${jobId}] Process error:`, error);
      job.status = "failed";
      job.error = `Process error: ${error.message}`;
    });

    child.on("close", (code) => {
      console.log(`[Job ${jobId}] Process closed with code ${code}`);
      if (code === 0) {
        job.status = "completed";
        job.progress = 100;
      } else {
        job.status = "failed";
        job.error = `Process exited with code ${code}`;
        if (job.errorOutput) {
          job.error += `\n${job.errorOutput}`;
        }
      }
      job.endTime = new Date();
    });

    return job;
  }

   /**
    * Parse progress from output
    * @param {Object} job - Job object
    * @param {string} output - Output string
    * @private
    */
   _parseProgress(job, output) {
     // Parse "Progress 45.67% (123/234)"
     const progressMatch = output.match(
       /Progress\s+([\d.]+)%\s+\((\d+)\/(\d+)\)/
     );
     if (progressMatch) {
       const oldProgress = job.progress;
       job.progress = parseFloat(progressMatch[1]);
       job.current = parseInt(progressMatch[2]);
       job.total = parseInt(progressMatch[3]);
       console.log(`[Job ${job.id}] Progress updated: ${oldProgress}% -> ${job.progress}% (${job.current}/${job.total})`);
     }

     // Parse "Fetching book info"
     if (output.includes("Fetching book info")) {
       console.log(`[Job ${job.id}] Status changed to: fetching_info`);
       job.status = "fetching_info";
     }

     // Parse "Downloading pages"
     if (output.includes("Downloading pages")) {
       console.log(`[Job ${job.id}] Status changed to: downloading`);
       job.status = "downloading";
     }

     // Parse "Done" - SOLO se è proprio alla fine
     if (output.trim() === "Done" || output.includes("Done\n") && job.progress >= 99) {
       console.log(`[Job ${job.id}] Download completed!`);
       job.status = "completed";
       job.progress = 100;
     }
   }

  /**
   * Get job status
   * @param {string} jobId - Job ID
   * @returns {Object} Job information
   */
  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs
   * @returns {Array} Array of jobs
   */
  getAllJobs() {
    return Array.from(this.jobs.values()).map((job) => {
      const { process, ...jobData } = job;
      return jobData;
    });
  }

  /**
   * Cancel a job
   * @param {string} jobId - Job ID
   * @returns {boolean} Success status
   */
  cancelJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    if (job.process) {
      job.process.kill();
    }

    job.status = "cancelled";
    job.endTime = new Date();
    return true;
  }

  /**
   * Delete a job
   * @param {string} jobId - Job ID
   * @returns {boolean} Success status
   */
  deleteJob(jobId) {
    return this.jobs.delete(jobId);
  }
}

module.exports = DownloadManager;
