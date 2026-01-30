import fetch from 'node-fetch';

/**
 * Gets user information from the API
 * @param {string} baseSite - The base site URL
 * @param {Object} headers - Complete headers object including auth_token
 * @returns {Promise<Object>} User information
 */
export async function getUserInfo(baseSite, headers) {
    const response = await fetch(`https://${baseSite}/api/v5/user`, { headers });

    if (response.status != 200) {
        throw new Error('Bad cookie');
    }

    return await response.json();
}

/**
 * Gets the list of books from the API
 * @param {string} baseSite - The base site URL
 * @param {Object} headers - Complete headers object including auth_token
 * @returns {Promise<Array>} Array of books
 */
export async function getBooks(baseSite, headers) {
    const books = await fetch(`https://${baseSite}/api/v6/books?page_thumb_size=medium&per_page=25000`, { headers }).then(res => res.json());

    const preactivations = await fetch(`https://${baseSite}/api/v5/books/preactivations`, { headers }).then(res => res.json());

    preactivations.forEach(preactivation => {
        if (preactivation.no_bsmart === false) {
            books.push(...preactivation.books);
        }
    });

    return books;
}

/**
 * Gets detailed information about a specific book
 * @param {string} baseSite - The base site URL
 * @param {string} bookId - The book ID
 * @param {Object} headers - Complete headers object including auth_token
 * @returns {Promise<Object>} Book information
 */
export async function getBookInfo(baseSite, bookId, headers) {
    const response = await fetch(`https://${baseSite}/api/v6/books/by_book_id/${bookId}`, { headers });

    if (response.status != 200) {
        throw new Error('Invalid book id');
    }

    return await response.json();
}

/**
 * Gets all resources for a book
 * @param {string} baseSite - The base site URL
 * @param {Object} book - The book object
 * @param {Object} headers - Complete headers object including auth_token
 * @returns {Promise<Array>} Array of resources
 */
export async function getBookResources(baseSite, book, headers) {
    let info = [];
    let page = 1;

    while (true) {
        const tempInfo = await fetch(`https://${baseSite}/api/v5/books/${book.id}/${book.current_edition.revision}/resources?per_page=500&page=${page}`, { headers }).then(res => res.json());
        info = info.concat(tempInfo);
        if (tempInfo.length < 500) break;
        page++;
    }

    return info;
}
