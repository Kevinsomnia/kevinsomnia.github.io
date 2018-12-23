// Constants
const PIXELS_PER_SECOND = 240; // Controls how fast to scroll the graph across the screen.
const BEAT_RADIUS = 10;
const SMASH_LINE_OFFSET = 6; // Spacing from the left of canvas.
const SMASH_LINE_WIDTH = 34;
const PEAK_THRESHOLD = 0.0525;
const BASS_POS_Y = 0.35, SNARE_POS_Y = 0.65;
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
var timeOffset = 0.0; // Compensate for smash line.

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

    loadingNotification = $.notify({ title: '<b>Please be patient:</b>', message: 'Retrieving track data...' }, {
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
    console.log('*** Track Info ***');
    console.log(scController.track);

    if (loadingNotification != null) {
        loadingNotification.update({
            message: 'Generating beatmap...'
        });
    }

    startSamplingTrack();
}

function onTrackLoadFail(errorMsg) {
    displayError('Failed to load track! ' + errorMsg);
    setIsBusy(false);

    if (loadingNotification != null) {
        loadingNotification.close();
        loadingNotification = null;
    }
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
        loadingNotification = null;
    }

    // Setup any necessary game variables.
    var offsetInPixels = SMASH_LINE_OFFSET + (SMASH_LINE_WIDTH * 0.5);
    timeOffset = -offsetInPixels / PIXELS_PER_SECOND; // Negative time offset to shift graph to the right.

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
    var dataLength = lChannel.length;

    // Check if volume normalization is necessary by computing it's overall average amplitude.
    var avgSongVolume = 0.0;

    // Accumulate every 4th sample to save time.
    const EVERY_NTH_SAMPLE = 4;

    for (var i = 0; i < dataLength; i += EVERY_NTH_SAMPLE) {
        avgSongVolume += Math.abs(lChannel[i]);
        avgSongVolume += Math.abs(rChannel[i]);
    }

    avgSongVolume *= 0.5 * EVERY_NTH_SAMPLE; // Average both channels and account for missing samples.
    avgSongVolume /= dataLength; // Average over the entire track.

    // Normalize the amplitudes of quiet songs.
    var normalizationFactor = Math.max(1.0, 0.25 / avgSongVolume); // Most tracks are probably centered around 25%.
    console.log('normalize factor: ' + normalizationFactor + '   (avg volume: ' + avgSongVolume + ')');

    songBpm = 120.0; // Add BPM detection (first soundcloud metadata, then calculate with beat spacing). Later make it overrideable.
    minBeatInterval = (60.0 / songBpm) / 8.0; // 1/32 note.

    beats = [];
    var sampleStepSize = Math.ceil(minBeatInterval * sampleRate); // Number of samples within the minimum beat interval.
    var sampleStartIndex = 0;
    var prevEnergy = 0.0;

    while (sampleStartIndex < dataLength) {
        var energy = 0.0; // Rough approximation of sound energy.

        for (var i = 0; i < sampleStepSize; i++) {
            var absIndex = sampleStartIndex + i;

            if (absIndex >= dataLength) {
                break;
            }

            var sample = Math.abs(lChannel[absIndex]) + Math.abs(rChannel[absIndex]);
            energy += sample * sample;
        }

        energy *= 0.25 * normalizationFactor; // Average both channels and apply normalization. (0.5 * 0.5 * norm).

        if (sampleStepSize > 1) {
            energy /= sampleStepSize;
        }

        // The average sampled amplitude is greater than the previous sample's by a threshold.
        if (sampleStartIndex > 0 && energy - prevEnergy > PEAK_THRESHOLD) {
            beats.push({
                type: BEAT_BASS, // Should be different depending if this beat is from low-pass or high-pass.
                timestamp: ((sampleStartIndex + (sampleStepSize * 0.5)) / sampleRate) // Convert sample index to seconds.
            });
        }

        prevEnergy = energy;
        sampleStartIndex += sampleStepSize;
    }
}

function renderGame() {
    gameView.width = clamp(window.innerWidth - 45, PIXELS_PER_SECOND * 2, 3840);
    gameView.height = clamp(window.innerHeight - 195, 300, 1080);

    requestAnimationFrame(renderGame);
    gameLoop();

    var gameCtx = gameView.getContext('2d');

    // Clear canvas every frame.
    gameCtx.clearRect(0, 0, gameView.width, gameView.height);

    drawGraph(gameCtx);
    drawSmashArea(gameCtx);
    drawAllBeats(gameCtx);
}

