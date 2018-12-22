// Constants
const GAME_VIEW_WIDTH = 5.0; // Width of the game view in seconds.

// HTML elements
var audioPlayer = document.getElementById('audioPlayer');
var gameView = document.getElementById('gameView');

// Audio controller variables.
var scController = {};
var audioCtx = null;
var songDuration = 0.0;
var sampleRate = 44100;

// Game variables.
var curTime = 0.0;
var lastTime = 0.0;
var unitScale = 500.0; // The number of pixels per second.
var offsetX = 0.0;
var leftGameBounds = 0.0;
var rightGameBounds = 1.0;

function initController() {
    // Create controller object for this session.
    scController = { clientID: 'giRCTsKmvoxGF53IxQ6xEV1FzsR6IzQH', track: null, onRetrieved: null, onFailed: null };
    SC.initialize({ client_id: scController.clientID });

    //DEBUG.
    renderGame();
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
    audioCtx = new AudioContext();

    // Get the audio data through AJAX.
    var request = new XMLHttpRequest();
    request.open('GET', streamUrl, true);
    request.responseType = 'arraybuffer';

    request.onload = function () {
        audioCtx.decodeAudioData(request.response, function (data) {
            console.log(data);
            initializeGame(audioCtx, data);
        }, null);
    }

    request.send();
}

function initializeGame(audioCtx, data) {
    // Generate beatmap.
    createBeatmap(data);

    // Reset time to start of clip.
    curTime = 0.0;
    lastTime = curTime;

    // Connect audio data to player and start playing.
    var bufferSrc = audioCtx.createBufferSource();
    bufferSrc.buffer = data;
    bufferSrc.connect(audioCtx.destination);
    bufferSrc.start();

    // Start drawing the game.
    renderGame();
}

var peaks = null; // Array of timestamps of audio peaks.

function createBeatmap(data) {
    var numChannels = data.numberOfChannels;

    if (numChannels != 2) {
        return; // Channel count is not supported.
    }

    sampleRate = data.sampleRate;
    songDuration = data.length * 1.0 / sampleRate;

    var leftChannel = data.getChannelData(0);
    var rightChannel = data.getChannelData(1);

    peaks = calculatePeaks(leftChannel, rightChannel);

    console.log(peaks);
}

// Pretty dumb way to get the peaks, but just get the peak amplitude in the samples.
function calculatePeaks(lChannel, rChannel) {
    var results = [];
    var dataLength = lChannel.length;
    var stepSize = Math.ceil(0.001 * sampleRate); // Sample every 0.001 second interval.

    for (var i = 0; i < dataLength; i += stepSize) {
        var avgAmplitude = (lChannel[i] + rChannel[i]) * 0.5;

        if (avgAmplitude > 0.5) {
            results.push(i * 1.0 / sampleRate); // Convert sample index to seconds.
        }
    }

    return results;
}

function renderGame() {
    gameView.width = window.innerWidth - 50;
    gameView.height = window.innerHeight - 200;

    requestAnimationFrame(renderGame);
    gameLoop();

    var gameCtx = gameView.getContext('2d');

    gameCtx.clearRect(0, 0, gameView.width, gameView.height);

    // Draw vertical lines in intervals.
    const bpm = 120.0; // Make adjustable later.
    var lineStep = 60.0 / bpm; // Time interval per beat.
    var curLineTime = Math.ceil(leftGameBounds / lineStep) * lineStep;

    gameCtx.strokeStyle = '#ffffff33'; // Translucent white.
    gameCtx.lineWidth = 2;

    while(curLineTime < rightGameBounds) {
        gameCtx.beginPath();
        var x = convertSecondsToPixel(curLineTime);
        gameCtx.moveTo(x, 0);
        gameCtx.lineTo(x, gameView.height);
        gameCtx.stroke();

        // Step to next line.
        curLineTime += lineStep;
    }

    // Draw beat "notes"

}

function convertSecondsToPixel(time) {
    var inverseLerp = (time - leftGameBounds) / (rightGameBounds - leftGameBounds); // Map from 0 to 1.
    return inverseLerp * gameView.width; // 0 to game view width.
}

function gameLoop() {
    curTime = audioCtx.currentTime;
    //var dt = curTime - lastTime; // Time delta (in seconds) between previous frame and this frame.

    // Update bounds.
    leftGameBounds = curTime;
    rightGameBounds = curTime + GAME_VIEW_WIDTH;

    lastTime = curTime;
}