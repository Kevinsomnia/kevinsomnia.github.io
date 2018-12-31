// Global constants.
const UPDATE_PLAYER_INTERVAL = 100; // in milliseconds.

// HTML elements
var musicPlayer = document.getElementById('musicPlayer');
var currentTimeLabel = document.getElementById('currentTimeLbl');
var trackDurationLabel = document.getElementById('trackDurationLbl');
var playerProgSlider = document.getElementById('playerProgSlider');
var helpButton = document.getElementById('helpBtn');
var loadButton = document.getElementById('loadBtn');
var shuffleButton = document.getElementById('shuffleBtn');
var settingsButton = document.getElementById('settingsBtn');
var playlistTitleUI = document.getElementById('playlistTitle');
var playlistUI = document.getElementById('playlist');

// Audio controller variables.
var scClientID = '';
var scController = {};
var loadingNotification = null;
var isBusy = false;
var isPlayerPlaying = false;
var curTrackIndex = -1;

$('#loadBtn').click(function (e) {
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

function onWebpageLoaded() {
    // Load settings.
    scClientID = localStorage.getItem('scClientId');

    $('#cIdInput').val(scClientID);
    $('#scLink').val(localStorage.getItem('scLink'));

    // Initialize audio player for audio streaming.
    musicPlayer.crossOrigin = 'anonymous';
    curTrackIndex = -1;

    // Start player UI update loop.
    updatePlayerUI();
}

function initController() {
    // Create controller object for this client ID.
    scController = { clientID: scClientID, metadata: null, playlist: null, onRetrieved: null, onFailed: null };
    SC.initialize({ client_id: scClientID });
}

function getStreamUrl(index) {
    return scController.playlist[index].stream_url + '?client_id=' + scController.clientID;
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
                scController.metadata = result;
                scController.playlist = result.tracks;

                var trackCount = scController.playlist.length;

                // Remove tracks from playlist that are not streamable.
                for(var i = trackCount - 1; i >= 0; i--) {
                    if(!scController.playlist[i].streamable) {
                        scController.playlist.splice(i, 1);
                    }
                }

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

function onPressLoad() {
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

function onPressShuffle() {
    if (!scController || !scController.playlist) {
        return; // No playlist to shuffle.
    }

    shufflePlaylist();
    refreshPlaylistUI();
}

function onPlaylistLoadSuccess() {
    if (loadingNotification != null) {
        loadingNotification.close();
        loadingNotification = null;
    }

    refreshPlaylistUI();
    setIsBusy(false);
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
    // In-place shuffling for playlist array (roughly O(n)).
    var trackCount = scController.playlist.length;

    if (trackCount <= 1) {
        return;
    }

    for (var i = 0; i < trackCount; i++) {
        // Choose random index to swap with.
        var swapWith = randomInt(0, trackCount);

        if (swapWith == i) {
            swapWith++;
        }

        if (swapWith >= trackCount) {
            swapWith -= trackCount; // Wrap around.
        }

        // Swap both elements.
        var temp = scController.playlist[i];
        scController.playlist[i] = scController.playlist[swapWith];
        scController.playlist[swapWith] = temp;
    }

    if (loadingNotification != null) {
        loadingNotification.close();
        loadingNotification = null;
    }
}

function refreshPlaylistUI() {
    var playlistDurationInSeconds = scController.metadata.duration / 1000; // milliseconds -> seconds.

    playlistTitleUI.innerHTML = '<strong>' + scController.metadata.title + ' | ' + scController.metadata.user.username + ' | '
        + scController.playlist.length + ' tracks | ' + toTimerFormat(playlistDurationInSeconds) + '</strong>';

    var listContents = '';
    var trackCount = scController.playlist.length;

    for (var i = 0; i < trackCount; i++) {
        var selectedAndPlayingTrack = (isPlayerPlaying && i == curTrackIndex);
        var styling = '" class="track-list-item';

        if (selectedAndPlayingTrack) {
            styling += ' track-list-item-playing"';
        }
        else {
            styling += '"'; // Close off class quotation mark.
        }

        // Add click callback to play this track.
        styling += ' onclick="loadTrackOntoPlayer(' + i + ')">';
        var playIcon = '';

        if (selectedAndPlayingTrack) {
            // Display play icon for the current track index.
            playIcon = '<img src="images/play.png" style="width:12px;height:16px;margin-right:7px;margin-bottom:3px;">';
        }

        var trackName = '<div class="d-inline-flex">' + scController.playlist[i].title + '</div>';
        var uploaderName = '<div class="d-inline-flex pl-3" style="color:#a0a0a0">by ' + scController.playlist[i].user.username + '</div>';

        listContents += '<button id="trackBtn' + i + styling + playIcon + trackName + uploaderName + '</button>';
    }

    playlistUI.innerHTML = '<div class="list-group">' + listContents + '</div>';
}

function updatePlayerUI() {
    if(curTrackIndex == -1) {
        currentTimeLabel.innerHTML = '--:--';
        trackDurationLabel.innerHTML = '--:--';
    }
    else {
        var curPlayerTime = Math.floor(musicPlayer.currentTime);
        var curPlayerDuration = Math.floor(musicPlayer.duration);

        currentTimeLabel.innerHTML = toTimerFormat(curPlayerTime);
        trackDurationLabel.innerHTML = toTimerFormat(musicPlayer.duration);

        // Update progress slider.
        playerProgSlider.max = curPlayerDuration.toString();
        playerProgSlider.value = curPlayerTime.toString();
    }

    setTimeout(updatePlayerUI, UPDATE_PLAYER_INTERVAL);
}

function loadTrackOntoPlayer(index) {
    if(!scController || !scController.playlist || index >= scController.playlist.length) {
        return;
    }

    console.log(scController.playlist[index]);
    curTrackIndex = index;

    // Set new player source to this track's stream URL.
    musicPlayer.setAttribute('src', getStreamUrl(index));
    musicPlayer.play();
    isPlayerPlaying = true;

    // Update UI.
    refreshPlaylistUI();
    updatePlayerUI();
}

// Player controls
function cyclePrevTrack() {
    if(scController.playlist.length <= 1) {
        return; // No tracks to cycle.
    }

    curTrackIndex--;

    if(curTrackIndex < 0) {
        // Wrap around.
        curTrackIndex = scController.playlist.length - 1;
    }

    loadTrackOntoPlayer(curTrackIndex);
    refreshPlaylistUI();
}

function toggleTrackPlayback() {
    isPlayerPlaying = !isPlayerPlaying;
    console.log('now playing: ' + isPlayerPlaying);

    if(isPlayerPlaying) {
        musicPlayer.play();
        // Update image to pause button.
    }
    else {
        musicPlayer.pause();
        // Update image to play button.
    }
}

function cycleNextTrack() {
    if(scController.playlist.length <= 1) {
        return; // No tracks to cycle.
    }

    curTrackIndex++;

    if(curTrackIndex >= scController.playlist.length) {
        // Wrap around.
        curTrackIndex = 0;
    }

    loadTrackOntoPlayer(curTrackIndex);
    refreshPlaylistUI();
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