function drawGraph(ctx) {
    // Draw vertical lines and time labels in intervals.
    var lineStep = 60.0 / songBpm; // Time interval per beat.
    var curLineIndex = Math.ceil(leftGameBounds / lineStep);
    var curLineTime = curLineIndex * lineStep;

    ctx.lineWidth = 2;
    ctx.fillStyle = '#ffffff66'; // translucent white.
    ctx.textAlign = 'center';
    ctx.font = '12px Verdana';

    while (curLineTime < rightGameBounds) {
        var isMeasureLine = (curLineIndex % 4 == 0); // 4 beats per measure.

        if (isMeasureLine) {
            // Marks first beat of the measure.
            ctx.strokeStyle = '#ffffff33'; // translucent white.
            drawVerticalLine(ctx, curLineTime, 0.96);
            drawTimestamp(ctx, curLineTime);
        }
        else {
            // Every other beat in the measure.
            ctx.strokeStyle = '#ffffff0a';
            drawVerticalLine(ctx, curLineTime, 0.96);
        }

        curLineTime += lineStep;
        curLineIndex++;
    }
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
    ctx.fillText(toTimerFormat(time), x, gameView.height);
}

function drawSmashArea(ctx) {
    // Draw a thick line.
    ctx.lineWidth = SMASH_LINE_WIDTH;
    ctx.strokeStyle = '#51871cb0'; // translucent green.
    ctx.beginPath();
    var x = (SMASH_LINE_WIDTH * 0.5) + SMASH_LINE_OFFSET;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, gameView.height * 0.96);
    ctx.stroke();

    // Cutout holes for each beat type.
    var holeRadius = BEAT_RADIUS + 4;
    cutHole(ctx, x, gameView.height * BASS_POS_Y, holeRadius);
    cutHole(ctx, x, gameView.height * SNARE_POS_Y, holeRadius);
    
    // Draw labels to the inside the holes.
    ctx.fillStyle = '#d33415'; // red orange
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px Verdana';
    ctx.fillText('A', x, (gameView.height * BASS_POS_Y) + 7);
    ctx.fillStyle = '#3581e4'; // blue
    ctx.fillText('D', x, (gameView.height * SNARE_POS_Y) + 7);
}

function cutHole(ctx, x, y, radius) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
    ctx.clip();
    var clearSize = radius * 2 + 2; // diameter + 1 pixel padding.
    ctx.clearRect(x - radius - 1, y - radius - 1, clearSize, clearSize);
    ctx.restore();
}

function drawAllBeats(ctx) {
    ctx.lineWidth = 2; // Controls outline thickness.

    for (var i = 0; i < beats.length; i++) {
        drawBeat(ctx, beats[i]);
    }
}

function drawBeat(ctx, beat) {
    var x = convertSecondsToPixel(beat.timestamp);
    var y = gameView.height;

    if (beat.type == BEAT_BASS) {
        ctx.fillStyle = '#d33415'; // red orange.
        ctx.strokeStyle = '#9b2812'; // darker red orange.
        y *= BASS_POS_Y;
    }
    else if (beat.type == BEAT_SNARE) {
        ctx.fillStyle = '#3581e4'; // light blue.
        ctx.strokeStyle = '#2760aa'; // blue.
        y *= SNARE_POS_Y;
    }

    ctx.beginPath();
    ctx.arc(x, y, BEAT_RADIUS, 0, 2 * Math.PI, false);
    ctx.fill();
    ctx.stroke();
}

// Gets the actual time at the left edge of the canvas. curTime represents the time at the smash area.
function getCurrentAdjustedTime() {
    return curTime + timeOffset;
}

function convertSecondsToPixel(time) {
    var inverseLerp = (time - leftGameBounds) / (rightGameBounds - leftGameBounds); // Map from 0 to 1.
    return inverseLerp * gameView.width; // 0 to game view width.
}

function gameLoop() {
    curTime = audioCtx.currentTime - startTime;
    //var dt = curTime - lastTime; // Time delta (in seconds) between previous frame and this frame.

    // Update bounds.
    leftGameBounds = getCurrentAdjustedTime();
    rightGameBounds = leftGameBounds + (gameView.width / PIXELS_PER_SECOND);

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

// HELPERS
function toTimerFormat(seconds) {
    seconds = Math.round(seconds); // no milliseconds.
    var min = Math.floor(seconds / 60);
    var sec = seconds % 60;

    if (sec < 10) {
        return min + ':0' + sec;
    }

    return min + ':' + sec;
}

function clamp(val, min, max) {
    return Math.min(Math.max(min, val), max)
}