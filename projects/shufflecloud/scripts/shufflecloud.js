// Global constants.
const UPDATE_PLAYER_INTERVAL = 16; // in milliseconds.
const TEXT_SCROLL_SPEED = 75; // in pixels/s.
const TEXT_SCROLL_START_DELAY = 1.5; // in seconds.
const TEXT_SCROLL_END_DELAY = 1.5; // in seconds.

// HTML elements
var musicPlayer = document.getElementById('musicPlayer');
var trackPermalink = document.getElementById('trackPermalink');
var trackArtwork = document.getElementById('trackArtwork');
var trackLblParent = document.getElementById('trackLblParent');
var trackNameLabel = document.getElementById('trackNameLbl');
var artistNameLabel = document.getElementById('artistNameLbl');
var currentTimeLabel = document.getElementById('currentTimeLbl');
var trackDurationLabel = document.getElementById('trackDurationLbl');
var playerProgSlider = document.getElementById('playerProgSldr');
var playerPlayButton = document.getElementById('playerPlayBtn');
var playerVolumeSlider = document.getElementById('playerVolSldr');

var loadButton = document.getElementById('loadBtn');
var shuffleButton = document.getElementById('shuffleBtn');
var settingsButton = document.getElementById('settingsBtn');
var playlistPermalink = document.getElementById('playlistPermalink');
var playlistTitleUI = document.getElementById('playlistTitle');
var playlistUI = document.getElementById('playlist');

// Audio controller variables.
var scClientID = 'HzEllmdjxRaeJ4LHu62ED4YKXrx4ji1v';
var scController = {};
var loadingNotification = null;
var isBusy = false;
var isPlayerPlaying = false;
var isScrubbing = false;
var curTrackIndex = -1;
var playerVolume = 1.0;
var trackScrollingTimer = null;
var artistScrollingTimer = null;
var lastTimestamp = 0.0;

// Cached HTML variables that are constantly updating.
var cachedCurTimeText = '';

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

$('#playerVolSldr').on('input', function (e) {
    playerVolume = $('#playerVolSldr').val() / 100.0;
    musicPlayer.volume = playerVolume;
    localStorage.setItem('playerVolume', playerVolume.toString());
});

$('#playerProgSldr').on('mousedown', function (e) {
    if (isPlayerPlaying && !isScrubbing) {
        // User started scrubbing, so pause playback.
        musicPlayer.pause();
        isScrubbing = true;
    }
});

$('#playerProgSldr').on('input', function (e) {
    if (isPlayerPlaying && isScrubbing) {
        // To update current time label.
        musicPlayer.currentTime = $('#playerProgSldr').val();
    }
});

$('#playerProgSldr').on('mouseup', function (e) {
    if (isPlayerPlaying && isScrubbing) {
        // Stop scrubbing. Go to this point in time and resume.
        musicPlayer.currentTime = $('#playerProgSldr').val();
        musicPlayer.play();
        isScrubbing = false;
    }
});

