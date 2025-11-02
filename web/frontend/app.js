/**
 * AppController Class
 * Manages the entire frontend application with sidebar navigation
 */
class AppController {
  constructor() {
    this.currentSection = "validate";
    this.platform = "bsmart";
    this.cookie = "";
    this.books = [];
    this.selectedBooks = new Set();
    this.jobs = new Map();
    this.completedFiles = [];
    this.ws = null;

    this.init();
  }

  /**
   * Initialize the application
   */
  init() {
    this.loadStoredCredentials();
    this.setupEventListeners();
    this.connectWebSocket();
    this.updatePlatformInfo();
  }

  /**
   * Load stored credentials from localStorage
   */
  loadStoredCredentials() {
    try {
      const stored = localStorage.getItem("bsmart_credentials");
      if (stored) {
        const credentials = JSON.parse(stored);
        this.platform = credentials.platform || "bsmart";
        this.cookie = credentials.cookie || "";

        // Set platform radio button
        document.querySelector(
          `input[name="platform"][value="${this.platform}"]`
        ).checked = true;

        // Set cookie textarea
        if (this.cookie) {
          document.getElementById("cookie-input").value = this.cookie;
          this.showMessage(
            document.getElementById("validation-result"),
            "info",
            '✓ Credenziali recuperate. Clicca "Valida Cookie" per verificare.'
          );
        }
      }
    } catch (e) {
      console.error("Error loading credentials:", e);
    }
  }

