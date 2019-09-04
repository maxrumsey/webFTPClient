const fs = require('fs');

const Net = require('net');

const EventEmitter = require('events');
class MyEmitter extends EventEmitter {}

class FTPConnection {
  constructor(host, port) {
    this.controlClient = new Net.Socket();
    this.host = host || 'localhost';
    this.port = port || 21;
    this.loggedIn = false;
    this.controlClient.setEncoding('binary');
    this.events = new MyEmitter()
    // The controlClient can also receive data from the server by reading from its socket.
    this.controlClient.on('data', (chunk) => {
      const str = chunk.toString();
      const lines = str.split('\n')
      for (var i = 0; i < lines.length; i++) {
        this.events.emit('dataIn', lines[i], chunk)
      }
    });
    this.events.on('dataIn', (str, chunk) => {
      if (str.length == 0) return;
      console.log('CONTROL: ' + str)
      const code = str.split(' ')[0].split('-')[0];
      if (code == '331') this.events.emit('login')
      else if (code == '430') this.events.emit('login', new Error(str))
      else if (code == '230') this.events.emit('login')
      else if (code == '220') this.events.emit('readyForUser')
      else if (code == '257') this.events.emit('dirAdded')
      else if (code == '227') {
        const ipStr = str.split('(')[1].split(')')[0].split(',')
        const ip = ipStr.slice(0, 4).join('.')
        let ports = ipStr.slice(4)
        ports = ports.map(e => parseInt(e))
        this.events.emit('passiveEstablished', ip, (ports[0] * 256) + ports[1])
      } else if (code == '226') {
        this.dataClient = undefined;
      } else if (code == '150') {
        this.events.emit('dataConnectionOpened')
      } else if (code == '250') {
        this.events.emit('250');
      }
    })
    this.controlClient.on('end', () => {
        console.log('Control - Requested an end to the TCP connection');
    });
  }
  connect() {
    return new Promise((res, rej) => {
      process.nextTick(() => {
        this.controlClient.connect({ port: this.port, host: this.host }, () => {
          this.events.once('readyForUser', () => {
            res();
          })
        })
      })
    })
  }
  write(txt) {
    this.controlClient.write(txt + '\r\n', 'binary')
    console.log('=> ' + txt)
  }
  login(usr, pass) {
    let username = usr
    if (!usr) username = 'anonymous';

    this.write('USER ' + username);
    if (pass) this.write('PASS ' + pass);
    return new Promise((res, rej) => {
      this.events.once('login', e1 => {
        this.events.once('login', e2 => {
          this.loggedIn = true;
          if (e1 || e2) {
            rej(e1 || e2)
          } else {
            res()
          }
        })
      })
    })
  }
  ls() {
    this.write('PASV')
    return new Promise((res, rej) => {
      this.events.once('passiveEstablished', (ip, port) => {
        const dataClient = new Net.Socket();
        dataClient.setEncoding('binary');
        dataClient.on('data', (chunk) => {
          dataClient.end();
          res(chunk.toString())
        });
        dataClient.on('end', () => {
            console.log('Data Socket Closed');
            res('')
        });
        dataClient.connect({ port: port, host: ip }, () => {
          this.write('LIST')
        })
      })
    })
  }
  downloadHandler(filePath, CMD) {
    this.write('PASV')
    return new Promise((res, rej) => {
      this.events.once('passiveEstablished', (ip, port) => {
        const dataClient = new Net.Socket();
        dataClient.setEncoding('binary');
        dataClient.on('data', (chunk) => {
          dataClient.end();
          if (filePath) fs.writeFile(filePath, chunk, (e) => {
            if (e) rej(e)
            else res()
          })
          else {
            res(chunk)
          }
        });
        dataClient.on('end', () => {
            console.log('Data Socket Closed');
        });
        dataClient.connect({ port: port, host: ip }, () => {
          console.log('Data Socket Opened.')
          this.write(CMD)
        })
      })
    })
  }
  upload(file, serverPath) {
    this.write('PASV')
    return new Promise((res, rej) => {
      this.events.once('passiveEstablished', (ip, port) => {
        const dataClient = new Net.Socket();
        dataClient.setEncoding('binary');
        dataClient.on('end', () => {
            console.log('Data Socket Closed');
            res();
        });
        dataClient.connect({ port: port, host: ip }, () => {
          console.log('Data Socket Opened.')
          this.write('STOR ' + serverPath)
          this.events.once('dataConnectionOpened', () => {
            dataClient.write(file);
            dataClient.end();
          })
        })
      })
    })
  }
  cd(path) {
    this.write('CWD ' + path)
    return new Promise((res) => {
      this.events.once('250', res)
    })
  }
  async download(serverFile, filePath) {
    return (await this.downloadHandler(filePath, 'RETR ' + serverFile))
  }
  send(CMD) {
    this.write(CMD);
    return new Promise((res) => {
      this.events.once('dataIn', res)
    })
  }
  addDirectory(name) {
    this.write('MKD ' + name);
    return new Promise((res, rej) => {
      this.events.once('dirAdded', res)
    })
  }
}
module.exports = FTPConnection
