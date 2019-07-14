// Constants.
const ENTER_KEY = 13;
const MIN_CONSOLE_BODY_HEIGHT = 75; // in pixels.
const STATIC_ELEMENTS_HEIGHT = 115; // in pixels.

// Member variables.
var secureMode = false;
var connecting = false;
var connected = false;
var serverList = []; // Server list.
var connectedIndex = 0; // index in 'serverList'
var socket = null;
var lastRecvTime = 0;

// HTML elements
var consoleBody = document.getElementById('consoleBody');

// Init.
$('#ipInput').mask('099.099.099.099');
$('#portInput').mask('00000');
loadSettings();
loadServerInfo(0); // Select the first item in server list by default.

resizeConsoleBody();
window.onresize = resizeConsoleBody;

// Connection form UI.
$('#savedServerList').change(function() {
    let selectedIndex = $('#savedServerList').prop('selectedIndex');
    loadServerInfo(selectedIndex);
});

$('#addServerBtn').click(function() {
    let newIndex = serverList.length;
    serverList.push({ 'serverName': ('My Server ' + (newIndex + 1)), 'ip': '127.0.0.1', 'port': '25001' });
    
    updateServerListUI();

    // Select added server.
    loadServerInfo(newIndex);

    // Save server list.
    saveSettings();
});

$('#removeServerBtn').click(function() {
    if(serverList.length <= 1)
        return; // Requires at least one item in list.
    
    // Remove selected option.
    let selectedIndex = $('#savedServerList').prop('selectedIndex');
    serverList.splice(selectedIndex, 1);

    updateServerListUI();

    // Select next available option.
    let newSelection = Math.min(selectedIndex, serverList.length - 1);
    loadServerInfo(newSelection);

    // Save server list.
    saveSettings();
});

// Server input field events.
$('#nameInput').on('input', function() {
    let selectedIndex = $('#savedServerList').prop('selectedIndex');
    let newName = $('#nameInput').val();

    if(newName.length == 0)
        newName = 'Unnamed Server ' + (selectedIndex + 1); // Placeholder for empty server names.
    
    serverList[selectedIndex].serverName = newName;
    updateServerListUI(selectedIndex);
});

$('#ipInput').on('input', function() {
    let selectedIndex = $('#savedServerList').prop('selectedIndex');
    serverList[selectedIndex].ip = $('#ipInput').val();
});

$('#portInput').on('input', function() {
    let selectedIndex = $('#savedServerList').prop('selectedIndex');
    serverList[selectedIndex].port = $('#portInput').val();
});

$('#connectBtn').click(function() {
    startConnectToServer();
});

