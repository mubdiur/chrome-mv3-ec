console.log('Content script loaded!');

// listen for click event
document.addEventListener('click', function(e) {
  // send message to background script

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
  chrome.runtime.sendMessage({type: 'clickEvent', clientX: x, clientY: y});

});

if (window.self === window.top) {
  // send message to background script
  chrome.runtime.sendMessage({type: 'attachDebugger'});
}