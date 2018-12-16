const TYPE_INVALID = -2; // Files that would absolutely not be suitable.
const TYPE_UNSUPPORTED = -1; // Not natively supported, but it will still read.

const INVALID_TYPES = ['exe', 'png', 'jpg', 'jpeg', 'mp3', 'mp4', 'dll', 'psd', 'pak', 'dat', 'bytes', 'pdf'];

const TYPE_TEXT = 0; // Regular text files.
const TYPE_JS = 1; // JavaScript
const TYPE_HTML = 2; // HTML
const TYPE_CSS = 3; // CSS
const TYPE_CPP = 4; // C++
const TYPE_CSHARP = 5; // C#
const TYPE_JAVA = 6; // Java.

const SUPPORTED_TYPES = {
    'txt': TYPE_TEXT,
    'log': TYPE_TEXT,
    'csv': TYPE_TEXT,
    'ini': TYPE_TEXT,

    'js': TYPE_JS,
    'html': TYPE_HTML,
    'css': TYPE_CSS,
    'cpp': TYPE_CPP,
    'cs': TYPE_CSHARP,
    'java': TYPE_JAVA,
};


// File collection
class FileInfo {
    constructor(file) {
        this.data = file;
        this._determineFileType();

        // Per-file stats.
        this.lineCount = 0;
        this.avgCharsPerLine = 0;

        if (!this.valid()) {
            console.log(this.name() + ' is an invalid file! Ignoring it...');
        }
        else if (!this.supported()) {
            console.log(this.name() + ' is not natively supported. Some options will not apply to this file.');
        }
    }

    // Public properties.
    name() {
        if (this.data == null) {
            return '';
        }

        return this.data.name;
    }

    timestamp() {
        if (this.data == null) {
            return 0;
        }
        return this.data.lastModified;
    }

    size() {
        if (this.data == null) {
            return 0;
        }

        return this.data.size;
    }

    // Helper functions.
    valid() {
        return (this.type > TYPE_INVALID);
    }

    supported() {
        return (this.type > TYPE_UNSUPPORTED);
    }

    getFileExtension() {
        var fileName = this.name();
        var lastPeriod = fileName.lastIndexOf('.');

        if (lastPeriod > -1) {
            // Return everything after last period.
            return fileName.substring(lastPeriod + 1, fileName.length);
        }

        console.log('No extension for file ' + fileName);
        return null;
    }

    _determineFileType() {
        var extensionName = this.getFileExtension();
        extensionName = extensionName.toLowerCase(); // case insensitive.

        // Check if it is valid or not.
        for (var i = 0; i < INVALID_TYPES.length; i++) {
            if (extensionName == INVALID_TYPES[i]) {
                this.type = TYPE_INVALID;
                return;
            }
        }

        // Check for type ID if it is in supported list.
        if (extensionName in SUPPORTED_TYPES) {
            this.type = SUPPORTED_TYPES[extensionName];
            return;
        }

        // Not supported.
        this.type = TYPE_UNSUPPORTED;
    }
}

// Chart
var ctx = document.getElementById("dataChart");
var dataChart = null;

// Drag and drop
var dropArea = document.getElementById('dropArea');
var fileList = [];

// Other elements.
var fileSelector = document.getElementById('fileSelector');
var listTitleUI = document.getElementById('fileListTitle');
var fileListUI = document.getElementById('fileList');
var analyzeButton = document.getElementById('analyzeBtn');

dropArea.addEventListener('drop', function (e) {
    e.stopPropagation();
    e.preventDefault();

    console.log('Dropped');
});

// Event function called after selecting files.
fileSelector.onchange = function () {
    addFiles();

    // Clear the file selector value in case we remove and readd the same item.
    fileSelector.value = '';
}

addFiles = function () {
    var numFilesSelected = fileSelector.files.length;

    if (numFilesSelected == 0) {
        return;
    }

    // Add selected files to list (if they aren't already).
    for (var i = 0; i < numFilesSelected; i++) {
        var file = fileSelector.files[i];
        var data = new FileInfo(file);

        // Only add valid files (non-binary).
        if (!data.valid()) {
            // Display error
            $.notify({ title: '<b>Failed to add:</b>', message: file.name + '. It\'s probably because it is a binary file.' }, {
                type: 'danger',
                allow_dismiss: true,
                spacing: 5,
                delay: 1200,
                timer: 300,
                placement: {
                    from: "top",
                    align: "center"
                },
                animate: {
                    enter: 'animated faster fadeInDown',
                    exit: 'animated faster fadeOutUp'
                }
            });

            continue;
        }

        if (!containedInFiles(data)) {
            fileList.push(data);
        }
    }

    // Update UI reprentation.
    updateFileList();
}

containedInFiles = function (toCheck) {
    for (var i = 0; i < fileList.length; i++) {
        var thisFile = fileList[i];

        if (thisFile.timestamp() == toCheck.timestamp() && thisFile.size() == toCheck.size()) {
            return true;
        }
    }

    return false;
}

