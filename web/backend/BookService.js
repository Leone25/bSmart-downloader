const { spawn } = require('child_process');
const path = require('path');

/**
 * BookService Class
 * Handles book-related operations like fetching book lists
 */
class BookService {
    constructor() {
        this.indexPath = path.join(__dirname, '../../index.js');
    }

    /**
     * Fetch books from bSmart/digibook24
     * @param {Object} params - Parameters (site, cookie)
     * @returns {Promise<Array>} List of books
     */
    async fetchBooks(params) {
        return new Promise((resolve, reject) => {
            const { site, cookie } = params;

            if (!site || !cookie) {
                return reject(new Error('Site and cookie are required'));
            }

            const args = [
                this.indexPath,
                '--site', site,
                '--cookie', cookie,
                '--listOnly'
            ];

            const child = spawn('node', args);
            let output = '';
            let errorOutput = '';

            child.stdout.on('data', (data) => {
                output += data.toString();
            });

            child.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            child.on('close', (code) => {
                if (code !== 0) {
                    return reject(new Error(errorOutput || 'Failed to fetch books'));
                }

                try {
                    // Parse JSON output from the script
                    const books = JSON.parse(output);
                    resolve(books);
                } catch (e) {
                    reject(new Error('Failed to parse book list: ' + output));
                }
            });
        });
    }

    /**
     * Validate cookie
     * @param {Object} params - Parameters (site, cookie)
     * @returns {Promise<Object>} Validation result with user info
     */
    async validateCookie(params) {
        const { site, cookie } = params;

        if (!site || !cookie) {
            throw new Error('Site and cookie are required');
        }

        try {
            // Try to fetch books - if successful, cookie is valid
            const books = await this.fetchBooks(params);
            return {
                valid: true,
                bookCount: books.length
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }
}

module.exports = BookService;

