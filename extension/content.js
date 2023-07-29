console.log('Content script loaded!');

const getBoundingRect = (event, window) => {
  let element = null;
  if (event.composedPath()[0]) {
    element = event.composedPath()[0];
  } else {
    element = event.target;
  }
  const rect = element.getBoundingClientRect();
  console.log(element, rect);
  let currentWindow = window.self;
  let x = rect.x, y = rect.y;
  while (currentWindow !== window.top) {
    x += currentWindow.frameElement.offsetLeft;
    y += currentWindow.frameElement.offsetTop;
    currentWindow = currentWindow.parent;
  }
  return {x, y, width: rect.width, height: rect.height};
}

const drawRectMs = (rect, ms) => {
  // create a div
  const div = document.createElement('div');
  div.style.position = 'absolute';
  div.style.left = rect.x + 'px';
  div.style.top = rect.y + 'px';
  div.style.width = rect.width + 'px';
  div.style.height = rect.height + 'px';
  div.style.border = '2px solid red';
  div.style.zIndex = '2147483647 !important';
  div.style.pointerEvents = 'none';
  div.style.opacity = '0.3';
  div.style.backgroundColor = 'red';
  div.style.color = 'white';
  div.style.fontSize = '12px';
  div.style.fontWeight = 'bold';
  div.style.textAlign = 'center';
  div.style.paddingTop = '2px';
  div.style.boxSizing = 'border-box';
  document.body.appendChild(div);
  setTimeout(() => {
    document.body.removeChild(div);
  }
  , ms);
}
// listen for click event
window.addEventListener('click', function(e) {
  // send message to background script
  e.preventDefault();
  e.stopPropagation();
  let backTrack = 0;
  currentWindow = window.self;
  let x = e.clientX, y = e.clientY;
  while (currentWindow !== window.top) {
    backTrack++;
    x += currentWindow.frameElement.offsetLeft;
    y += currentWindow.frameElement.offsetTop;
    currentWindow = currentWindow.parent;
  }
  console.log('backTrack: ' , backTrack, 'x: ', x, 'y: ', y);
  // chrome.runtime.sendMessage({type: 'drawRectMs', rect: getBoundingRect(e, window), ms: 3000});
  chrome.runtime.sendMessage({type: 'clickEvent', rect: getBoundingRect(e, window), ratio: window.devicePixelRatio});

}, true);


if (window.self === window.top) {
  // send message to background script
  chrome.runtime.sendMessage({type: 'attachDebugger'});
  chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.type === 'drawRectMs') {
      console.log('Message received: ' + JSON.stringify(message, null, 2));
      drawRectMs(message.rect, message.ms);
    }
  });
}