updateFileList = function () {
    var fileCount = fileList.length;
    var noFiles = (fileCount == 0);

    analyzeButton.disabled = noFiles;

    if (noFiles) {
        // Clear list.
        listTitleUI.innerHTML = '<strong>No files selected...</strong>';
        fileListUI.innerHTML = '';
        return;
    }

    // Format list.
    var listContents = '';

    for (var i = 0; i < fileCount; i++) {
        var styling = '" onclick="removeListItem(' + i + ')" class="file-list-item';

        if (!fileList[i].supported()) {
            // If file type is not supported, color code it to distinguish that fact.
            styling += ' file-list-item-notsup" data-toggle="tooltip" data-placement="bottom" data-html="true" title="';
            styling += '.' + fileList[i].getFileExtension() + ' is not a natively supported file type, <b>but will still be processed</b>.' +
                '<p>Some options will be limited.</p>Click to remove."';
        }
        else {
            styling += '" data-toggle="tooltip" data-placement="bottom" title="Click to remove"';
        }

        styling += '>';
        listContents += '<button id="' + i + styling + fileList[i].name() + '</button>';
    }

    listTitleUI.innerHTML = '<strong>Selected Files (' + fileCount + '):</strong>';
    fileListUI.innerHTML = '<div class="list-group">' + listContents + '</div>';

    // Initialize tooltips for these elements.
    $('[data-toggle="tooltip"]').tooltip();
}

// Event function called after clicking on an item from the list.
removeListItem = function (index) {
    if (fileList.length == 0) {
        return;
    }

    // Dispose tooltip when removing this item.
    $('#' + index).tooltip('dispose');

    // Remove from list.
    fileList.splice(index, 1);
    updateFileList();
}

// Webpage loaded.
this.updateFileList();

// THIS IS WHERE THE REAL STUFF HAPPENS (file reading).
var isReading = false;
var totalLines, totalChars, filesReadSoFar;

processFiles = function () {
    if (fileList.length == 0 || isReading) {
        return;
    }

    // Mark that we are reading, and reset statistics.
    setIsReading(true);
    totalLines = 0;
    totalChars = 0;
    filesReadSoFar = 0;

    for (var i = 0; i < fileList.length; i++) {
        readFile(fileList[i])
    }
}

readFile = function (file) {
    if (!isReading) {
        return;
    }

    var reader = new FileReader;

    // File reading is async, so add a callback for when it completes.
    reader.onload = function (data) {
        filesReadSoFar++;
        file.lineCount = 0;
        file.avgCharsPerLine = 0;

        var text = data.target.result;
        var lastNewLine = -1;

        for (var i = 0; i < text.length; i++) {
            // Handle windows carriage return.
            if (i < text.length - 1 && text[i] == '\r' && text[i + 1] == '\n') {
                i++;
                lastNewLine++;
            }

            if (text[i] == '\n') {
                file.lineCount++;

                // All characters in between the new lines are counted.
                var diff = i - lastNewLine - 1;
                file.avgCharsPerLine += diff;
                lastNewLine = i;
            }
        }

        totalLines += file.lineCount;
        totalChars += file.avgCharsPerLine;

        if (file.lineCount > 0) {
            file.avgCharsPerLine /= (1.0 * file.lineCount);
        }

        file.avgCharsPerLine = Math.round(file.avgCharsPerLine * 100.0) / 100.0;

        if (filesReadSoFar == fileList.length) {
            // DONE READING. Show results and statistics.
            calculateExtraStats();
            displayStats();
            setIsReading(false);
        }
    };

    // Begin reading the file.
    reader.readAsText(file.data);
}

setIsReading = function (reading) {
    // Toggles button controls.
    fileSelector.disabled = reading;
    analyzeButton.disabled = reading;

    // Toggles removal of list items (click events).
    for (var i = 0; i < fileList.length; i++) {
        $('#' + i).prop('disabled', reading);
    }

    isReading = reading;
}

calculateExtraStats = function () {
    console.log('total lines: ' + totalLines);
    console.log('average lines per file: ' + (totalLines / (1.0 * fileList.length)));
    console.log('total chars: ' + totalChars);
}


displayStats = function () {
    console.log('displaying stats');

    // Initialize chart if it doesn't exist.
    if (dataChart == null) {
        dataChart = new Chart(ctx, {
            type: 'horizontalBar'
        });
    }

    // Update chart parameters.

    var dataCount = fileList.length;
    var fileNames = [];
    var dataPoints = [];

    var lineColors = [];
    var lineBorders = [];

    var chartMax = 0;

    fileList.sort(sortFilesHiToLo);

    for (var i = 0; i < dataCount; i++) {
        fileNames.push(fileList[i].name());
        dataPoints.push(fileList[i].lineCount);

        //avgChars.push(fileList[i].avgCharsPerLine);

        if (fileList[i].lineCount > chartMax) {
            chartMax = fileList[i].lineCount;
        }

        var progress = i / (1.0 * dataCount);
        var rg = lerp(180, 80, progress);
        lineColors.push('rgba(255,' + rg + ',56,0.6)');
        lineBorders.push('rgba(205,' + rg + ',105,0.8)');
    }

    dataChart.data = {
        labels: fileNames,
        datasets: [{
            label: '# of Lines',
            data: dataPoints,
            backgroundColor: lineColors,
            borderColor: lineBorders,
            borderWidth: 1
        }]
    };

    dataChart.options = {
        responsive: true,
        maintainAspectRatio: false,

        legend: {
            display: false
        },
        scales: {
            xAxes: [{
                gridLines: {
                    display: true,
                    color: '#808080a0',
                    lineWidth: 2
                },
                ticks: {
                    min: 0,
                    max: chartMax,
                    stepSize: (chartMax / 5),
                    fontColor: '#ffffff'
                }
            }],
            yAxes: [{
                ticks: {
                    fontColor: '#ffffff'
                }
            }]
        }
    }

    dataChart.update();
}

sortFilesHiToLo = function (a, b) {
    return (b.lineCount - a.lineCount);
}

lerp = function (a, b, t) {
    return Math.round(a + ((b - a) * t));
}