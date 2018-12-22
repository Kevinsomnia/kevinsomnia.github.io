// Global variables.
var scController = {};

function initController() {
    // Create controller object for this session.
    console.log('Initializing SC controller...');
    scController = { clientID:'giRCTsKmvoxGF53IxQ6xEV1FzsR6IzQH', streamUrl:null, onRetrieved:null, onFailed:null };
    console.log(scController);

    SC.initialize({ client_id: scController.clientID });
}

function tryGetSound(link, onRetrieved, onFailed) {
    // By default, set streamUrl to null. If everything is successful by the end, it will be an actual link!
    scController.streamUrl = null;

    // Set callbacks for track retrieve result.
    scController.onRetrieved = onRetrieved;
    scController.onFailed = onFailed;

    // Sanitize link.
    link = link.trim();
    console.log('start playing: ' + link);

    // Resolve to get track ID from link.
    SC.get('/resolve', { url: link }, function(result) {
        if(!result.errors && result.kind == 'track') {
            // We need to provide the client ID to use the API and access the sound.
            scController.streamUrl = result.stream_url + '?client_id=' + scController.clientID;
            console.log('Got final stream URL: ' + scController.streamUrl);

            if(scController.onRetrieved !== null) {
                scController.onRetrieved();
            }
        }
    
        if(scController.onFailed !== null) {
            if(result.errors) {
                scController.onFailed(result.errors[0].error_message);
            }
            else {
                scController.onFailed(result.kind + ' is unsupported');
            }
        }
    });
}

function onPressPlay() {
    var link = $('#scLink').val();
    tryGetSound(link, onTrackLoad, onTrackFail);
}

function onTrackLoad() {
    console.log('track loaded!');
}

function onTrackFail(errorMsg) {
    console.log('track failed: ' + errorMsg);
}