function onWebpageLoaded() {
    // Load settings.
    scClientID = loadString('scClientId', 'HzEllmdjxRaeJ4LHu62ED4YKXrx4ji1v');
    playerVolume = loadFloat('playerVolume', 1.0);

    $('#cIdInput').val(scClientID);
    $('#scLink').val(localStorage.getItem('scLink'));
    $('#playerVolSldr').val(Math.round(playerVolume * 100));

    // Initialize music player for audio streaming.
    musicPlayer.crossOrigin = 'anonymous';
    musicPlayer.addEventListener('loadeddata', onTrackLoaded);
    musicPlayer.addEventListener('ended', onTrackEnded);
    musicPlayer.volume = playerVolume;
    resetScrollingTimers();
    clearCurrentTrack();

    // Start player UI update loop.
    lastTimestamp = performance.now();
    playerUpdateLoop(lastTimestamp);
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

                // Update playlist link.
                playlistPermalink.href = link;
                var trackCount = scController.playlist.length;

                // Remove tracks from playlist that are not streamable.
                for (var i = trackCount - 1; i >= 0; i--) {
                    if (!scController.playlist[i].streamable) {
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
}

function onPlaylistLoadSuccess() {
    if (loadingNotification != null) {
        loadingNotification.close();
        loadingNotification = null;
    }

    // Reset current track and stop music playback.
    clearCurrentTrack();

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

        if (i == swapWith) {
            swapWith++;
        }

        // Current track index should persist even after shuffling.
        if (curTrackIndex == i) {
            curTrackIndex = swapWith;
        }
        else if (curTrackIndex == swapWith) {
            curTrackIndex = i;
        }

        if (swapWith >= trackCount) {
            swapWith -= trackCount; // Wrap around.
        }

        // Swap both elements.
        var temp = scController.playlist[i];
        scController.playlist[i] = scController.playlist[swapWith];
        scController.playlist[swapWith] = temp;
    }

    refreshPlaylistUI();

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
        var selectedTrack = (i == curTrackIndex);
        var styling = '" class="track-list-item';

        if (selectedTrack) {
            styling += ' track-list-item-selected"';
        }
        else {
            styling += '"'; // Close off class quotation mark.
        }

        // Add click callback to play this track.
        styling += ' onclick="loadTrackOntoPlayer(' + i + ')">';
        var playIcon = '';

        if (selectedTrack) {
            if (isPlayerPlaying) {
                // Display play icon for the current track index.
                playIcon = '<img src="images/play.png" class="img-no-interact" style="width:12px;height:16px;margin-right:7px;margin-bottom:3px;">';
            }
            else {
                // Display pause icon instead.
                playIcon = '<img src="images/pause.png" class="img-no-interact" style="width:12px;height:16px;margin-right:7px;margin-bottom:3px;">';
            }
        }

        var trackName = '<div class="d-inline-flex">' + scController.playlist[i].title + '</div>';
        var uploaderName = '<div class="d-inline-flex pl-3" style="color:#a0a0a0">by ' + scController.playlist[i].user.username + '</div>';

        listContents += '<button id="trackBtn' + i + styling + playIcon + trackName + uploaderName + '</button>';
    }

    playlistUI.innerHTML = '<div class="list-group">' + listContents + '</div>';
}

function scrollToCurrentTrack() {
    if (curTrackIndex <= -1 || !scController || !scController.playlist || curTrackIndex >= scController.playlist.length) {
        return; // No track to scroll to.
    }

    var elementID = 'trackBtn' + curTrackIndex;
    document.getElementById(elementID).scrollIntoView();
}

function playerUpdateLoop(timestamp) {
    if (curTrackIndex > -1) {
        // Update current time for label and slider.
        var curPlayerTime = musicPlayer.currentTime;
        var curTimeText = toTimerFormat(curPlayerTime);

        // Cache label text for performance (setting innerHTML is slow).
        if (cachedCurTimeText !== curTimeText) {
            currentTimeLabel.innerHTML = curTimeText;
            cachedCurTimeText = curTimeText;
        }

        if (!isScrubbing) {
            playerProgSlider.value = curPlayerTime.toString();
        }
    }

    // Update track and artist label positioning.
    var trackLblParentWidth = trackLblParent.clientWidth + 6; // Magic number :o
    var trackNameMoveDist = Math.max(0, trackNameLabel.clientWidth - trackLblParentWidth);
    var artistNameMoveDist = Math.max(0, artistNameLabel.clientWidth - trackLblParentWidth);
    var dt = (timestamp - lastTimestamp) / 1000.0; // time elapsed in seconds.

    runScrollingTimer(trackScrollingTimer, trackNameMoveDist, dt);
    runScrollingTimer(artistScrollingTimer, artistNameMoveDist, dt);
    trackNameLabel.style.left = -trackScrollingTimer.pxOffset + 'px';
    artistNameLabel.style.left = -artistScrollingTimer.pxOffset + 'px';

    requestAnimationFrame(playerUpdateLoop);
    lastTimestamp = timestamp;
}

function onTrackEnded() {
    // Automatically go to the next track in playlist.
    if (!isBusy && isPlayerPlaying) {
        cycleNextTrack();
    }
}

function loadTrackOntoPlayer(index) {
    if (isBusy || !scController || !scController.playlist || index >= scController.playlist.length) {
        return;
    }

    curTrackIndex = index;

    // Set new player source to this track's stream URL.
    isPlayerPlaying = false;
    isScrubbing = false;
    musicPlayer.src = getStreamUrl(index);
    musicPlayer.currentTime = 0.0;
    resetScrollingTimers();
    setIsBusy(true);
    toggleTrackPlayback(); // Start playing.

    // Update UI.
    updateTrackInfoUI();
    scrollToCurrentTrack();
}

