let minutes = 1;
let seconds = 0;
let intervalSeconds = minutes ? minutes * 60 : seconds;
let intervalMs = intervalSeconds * 1000;
let connectionBeginTime = Date.now();

let frameMapById = {}

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

const handler = async (message, sender, sendResponse) => {
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

  if (message.type === 'setFrames') {
    const allFrames = await chrome.webNavigation.getAllFrames({tabId: sender.tab.id});
    const mappedFrames = buildTree(allFrames);
    const children = mappedFrames[sender.frameId];
    const frames = message.frames;

    console.log('frames and children: ', frames, children);
    const frameObj = [];
    for (let i = 0; frames.length && i < frames.length; i++) {
      const frame = frames[i];
      let child = null;
      try {
        child = children.find((child) => child.url === frame.src);
      } catch (_e) {
        // ignore
      }
      if (child) {
        frameObj[i] = { ...frame, frameId: child.frameId, parentFrameId: sender.frameId };
        frameMapById[child.frameId] = frameObj[i];
      }
      else
        frameObj[i] = {}
    }
    return;
  }
  if (message.type === 'getFrame') {
    if(!frameMapById[sender.frameId]) return;
    let frameId = sender.frameId;
    let frameLocation = '';
    let x = 0, y = 0;
    while (frameId !== 0) {
      const frame = frameMapById[frameId];
      if(!frame) break;
      x += frame.bounding_rect.x;
      y += frame.bounding_rect.y;
      frameLocation += ':' + frame.index;
      frameId = frame.parentFrameId;
    }
    console.log('frameId', frameId);
    if (frameId!==0) sendResponse(null)
    else sendResponse({ frameLocation, actualCoordinates: {x, y} });
  }
  if (message.type === 'recalculateFrames') {
    frameMapById = {};
    chrome.tabs.sendMessage(sender.tab.id, { type: 'onCompleted' });
  }
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  handler(message, sender, sendResponse);
  return true;
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

function buildTree(objects) {
  const map = {};

  for (const obj of objects) {
    if(obj.parentFrameId === -1) {
      continue;
    }
    if(!(map[obj.parentFrameId] && map[obj.parentFrameId].length)) {
      map[obj.parentFrameId] = [];
    }
    if(!(map[obj.frameId] && map[obj.frameId].length)) {
      map[obj.frameId] = [];
    }
    map[obj.parentFrameId].push({
      frameId: obj.frameId,
      url: obj.url,
    });
  }

  return map;
}

chrome.webNavigation.onCompleted.addListener((details) => {
  console.log('onCompleted: ', details);
  chrome.tabs.sendMessage(details.tabId, { type: 'onCompleted', details });
});