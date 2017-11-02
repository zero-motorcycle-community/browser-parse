# browser-parse
## Functionality
- HTML5-based Decoder for Zero Motorcycles log files, both [MBB](http://zeromanual.com/index.php/Unofficial_Service_Manual#Main_Bike_Board) and [BMS](http://zeromanual.com/index.php/Unofficial_Service_Manual#Battery_Management_System).
- HTML5 Offline parser for Zero Motorcycles log files.
- HTML5 Offline viewer with Highcharts for MBB log files.

# Usage
1. Get log files from the [Zero App](http://www.zeromotorcycles.com/app/help/ios/) (Support/Email Bike Logs)
1. Send to file storage.
1. Choose .bin file in the Decoder tool to decode text and view charts.

# DISCLAIMER:
- This software is not sponsored by, associated with, affiliated with, or endorsed by Zero Motorcycles.
- It is maintained by riders just like you.
- Information is presented as-is and may be inaccurate.

## Online Support
Parser, Viewer and Tools download page now hosted on GitHub

- [Zero Log File Tools](https://zero-motorcycle-community.github.io/browser-parse/)
- [Zero Log File Parser](https://zero-motorcycle-community.github.io/browser-parse/zero-log-parser.html)
- [Zero Log File Viewer](https://zero-motorcycle-community.github.io/browser-parse/zero-log-viewer.html)

## Offline Support
- These tools work offline.
- Use Chrome or Firefox to open the web page and save or cache it.
- On iOS
  - **Bookmarking** Mobile Safari supports marking a page as a bookmark or a favorite, and Add To Homescreen can make it accessible with a conventional app icon.
  - **Log File Management** As of iOS 11, the Files functionality can save the log from the native Mail client (and others like Google Inbox/Gmail).

# Building
`zero-log-parser.html` is built from the files in the `component` folder. It includes all styles, images, and scripts in a single file to make offline usage work well.

## Windows
Use powershell script `.\merge.ps1` to create single file html from components.

## Unix-like OSes
Run `make`:
- `make logparser-offline` builds the offline log parser.
- `make logviewer-offline` builds the offline log viewer.
- `make logparser-online` builds the online log parser.
- `make logviewer-online` builds the online log viewer.
- `make logparser` builds online and offline parsers.
- `make logviewer` builds online and offline viewers.
- `make` builds everything.
- `make clean all` forces a rebuild.

### Pre-requisites
- bash and make (GNU and non-GNU should work).
- GNU Recode (available on Linux and Homebrew for OS X) is required to commit the same encoding as is checked into the repository.
