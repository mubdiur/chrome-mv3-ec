let minutes = 5;
let intervalSeconds = minutes ? minutes * 60 : 15;

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed!');
});
let _port = null;
let count = 0;
// handle external connection
chrome.runtime.onConnectExternal.addListener((port) => {
  console.log('External connection established!');
  port.onMessage.addListener((message) => {
    console.log('External message received: ' + JSON.stringify(message, null, 2));
    port.postMessage(`Message received by extension!\ninterval: ${minutes} minutes or ${intervalSeconds} seconds}`);
  });

  port.onDisconnect.addListener(() => {
    _port = null;
    console.log('External connection disconnected!');
  });

  _port = port;
});

// keep sending count++ with an interval of 3 seconds through _port if _port is not null
setInterval(() => {
  if (_port) {
    const timeSeconds = count * intervalSeconds;
    const timeMinutes = Number.prototype.toFixed.call(timeSeconds / 60, 2);
    const timeHours = Number.prototype.toFixed.call(timeSeconds / 3600, 2);
    const message = {
      count: count++,
      interval: minutes ? minutes + ' minutes' : intervalSeconds + ' seconds',
      timeElapsed: {
        seconds: timeSeconds + ' seconds',
        minutes: timeMinutes + ' minutes',
        hours: timeHours + ' hours',
      },
      time: new Date().toLocaleTimeString(),
    }
    _port.postMessage(JSON.stringify(message, null, 2));
  }
}, 1000 * intervalSeconds);