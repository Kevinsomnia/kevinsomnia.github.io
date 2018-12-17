const TYPE_INVALID = -2; // Files that would absolutely not be suitable.
const TYPE_UNSUPPORTED = -1; // Not natively supported, but it will still read.

// Binary files are considered invalid types by default.
const INVALID_TYPES = ['7z', 'aif', 'apk', 'avi', 'bin', 'bytes', 'cab', 'cur', 'dat',
                       'db', 'dbf', 'deb', 'dll', 'dmg', 'dmp', 'doc', 'docx', 'drv', 'exe',
                       'flv', 'fnt', 'gif', 'gz', 'h264', 'icns', 'ico', 'iso', 'jpeg',
                       'jpg', 'key', 'm4v', 'mdb', 'mid', 'midi', 'mov', 'mp3', 'mp4', 'mpa',
                       'mpeg', 'mpg', 'msi', 'ods', 'ogg', 'otf', 'pak', 'pdf', 'png', 'pps',
                       'ppt', 'pptx', 'psd', 'rar', 'sav', 'sql', 'svg', 'swf', 'sys', 'tar',
                       'tif', 'tmp', 'toast', 'ttf', 'wav', 'wma', 'wmv', 'xlr', 'xls', 'xlsx',
                       'zip'];

const TYPE_TEXT = 0; // Regular text files.
const TYPE_JS = 1; // JavaScript
const TYPE_MARKUP = 2; // HTML/XML
const TYPE_CSS = 3; // CSS
const TYPE_CPP = 4; // C++
const TYPE_CSHARP = 5; // C#
const TYPE_JAVA = 6; // Java.
const TYPE_UNISHADER = 7; // Unity Shaders.

const SUPPORTED_TYPES = {
    'txt': TYPE_TEXT,
    'log': TYPE_TEXT,
    'csv': TYPE_TEXT,
    'ini': TYPE_TEXT,
    'cfg': TYPE_TEXT,
    'rtf': TYPE_TEXT,
    'xml': TYPE_TEXT,
    'md': TYPE_TEXT,

    'js': TYPE_JS,
    'html': TYPE_MARKUP,
    'xml': TYPE_MARKUP,
    'css': TYPE_CSS,
    'cpp': TYPE_CPP,
    'cs': TYPE_CSHARP,
    'java': TYPE_JAVA,
    'shader': TYPE_UNISHADER,
    'cginc': TYPE_UNISHADER,
    'compute': TYPE_UNISHADER,
};

// Chart visual constants
const BASE_CHART_HEIGHT = 10; // in vh.
const MIN_CHART_HEIGHT = 5;
const BAR_SIZE = 3.5;


// File collection
class FileInfo {
    constructor(file) {
        this.data = file;
        this.size = file.size;
        this._determineFileType();

        // Per-file stats.
        this.lineCount = 0;
        this.avgCharsPerLine = 0;

        if (!this.valid()) {
            console.log(this.name() + ' is an invalid file! Ignoring it...');
        }
    }

    // Public properties that access file data.
    name() {
        return this.data.name;
    }