function updateTrackInfoUI() {
    if (curTrackIndex <= -1) {
        // No track selected. Reset to default values.
        trackPermalink.href = '';
        trackArtwork.src = '../../images/shufflecloud.jpg';
        trackNameLabel.innerHTML = 'Track Name';
        artistNameLabel.innerHTML = 'Artist Name';
    }
    else {
        // Update static track elements (basically everything except for the current time).
        trackPermalink.href = scController.playlist[curTrackIndex].permalink_url;
        trackArtwork.src = scController.playlist[curTrackIndex].artwork_url;
        trackNameLabel.innerHTML = scController.playlist[curTrackIndex].title;
        artistNameLabel.innerHTML = scController.playlist[curTrackIndex].user.username;
    }

    // Reset time labels and slider (we need to wait for the track to finish loading onto player, see onTrackLoaded below).
    currentTimeLabel.innerHTML = '0:00';
    trackDurationLabel.innerHTML = '--:--';
    playerProgSlider.max = playerProgSlider.step.toString();
    playerProgSlider.value = '0';
}

function onTrackLoaded() {
    setIsBusy(false);

    // Update track duration on label and slider.
    var curPlayerDuration = (!isNaN(musicPlayer.duration)) ? musicPlayer.duration : 0;
    trackDurationLabel.innerHTML = toTimerFormat(curPlayerDuration);
    playerProgSlider.max = curPlayerDuration.toString();
}

// Player controls
function cyclePrevTrack() {
    // The song will rewind to beginning instead, when more than 3 seconds in.
    var shouldRewind = (musicPlayer.currentTime >= 3.0);

    if (shouldRewind) {
        // Simply restart to beginning of current song.
        musicPlayer.currentTime = 0.0;
    }
    else {
        if (isBusy || scController.playlist.length <= 1) {
            return; // No tracks to cycle.
        }

        curTrackIndex--;

        if (curTrackIndex < 0) {
            // Wrap around.
            curTrackIndex = scController.playlist.length - 1;
        }

        loadTrackOntoPlayer(curTrackIndex);
        refreshPlaylistUI();
    }
}

function toggleTrackPlayback() {
    if (!scController || !scController.playlist || scController.playlist.length == 0) {
        return;
    }

    isPlayerPlaying = !isPlayerPlaying;

    if (isPlayerPlaying) {
        if (curTrackIndex < 0) {
            loadTrackOntoPlayer(0);
        }

        musicPlayer.play();
        playerPlayButton.src = 'images/pause.png';
    }
    else {
        musicPlayer.pause();
        playerPlayButton.src = 'images/play.png';
    }

    // Update playing icon in playlist.
    refreshPlaylistUI();
}

function cycleNextTrack() {
    if (isBusy || scController.playlist.length <= 1) {
        return; // No tracks to cycle.
    }

    curTrackIndex++;

    if (curTrackIndex >= scController.playlist.length) {
        // Wrap around.
        curTrackIndex = 0;
    }

    loadTrackOntoPlayer(curTrackIndex);
    refreshPlaylistUI();
}

function clearCurrentTrack() {
    musicPlayer.pause();
    musicPlayer.currentTime = 0.0;
    musicPlayer.src = '';
    isPlayerPlaying = false;
    isScrubbing = false;
    curTrackIndex = -1;
    resetScrollingTimers();

    // Clear cached label texts.
    cachedCurTimeText = '';

    // Update UI.
    updateTrackInfoUI();
}

function runScrollingTimer(timer, maxOffset, deltaTime) {
    if (timer.reachedEnd) {
        // Timer to reset to beginning.
        timer.delay += deltaTime;

        if (timer.delay >= TEXT_SCROLL_END_DELAY) {
            // Go back to the start.
            timer.pxOffset = 0.0;
            timer.delay = 0.0;
            timer.reachedEnd = false;
        }
    }
    else {
        if (timer.delay < TEXT_SCROLL_START_DELAY) {
            // Wait! There's a delay set!
            timer.delay += deltaTime;
        }
        else {
            // Start scrolling to the right.
            timer.pxOffset += TEXT_SCROLL_SPEED * deltaTime;

            if (timer.pxOffset > maxOffset) {
                timer.pxOffset = maxOffset;
                timer.delay = 0.0;
                timer.reachedEnd = true;
            }
        }
    }
}

function resetScrollingTimers() {
    trackScrollingTimer = { pxOffset: 0.0, delay: 0.0, reachedEnd: false };
    artistScrollingTimer = { pxOffset: 0.0, delay: 0.0, reachedEnd: false };
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
    loadButton.disabled = busy;
    shuffleButton.disabled = busy;
    settingsButton.disabled = busy;

    isBusy = busy;
}