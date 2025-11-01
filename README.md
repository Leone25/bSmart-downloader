# bSmart-downloader

Download your books from bSmart as offline pdf

**NOW WITH DIGIBOOK24 (EdiErmes) SUPPORT!!!**

## How to use

### 🌐 Web UI (Recommended - Easy & Visual)

The easiest way! Modern web interface with guided steps and real-time progress.

**Prerequisites**: [Docker](https://www.docker.com/get-started) and Docker Compose installed.

1. Download and extract the repo
2. Open a terminal in the project folder
3. Start the Web UI:
   ```bash
   docker-compose up -d web
   ```
4. Open your browser at **http://localhost:3001**
5. Follow the guided interface to download your books!

Downloaded PDFs will be in the `downloads/` folder.

To stop: `docker-compose down`

---

### 💻 Command Line (Node.js)

**Prerequisites**: [Node.js](https://nodejs.org/) installed.

#### Installation

1. Download and extract the repo
2. Open a terminal window in the folder where you extracted the repo
3. Run `npm i` to install all the required dependencies

#### Usage

1. Open a terminal window in the folder where you extracted the repo
2. Run `node index.js`
3. Select the platform you'd like to download from
4. Open [bSmart](https://my.bsmart.it) or [digibook24](https://my.digibook24.com/) in your browser, then open the dev tools (F12) and go to the storage(Firefox) or application(Chromium) tab, there click on `Cookie`, then `https://my.bsmart.it` (or `https://my.digibook24.com/`), then copy in the terminal the cookie called `_bsw_session_v1_production` (without any quotation marks)
5. Input the id of the book you'd like to download, either from the list or from the url, after `/books/`. It's ususally a 4 digit number
6. Press enter and the script will start working, a file will be saved in the same folder as the one with the `index.js` with the name of the book, containing the full book downloaded.

NOTE: some times this doesn't work flawlessly and/or the script crashes saying that `_this.catalog.Pages is not a function` , I've tryed to fix all the issues I've had but in some cases you might need to do a manual download and merge, for this please download [pdftk](https://www.pdflabs.com/tools/pdftk-the-pdf-toolkit/) and run `node index.js --pdftk`

Further options are available, run `node index.js --help` for more info.

---

### 🐳 Docker CLI (Alternative)

Use Docker without the Web UI (interactive terminal mode):

1. Build: `docker-compose build`
2. Run: `docker-compose --profile cli run --rm bsmart-downloader`
3. Follow the prompts

Or with CLI arguments:
```bash
docker-compose --profile cli run --rm bsmart-downloader --site bsmart --cookie "YOUR_COOKIE" --bookId 1234
```

Help: `docker-compose --profile cli run --rm bsmart-downloader --help`

---

## 📖 Getting the Cookie

For all methods, you need the session cookie from bSmart/digibook24:

1. Open [my.bsmart.it](https://my.bsmart.it) or [my.digibook24.com](https://my.digibook24.com)
2. Login to your account
3. Press **F12** to open Developer Tools
4. Go to **Application** (Chrome) or **Storage** (Firefox) tab
5. Click **Cookies** → Select the website
6. Find `_bsw_session_v1_production`
7. Copy the **Value** (long string)

Enjoy!

Remember that you are responsible for what you are doing on the internet and even tho this script exists it might not be legal in your country to create personal backups of books.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

MIT licence

I may or may not update it depending on my needs tho I'm open to pullup requests ecc.
