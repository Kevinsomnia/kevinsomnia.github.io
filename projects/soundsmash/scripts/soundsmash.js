// Constants
const GAME_VIEW_WIDTH = 5.0; // Width of the game view in seconds.
const NOTE_RADIUS = 10;
const PEAK_THRESHOLD = 0.075;

// HTML elements
var audioPlayer = document.getElementById('audioPlayer');
var gameView = document.getElementById('gameView');

// Audio controller variables.
var scController = {};
var audioCtx = null;
var songDuration = 0.0;
var sampleRate = 44100;

// Game variables.
var startTime = 0.0;
var curTime = 0.0;
var lastTime = 0.0;
var unitScale = 500.0; // The number of pixels per second.
var leftGameBounds = 0.0;
var rightGameBounds = 1.0;

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
    // Create audio buffer.
    var bufferSrc = audioCtx.createBufferSource();
    bufferSrc.buffer = data;

    // Apply low pass filter to get the bass drum hits.
    var lowPassFilter = audioCtx.createBiquadFilter();
    lowPassFilter.type = 'lowpass';
    lowPassFilter.frequency.value = 150; // Hz
    bufferSrc.connect(lowPassFilter);

    // Generate beatmap.
    createBeatmap(bufferSrc.buffer);

    // Reset time to start of clip.
    startTime = audioCtx.currentTime;
    curTime = 0.0;
    lastTime = curTime;

    bufferSrc.connect(audioCtx.destination);
    bufferSrc.start(0);

    // Start drawing the game.
    renderGame();
}

var amplitudes = null;
var peaks = null; // Array of timestamps of audio peaks.
var stepSize = 0.0;

function createBeatmap(data) {
    var numChannels = data.numberOfChannels;

    if (numChannels != 2) {
        return; // Channel count is not supported.
    }

    sampleRate = data.sampleRate;
    songDuration = data.duration;

    // Get channel data and downsample them to nyquist.
    var leftChannel = data.getChannelData(0);
    var rightChannel = data.getChannelData(1);

    peaks = calculatePeaks(leftChannel, rightChannel, leftChannel.length);

    console.log(peaks);
}

// Pretty dumb way to get the peaks, but just get the peak amplitude in the samples.
function calculatePeaks(lChannel, rChannel, length) {
    var results = [];
    stepSize = Math.ceil(0.05 * sampleRate); // Sample every 0.05 second interval.
    var sampleStartIndex = 0;
    var prevAvgAmp = 0.0;
    amplitudes = [];

    while (sampleStartIndex < length) {
        var avgAmplitude = 0.0;

        for (var i = 0; i < stepSize; i++) {
            var absIndex = sampleStartIndex + i;

            if (absIndex >= length) {
                break;
            }

            // Accumulate the greater amplitude from both channels.
            var sample = (Math.abs(lChannel[absIndex]) + Math.abs(rChannel[absIndex])) * 0.5;
            avgAmplitude += sample * sample;
        }

        if (stepSize > 1) {
            avgAmplitude /= stepSize;
        }

        // The average sampled amplitude is greater than the previous sample's by a threshold.
        if (sampleStartIndex > 0 && avgAmplitude - prevAvgAmp > PEAK_THRESHOLD) {
            results.push((sampleStartIndex + (stepSize * 0.5)) / sampleRate); // Convert sample index to seconds.
        }

        amplitudes.push(avgAmplitude);

        prevAvgAmp = avgAmplitude;
        sampleStartIndex += stepSize;
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

    // Draw intensity debug.
    gameCtx.strokeStyle = '#77db25'; // lime green.
    gameCtx.lineWidth = 8;
    var amplIndex = Math.min(Math.floor(leftGameBounds * 20.0), amplitudes.length - 1);
    drawVerticalLine(gameCtx, rightGameBounds - 0.33, amplitudes[amplIndex]);

    // Draw vertical lines and time labels in intervals.
    const bpm = 120.0; // Make adjustable later.
    var lineStep = 60.0 / bpm; // Time interval per beat.
    var curLineTime = Math.ceil(leftGameBounds / lineStep) * lineStep;

    gameCtx.strokeStyle = '#ffffff33'; // translucent white.
    gameCtx.lineWidth = 2;
    gameCtx.fillStyle = '#ffffff66'; // translucent white.
    gameCtx.textAlign = 'center';
    gameCtx.font = '12px Verdana';

    while (curLineTime < rightGameBounds) {
        drawVerticalLine(gameCtx, curLineTime, 1.0);
        drawTimestamp(gameCtx, curLineTime);
        curLineTime += lineStep;
    }

    // Draw beat "notes"
    gameCtx.fillStyle = '#d33415'; // red orange.
    gameCtx.strokeStyle = '#9b2812'; // darker red orange.
    gameCtx.lineWidth = 2; // outline width.

    for (var i = 0; i < peaks.length; i++) {
        drawNote(gameCtx, peaks[i]);
    }
}

function drawNote(ctx, time) {
    var x = convertSecondsToPixel(time);
    var centerY = gameView.height * 0.5;

    ctx.beginPath();
    ctx.arc(x, centerY, NOTE_RADIUS, 0, 2 * Math.PI, false);
    ctx.fill();
    ctx.stroke();
}

function drawVerticalLine(ctx, time, heightPercent) {
    var x = convertSecondsToPixel(time);

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, gameView.height * heightPercent);
    ctx.stroke();
}

function drawTimestamp(ctx, time) {
    var x = convertSecondsToPixel(time);
    ctx.fillText(time.toString(), x, gameView.height);
}

function convertSecondsToPixel(time) {
    var inverseLerp = (time - leftGameBounds) / (rightGameBounds - leftGameBounds); // Map from 0 to 1.
    return inverseLerp * gameView.width; // 0 to game view width.
}

function gameLoop() {
    curTime = audioCtx.currentTime - startTime;
    //var dt = curTime - lastTime; // Time delta (in seconds) between previous frame and this frame.

    // Update bounds.
    leftGameBounds = curTime;
    rightGameBounds = curTime + GAME_VIEW_WIDTH;

    lastTime = curTime;
}