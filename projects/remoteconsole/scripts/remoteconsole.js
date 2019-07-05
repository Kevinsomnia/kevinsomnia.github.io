// Constants.
const ENTER_KEY = 13;
const MIN_CONSOLE_BODY_HEIGHT = 75; // in pixels.
const STATIC_ELEMENTS_HEIGHT = 115; // in pixels.

var connecting = false;
var connected = false;
var ipString = '192.168.1.50';
var portString = '8080';
var socket = null;

// HTML elements
var consoleBody = document.getElementById('consoleBody');

// Init.
$('#ipInput').mask('099.099.099.099');
$('#portInput').mask('00000');
loadSettings();

resizeConsoleBody();
window.onresize = resizeConsoleBody;

// Connection form UI.
$('#connectBtn').click(function() {
    setConnectingState(true);
    saveSettings();

    ipString = $('#ipInput').val();
    portString = $('#portInput').val();

    var finalWsUrl = 'ws://' + ipString + ':' + portString;
    console.log('Connecting to: ' + finalWsUrl);
    
    // Connect to URL.
    socket = new WebSocket(finalWsUrl);

    // Setup callbacks.
    socket.onopen = function(event) {
        onConnect(event);
    }

    socket.onmessage = function(event) {
        onReceivedData(event.data);
    }

    socket.onclose = function(event) {
        onDisconnect(event);
    }

    socket.onerror = function(event) {
        onError(event);
    }
});

// Console UI.
$('#inputField').on('keydown', (event) => {
    // Submit command to server on enter key.
    if(event.keyCode === ENTER_KEY) {
        onSubmitMessage();
    }
});

$('#sendBtn').on('click', () => {
    // Clicking send button.
    onSubmitMessage();
});

$('#disconnectBtn').on('click', () => {
    // Clicking disconnect button.
    if(!connected)
        return;
    
    socket.close();
    socket = null;
    setConnectingState(false);
    connected = false;
});

function resizeConsoleBody() {
    // Fit console UI to window height.
    let height = Math.max(MIN_CONSOLE_BODY_HEIGHT, window.innerHeight - STATIC_ELEMENTS_HEIGHT);
    consoleBody.style.height = height + 'px';
}

function loadSettings() {
    $('#ipInput').val(loadString('ip', ''));
    $('#portInput').val(loadString('port', ''));
}

function saveSettings() {
    saveString('ip', $('#ipInput').val());
    saveString('port', $('#portInput').val());
}

function setConnectingState(state) {
    connecting = state;
    $('#connectBtn').attr('disabled', connecting);
}

// WebSocket connection.
function onConnect(event) {
    connected = true;

    // Update tab name.
    document.title = ipString + ':' + portString + ' | Remote Console | Paxitium';

    // Fade out form and load console UI.
    animateCSS('#connectForm', 'fadeOut', function() {
        setConnectingState(false);
        $('#connectForm').hide();
        loadConsoleUI();
    });
}

function onDisconnect(event) {
    console.log('Socket closed!');
    setConnectingState(false);
    connected = false;
}

function onError(event) {
    alert('Connection error! Could not connect to: ' + event.target.url);
    setConnectingState(false);
    connected = false;
}

function loadConsoleUI() {
    $('#consoleUI').show();
    animateCSS('#consoleUI', 'fadeIn', null);
}

// Messaging.
function onSubmitMessage() {
    let msg = $('#inputField').val();
    sendMessageToServer(msg);
    $('#inputField').val('');
}

function sendMessageToServer(msg) {
    // Check if we are connected.
    if(!connected)
        return;
    
    // Sanitize message before sending.

    console.log('Sending: ' + msg);
    socket.send(msg);
}

function onReceivedData(data) {
    console.log('Received data: ' + data);
}