    timestamp() {
        return this.data.lastModified;
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

    compare(other) {
        return (this.name() == other.name() && this.timestamp() == other.timestamp() && this.size == other.size);
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

// Drag and drop
var dropArea = document.getElementById('dropArea');
var fileList = [];

// Other elements.
var fileSelector = document.getElementById('fileSelector');
var listTitleUI = document.getElementById('fileListTitle');
var fileListUI = document.getElementById('fileList');
var analyzeButton = document.getElementById('analyzeBtn');
var summaryText = document.getElementById('summaryText');

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

function addFiles() {
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

function containedInFiles(toCheck) {
    for (var i = 0; i < fileList.length; i++) {
        var thisFile = fileList[i];

        if (thisFile.compare(toCheck)) {
            return true;
        }
    }

    return false;
}

function updateFileList() {
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
function removeListItem(index) {
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

// THIS IS WHERE THE REAL STUFF HAPPENS (file reading and chart updating).
var isReading = false;
var totalLines, totalChars, avgLinesPerFile, avgCharsPerFile, avgCharsTotalLines, filesReadSoFar;

processFiles = function () {
    if (fileList.length == 0 || isReading) {
        return;
    }

    // Mark that we are reading, and reset statistics.
    setIsReading(true);
    totalLines = 0;
    totalChars = 0;
    avgLinesPerFile = 0;
    avgCharsPerFile = 0;
    avgCharsTotalLines = 0;
    filesReadSoFar = 0;

    for (var i = 0; i < fileList.length; i++) {
        readFile(fileList[i])
    }
}

function readFile(file) {
    if (!isReading) {
        return;
    }

    var reader = new FileReader;

    // File reading is async, so add a callback for when it completes.
    reader.onload = function (data) {
        filesReadSoFar++;
        file.lineCount = 1;
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
            displayDetailedStats();
            updateOverview();
            setIsReading(false);
        }
    };

    // Begin reading the file.
    reader.readAsText(file.data);
}

function setIsReading(reading) {
    // Toggles button controls.
    fileSelector.disabled = reading;
    analyzeButton.disabled = reading;

    // Toggles removal of list items (click events).
    for (var i = 0; i < fileList.length; i++) {
        $('#' + i).prop('disabled', reading);
    }

    isReading = reading;
}

function calculateExtraStats() {
    avgLinesPerFile = totalLines / (1.0 * fileList.length);
    avgLinesPerFile = Math.round(avgLinesPerFile * 100.0) / 100.0;

    avgCharsPerFile = totalChars / (1.0 * fileList.length);
    avgCharsPerFile = Math.round(avgCharsPerFile);

    avgCharsTotalLines = totalChars / (1.0 * totalLines);
    avgCharsTotalLines = Math.round(avgCharsTotalLines * 100.0) / 100.0;
}

// Charts
var activeChartView = 0;
var chartUnits = ['# of Lines', 'Avg. Characters per Line', 'File Size in Bytes'];

var dataChartParent = document.getElementById('chartContainer');
var dataChartCtx = document.getElementById('dataChart');
var dataChart = new Chart(dataChartCtx, {
    type: 'horizontalBar'
});

var distribChartCtx = document.getElementById('distribChart');
var distribChart = new Chart(distribChartCtx, {
    type: 'doughnut'
});

function updateOverview() {
    var selectedFiles = fileList.length > 0;

    // Update summary box.
    if (selectedFiles) {
        var content = '<b>Files Analyzed:</b> ' + fileList.length + '<br>';
        content += '<br>';
        content += '<b>Total Line Count:</b> ' + totalLines.toLocaleString() + ' lines<br>';
        content += '<b>Average Lines per File:</b> ' + avgLinesPerFile.toLocaleString() + ' lines<br>';
        content += '<br>';
        content += '<b>Total Character Count:</b> ' + totalChars.toLocaleString() + ' characters<br>';
        content += '<b>Average Characters per File:</b> ' + avgCharsPerFile.toLocaleString() + ' characters<br>';
        content += '<b>Average Characters per Lines:</b> ' + avgCharsTotalLines.toLocaleString() + ' characters<br>';

        // Replace with actual word count and user-set WPM.
        var avgCharsPerWord = 4.84;
        var wpm = 60.0;
        var charsPerMin = wpm * avgCharsPerWord;

        content += '<br>If you started typing all of these files, non-stop and consecutively, you would finish at <b>';

        // Calculate date in 'x' minutes into the future.
        var curDate = new Date();
        var durationInMinutes = (totalChars / charsPerMin);
        var newMs = curDate.getTime() + (durationInMinutes * 60000); // Target date in ms.
        curDate.setTime(newMs);

        content += curDate.toLocaleString() + '</b> (from ' + wpm + ' words per minute).';

        if (durationInMinutes >= 1440) {
            // Takes a day or more.
            content += " That's a long time!";
        }

        summaryText.innerHTML = content;
    }
    else {
        summaryText.innerHTML = '<b>Please select files using the dialog box above!</b>';
    }

    Chart.defaults.global.legend.labels.usePointStyle = true;
    var overview = retrieveOverviewData();

    // DISTRIBUTION DOUGHNUT CHART OF FILE TYPES.
    distribChart.data = {
        labels: overview[0],
        datasets: [{
            data: overview[2],
            backgroundColor: overview[3],
            borderColor: overview[4],
            borderWidth: 1
        }]
    };

    distribChart.options = {
        responsive: false,
        maintainAspectRatio: false,
        legend: {
            labels: {
                generateLabels: function (chart) {
                    var data = chart.data;
                    var newLabels = [];

                    if (data.labels.length > 0) {
                        // Generate new legend labels.
                        var dataMeta = chart.getDatasetMeta(0);

                        for (var i = 0; i < data.labels.length; i++) {
                            var set = data.datasets[0];

                            newLabels.push({
                                text: overview[1][i],
                                fillStyle: set.backgroundColor[i],
                                strokeStyle: set.borderColor[i],
                                lineWidth: set.borderWidth,
                                hidden: dataMeta.data[i].hidden,
                                index: i
                            });
                        }
                    }

                    return newLabels;
                },
                fontColor: '#ffffff'
            }
        }
    };

    distribChart.update();
}

function retrieveOverviewData() {
    var dataCount = fileList.length;

    if (dataCount == 0) {
        return [['% of File Type'], ['File Type'], [100], ['rgba(255,200,125,0.8)'], ['rgba(255,255,255,1.0)']];
    }

    var totalSize = 0;

    var names = [];
    var extNames = [];
    var extSizes = [];
    var fillCols = [];
    var borderCols = [];

    for (var i = 0; i < dataCount; i++) {
        // Accumulate total file size per file extension.
        var ext = fileList[i].getFileExtension().toUpperCase();
        var indexInExtArr = extNames.indexOf(ext);
        var fileSize = fileList[i].size;

        if (indexInExtArr > -1) {
            // Exists already, accumulate.
            extSizes[indexInExtArr] += fileSize;
        }
        else {
            // Create new pair.
            names.push('% of .' + ext + ' files');
            extNames.push(ext);
            extSizes.push(fileSize);
        }

        totalSize += fileSize;
    }

    for (var i = 0; i < names.length; i++) {
        extSizes[i] *= (100.0 / totalSize);
        // Trim decimal places.
        extSizes[i] = Math.round(extSizes[i] * 100.0) / 100.0;

        // Get random colors for each segment.
        var r = getRandomInt(0, 160);
        var g = getRandomInt(0, 160);
        var b = getRandomInt(0, 160);
        fillCols.push('rgba(' + r + ',' + g + ',' + b + ',0.8)');
        borderCols.push('rgba(' + (r + 95) + ',' + (g + 95) + ',' + (b + 95) + ',0.9)');
    }

    return [names, extNames, extSizes, fillCols, borderCols];
}

function getRandomInt(min, max) {
    var randomT = Math.random();
    return Math.floor(lerp(min, max + 1, randomT));
}

function changeDetailedView(viewIndex) {
    if (viewIndex == activeChartView) {
        return;
    }

    activeChartView = viewIndex;
    displayDetailedStats();
}

function displayDetailedStats() {
    // BASE CHART WITH MULTIPLE VIEWS.
    var chartData = retrieveChartData();

    dataChart.data = {
        labels: chartData[0],
        datasets: [{
            label: chartUnits[activeChartView],
            data: chartData[1],
            backgroundColor: chartData[2],
            borderColor: chartData[3],
            borderWidth: 1
        }]
    };

    dataChart.options = {
        maintainAspectRatio: false,
        legend: {
            display: false
        },
        scales: {
            xAxes: [{
                scaleLabel: {
                    display: true,
                    labelString: chartUnits[activeChartView],
                    fontColor: '#ffffff'
                },
                gridLines: {
                    display: true,
                    color: '#40404090',
                    lineWidth: 1
                },
                ticks: {
                    min: 0,
                    max: chartData[4],
                    stepSize: (chartData[4] / 4),
                    fontColor: '#ffffff'
                }
            }],
            yAxes: [{
                barPercentage: 0.925,
                categoryPercentage: 1.0,
                ticks: {
                    fontColor: '#ffffff',
                    mirror: true,
                    padding: -6
                }
            }]
        }
    };

    dataChart.update();

    var newHeight = Math.max(BASE_CHART_HEIGHT, MIN_CHART_HEIGHT + (fileList.length * BAR_SIZE));
    dataChartParent.style.height = newHeight + 'vh';
}

// Returns a JSON object: {items (list), max (float/int)}.
function retrieveChartData() {
    var dataCount = fileList.length;

    if (dataCount == 0) {
        return [[], [], [], [], 100];
    }

    // We do not want to sort the file list itself. So create a copy of this array.
    var sortedFiles = fileList.slice(0);
    sortedFiles.sort(sortFilesBehavior);

    var names = [];
    var vals = [];
    var fillCols = [];
    var borderCols = [];
    var chartMax = 0;

    for (var i = 0; i < dataCount; i++) {
        // Get the value depending on chart view.
        var val = sortedFiles[i].lineCount;

        if (activeChartView == 1) {
            val = sortedFiles[i].avgCharsPerLine;
        }
        else if (activeChartView == 2) {
            val = sortedFiles[i].size;
        }

        // Set new maximum if applicable.
        if (val > chartMax) {
            chartMax = val;
        }

        names.push(sortedFiles[i].name());
        vals.push(val);

        // Create a gradient from colors
        var factor = i / (1.0 * dataCount);
        var rg = lerp(180, 80, factor);
        fillCols.push('rgba(255,' + rg + ',56,0.125)');
        borderCols.push('rgba(205,' + rg + ',105,0.8)');
    }

    chartMax = Math.ceil(chartMax);
    return [names, vals, fillCols, borderCols, chartMax];
}

function sortFilesBehavior(a, b) {
    if (activeChartView == 1) {
        // Sort by descending average characters per line.
        return (b.avgCharsPerLine - a.avgCharsPerLine);
    }
    else if (activeChartView == 2) {
        // Sort by descending file size.
        return (b.size - a.size);
    }

    // Sort by descending line count.
    return (b.lineCount - a.lineCount);
}

function lerp(a, b, t) {
    return Math.round(a + ((b - a) * t));
}

// On page load: Enable visibility of graphs and fill with dummy data.
displayDetailedStats();
updateOverview();