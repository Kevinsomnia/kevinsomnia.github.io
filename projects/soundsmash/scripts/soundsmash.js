// HTML elements
var gameCanvas = document.getElementById('gameView');

// Audio controller variables.
var scController = {};

// Game variables.
var curTime = 0.0;
var lastTime = 0.0;
var unitScale = 500.0;
var offsetX = 0.0;

function initController() {
    // Create controller object for this session.
    scController = { clientID: 'giRCTsKmvoxGF53IxQ6xEV1FzsR6IzQH', track: null, onRetrieved: null, onFailed: null };
    SC.initialize({ client_id: scController.clientID });

}

function getStreamUrl() {
    return scController.track.stream_url + '?client_id=' + scController.clientID;
}

function tryGetSound(link, onRetrieved, onFailed) {
    // First, set the track to null. If everything is successful, it will contain actual track data when onRetrieved() is called!
    scController.track = null;

    // Set callbacks for track retrieve result.
    scController.onRetrieved = onRetrieved;
    scController.onFailed = onFailed;

    // Sanitize link.
    link = link.trim();

    // Resolve to get track ID from link.
    SC.get('/resolve', { url: link }, function (result) {
        if (!result.errors && result.kind == 'track') {
            // We need to provide the client ID to use the API and access the sound.
            scController.track = result;

            if (scController.onRetrieved !== null) {
                scController.onRetrieved();
                return;
            }
        }
        else {
            if (scController.onFailed !== null) {
                if (result.errors) {
                    scController.onFailed(result.errors[0].error_message);
                }
                else {
                    scController.onFailed(result.kind + ' is unsupported');
                }
            }
        }
    });
}

function onPressPlay() {
    var link = $('#scLink').val();
    tryGetSound(link, onTrackLoadSuccess, onTrackLoadFail);
}

function onTrackLoadSuccess() {
    console.log('Track load successful. Start sampling');
    startSamplingTrack();
}

function onTrackLoadFail(errorMsg) {
    console.log('Track failed to load: ' + errorMsg);
}

function startSamplingTrack() {
    // Get the URL of audio content.
    var streamUrl = getStreamUrl();

    // Create audio context and buffer.
    var audioCtx = new AudioContext();

    // Get the audio data through AJAX.
    var request = new XMLHttpRequest();
    request.open('GET', streamUrl, true);
    request.responseType = 'arraybuffer';

    request.onload = function () {
        audioCtx.decodeAudioData(request.response, function (data) {
            initializeGame(audioCtx, data);
        }, null);
    }

    request.send();
}

function initializeGame(audioCtx, data) {
    // Generate beatmap.
    createBeatmap(data);

    // Initialize time.
    var now = new Date();
    curTime = now.getTime();
    lastTime = curTime;

    // Connect audio data to player and start playing.
    var bufferSrc = audioCtx.createBufferSource();
    bufferSrc.buffer = data;
    bufferSrc.connect(audioCtx.destination);
    bufferSrc.start();

    // Start drawing the game.
    renderGame();
}

var peaks = []; // Array of samples indices.

function createBeatmap(data) {
    var numChannels = data.numberOfChannels;

    if (numChannels != 2) {
        return; // Channel count is not supported.
    }

    var sampleRate = data.sampleRate;
    var leftChannel = data.getChannelData(0);
    var rightChannel = data.getChannelData(1);

    peaks = calculatePeaks(leftChannel, rightChannel, sampleRate);

    console.log(peaks);
}

// Pretty dumb way to get beats, but just get the peak amplitude in the samples.
function calculatePeaks(lChannel, rChannel, sampleRate) {
    var results = [];
    var dataLength = lChannel.length;
    var stepSize = Math.ceil(0.001 * sampleRate); // Sample every 0.001 second interval.

    for (var i = 0; i < dataLength; i += stepSize) {
        var avgAmplitude = (lChannel[i] + rChannel[i]) * 0.5;

        if (avgAmplitude > 0.5) {
            console.log('peak: ' + i + ' / ' + dataLength);
            results.push(i);
        }
    }

    return results;
}

function renderGame() {
    gameCanvas.width = window.innerWidth - 50;
    gameCanvas.height = window.innerHeight - 200;

    requestAnimationFrame(renderGame);
    gameLoop();

    var gameCtx = gameCanvas.getContext('2d');

    gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

    gameCtx.lineWidth = 2;

    // Draw vertical lines
    var lineCount = Math.ceil(gameCanvas.width / unitScale);
    gameCtx.strokeStyle = '#ffffff33'; // Translucent white.

    for (var i = 0; i < lineCount; i++) {
        gameCtx.beginPath();
        var x = (i + 1) * unitScale;
        gameCtx.moveTo(x + offsetX, 0);
        gameCtx.lineTo(x + offsetX, gameCanvas.height);
        gameCtx.stroke();
    }
}

function gameLoop() {
    var now = new Date();
    curTime = now.getTime(); // TEMP. Should use the current audio sample for time reference.
    var dt = 1 / 60.0; // Time delta (in seconds) between previous frame and this frame.

    offsetX -= dt * unitScale;

    if (offsetX < -unitScale) {
        offsetX += unitScale; // Loop.
    }

    lastTime = curTime;
}