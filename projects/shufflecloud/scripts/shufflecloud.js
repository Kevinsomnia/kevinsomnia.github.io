// HTML elements
var audioPlayer = document.getElementById('audioPlayer');
var helpButton = document.getElementById('helpBtn');
var startButton = document.getElementById('startBtn');
var settingsButton = document.getElementById('settingsBtn');

// Audio controller variables.
var scClientID = '';
var scController = {};
var audioCtx = null;
var songDuration = 0.0;
var sampleRate = 44100;
var loadingNotification = null;
var isBusy = false;
var isPlaying = false;

$('#startBtn').click(function (e) {
    localStorage.setItem('scLink', $('#scLink').val());
});

$('#closeSettings').click(function (e) {
    var newId = $('#cIdInput').val();

    if (newId != scClientID) {
        scClientID = newId;
        localStorage.setItem('scClientId', scClientID);

        initController(); // Reinitialize.
    }
});

function loadSettings() {
    scClientID = localStorage.getItem('scClientId');

    $('#cIdInput').val(scClientID);
    $('#scLink').val(localStorage.getItem('scLink'));
}

function initController() {
    // Create controller object for this session.
    scController = { clientID: scClientID, playlist: null, onRetrieved: null, onFailed: null };
    SC.initialize({ client_id: scClientID });
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
        if (result) {
            if (!result.errors && result.kind == 'playlist') {
                scController.playlist = fillPlaylist(result.tracks);

                if (scController.onRetrieved !== null) {
                    scController.onRetrieved();
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
        }
        else {
            scController.onFailed('Unauthorized! Make sure you set the client ID in the settings menu! (or you may need to assign a new one)');
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
    if (loadingNotification != null) {
        loadingNotification.update({
            message: 'Shuffling playlist...'
        });
    }

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

function fillPlaylist(tracks) {
    scController.playlist = [];
    var trackCount = tracks.length;

    for(var i = 0; i < trackCount; i++) {
        scController.playlist.push({origIndex: i, data: tracks[i]})
    }
}

function shufflePlaylist() {
    // In-place shuffling.
    console.log('Shuffling playlist...');
    var trackCount = scController.playlist.length;

    for(var i = 0; i < trackCount; i++) {
        // Choose random index to swap with.
        var swapWith = randomInt(0, trackCount - 1);

        if(swapWith == i) {
            swapWith++;

            if(swapWith >= trackCount) {
                swapWith = 0; // Wrap around.
            }
        }

        console.log('swapping index ' + i + ' and ' + swapWith);

        // Swap both elements.
        var temp = scController.playlist[i];
        scController.playlist[i] = scController.playlist[swapWith];
        scController.playlist[swapWith] = temp;
    }

    console.log(scController.playlist);
    
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

function lerp(a, b, t) {
    return a + ((b - a) * t);
}

function randomInt(min, max) {
    return Math.floor(lerp(min, max + 1, Math.random()));
}