$('#ipInput').mask('099.099.099.099');
$('#portInput').mask('00000');

$('#connectBtn').click(function() {
    var finalWsUrl = "ws://" + $('#ipInput').val() + ":" + $('#portInput').val() + "/Console";
    console.log("connecting to: " + finalWsUrl);
    
    var socket = new WebSocket(finalWsUrl);

    socket.onopen = function() {
        console.log('socket opened!');
    }

    socket.onmessage = function(event) {
        alert('Received data: ' + event.data);
    }

    socket.onclose = function() {
        console.log('socket closed!');
    }

    socket.onerror = function() {
        alert('Connection error!');
    }
});
