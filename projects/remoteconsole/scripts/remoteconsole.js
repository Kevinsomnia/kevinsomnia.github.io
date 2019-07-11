// Constants.
const ENTER_KEY = 13;
const MIN_CONSOLE_BODY_HEIGHT = 75; // in pixels.
const STATIC_ELEMENTS_HEIGHT = 115; // in pixels.

var secureMode = false;
var connecting = false;
var connected = false;
var ipString = '192.168.1.50';
var portString = '8080';
var socket = null;

// ADD FIREFOX DETECTION AND NOTIFY THAT THEY NEED TO EITHER USE CHROME OR ALLOW INSECURE WEBSOCKETS.

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
    let pwdString = $('#pwdInput').val();

    let finalWsUrl;

    if(secureMode)
        finalWsUrl = 'wss://';
    else
        finalWsUrl = 'ws://';
    
    finalWsUrl += ipString + ':' + portString;
    console.log('Connecting to: ' + finalWsUrl);
    
    // Connect to URL.
    socket = new WebSocket(finalWsUrl + '/' + pwdString);

    // Setup callbacks.
    socket.onopen = function(event) {
        onConnect(event);
    }

    socket.onmessage = function(event) {
        onReceivedData(event.data);
    }

    socket.onclose = function(event) {
        if(connected)
            alert('Lost connection to server...');
        
        onDisconnect();
    }

    socket.onerror = function(event) {
        onError(event);
    }
});

$('#secureToggleBtn').click(function() {
    setSecureState(!secureMode);
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
    onDisconnect();
});

function resizeConsoleBody() {
    // Fit console UI to window height.
    let height = Math.max(MIN_CONSOLE_BODY_HEIGHT, window.innerHeight - STATIC_ELEMENTS_HEIGHT);
    consoleBody.style.height = height + 'px';
}

function loadSettings() {
    $('#ipInput').val(loadString('ip', ''));
    $('#portInput').val(loadString('port', ''));
    setSecureState(loadBoolean('secure', false));
}

function saveSettings() {
    saveString('ip', $('#ipInput').val());
    saveString('port', $('#portInput').val());
    saveBoolean('secure', secureMode);
}

function setSecureState(state) {
    secureMode = state;
    saveSettings();

    if(secureMode) {
        $('#secureToggleBtn').css('background-color', '#40942b'); // green
        $('#secureIcon').attr('src', 'images/secure.png');
    }
    else {
        $('#secureToggleBtn').css('background-color', '#7a7942'); // yellow
        $('#secureIcon').attr('src', 'images/insecure.png');
    }
}

function setConnectingState(state) {
    connecting = state;
    $('#connectBtn').attr('disabled', connecting);
}

function updateTabName() {
    if(connected)
        document.title = ipString + ':' + portString + ' | Remote Console';
    else
        document.title = 'Remote Console | Kevin\'s Web Portfolio';
}

// WebSocket connection.
function onConnect(event) {
    connected = true;
    updateTabName();

    // Clear and show connected message.
    $('#serverTitle').text(ipString + ' | Port ' + portString);
    $('#consoleBody').text('Successfully connected to ' + ipString + ':' + portString + '!');

    // Fade out form and fade in console UI.
    animateCSS('#connectForm', 'fadeOut', function() {
        setConnectingState(false);
        $('#connectForm').hide();

        $('#consoleUI').show();
        animateCSS('#consoleUI', 'fadeIn', null);
    });
}

function onDisconnect() {
    if(connected) {
        // Fade out console UI and load connection form.
        animateCSS('#consoleUI', 'fadeOut', function() {
            setConnectingState(false);
            $('#consoleUI').hide();
            
            $('#connectForm').show();
            animateCSS('#connectForm', 'fadeIn', null);
        });

        connected = false;
        updateTabName();
    }
}

function onError(event) {
    alert('Failed to connect. Ensure the server\'s port is open!');
    setConnectingState(false);
    connected = false;
}

// Messaging.
function onSubmitMessage() {
    let msg = $('#inputField').val();
    sendMessageToServer(msg);
    $('#inputField').val('');
}

function sendMessageToServer(msg) {
    if(!connected)
        return; // Not connected.
    
    // Trim leading/trailing whitespace.
    msg = msg.trim();

    if(!msg || msg.length === 0)
        return; // Empty message.
    
    socket.send(msg);
}

function onReceivedData(data) {
    $('#consoleBody').append('<br>' + data);
}