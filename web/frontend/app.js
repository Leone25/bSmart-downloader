/**
 * AppController Class
 * Manages the entire frontend application flow
 */
class AppController {
    constructor() {
        this.currentStep = 1;
        this.platform = 'bsmart';
        this.cookie = '';
        this.books = [];
        this.selectedBooks = new Set();
        this.jobs = new Map();
        this.ws = null;
        
        this.init();
    }

    /**
     * Initialize the application
     */
    init() {
        this.setupEventListeners();
        this.connectWebSocket();
        this.updateNavigation();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Platform selection
        document.querySelectorAll('input[name="platform"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.platform = e.target.value;
                this.updatePlatformInfo();
            });
        });

        // Validate cookie
        document.getElementById('validate-btn').addEventListener('click', () => {
            this.validateCookie();
        });

        // Download button
        document.getElementById('download-btn').addEventListener('click', () => {
            this.startDownloads();
        });

        // Navigation
        document.getElementById('prev-btn').addEventListener('click', () => {
            this.goToStep(this.currentStep - 1);
        });

        document.getElementById('next-btn').addEventListener('click', () => {
            this.goToStep(this.currentStep + 1);
        });
    }

    /**
     * Connect to WebSocket for real-time updates
     */
    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.ws = new WebSocket(wsUrl);

        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'jobs_update') {
                this.updateJobsDisplay(message.data);
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected, reconnecting...');
            setTimeout(() => this.connectWebSocket(), 3000);
        };
    }

    /**
     * Update platform-specific information
     */
    updatePlatformInfo() {
        const urls = {
            bsmart: {
                main: 'my.bsmart.it',
                cookie: 'https://my.bsmart.it'
            },
            digibook24: {
                main: 'my.digibook24.com',
                cookie: 'https://my.digibook24.com'
            }
        };

        const info = urls[this.platform];
        document.getElementById('platform-url').textContent = info.main;
        document.getElementById('platform-cookie-url').textContent = info.cookie;
    }

    /**
     * Navigate to a specific step
     * @param {number} step - Step number
     */
    goToStep(step) {
        if (step < 1 || step > 4) return;

        // Hide all steps
        document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
        
        // Show target step
        document.getElementById(`step${step}`).classList.add('active');
        
        this.currentStep = step;
        this.updateNavigation();

        // Load data if needed
        if (step === 3 && this.books.length === 0) {
            this.loadBooks();
        }
    }

    /**
     * Update navigation buttons state
     */
    updateNavigation() {
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');

        prevBtn.disabled = this.currentStep === 1;
        
        if (this.currentStep === 2) {
            nextBtn.disabled = !this.cookie;
        } else if (this.currentStep === 3) {
            nextBtn.style.display = 'none';
        } else if (this.currentStep === 4) {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
        } else {
            nextBtn.disabled = false;
            nextBtn.style.display = 'inline-block';
            prevBtn.style.display = 'inline-block';
        }
    }

    /**
     * Validate cookie with API
     */
    async validateCookie() {
        const cookieInput = document.getElementById('cookie-input').value.trim();
        const resultDiv = document.getElementById('validation-result');
        const validateBtn = document.getElementById('validate-btn');

        if (!cookieInput) {
            this.showMessage(resultDiv, 'error', 'Inserisci il cookie');
            return;
        }

        validateBtn.disabled = true;
        validateBtn.textContent = 'Validazione...';

        try {
            const response = await fetch('/api/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    site: this.platform,
                    cookie: cookieInput
                })
            });

            const data = await response.json();

            if (data.valid) {
                this.cookie = cookieInput;
                this.showMessage(resultDiv, 'success', '✓ Cookie valido! Clicca "Avanti" per continuare');
                this.updateNavigation();
                
                // Auto-advance after 1 second
                setTimeout(() => this.goToStep(3), 1000);
            } else {
                this.showMessage(resultDiv, 'error', '✗ Cookie non valido: ' + data.error);
            }
        } catch (error) {
            this.showMessage(resultDiv, 'error', '✗ Errore di connessione: ' + error.message);
        } finally {
            validateBtn.disabled = false;
            validateBtn.textContent = 'Valida Cookie';
        }
    }

    /**
     * Load books from API
     */
    async loadBooks() {
        const loadingDiv = document.getElementById('books-loading');
        const booksDiv = document.getElementById('books-list');
        const errorDiv = document.getElementById('books-error');

        loadingDiv.classList.add('show');
        booksDiv.innerHTML = '';
        errorDiv.classList.remove('show');

        try {
            const response = await fetch('/api/books', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    site: this.platform,
                    cookie: this.cookie
                })
            });

            if (!response.ok) {
                throw new Error('Errore nel caricamento dei libri');
            }

            this.books = await response.json();
            
            if (this.books.length === 0) {
                this.showMessage(errorDiv, 'info', 'Nessun libro trovato nella tua libreria');
            } else {
                this.renderBooks();
            }
        } catch (error) {
            this.showMessage(errorDiv, 'error', 'Errore: ' + error.message);
        } finally {
            loadingDiv.classList.remove('show');
        }
    }

    /**
     * Render books list
     */
    renderBooks() {
        const booksDiv = document.getElementById('books-list');
        booksDiv.innerHTML = '';

        this.books.forEach(book => {
            const bookEl = document.createElement('div');
            bookEl.className = 'book-item';
            bookEl.innerHTML = `
                <label>
                    <input type="checkbox" value="${book.id}" class="book-checkbox">
                    <div class="book-title">${book.title}</div>
                    <div class="book-id">ID: ${book.id}</div>
                </label>
            `;

            bookEl.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox') {
                    const checkbox = bookEl.querySelector('input[type="checkbox"]');
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            });

            bookEl.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.selectedBooks.add(book.id);
                    bookEl.classList.add('selected');
                } else {
                    this.selectedBooks.delete(book.id);
                    bookEl.classList.remove('selected');
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
        const downloadBtn = document.getElementById('download-btn');
        downloadBtn.disabled = this.selectedBooks.size === 0;
        downloadBtn.textContent = `📥 Scarica ${this.selectedBooks.size > 0 ? '(' + this.selectedBooks.size + ')' : 'Selezionati'}`;
    }

    /**
     * Start downloads for selected books
     */
    async startDownloads() {
        if (this.selectedBooks.size === 0) return;

        // Move to download step
        this.goToStep(4);

        for (const bookId of this.selectedBooks) {
            try {
                const response = await fetch('/api/download', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        site: this.platform,
                        cookie: this.cookie,
                        bookId: bookId
                    })
                });

                const data = await response.json();
                console.log('Download started:', data);
            } catch (error) {
                console.error('Error starting download:', error);
            }
        }
    }

    /**
     * Update jobs display with real-time data
     * @param {Array} jobs - Array of job objects
     */
    updateJobsDisplay(jobs) {
        const downloadsDiv = document.getElementById('downloads-list');
        
        if (jobs.length === 0) {
            downloadsDiv.innerHTML = '<p class="message info show">Nessun download in corso</p>';
            return;
        }

        // Update or create job elements
        jobs.forEach(job => {
            let jobEl = document.getElementById(`job-${job.id}`);
            
            if (!jobEl) {
                jobEl = this.createJobElement(job);
                downloadsDiv.appendChild(jobEl);
            } else {
                this.updateJobElement(jobEl, job);
            }
        });
    }

    /**
     * Create job element
     * @param {Object} job - Job object
     * @returns {HTMLElement} Job element
     */
    createJobElement(job) {
        const jobEl = document.createElement('div');
        jobEl.id = `job-${job.id}`;
        jobEl.className = 'download-item';
        
        const book = this.books.find(b => b.id == job.bookId);
        const bookTitle = book ? book.title : `Book ID: ${job.bookId}`;
        
        jobEl.innerHTML = `
            <div class="download-header">
                <div class="download-title">${bookTitle}</div>
                <div class="download-status ${job.status}">${this.getStatusText(job.status)}</div>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${job.progress}%"></div>
            </div>
            <div class="progress-text">${job.current || 0} / ${job.total || 0} pagine (${job.progress.toFixed(1)}%)</div>
        `;
        
        return jobEl;
    }

    /**
     * Update job element
     * @param {HTMLElement} jobEl - Job element
     * @param {Object} job - Job object
     */
    updateJobElement(jobEl, job) {
        const statusEl = jobEl.querySelector('.download-status');
        const progressFill = jobEl.querySelector('.progress-fill');
        const progressText = jobEl.querySelector('.progress-text');
        
        statusEl.textContent = this.getStatusText(job.status);
        statusEl.className = `download-status ${job.status}`;
        
        progressFill.style.width = `${job.progress}%`;
        progressText.textContent = `${job.current || 0} / ${job.total || 0} pagine (${job.progress.toFixed(1)}%)`;
    }

    /**
     * Get human-readable status text
     * @param {string} status - Job status
     * @returns {string} Status text
     */
    getStatusText(status) {
        const statusMap = {
            pending: '⏳ In attesa',
            fetching_info: '📖 Recupero informazioni',
            downloading: '⬇️ Download in corso',
            running: '▶️ In esecuzione',
            completed: '✓ Completato',
            failed: '✗ Errore',
            cancelled: '⊗ Annullato'
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
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AppController();
});

