# webFTPClient
## What is `webFTPClient`?
`webFTPClient` is a command line application that opens a web browser and allows users to connect to FTP server, view the contents of the server, create directories and upload files. This is intended to be used in a DropBox type capacity, as it currently does not have support for deleting files or renaming files.
## What FTP client library do you use?
None. The FTP client used here was built from scratch, and uses Node.JS's `Net` for establishing and operating socket connections.
## What other libraries are used?
* Express - For operating the webserver.
* open - For opening the web browser on start.
* pug - For rendering HTML
* minimist - For parsing command line options
