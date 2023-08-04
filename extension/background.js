let minutes = 1;
let seconds = 0;
let intervalSeconds = minutes ? minutes * 60 : seconds;
let intervalMs = intervalSeconds * 1000;
let connectionBeginTime = Date.now();

function formatTime(milliseconds) {
  var seconds = Math.floor(milliseconds / 1000);
  var minutes = Math.floor(seconds / 60);
  var hours = Math.floor(minutes / 60);

  milliseconds %= 1000;
  seconds %= 60;
  minutes %= 60;

  var formattedTime =
    hours.toString().padStart(2, "0") +
    "h:" +
    minutes.toString().padStart(2, "0") +
    "m:" +
    seconds.toString().padStart(2, "0") +
    "s." +
    milliseconds.toString().padStart(3, "0");

  return formattedTime;
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed!');
});
let _port = null;
let count = 0;
let startTime = new Date().toLocaleTimeString();
// handle external connection
chrome.runtime.onConnectExternal.addListener((port) => {
  console.log('External connection established!');
  port.onMessage.addListener((message) => {
    if (message.type === 'keep_alive') {
      console.log('External message received: ' + JSON.stringify(message, null, 2));
      return;
    }

    connectionBeginTime = Date.now();
    console.log('External message received: ' + JSON.stringify(message, null, 2));
    port.postMessage(`Message received by extension! Wait for ${formatTime(intervalMs)}`);
  });

  port.onDisconnect.addListener(() => {
    _port = null;
    console.log('External connection disconnected!');
  });

  _port = port;
});

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'clickEvent') {
    console.log('Message received sw: ' + JSON.stringify(message, null, 2));

    const { rect } = message;
    const { x, y, width, height } = rect;
  
    // get Page.getLayoutMetrics
    const layoutMatrics = await chrome.debugger.sendCommand({ tabId: sender.tab.id }, 'Page.getLayoutMetrics');  
    // print layoutMatrics
    console.log('layoutMatrics: ' + JSON.stringify(layoutMatrics, null, 2));

    const cssVisualViewport = layoutMatrics.cssVisualViewport;
    const visualViewport = layoutMatrics.visualViewport;
    const zoom = cssVisualViewport.zoom;
    const widthRatio = visualViewport.clientWidth / cssVisualViewport.clientWidth / zoom;
    const heightRatio = visualViewport.clientHeight / cssVisualViewport.clientHeight / zoom;
    
    console.log('widthRatio: ' + widthRatio);
    console.log('heightRatio: ' + heightRatio);
    // highlight rect using dom
    await chrome.debugger.sendCommand({ tabId: sender.tab.id }, 'DOM.highlightRect', {
      x: Math.floor(x * zoom / widthRatio),
      y: Math.floor(y * zoom / heightRatio),
      width: Math.floor(width * zoom / widthRatio),
      height: Math.floor(height * zoom / heightRatio),
      color: { r: 255, g: 0, b: 0, a: 0.3 },
    });
    return;
  }
  if (message.type === 'drawRectMs') {
    console.log('Message received IN SW: ' + JSON.stringify(message, null, 2));
    await chrome.tabs.sendMessage(sender.tab.id, message);
    return;
  }
  if (message.type === 'attachDebugger') {
    try {
      await chrome.debugger.detach({ tabId: sender.tab.id });
      await chrome.debugger.sendCommand({ tabId: sender.tab.id }, 'Page.enable');
    } catch (e) {
      // ignore
    }
    await chrome.debugger.attach({ tabId: sender.tab.id }, '1.3');
    // enable dom
    await chrome.debugger.sendCommand({ tabId: sender.tab.id }, 'DOM.enable');
    // enable overlay
    await chrome.debugger.sendCommand({ tabId: sender.tab.id }, 'Overlay.enable');
  }
});
// keep sending count++ with an interval of 3 seconds through _port if _port is not null
setInterval(() => {
  if (_port) {
    const timeNow = Date.now();
    const message = {
      type: 'keep_alive',
      count: count++,
      interval: formatTime(intervalMs),
      timeElapsed: formatTime(timeNow - connectionBeginTime),
      startTime,
      currentTime: new Date().toLocaleTimeString(),
    }
    _port.postMessage(message);
  }
}, intervalMs);