$(document).on('keydown', (event) => {
    // Connect to server when in connection UI.
    if(!connected && !connecting && event.keyCode === ENTER_KEY) {
        startConnectToServer();
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

function startConnectToServer() {
    setConnectingState(true);
    saveSettings();

    connectedIndex = $('#savedServerList').prop('selectedIndex');
    let pwdString = $('#pwdInput').val();

    let finalWsUrl;

    if(secureMode)
        finalWsUrl = 'wss://';
    else
        finalWsUrl = 'ws://';
    
    finalWsUrl += serverList[connectedIndex].ip + ':' + serverList[connectedIndex].port;
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
}

function resizeConsoleBody() {
    // Fit console UI to window height.
    let height = Math.max(MIN_CONSOLE_BODY_HEIGHT, window.innerHeight - STATIC_ELEMENTS_HEIGHT);
    consoleBody.style.height = height + 'px';
}

function loadSettings() {
    // Load saved server list.
    let loadServers = loadString('servers', '');

    if(loadServers.length == 0) {
        // If there isn't any saved data, just add a temporary item.
        serverList.push({ 'serverName': 'localhost', 'ip': '127.0.0.1', 'port': '25001' });
    }
    else {
        // Parse the string as a JSON array.
        serverList = JSON.parse(loadServers);
    }
    
    updateServerListUI();
    setSecureState(loadBoolean('secure', false));
}

function saveSettings() {
    saveString('servers', JSON.stringify(serverList));
    saveBoolean('secure', secureMode);
}

function updateServerListUI(index) {
    if(index === undefined) {
        // Positive: add items, negative: remove items.
        let optionDelta = serverList.length - $('#savedServerList').children('option').length;

        if(optionDelta > 0) {
            // Add entries if necessary.
            for(let i = 0; i < optionDelta; i++) {
                $('#savedServerList').append($('<option>', { text: '' }));
            }
        }
        else if(optionDelta < 0) {
            // Remove entries if necessary.
            for(let i = 0; i < -optionDelta; i++) {
                $('#savedServerList option:eq(' + (serverList.length - i - 1) + ')').remove();
            }
        }

        // Update existing entries.
        for(let i = 0; i < serverList.length; i++) {
            updateServerListUI(i);
        }
    }
    else {
        // Update a specific element inside the list only.
        $('#savedServerList option:eq(' + index + ')').text(serverList[index].serverName);
    }
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

function loadServerInfo(index) {
    let elementID = '#savedServerList option:eq(' + index + ')';
    $(elementID).prop('selected', true); // Select item in list.

    // Update input values.
    $('#nameInput').val(serverList[index].serverName);
    $('#ipInput').val(serverList[index].ip);
    $('#portInput').val(serverList[index].port);
}

function setConnectingState(state) {
    connecting = state;
    $('#connectBtn').attr('disabled', connecting);
}

function updateTabName() {
    if(connected)
        document.title = serverList[connectedIndex].ip + ':' + serverList[connectedIndex].port + ' | Remote Console';
    else
        document.title = 'Remote Console | Kevin\'s Web Portfolio';
}

// WebSocket connection.
function onConnect(event) {
    connected = true;
    updateTabName();

    // Clear and show connected message.
    $('#serverTitle').text(serverList[connectedIndex].ip + ' | Port ' + serverList[connectedIndex].port);
    $('#consoleBody').text('Successfully connected to ' + serverList[connectedIndex].ip + ':' + serverList[connectedIndex].port + '!');
    $('#consoleBody').append('<br>');

    // Fade out form and fade in console UI.
    animateCSS('#connectForm', 'fadeOut', function() {
        setConnectingState(false);
        $('#connectForm').hide();

        // Clear password input.
        $('#pwdInput').val('');

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

// Sending data to server.
function sendMessageToServer(msg) {
    if(!connected)
        return; // Not connected.
    
    // Trim leading/trailing whitespace.
    msg = msg.trim();

    if(!msg || msg.length === 0)
        return; // Empty message.
    
    socket.send(msg);
}

// Received data from server.
function onReceivedData(data) {
    let scrollPos = $('#consoleBody').scrollTop();
    let contentHeight = $('#consoleBody').prop('scrollHeight');
    let viewHeight = $('#consoleBody').prop('clientHeight');
    let autoScroll = (scrollPos + viewHeight >= contentHeight - 1);

    if(data == '\0\0') {
        // This is a separator tag. Add a space separator.
        $('#consoleBody').append('<div style="margin-bottom:0.5rem;"></div>');
    }
    else {
        // Check for timestamp flag in data.
        if(data.length >= 2 && data.substring(data.length - 2) == '+$') {
            data = data.substring(0, data.length - 2);
            let recvTime = Math.floor(Date.now() / 1000); // seconds.

            // Only print timestamp when it's at least one second apart.
            if(recvTime > lastRecvTime) {
                data += '<span style="float:right;color:#808080;">' + getTimestampString() + '</span>';
                lastRecvTime = recvTime;
            }
        }

        // Append message.
        $('#consoleBody').append('<div>' + data + '</div>');
    }

    if(autoScroll) {
        $('#consoleBody').scrollTop(contentHeight);
    }
}