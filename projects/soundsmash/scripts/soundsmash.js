// Constants
const GAME_VIEW_WIDTH = 5.0; // Width of the game view in seconds.
const BEAT_RADIUS = 10;
const PEAK_THRESHOLD = 0.05;
const KEY_A = 65, KEY_D = 68;
const BEAT_BASS = 0, BEAT_SNARE = 1;

// HTML elements
var audioPlayer = document.getElementById('audioPlayer');
var gameView = document.getElementById('gameView');
var helpButton = document.getElementById('helpBtn');
var playButton = document.getElementById('playBtn');
var settingsButton = document.getElementById('settingsBtn');

// Audio controller variables.
var scController = {};
var audioCtx = null;
var songDuration = 0.0;
var sampleRate = 44100;
var songBpm = 120.0;

// Game variables.
var loadingNotification = null;
var isBusy = false;
var isPlaying = false;
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
    setIsBusy(true);

    loadingNotification = $.notify({ title: '<b>Getting sound:</b>', message: 'Please be patient while the sound loads.' }, {
        type: 'info',
        allow_dismiss: false,
        spacing: 5,
        timer: 0,
        placement: {
            from: "top",
            align: "center"
        },
        animate: {
            enter: 'animated faster fadeInDown',
            exit: 'animated faster fadeOutUp'
        }
    });
}

function onTrackLoadSuccess() {
    console.log('Track load successful. Creating beatmap.');
    console.log('*** Track Info ***');
    console.log(scController.track);

    startSamplingTrack();
}

function onTrackLoadFail(errorMsg) {
    console.log('Track failed to load: ' + errorMsg);
    setIsBusy(false);

    if(loadingNotification != null) {
        loadingNotification.close();
    }

    displayError('Failed to load sound! Make sure the URL is correct, and that it is not a playlist.')
}

function displayError(msg) {
    $.notify({ title: '<b>Error:</b>', message: msg }, {
        type: 'danger',
        allow_dismiss: true,
        spacing: 5,
        delay: 5000,
        timer: 250,
        placement: {
            from: "top",
            align: "center"
        },
        animate: {
            enter: 'animated faster fadeInDown',
            exit: 'animated faster fadeOutUp'
        }
    });
}

function setIsBusy(busy) {
    helpButton.disabled = busy;
    playButton.disabled = busy;
    settingsButton.disabled = busy;

    isBusy = busy;
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

    // Finished loading. Close notification.
    if (loadingNotification != null) {
        loadingNotification.close();
    }

    // Start drawing the game.
    isPlaying = true;
    renderGame();
}

var beats = null; // Array of timestamps of audio peaks. This list is ordered chronologically.

function createBeatmap(data) {
    var numChannels = data.numberOfChannels;

    if (numChannels != 2) {
        return; // Channel count is not supported.
    }

    sampleRate = data.sampleRate;
    songDuration = data.duration;

    // Get channel data and downsample them to nyquist.
    var lChannel = data.getChannelData(0);
    var rChannel = data.getChannelData(1);

    songBpm = 120.0; // Add BPM detection (first soundcloud metadata, then calculate with beat spacing). Later make it overrideable.
    minBeatInterval = (60.0 / songBpm) / 8.0; // 1/32 note.

    beats = [];
    var sampleStepSize = Math.ceil(minBeatInterval * sampleRate); // Number of samples within the minimum beat interval.
    var sampleStartIndex = 0;
    var prevAvgRMS = 0.0;

    while (sampleStartIndex < length) {
        var avgRMS = 0.0; // Rough approximation of root-mean square.

        for (var i = 0; i < sampleStepSize; i++) {
            var absIndex = sampleStartIndex + i;

            if (absIndex >= length) {
                break;
            }

            var sample = (Math.abs(lChannel[absIndex]) + Math.abs(rChannel[absIndex])) * 0.5;
            avgRMS += sample * sample;
        }

        if (sampleStepSize > 1) {
            avgRMS /= sampleStepSize;
        }

        // The average sampled amplitude is greater than the previous sample's by a threshold.
        if (sampleStartIndex > 0 && avgRMS - prevAvgRMS > PEAK_THRESHOLD) {
            beats.push({
                type: BEAT_BASS, // Should be different depending if this beat is from low-pass or high-pass.
                timestamp: ((sampleStartIndex + (sampleStepSize * 0.5)) / sampleRate) // Convert sample index to seconds.
            });
        }

        prevAvgRMS = avgRMS;
        sampleStartIndex += stepSize;
    }
}

function renderGame() {
    gameView.width = window.innerWidth - 45;
    gameView.height = window.innerHeight - 195;

    requestAnimationFrame(renderGame);
    gameLoop();

    var gameCtx = gameView.getContext('2d');

    gameCtx.clearRect(0, 0, gameView.width, gameView.height);

    // Draw vertical lines and time labels in intervals.
    var lineStep = 60.0 / songBpm; // Time interval per beat.
    var measureTime = lineStep * 4.0; // 4 beats per measure.
    var curLineTime = Math.ceil(leftGameBounds / lineStep) * lineStep;

    gameCtx.lineWidth = 2;
    gameCtx.fillStyle = '#ffffff66'; // translucent white.
    gameCtx.textAlign = 'center';
    gameCtx.font = '12px Verdana';

    while (curLineTime < rightGameBounds) {
        var isMeasureLine = (curLineTime % measureTime == 0.0);

        if(isMeasureLine) {
            // Marks first beat of the measure.
            gameCtx.strokeStyle = '#ffffff33'; // translucent white.
            drawVerticalLine(gameCtx, curLineTime, 0.96);
            drawTimestamp(gameCtx, curLineTime);
        }
        else {
            // Every other beat in the measure.
            gameCtx.strokeStyle = '#ffffff19';
            drawVerticalLine(gameCtx, curLineTime, 0.96);
        }

        curLineTime += lineStep;
    }

    // Draw beats as circles.
    gameCtx.lineWidth = 2; // Circle outline width.

    for (var i = 0; i < beats.length; i++) {
        drawBeat(gameCtx, beats[i]);
    }
}

function drawBeat(ctx, beat) {
    var x = convertSecondsToPixel(beat.timestamp);
    var centerY = gameView.height * 0.5;

    if (beat.type == BEAT_BASS) {
        ctx.fillStyle = '#d33415'; // red orange.
        ctx.strokeStyle = '#9b2812'; // darker red orange.
    }
    else if (beat.type == BEAT_SNARE) {
        ctx.fillStyle = '#3581e4'; // light blue.
        ctx.strokeStyle = '#2760aa'; // blue.
    }

    ctx.beginPath();
    ctx.arc(x, centerY, BEAT_RADIUS, 0, 2 * Math.PI, false);
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

function onKeyDown(event) {
    if (event.repeat) {
        return; // Ignore repeated events.
    }

    if (event.keyCode == KEY_A) {
        smashKey(0);
    }
    else if (event.keyCode == KEY_D) {
        smashKey(1);
    }
}

function onKeyUp(event) {
    // Use for notes that are required to be held down.
    if (event.keyCode == KEY_A) {
    }
    else if (event.keyCode == KEY_D) {
    }
}

function getNextBeat() {

}

function smashKey(type) {
    if (type == 1) {

    }
}