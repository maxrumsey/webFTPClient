const express = require('express');
const open = require('open');
const app = express();
const API = require('./api.js');
const pug = require('pug');
const fs = require('fs');

const argv = require('minimist')(process.argv.slice(2));

const client = new API(argv.h.split(':')[0], argv.h.split(':')[1]);
app.use(async (req, res) => {
  const serverPath = req.path;
  if (req.query.download) {
    const file = await client.download('./' + req.query.download);
    res.set('Content-disposition', 'attachment; filename=' + req.query.download);
    res.send(file);
    return;
  }
  if (req.path === '/favicon.ico') return;
  if (req.query.upload) {
    const uploadedFile = fs.readFileSync(req.query.upload);
    const fileName = req.query.upload.split('/')[req.query.upload.split('/').length - 1]
    if (!uploadedFile) return res.send('File to be uploaded not found.')
    await client.upload(uploadedFile, './' + fileName)
  }
  if (req.query.directory) {
    await client.addDirectory(req.query.directory);
  }
  await client.send('CWD ' + serverPath)
  let filesStr = await client.ls();
  filesStr = filesStr.replace(/\r/g, '');
  filesStr = filesStr.split('\n')
  const files = [];
  for (var i = 0; i < filesStr.length; i++) {
    filesStr[i] = filesStr[i].replace(/\s\s+/g, ' ');
    if (filesStr[i] == '') continue;
    const type = filesStr[i].split(' ')[1]
    const name = filesStr[i].split(' ')[filesStr[i].split(' ').length - 1]
    if (type == 'folder') {
      files.push({
        type: 'folder',
        name: name + '/',
        url: req.path == '/' ? '/' + name : req.path + '/' + name
      })
    } else {
      files.push({
        type: 'file',
        name: name,
        url: (req.path == '/' ? '/' : req.path) + '?download=' + name
      })
    }
  }
  const rendered = pug.renderFile('main.pug', {
			files: files ? files : [],
      url: req.path
	})

  res.send(rendered)
})
client.connect()
  .then(async e => {
    try {
      await client.login(argv.u, argv.p);
    } catch (e) {
      console.log('Failed to log in.');
      console.log(e);
      process.exit(1);
    }
    const listener = app.listen(() => {
      const port = listener.address().port
      console.log('Server started. Listening on Port:', port);
      open('http://localhost:' + port)
    })
  })
