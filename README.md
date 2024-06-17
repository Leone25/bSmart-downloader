# bSmart-downloader
Download your books from bSmart as offline pdf

**NOW WITH DIGIBOOK24 (EdiErmes) SUPPORT!!!**


## How to use

### Installation
(NOTE: this assumes you already have [node.js](https://nodejs.org/))
1. Download and extract the repo
2. Open a terminal window in the folder where you extracted the repo
3. Run `npm i` to install all the required dependencies

### Usage

1. Open a terminal window in the folder where you extracted the repo
2. Run `node index.js`
3. Select the platform you'd like to download from
4. Open [bSmart](https://my.bsmart.it) or [digibook24](https://my.digibook24.com/) in your browser, then open the dev tools (F12) and go to the storage(Firefox) or application(Chromium) tab, there click on `Cookie`, then `https://my.bsmart.it` (or `https://my.digibook24.com/`), then copy in the terminal the cookie called `_bsw_session_v1_production` (without any quotation marks)
5. Input the id of the book you'd like to download, either from the list or from the url, after `/books/`. It's ususally a 4 digit number
6. Press enter and the script will start working, a file will be saved in the same folder as the one with the `index.js` with the name of the book, containing the full book downloaded.

NOTE: some times this doesn't work flawlessly and/or the script crashes saying that `_this.catalog.Pages is not a function` , I've tryed to fix all the issues I've had but in some cases you might need to do a manual download and merge, for this please download [pdftk](https://www.pdflabs.com/tools/pdftk-the-pdf-toolkit/) and run `node index.js --pdftk`

Further options are available, run `node index.js --help` for more info.

Enjoy

Remember that you are sesponsible for what you are doing on the internet and even tho this script exists it might not be legal in your country to create personal backups of books.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

MIT licence

I may or may not update it depending on my needs tho I'm open to pullup requests ecc.
