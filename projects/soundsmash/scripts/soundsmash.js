// Global variables.
var controller;

class SoundCloudController {
    constructor() {
        this.clientID = 'giRCTsKmvoxGF53IxQ6xEV1FzsR6IzQH';
        this.streamUrl = null;

        console.log('Initializing SC controller...');
        console.log(this);

        SC.initialize({client_id: this.clientID});
    }

    tryGetSound(link) {
        // By default, set streamUrl to null. If everything is successful by the end, it will be an actual link!
        this.streamUrl = null;

        // Sanitize link.
        link = link.trim();
        console.log('start playing: ' + link);

        // Resolve to get track ID from link.
        SC.get('/resolve', { url: link }, function(result) {
            if(!result.errors) {
                if(result.kind == 'track') {
                    // We need to provide the client ID to use the API and access the sound.
                    this.streamUrl = result.stream_url + '?client_id=' + this.clientID;
                    console.log('Got final stream URL: ' + streamUrl);
                    return true;
                }
                else {
                    console.log('No support for ' + result.kind + '. Sorry!');
                }
            }
            else {
                // Error: most likely invalid client ID or track.
                console.log('Cannot play track: ' + result.errors[0].error_message);
            }
        });

        return false;
    }
}

function initController() {
    controller = new SoundCloudController();
}

function play() {
    var link = $('#scLink').val();
    if(controller.tryGetSound(link)) {
        console.log('Get sound success');
    }
    else {
        console.log('Get sound failed');
    }
}