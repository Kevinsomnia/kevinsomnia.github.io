// Global variables.
var controller;

class SoundCloudController {
    constructor() {
        this.clientID = 'giRCTsKmvoxGF53IxQ6xEV1FzsR6IzQH';
        console.log('init SC: ' + this.clientID);

        SC.initialize({client_id: this.clientID});
    }

    play(link) {
        link = link.trim();
        console.log('start playing: ' + link);

        SC.get('/resolve', { url: link }, function(result) {
            console.log(result);
        });
    }
}

function initController() {
    controller = new SoundCloudController();
}

function play() {
    var link = $('#scLink').val();
    controller.play(link);
}