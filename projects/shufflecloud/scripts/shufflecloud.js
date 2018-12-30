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
var helpButton = document.getElementById('helpBtn');
var startButton = document.getElementById('startBtn');
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
    scController = { clientID: 'giRCTsKmvoxGF53IxQ6xEV1FzsR6IzQH', playlist: null, onRetrieved: null, onFailed: null };
    SC.initialize({ client_id: scController.clientID });
}

function getStreamUrl() {
    return scController.playlist.stream_url + '?client_id=' + scController.clientID;
}

function tryGetPlaylist(link, onRetrieved, onFailed) {
    // First, set the playlist to null. If everything is successful, it will contain the entire playlist data when onRetrieved() is called!
    scController.playlist = null;

    // Set callbacks for playlist retrieve result.
    scController.onRetrieved = onRetrieved;
    scController.onFailed = onFailed;

    // Sanitize link.
    link = link.trim();

    // Resolve to get playlist from link.
    SC.get('/resolve', { url: link }, function (result) {
        console.log(result);

        if (!result.errors && result.kind == 'playlist') {
            // We need to provide the client ID to use the API and access the sound.
            scController.playlist = result;

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
                    scController.onFailed(result.kind + ' is unsupported.');
                }
            }
        }
    });
}

function onPressStart() {
    var link = $('#scLink').val();
    tryGetPlaylist(link, onPlaylistLoadSuccess, onPlaylistLoadFail);
    setIsBusy(true);

    loadingNotification = $.notify({ title: '<b>Loading:</b>', message: 'Retrieving playlist...' }, {
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

function onPlaylistLoadSuccess() {
    console.log('*** Playlist Info ***');
    console.log(scController.playlist);

    shufflePlaylist();
}

function onPlaylistLoadFail(errorMsg) {
    displayError('Failed to load playlist! ' + errorMsg);
    setIsBusy(false);

    if (loadingNotification != null) {
        loadingNotification.close();
        loadingNotification = null;
    }
}

function shufflePlaylist() {
    // Magic.
    console.log('Shuffle stuff');
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
    startButton.disabled = busy;
    settingsButton.disabled = busy;

    isBusy = busy;
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