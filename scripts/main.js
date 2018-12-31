// A nice compilation of helper functions for my projects.
// Author: Kevin Tong

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

function clamp(val, min, max) {
    return Math.min(Math.max(min, val), max);
}

function randomInt(minInclusive, maxInclusive) {
    return Math.floor(lerp(minInclusive, maxInclusive + 1, Math.random()));
}