  /**
   * Save credentials to localStorage
   */
  saveCredentials() {
    try {
      const credentials = {
        platform: this.platform,
        cookie: this.cookie,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem("bsmart_credentials", JSON.stringify(credentials));
    } catch (e) {
      console.error("Error saving credentials:", e);
    }
  }

  /**
   * Clear stored credentials
   */
  clearCredentials() {
    try {
      localStorage.removeItem("bsmart_credentials");
      this.cookie = "";
      document.getElementById("cookie-input").value = "";
    } catch (e) {
      console.error("Error clearing credentials:", e);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Sidebar navigation
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        const section = e.currentTarget.dataset.section;
        this.navigateToSection(section);
      });
    });

    // Platform selection
    document.querySelectorAll('input[name="platform"]').forEach((radio) => {
      radio.addEventListener("change", (e) => {
        this.platform = e.target.value;
        this.updatePlatformInfo();
      });
    });

    // Validate cookie
    document.getElementById("validate-btn").addEventListener("click", () => {
      this.validateCookie();
    });

    // Book search
    document.getElementById("book-search").addEventListener("input", (e) => {
      this.filterBooks(e.target.value);
    });

    // Download selected
    document
      .getElementById("download-selected-btn")
      .addEventListener("click", () => {
        this.startDownloads();
      });

    // Refresh completed
    document
      .getElementById("refresh-completed-btn")
      .addEventListener("click", () => {
        this.loadCompletedFiles();
      });
  }

  /**
   * Connect to WebSocket for real-time updates
   */
  connectWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}`;

    const statusIndicator = document.getElementById("ws-status");
    const statusText = document.getElementById("ws-status-text");

    statusIndicator.className = "status-indicator connecting";
    statusText.textContent = "Connessione...";

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      statusIndicator.className = "status-indicator connected";
      statusText.textContent = "Connesso";
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "jobs_update") {
        this.updateJobsDisplay(message.data);
      }
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      statusIndicator.className = "status-indicator disconnected";
      statusText.textContent = "Errore";
    };

    this.ws.onclose = () => {
      statusIndicator.className = "status-indicator disconnected";
      statusText.textContent = "Disconnesso";
      setTimeout(() => this.connectWebSocket(), 3000);
    };
  }

  /**
   * Navigate to a section
   * @param {string} section - Section name
   */
  navigateToSection(section) {
    // Check if we need to load books first
    if (section === "books" && !this.cookie) {
      this.showMessage(
        document.getElementById("validation-result"),
        "error",
        "⚠️ Devi prima validare il cookie!"
      );
      return;
    }

    // Update navigation
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.remove("active");
    });
    document
      .querySelector(`[data-section="${section}"]`)
      .classList.add("active");

    // Update sections
    document.querySelectorAll(".content-section").forEach((s) => {
      s.classList.remove("active");
    });
    document.getElementById(`${section}-section`).classList.add("active");

    // Update header
    const titles = {
      validate: {
        title: "Validazione Cookie",
        subtitle: "Inserisci le credenziali per iniziare",
      },
      books: {
        title: "I Tuoi Libri",
        subtitle: "Seleziona i libri da scaricare",
      },
      downloads: {
        title: "Download in Corso",
        subtitle: "Monitora i download attivi",
      },
      completed: {
        title: "Libri Completati",
        subtitle: "I tuoi libri scaricati",
      },
    };

    document.getElementById("section-title").textContent =
      titles[section].title;
    document.getElementById("section-subtitle").textContent =
      titles[section].subtitle;

    this.currentSection = section;

    // Load data if needed
    if (section === "books" && this.books.length === 0) {
      this.loadBooks();
    } else if (section === "completed") {
      this.loadCompletedFiles();
    }
  }

  /**
   * Update platform-specific information
   */
  updatePlatformInfo() {
    const urls = {
      bsmart: {
        main: "my.bsmart.it",
        cookie: "https://my.bsmart.it",
      },
      digibook24: {
        main: "my.digibook24.com",
        cookie: "https://my.digibook24.com",
      },
    };

    const info = urls[this.platform];
    document.getElementById("platform-url").textContent = info.main;
    document.getElementById("platform-cookie-url").textContent = info.cookie;
  }

  /**
   * Validate cookie with API
   */
  async validateCookie() {
    const cookieInput = document.getElementById("cookie-input").value.trim();
    const resultDiv = document.getElementById("validation-result");
    const validateBtn = document.getElementById("validate-btn");

    if (!cookieInput) {
      this.showMessage(resultDiv, "error", "⚠️ Inserisci il cookie");
      return;
    }

    validateBtn.disabled = true;
    validateBtn.innerHTML =
      '<span class="btn-icon spinner-small"></span> Validazione...';

    try {
      const response = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site: this.platform,
          cookie: cookieInput,
        }),
      });

      const data = await response.json();

      if (data.valid) {
        this.cookie = cookieInput;
        this.saveCredentials(); // Save to localStorage
        this.showMessage(
          resultDiv,
          "success",
          `✓ Cookie valido! Trovati ${data.bookCount} libri. Vai alla sezione "Libri" per continuare.`
        );

        // Update books badge
        document.getElementById("books-badge").textContent = data.bookCount;

        // Auto-navigate after 1.5 seconds
        setTimeout(() => this.navigateToSection("books"), 1500);
      } else {
        this.clearCredentials(); // Clear invalid credentials
        this.showMessage(
          resultDiv,
          "error",
          "✗ Cookie non valido: " + (data.error || "Errore sconosciuto")
        );
      }
    } catch (error) {
      this.showMessage(
        resultDiv,
        "error",
        "✗ Errore di connessione: " + error.message
      );
    } finally {
      validateBtn.disabled = false;
      validateBtn.innerHTML = '<span class="btn-icon">🔓</span> Valida Cookie';
    }
  }

  /**
   * Load books from API
   */
  async loadBooks() {
    const loadingDiv = document.getElementById("books-loading");
    const booksDiv = document.getElementById("books-list");
    const errorDiv = document.getElementById("books-error");
    const searchInput = document.getElementById("book-search");

    loadingDiv.classList.add("show");
    booksDiv.innerHTML = "";
    errorDiv.classList.remove("show");
    searchInput.disabled = true;

    try {
      const response = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site: this.platform,
          cookie: this.cookie,
        }),
      });

      if (!response.ok) {
        throw new Error("Errore nel caricamento dei libri");
      }

      this.books = await response.json();

      if (this.books.length === 0) {
        this.showMessage(
          errorDiv,
          "info",
          "Nessun libro trovato nella tua libreria"
        );
      } else {
        this.renderBooks(this.books);
        searchInput.disabled = false;
      }
    } catch (error) {
      this.showMessage(errorDiv, "error", "Errore: " + error.message);
    } finally {
      loadingDiv.classList.remove("show");
    }
  }

  /**
   * Filter books by search term
   * @param {string} searchTerm - Search term
   */
  filterBooks(searchTerm) {
    const term = searchTerm.toLowerCase().trim();

    if (!term) {
      this.renderBooks(this.books);
      return;
    }

    const filtered = this.books.filter(
      (book) =>
        book.title.toLowerCase().includes(term) ||
        book.id.toString().includes(term)
    );

    this.renderBooks(filtered);
  }

  /**
   * Render books list
   * @param {Array} books - Books to render
   */
  renderBooks(books) {
    const booksDiv = document.getElementById("books-list");
    booksDiv.innerHTML = "";

    if (books.length === 0) {
      booksDiv.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">🔍</span>
                    <p>Nessun libro trovato</p>
                </div>
            `;
      return;
    }

    books.forEach((book) => {
      const isSelected = this.selectedBooks.has(book.id);
      const bookEl = document.createElement("div");
      bookEl.className = "book-item" + (isSelected ? " selected" : "");
      bookEl.innerHTML = `
                <input type="checkbox" value="${
                  book.id
                }" class="book-checkbox" ${isSelected ? "checked" : ""}>
                <div class="book-content">
                    <div class="book-icon">📖</div>
                    <div class="book-info">
                        <div class="book-title">${this.escapeHtml(
                          book.title
                        )}</div>
                        <div class="book-id">ID: ${book.id}</div>
                    </div>
                </div>
            `;

      bookEl.addEventListener("click", (e) => {
        if (e.target.type !== "checkbox") {
          const checkbox = bookEl.querySelector('input[type="checkbox"]');
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event("change"));
        }
      });

      bookEl
        .querySelector('input[type="checkbox"]')
        .addEventListener("change", (e) => {
          e.stopPropagation();
          if (e.target.checked) {
            this.selectedBooks.add(book.id);
            bookEl.classList.add("selected");
          } else {
            this.selectedBooks.delete(book.id);
            bookEl.classList.remove("selected");
          }
          this.updateDownloadButton();
        });

      booksDiv.appendChild(bookEl);
    });
  }

  /**
   * Update download button state
   */
  updateDownloadButton() {
    const downloadBtn = document.getElementById("download-selected-btn");
    const btnText = document.getElementById("download-btn-text");

    downloadBtn.disabled = this.selectedBooks.size === 0;

    if (this.selectedBooks.size > 0) {
      btnText.textContent = `Scarica ${this.selectedBooks.size} ${
        this.selectedBooks.size === 1 ? "Libro" : "Libri"
      }`;
    } else {
      btnText.textContent = "Scarica Selezionati";
    }
  }

  /**
   * Start downloads for selected books
   */
  async startDownloads() {
    if (this.selectedBooks.size === 0) return;

    // Navigate to downloads section
    this.navigateToSection("downloads");

    for (const bookId of this.selectedBooks) {
      try {
        const book = this.books.find((b) => b.id == bookId);
        const response = await fetch("/api/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            site: this.platform,
            cookie: this.cookie,
            bookId: bookId,
            bookTitle: book ? book.title : `Book ${bookId}`,
          }),
        });

        const data = await response.json();
        console.log("Download started:", data);
      } catch (error) {
        console.error("Error starting download:", error);
      }
    }

    // Clear selection
    this.selectedBooks.clear();
    this.updateDownloadButton();

    // Update books display
    document.querySelectorAll(".book-item").forEach((el) => {
      el.classList.remove("selected");
      const checkbox = el.querySelector('input[type="checkbox"]');
      if (checkbox) checkbox.checked = false;
    });
  }

   /**
    * Update jobs display with real-time data
    * @param {Array} jobs - Array of job objects
    */
   updateJobsDisplay(jobs) {
     console.log("[App] Jobs update received:", jobs);

     const activeJobs = jobs.filter(
       (j) =>
         j.status === "running" ||
         j.status === "pending" ||
         j.status === "fetching_info" ||
         j.status === "downloading" ||
         j.status === "failed"  // Mostra anche i job falliti!
     );

     const completedJobs = jobs.filter((j) => j.status === "completed");

     console.log(`[App] Active jobs: ${activeJobs.length}, Completed: ${completedJobs.length}`);

     // Update badges
     document.getElementById("downloads-badge").textContent =
       activeJobs.length || "";
     document.getElementById("completed-badge").textContent =
       completedJobs.length || "";

     // Update active downloads
     const activeDiv = document.getElementById("active-downloads");

     if (activeJobs.length === 0) {
       activeDiv.innerHTML = `
                 <div class="empty-state">
                     <span class="empty-icon">⬇️</span>
                     <p>Nessun download in corso</p>
                     <small>Seleziona dei libri dalla sezione "Libri" per iniziare</small>
                 </div>
             `;
     } else {
       activeDiv.innerHTML = "";
       activeJobs.forEach((job) => {
         console.log(`[App] Rendering job ${job.id} with status ${job.status}`);
         let jobEl = document.getElementById(`job-${job.id}`);

         if (!jobEl) {
           jobEl = this.createJobElement(job);
           activeDiv.appendChild(jobEl);
         } else {
           this.updateJobElement(jobEl, job);
         }
       });
     }
   }

  /**
   * Create job element
   * @param {Object} job - Job object
   * @returns {HTMLElement} Job element
   */
  createJobElement(job) {
    const jobEl = document.createElement("div");
    jobEl.id = `job-${job.id}`;
    jobEl.className = "download-item";

    const book = this.books.find((b) => b.id == job.bookId);
    const bookTitle = book ? book.title : `Book ID: ${job.bookId}`;

    const errorHtml = job.error
      ? `<div class="job-error">
                     <strong>❌ Errore:</strong> ${this.escapeHtml(job.error)}
                  </div>`
      : "";

    const showLogs =
      job.output && job.output.length > 0
        ? `<button class="btn-link toggle-logs" data-job-id="${job.id}">
                        📋 Mostra log (${job.output.length} righe)
                     </button>
                     <div class="job-logs" id="logs-${
                       job.id
                     }" style="display: none;">
                        <pre>${this.escapeHtml(
                          job.output.slice(-20).join("")
                        )}</pre>
                     </div>`
        : "";

    jobEl.innerHTML = `
             <div class="download-header">
                 <div class="download-title">
                     <span class="download-icon">📥</span>
                     ${this.escapeHtml(bookTitle)}
                 </div>
                 <div class="download-status ${
                   job.status
                 }">${this.getStatusText(job.status)}</div>
             </div>
             <div class="progress-container">
                 <div class="progress-bar">
                     <div class="progress-fill" style="width: ${
                       job.progress || 0
                     }%"></div>
                 </div>
                 <div class="progress-text">${job.current || 0} / ${
      job.total || 0
    } pagine (${(job.progress || 0).toFixed(1)}%)</div>
             </div>
             ${errorHtml}
             ${showLogs}
         `;

    // Add event listener for toggle logs
    const toggleBtn = jobEl.querySelector(".toggle-logs");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        const logsDiv = document.getElementById(`logs-${job.id}`);
        if (logsDiv.style.display === "none") {
          logsDiv.style.display = "block";
          toggleBtn.textContent = `📋 Nascondi log`;
        } else {
          logsDiv.style.display = "none";
          toggleBtn.textContent = `📋 Mostra log (${job.output.length} righe)`;
        }
      });
    }

    return jobEl;
  }

  /**
   * Update job element
   * @param {HTMLElement} jobEl - Job element
   * @param {Object} job - Job object
   */
  updateJobElement(jobEl, job) {
    const statusEl = jobEl.querySelector(".download-status");
    const progressFill = jobEl.querySelector(".progress-fill");
    const progressText = jobEl.querySelector(".progress-text");

    statusEl.textContent = this.getStatusText(job.status);
    statusEl.className = `download-status ${job.status}`;

    progressFill.style.width = `${job.progress || 0}%`;
    progressText.textContent = `${job.current || 0} / ${
      job.total || 0
    } pagine (${(job.progress || 0).toFixed(1)}%)`;

    // Update or add error message
    let errorDiv = jobEl.querySelector(".job-error");
    if (job.error && !errorDiv) {
      const progressContainer = jobEl.querySelector(".progress-container");
      errorDiv = document.createElement("div");
      errorDiv.className = "job-error";
      errorDiv.innerHTML = `<strong>❌ Errore:</strong> ${this.escapeHtml(
        job.error
      )}`;
      progressContainer.after(errorDiv);
    } else if (job.error && errorDiv) {
      errorDiv.innerHTML = `<strong>❌ Errore:</strong> ${this.escapeHtml(
        job.error
      )}`;
    }

    // Update logs if present
    const logsDiv = document.getElementById(`logs-${job.id}`);
    if (logsDiv && job.output && job.output.length > 0) {
      logsDiv.querySelector("pre").textContent = job.output.slice(-20).join("");
      const toggleBtn = jobEl.querySelector(".toggle-logs");
      if (toggleBtn && logsDiv.style.display === "none") {
        toggleBtn.textContent = `📋 Mostra log (${job.output.length} righe)`;
      }
    }
  }

  /**
   * Load completed files
   */
  async loadCompletedFiles() {
    const completedDiv = document.getElementById("completed-downloads");

    try {
      const response = await fetch("/api/downloaded");
      const files = await response.json();

      if (files.length === 0) {
        completedDiv.innerHTML = `
                    <div class="empty-state">
                        <span class="empty-icon">📚</span>
                        <p>Nessun libro scaricato</p>
                        <small>I libri completati appariranno qui</small>
                    </div>
                `;
      } else {
        completedDiv.innerHTML = "";
        files.forEach((file) => {
          const fileEl = this.createCompletedFileElement(file);
          completedDiv.appendChild(fileEl);
        });
      }
    } catch (error) {
      console.error("Error loading completed files:", error);
      completedDiv.innerHTML = `
                <div class="message error show">
                    Errore nel caricamento dei file: ${error.message}
                </div>
            `;
    }
  }

  /**
   * Create completed file element
   * @param {Object} file - File object
   * @returns {HTMLElement} File element
   */
  createCompletedFileElement(file) {
    const fileEl = document.createElement("div");
    fileEl.className = "completed-item";

    const date = new Date(file.date);
    const dateStr = date.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const sizeStr = this.formatFileSize(file.size);

    fileEl.innerHTML = `
            <div class="completed-icon">✅</div>
            <div class="completed-info">
                <div class="completed-name">${this.escapeHtml(file.name)}</div>
                <div class="completed-meta">
                    <span>📊 ${sizeStr}</span>
                    <span>📅 ${dateStr}</span>
                </div>
            </div>
            <div class="completed-actions">
                <a href="${
                  file.url
                }" download class="btn btn-primary btn-small">
                    <span class="btn-icon">💾</span>
                    Scarica
                </a>
            </div>
        `;

    return fileEl;
  }

  /**
   * Format file size
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted size
   */
  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    if (bytes < 1024 * 1024 * 1024)
      return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  }

  /**
   * Get human-readable status text
   * @param {string} status - Job status
   * @returns {string} Status text
   */
  getStatusText(status) {
    const statusMap = {
      pending: "⏳ In attesa",
      fetching_info: "📖 Recupero info",
      downloading: "⬇️ Download",
      running: "▶️ In corso",
      completed: "✓ Completato",
      failed: "✗ Errore",
      cancelled: "⊗ Annullato",
    };
    return statusMap[status] || status;
  }

  /**
   * Show message in a container
   * @param {HTMLElement} container - Container element
   * @param {string} type - Message type (success, error, info)
   * @param {string} text - Message text
   */
  showMessage(container, type, text) {
    container.textContent = text;
    container.className = `message ${type} show`;
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new AppController();
});
