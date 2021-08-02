# bSmart-downloader
Download your books from bSmart as offline pdf


## How to use

### Installation
(NOTE: this assumes you already have [node.js](https://nodejs.org/))
1. Download and extract the repo
2. Open a terminal window in the folder where you extracted the repo
3. Run `npm i` to install all the required dependencies

### Usage

1. Open a terminal window in the folder where you extracted the repo
2. Run `node index.js`
3. Input the id of the book you'd like to download, this is located in the url, after `/books/`, and it's ususally a 4 digit number
4. Input the `auth_token`, this can be obtained by using the inspector tools, in the network pannel, filtering by `fetch/XHR`, selecting one of the last request made by the site and looking into the request header section for a header with the same name
5. Press enter and the script will start working, a file will be saved in the same folder as the one with the `index.js` with the name of the book, containing the full book downloaded.

NOTE: some times this doesn't work flawlessly, i've tryed to fix all the issues I've had but in some cases you might need to do a manual download and merge, for this I've left some commented code for the techys.

Enjoy

Remember that you are sesponsible for what you are doing on the internet and even tho this script exists it might not be legal in your country to create personal backups of books.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

MIT licence

I may or may not update it depending on my needs tho I'm open to pullup requests ecc.
