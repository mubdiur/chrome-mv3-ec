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

  let x = rect.x, y = rect.y, width = rect.width, height = rect.height;

  while (currentWindow && currentWindow !== window.top) {
    // add the offsets
    if (currentWindow.frameElement && currentWindow.frameElement.offsetLeft)
      x += currentWindow.frameElement.offsetLeft;
    if (currentWindow.frameElement && currentWindow.frameElement.offsetTop)
      y += currentWindow.frameElement.offsetTop;

    // add the borders
    if (currentWindow.frameElement && currentWindow.frameElement.clientLeft)
      x += currentWindow.frameElement.clientLeft;
    if (currentWindow.frameElement && currentWindow.frameElement.clientTop)
      y += currentWindow.frameElement.clientTop;
    currentWindow = currentWindow.parent;
    // remove the scroll
    if (currentWindow && currentWindow.scrollX)
      x -= currentWindow.scrollX;
    if (currentWindow && currentWindow.scrollY)
      y -= currentWindow.scrollY;
  }

  if (x < 0) x = 0;
  if (y < 0) y = 0;
  return { x, y, width, height };
}

const drawRectMs = (rect, ms) => {
  // create a div
  const div = document.createElement('div');
  div.style.position = 'absolute';
  // add scroll width

  div.style.left = rect.x + window.scrollX + 'px';
  div.style.top = rect.y + window.scrollY + 'px';
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
window.addEventListener('click', async function (e) {
  // send message to background script
  e.preventDefault();
  e.stopPropagation();
  let backTrack = 0;
  currentWindow = window.self;
  let x = e.clientX, y = e.clientY;

  while (currentWindow !== window.top) {
    if (currentWindow.frameElement && currentWindow.frameElement.offsetLeft)
      x += currentWindow.frameElement.offsetLeft;
    if (currentWindow.frameElement && currentWindow.frameElement.offsetTop)
      y += currentWindow.frameElement.offsetTop;

    // add the borders
    if (currentWindow.frameElement && currentWindow.frameElement.clientLeft)
      x += currentWindow.frameElement.clientLeft;
    if (currentWindow.frameElement && currentWindow.frameElement.clientTop)
      y += currentWindow.frameElement.clientTop;
    currentWindow = currentWindow.parent;
    // remove the scroll
    if (currentWindow && currentWindow.scrollX)
      x -= currentWindow.scrollX;
    if (currentWindow && currentWindow.scrollY)
      y -= currentWindow.scrollY;
  }
  console.log('x: ', x, 'y: ', y);
  chrome.runtime.sendMessage({ type: 'clickEvent', rect: getBoundingRect(e, window)});
  // chrome.runtime.sendMessage({ type: 'drawRectMs', rect: getBoundingRect(e, window), ms: 5000 });

}, true);


if (window.self === window.top) {
  // send message to background script
  chrome.runtime.sendMessage({ type: 'attachDebugger' });
  chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    console.log('Message received in root content: ' + JSON.stringify(message, null, 2));
    if (message.type === 'drawRectMs') {
      drawRectMs(message.rect, message.ms);
    }
  });
}

