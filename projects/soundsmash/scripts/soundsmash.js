// Global variables.
var scController;

class SoundCloudController {
    constructor() {
        this.clientID = 'giRCTsKmvoxGF53IxQ6xEV1FzsR6IzQH';
        this.streamUrl = null;
        this.onRetrieved = null;
        this.onFailed = null;

        console.log('Initializing SC controller...');
        console.log(this);

        SC.initialize({client_id: this.clientID});
    }

    tryGetSound(link, onRetrieved, onFailed) {
        // By default, set streamUrl to null. If everything is successful by the end, it will be an actual link!
        this.streamUrl = null;

        // Set callbacks for track retrieve result.
        this.onRetrieved = onRetrieved;
        this.onFailed = onFailed;

        // Sanitize link.
        link = link.trim();
        console.log('start playing: ' + link);

        // Resolve to get track ID from link.
        SC.get('/resolve', { url: link }, this.onRetrievedTrack);
    }

    onRetrievedTrack(result) {
        if(!result.errors) {
            if(result.kind == 'track') {
                // We need to provide the client ID to use the API and access the sound.
                this.streamUrl = result.stream_url + '?client_id=' + this.clientID;
                console.log('Got final stream URL: ' + streamUrl);

                if(this.onRetrieved !== null) {
                    this.onRetrieved();
                }
            }
        }

        if(this.onFailed !== null) {
            if(result.errors) {
                this.onFailed(result.errors[0].error_message);
            }
            else {
                this.onFailed(result.kind + ' is unsupported');
            }
        }
    }
}

function initController() {
    scController = new SoundCloudController();
}

function play() {
    var link = $('#scLink').val();
    scController.tryGetSound(link, onTrackLoad, onTrackFail);
}

function onTrackLoad() {
    console.log('track loaded!');
}

function onTrackFail(errorMsg) {
    console.log('track failed: ' + errorMsg);
}