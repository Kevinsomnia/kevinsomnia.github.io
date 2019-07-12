// A nice compilation of helper functions for my projects.
// Author: Kevin Tong

function saveString(key, value) {
    localStorage.setItem(key, value);
}

function saveBoolean(key, value) {
    localStorage.setItem(key, value.toString());
}

function saveFloat(key, value) {
    localStorage.setItem(key, value.toString());
}

function saveInt(key, value) {
    localStorage.setItem(key, value.toString());
}

function saveArray(key, value) {
    localStorage.setItem(key, value.join(','));
}

function loadString(key, defaultValue) {
    var value = localStorage.getItem(key);

    if (value !== null) {
        return value;
    }

    return defaultValue;
}

function loadBoolean(key, defaultValue) {
    var value = localStorage.getItem(key);

    if (value !== null) {
        return (value === 'true');
    }

    return defaultValue;
}

function loadFloat(key, defaultValue) {
    var value = localStorage.getItem(key);

    if (value !== null) {
        return parseFloat(value);
    }

    return defaultValue;
}

function loadInt(key, defaultValue) {
    var value = localStorage.getItem(key);

    if (value !== null) {
        return parseInt(value);
    }

    return defaultValue;
}

function loadArray(key) {
    var value = localStorage.getItem(key);

    if (value !== null && value.length > 0) {
        return value.split(',');
    }

    return [];
}

// Example: 7/11/2019, 2:27:03 PM
function getTimestampString() {
    let dateNow = new Date(Date.now());
    let hours = dateNow.getHours();
    let mins = dateNow.getMinutes();
    let secs = dateNow.getSeconds();
    let meridiem = ' AM';

    if(hours > 12) {
        meridiem = ' PM';
        hours -= 12;
    }

    let timestamp = (dateNow.getMonth() + 1) + '/' + dateNow.getDate() + '/' + dateNow.getFullYear() + ', ';
    timestamp += hours + ((mins < 10) ? ':0' : ':') + mins + ((secs < 10) ? ':0' : ':') + secs + meridiem;
    return timestamp;
}

function toTimerFormat(seconds) {
    seconds = Math.floor(seconds); // no milliseconds.
    var needHours = (seconds >= 3600);
    
    var hr = Math.floor(seconds / 3600);
    var min = Math.floor((seconds / 60) % 60);
    var sec = seconds % 60;
    var result;

    if(needHours) {
        result = hr.toString();

        if (min < 10) {
            result += ':0' + min;
        }
        else {
            result += ':' + min;
        }
    }
    else {
        result = min.toString();
    }

    if (sec < 10) {
        result += ':0' + sec;
    }
    else {
        result += ':' + sec;
    }

    return result;
}

function lerp(a, b, t) {
    return a + ((b - a) * t);
}

function inverseLerp(a, b, val) {
    return clamp((val - a) / (b - a), 0.0, 1.0);
}

function clamp(val, min, max) {
    return Math.min(Math.max(min, val), max);
}

function randomInt(minInclusive, maxInclusive) {
    return Math.floor(lerp(minInclusive, maxInclusive + 1, Math.random()));
}

function animateCSS(element, animationName, callback) {
    const node = document.querySelector(element);
    node.classList.add('animated', animationName, 'fastest');

    function handleAnimationEnd() {
        node.classList.remove('animated', animationName, 'fastest');
        node.removeEventListener('animationend', handleAnimationEnd);
        
        if(typeof callback === 'function')
            callback();
    }

    node.addEventListener('animationend', handleAnimationEnd);
}