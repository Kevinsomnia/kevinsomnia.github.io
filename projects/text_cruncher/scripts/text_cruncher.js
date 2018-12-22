const TYPE_INVALID = -2; // Files that would absolutely not be suitable.
const TYPE_UNSUPPORTED = -1; // Not natively supported, but it will still read.

// Binary files are considered invalid types by default.
const INVALID_TYPES = ['7z', 'aif', 'anim', 'apk', 'asset', 'assets', 'avi', 'bin', 'blend', 'blend1', 'bmp',
    'bsa', 'bsp', 'bundle', 'bytes', 'cab', 'controller', 'cso', 'cur', 'dat', 'db', 'dbf', 'dds', 'deb', 'dll',
    'dmg', 'dmp', 'doc', 'docx', 'drv', 'dylib', 'esm', 'esp', 'exe', 'fbx', 'flv', 'fnt', 'gif', 'guiskin',
    'gz', 'h264', 'icns', 'ico', 'iso', 'jpeg', 'jpg', 'key', 'm4v', 'mask', 'mat', 'mdb', 'mid',
    'midi', 'mov', 'mp3', 'mp4', 'mpa', 'mpeg', 'mpg', 'msi', 'ods', 'ogg', 'otf', 'overridecontroller',
    'pak', 'pdb', 'pdf', 'physicmaterial', 'png', 'pps', 'ppt', 'pptx', 'prefab', 'psd', 'rar', 'resS',
    'sav', 'so', 'svg', 'swf', 'sys', 'tar', 'tga', 'tif', 'tiff', 'tmp', 'toast', 'ttf', 'unity',
    'unitypackage', 'wav', 'wma', 'wmv', 'xlr', 'xls', 'xlsx', 'zip']

// Associate file-types to comment styling.
const NO_COMMENTS = 0; // Regular text files. Doesn't support comments.
const C_COMMENTS = 1; // C-styled comments (//, /* */).
const MARKUP_COMMENTS = 2; // HTML/XML (// (scripts), <!-- -->)
const CSS_COMMENTS = 3; // CSS (only /* */)
const SH_COMMENTS = 4; // SH files (#)

const SUPPORTED_TYPES = {
    'txt': NO_COMMENTS,
    'log': NO_COMMENTS,
    'csv': NO_COMMENTS,
    'ini': NO_COMMENTS,
    'cfg': NO_COMMENTS,
    'rtf': NO_COMMENTS,
    'xml': NO_COMMENTS,
    'md': NO_COMMENTS,
    'srt': NO_COMMENTS,
    'json': NO_COMMENTS,
    'gitignore': NO_COMMENTS,
    'vdf': NO_COMMENTS,

    'js': C_COMMENTS,
    'cpp': C_COMMENTS,
    'shader': C_COMMENTS,
    'cginc': C_COMMENTS,
    'h': C_COMMENTS,
    'java': C_COMMENTS,
    'cs': C_COMMENTS,
    'html': MARKUP_COMMENTS,
    'xml': MARKUP_COMMENTS,
    'css': CSS_COMMENTS,
    'sh': SH_COMMENTS
};

// Chart visual constants
const BASE_CHART_HEIGHT = 175; // in pixels.
const BAR_SIZE = 28;
const CHART_ENTRIES_PER_PAGE = 100; // Limit data displayed on chart at once.

// Other constants.
const MAX_FILES_PROCESSED_PER_FRAME = 500;
const FILE_PROCESS_INTERVAL = 10; // in milliseconds.
const ADD_ERROR_MSG_LIMIT = 15;

// Global settings (default values).
var allowEmptyFileExtensions = false;
var allowDuplicateFiles = false;
var allowBinaryFiles = false;
var ignoreCommentedLines = true;
var ignoreEmptyLines = true;
var invalidKeywords = [];

// File collection
class FileInfo {
    constructor(file) {
        this.data = file;
        this.name = file.name;
        this.timestamp = file.lastModified;
        this.size = file.size;
        this._retrieveFileExtension();

        // Per-file stats.
        this.lineCount = 0;
        this.commentedLineCount = 0;
        this.emptyLineCount = 0;
        this.charCount = 0;
        this.avgCharsPerLine = 0;
    }

    // Compares files by name, timestamp, and size.
    compare(other) {
        return (this.name == other.name && this.timestamp == other.timestamp && this.size == other.size);
    }

    // After all the inexpensive validity checks are done, this is finally called to determine the file type and if it's accepted or not.
    completeInit() {
        this._determineFileType();
        this.valid = (this.type > TYPE_INVALID);
        this.supported = (this.type > TYPE_UNSUPPORTED);
    }

    // Returns true if file name is contains a keyword in the invalid keywords list.
    invalidByUser() {
        if (invalidKeywords.length > 0) {
            var fileName = this.name;

            for (var i = 0; i < invalidKeywords.length; i++) {
                if (fileName.includes(invalidKeywords[i])) {
                    return true;
                }
            }
        }

        return false;
    }

    isComment(text, start) {
        if (this.type != TYPE_UNSUPPORTED && this.type != NO_COMMENTS) {
            var textLength = text.length;
            var comment = this.getLineCommentString();

            for (var i = 0; i < comment.length; i++) {
                var absIndex = start + i;

                if (absIndex >= textLength) {
                    break; // Going out of text bounds.
                }

                if (text[absIndex] != comment[i]) {
                    return false; // Found a non-matching character from comment.
                }
            }

            return true;
        }

        // Does not support comments.
        return false;
    }

    getLineCommentString() {
        switch (this.type) {
            case C_COMMENTS:
                return '//';
            case SH_COMMENTS:
                return '#';
        }

        return null;
    }

    _determineFileType() {
        if (!allowBinaryFiles) {
            // Check if it is a binary file or not.
            // TODO: Use binary search.
            for (var i = 0; i < INVALID_TYPES.length; i++) {
                if (this.extension == INVALID_TYPES[i]) {
                    this.type = TYPE_INVALID;
                    return;
                }
            }
        }

        // Check for supported type ID if the extension is not empty.
        if (this.extension) {
            if (this.extension in SUPPORTED_TYPES) {
                this.type = SUPPORTED_TYPES[this.extension];
                return;
            }
        }

        // Not supported.
        this.type = TYPE_UNSUPPORTED;
    }

    _retrieveFileExtension() {
        var fileName = this.name;
        var lastPeriod = fileName.lastIndexOf('.');

        if (lastPeriod > -1) {
            // Return everything after last period.
            this.extension = fileName.substring(lastPeriod + 1, fileName.length).toLowerCase();
            return;
        }

        this.extension = '';
    }
}

// Drag and drop
var dropArea = document.getElementById('dropArea');
var fileList = [];

// HTML elements.
var fileSelector = document.getElementById('fileSelector');
var dirSelector = document.getElementById('directorySelector');
var listTitleUI = document.getElementById('fileListTitle');
var fileListUI = document.getElementById('fileList');
var analyzeButton = document.getElementById('analyzeBtn');
var settingsButton = document.getElementById('settingsBtn');
var summaryText = document.getElementById('summaryText');

// Other global variables.
var isBusy = false;
var queuedAddErrors = [];
var addErrorCount = 0;

// Settings events.
function loadSettings() {
    // Load setting values from storage.
    allowDuplicateFiles = loadBoolean('allowDupFiles', false);
    allowEmptyFileExtensions = loadBoolean('allowEmptyFileExt', false);
    allowBinaryFiles = loadBoolean('allowBinFiles', false);
    ignoreCommentedLines = loadBoolean('ignoreComments', true);
    ignoreEmptyLines = loadBoolean('ignoreEmptyLines', true);
    invalidKeywords = loadArray('invalidKeywords');

    // Update UI.
    $('#allowDupFiles').attr('checked', allowDuplicateFiles);
    $('#allowEmptyExt').attr('checked', allowEmptyFileExtensions);
    $('#allowBinFiles').attr('checked', allowBinaryFiles);
    $('#ignoreComments').attr('checked', ignoreCommentedLines);
    $('#ignoreEmptyLines').attr('checked', ignoreEmptyLines);

    for (var i = 0; i < invalidKeywords.length; i++) {
        $("#invalidKeywords").tagit('createTag', invalidKeywords[i]);
    }
};

function loadBoolean(key, defaultValue) {
    var value = localStorage.getItem(key);

    if (value !== null) {
        return (value === 'true');
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

$('#allowDupFiles').change(function (e) {
    allowDuplicateFiles = e.target.checked;
    localStorage.setItem('allowDupFiles', allowDuplicateFiles.toString());
});

$('#allowEmptyExt').change(function (e) {
    allowEmptyFileExtensions = e.target.checked;
    localStorage.setItem('allowEmptyFileExt', allowEmptyFileExtensions.toString());
});

$('#allowBinFiles').change(function (e) {
    allowBinaryFiles = e.target.checked;
    localStorage.setItem('allowBinFiles', allowBinaryFiles.toString());
});

$('#ignoreComments').change(function (e) {
    ignoreCommentedLines = e.target.checked;
    localStorage.setItem('ignoreComments', ignoreCommentedLines.toString());
});

$('#ignoreEmptyLines').change(function (e) {
    ignoreEmptyLines = e.target.checked;
    localStorage.setItem('ignoreEmptyLines', ignoreEmptyLines.toString());
});

$('#closeSettings').click(function (e) {
    // Save invalid keyword list into one string.
    invalidKeywords = $('#invalidKeywords').tagit('assignedTags');
    localStorage.setItem('invalidKeywords', invalidKeywords.join(','));
});

// Drag and drop event.
dropArea.addEventListener('drop', function (e) {
    e.stopPropagation();
    e.preventDefault();

    console.log('Dropped');
});

// Event function called after selecting files.
fileSelector.onchange = function () {
    setupAddFiles(fileSelector);
}

// Event function called after selecting directories.
dirSelector.onchange = function () {
    setupAddFiles(dirSelector);
}

function setupAddFiles(element) {
    var numFilesSelected = element.files.length;

    if (numFilesSelected === 0) {
        return;
    }

    // Notify that it may take a while to add more than 1000 files.
    var showNotification = (numFilesSelected >= 1000);
    setIsBusy(true);

    if (showNotification) {
        var notify = $.notify({ title: '<b>Adding files:</b>', message: 'This may take a while...' }, {
            type: 'info',
            allow_dismiss: false,
            spacing: 5,
            timer: 0,
            showProgressbar: true,
            placement: {
                from: "top",
                align: "center"
            },
            animate: {
                enter: 'animated faster fadeInDown',
                exit: 'animated faster fadeOutUp'
            }
        });

        addFiles(element, notify)
    }
    else {
        addFiles(element, null);
    }
}

function addFiles(element, notification) {
    addFilesChunked(element, 0, MAX_FILES_PROCESSED_PER_FRAME, notification);
}

function addFilesChunked(element, start, end, notification) {
    var numFilesSelected = element.files.length;

    if (end > numFilesSelected) {
        end = numFilesSelected;
    }

    // Add selected files to list (if they aren't already).
    for (var i = start; i < end; i++) {
        var file = element.files[i];
        var data = new FileInfo(file);

        // Limit size of files to 1 GiB (2^30).
        if (data.size >= 1073741824) {
            addErrorToQueue(file.name + ' is too large! Files must be less than 1 GiB.');
            continue;
        }

        // Ignore empty file extensions (if active).
        if (!allowEmptyFileExtensions && data.extension === '') {
            addErrorToQueue(file.name + '. The file extension is empty (toggleable setting).');
            continue;
        }

        data.completeInit();

        // Only add valid files (non-binary).
        if (!data.valid) {
            addErrorToQueue(file.name + ' is not a text file (toggleable setting).');
            continue;
        }

        // This file is marked contains a invalid keyword definition.
        if (data.invalidByUser()) {
            addErrorToQueue(file.name + ' contains an invalid keyword (user-defined).');
            continue;
        }

        if (allowDuplicateFiles || !containedInFiles(data)) {
            fileList.push(data);
        }
    }

    if (end === numFilesSelected) {
        // Update UI representation.
        updateFileList();
        setIsBusy(false);

        // Clear the file selector value in case we remove and readd the same item.
        element.value = '';

        if (notification != null) {
            notification.close();
        }

        // Display errors, if there are any.
        if (addErrorCount > ADD_ERROR_MSG_LIMIT) {
            displayError('Failed to add <b>' + addErrorCount + '</b> files.');
        }
        else {
            for (var i = 0; i < queuedAddErrors.length; i++) {
                displayError(queuedAddErrors[i]);
            }
        }

        queuedAddErrors.length = 0;
        addErrorCount = 0;
    }
    else {
        if (notification != null) {
            // Update progress bar on notification.
            notification.update('progress', (end * 100.0) / numFilesSelected);
        }

        // Process the next chunk of files.
        setTimeout(function () {
            addFilesChunked(element, end, end + MAX_FILES_PROCESSED_PER_FRAME, notification);
        }, FILE_PROCESS_INTERVAL);
    }
}

function addErrorToQueue(msg) {
    if (queuedAddErrors.length < ADD_ERROR_MSG_LIMIT) {
        queuedAddErrors.push(msg);
    }

    addErrorCount++;
}

function displayError(msg) {
    $.notify({ title: '<b>Error:</b>', message: msg }, {
        type: 'danger',
        allow_dismiss: true,
        spacing: 5,
        delay: 3000,
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
    var noFiles = (fileCount === 0);

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

        if (!fileList[i].supported) {
            // If file type is not supported, color code it to distinguish that fact.
            styling += ' file-list-item-notsup" data-toggle="tooltip" data-placement="bottom" data-html="true" title="';
            styling += '.' + fileList[i].extension + ' is not a natively supported file type, <b>but will still be processed</b>.' +
                '<p>Some options, like ignoring comments, will be limited.</p>Click to remove."';
        }
        else {
            styling += '" data-toggle="tooltip" data-placement="bottom" title="Click to remove"';
        }

        styling += '>';
        listContents += '<button id="' + i + styling + fileList[i].name + '</button>';
    }

    var searchField = '<div class="form-group"><input id="fileListSearch" class="form-control" type="text" placeholder="(doesn\'t work yet)"></div>';

    var buttons = '<button class="btn btn-primary btn-md ml-2" onclick="searchFilter()" style="background-color:#4286f4" role="button">Go</button>';
    buttons += '<button class="btn btn-primary btn-md ml-4" onclick="removeAllUnsupported()" style="background-color:#9b7735" role="button">Remove Unsupported</button>';
    buttons += '<button class="btn btn-primary btn-md ml-2" onclick="clearList()" style="background-color:#a03333" role="button">Clear List</button>';

    listTitleUI.innerHTML = '<strong>Selected Files (' + fileCount + ')</strong><div class="form-inline">' + searchField + buttons + '</div>';
    fileListUI.innerHTML = '<div class="list-group">' + listContents + '</div>';

    // Update disabled states of these buttons.
    for (var i = 0; i < fileList.length; i++) {
        $('#' + i).prop('disabled', isBusy);
    }

    // Initialize tooltips for these buttons.
    $('[data-toggle="tooltip"]').tooltip();
}

function searchFilter() {
    var searchValue = $('#fileListSearch').val();

    if (searchValue) {

    }
    else {

    }
}

// Event function called after clicking on an item from the list.
function removeListItem(index) {
    if (fileList.length === 0) {
        return;
    }

    // Dispose tooltip when removing this item.
    $('#' + index).tooltip('dispose');

    // Remove from list.
    fileList.splice(index, 1);
    updateFileList();
}

// Event function called after clicking the clear all button.
function clearList() {
    if (fileList.length === 0) {
        return;
    }

    // Dispose all tooltips.
    for (var i = 0; i < fileList.length; i++) {
        $('#' + i).tooltip('dispose');
    }

    // Clear all elements.
    fileList.splice(0, fileList.length);
    updateFileList();
}

// Event function called after clicking the remove all unsupported button.
function removeAllUnsupported() {
    if (fileList.length === 0) {
        return;
    }

    var removedSomething = false;

    for (var i = fileList.length - 1; i >= 0; i--) {
        if (!fileList[i].supported) {
            // Dispose this tooltip and remove from list.
            $('#' + i).tooltip('dispose');
            fileList.splice(i, 1);
            removedSomething = true;
        }
    }

    if (removedSomething) {
        updateFileList();
    }
}

// THIS IS WHERE THE REAL STUFF HAPPENS (file reading and chart updating).
var totalCountedLines, totalCommentedLines, totalEmptyLines, totalChars, avgLinesPerFile, avgCharsPerFile, avgCharsTotalLines, filesReadSoFar;

processFiles = function () {
    if (fileList.length === 0 || isBusy) {
        return;
    }

    // Mark that we are busy analyzing, and reset statistics.
    setIsBusy(true);
    totalCountedLines = 0;
    totalCommentedLines = 0;
    totalEmptyLines = 0;
    totalChars = 0;
    avgLinesPerFile = 0;
    avgCharsPerFile = 0;
    avgCharsTotalLines = 0;
    filesReadSoFar = 0;
    filesSuccessfullyRead = 0;

    // Start progress bar.
    $("#analyzeProgParent").show();
    $("#analyzeProgress").css('width', '0%').attr('aria-valuenow', 0);

    // Begin reading.
    for (var i = 0; i < fileList.length; i++) {
        readFile(fileList[i])
    }
}

function readFile(file) {
    if (!isBusy) {
        return;
    }

    var reader = new FileReader;

    // File reading is async, so add a callback for when it completes.
    reader.onloadend = function (event) {
        filesReadSoFar++;

        if (event.target.error != null) {
            displayError('Cannot read ' + file.name + ' :: ' + event.target.error.message);
        }
        else {
            filesSuccessfullyRead++;

            var curLineNum = 1;
            file.lineCount = 1; // Starts at one because we include the first line (even in empty files) (except for comments).
            file.charCount = 0;
            file.commentedLineCount = 0;
            file.emptyLineCount = 0;

            var text = event.target.result;
            var lineStart = 0; // Used to count characters between lines.

            var searchingForComment = ignoreCommentedLines; // Only search when we need to ignore commented lines.
            var isCommentedLine = false;
            var isEmptyLine = true; // Line is empty until we find a non-whitespace character.
            var isFirstLine = true;

            for (var i = 0; i < text.length; i++) {
                var isLastCharacterInFile = (i === text.length - 1);

                var windows = (!isLastCharacterInFile && text[i] === '\r' && text[i + 1] === '\n'); // CR LF
                var unix = (text[i] === '\n'); // LF
                var mac = (text[i] === '\r'); // CR
                var isNewLine = (windows || unix || mac);

                if (isNewLine) {
                    if (ignoreEmptyLines && isEmptyLine) {
                        file.emptyLineCount++;
                    }
                    else if (ignoreCommentedLines && isCommentedLine) {
                        file.commentedLineCount++;
                    }
                    else {
                        file.lineCount++;
                    }

                    // Gets the length of the current line up to (but not including) this character.
                    var diff = i - lineStart;

                    if (windows) {
                        i++; // Skip \n.
                    }

                    curLineNum++;
                    file.charCount += diff;
                    lineStart = i + 1; // Set the starting point of the next line.

                    isFirstLine = false;
                    searchingForComment = ignoreCommentedLines;
                    isEmptyLine = true;
                }
                else {
                    if (isLastCharacterInFile) {
                        // Accumulate character count for the final line.
                        var lineLength = i - lineStart + 1;
                        file.charCount += lineLength;
                    }
                    else {
                        // The file reading and current line is not over.

                        if (isEmptyLine) {
                            if (!isWhiteSpace(text[i])) {
                                // We hit something that is not whitespace.

                                if (searchingForComment) {
                                    // The first non-whitespace character of this line. This line is either a comment or not.
                                    isCommentedLine = file.isComment(text, i);

                                    if (isCommentedLine && isFirstLine) {
                                        file.lineCount = 0; // Don't count the first line anymore, since the first line is commented.
                                        file.commentedLineCount = 1;
                                    }

                                    searchingForComment = false;
                                }

                                isEmptyLine = false;
                            }
                        }
                    }
                }
            }

            // Calculate average characters per line.
            if (file.lineCount > 0) {
                file.avgCharsPerLine = file.charCount / (1.0 * file.lineCount);
            }

            file.avgCharsPerLine = Math.round(file.avgCharsPerLine * 100.0) / 100.0;

            // Accumulate total stats.
            totalCountedLines += file.lineCount;
            totalCommentedLines += file.commentedLineCount;
            totalEmptyLines += file.emptyLineCount;
            totalChars += file.charCount;
        }

        // Update progress bar.
        progress = (filesReadSoFar * (100.0 / fileList.length));
        $("#analyzeProgress").css("width", progress + "%").attr("aria-valuenow", progress);

        if (filesReadSoFar === fileList.length) {
            // DONE READING. Show results and statistics.
            calculateExtraStats();
            displayDetailedStats();
            updateOverview();
            setIsBusy(false);

            // Fade out progress bar.
            $("#analyzeProgParent").fadeOut(250);
        }
    };

    // Begin reading the file.
    reader.readAsText(file.data);
}

function setIsBusy(busy) {
    // Toggles button controls.
    $('#helpBtn').prop('disabled', busy);
    fileSelector.disabled = busy;
    dirSelector.disabled = busy;
    analyzeButton.disabled = busy;
    settingsButton.disabled = busy;

    // Toggles removal of list items (click events).
    for (var i = 0; i < fileList.length; i++) {
        $('#' + i).prop('disabled', busy);
    }

    isBusy = busy;
}

function calculateExtraStats() {
    if (fileList.length > 0) {
        avgLinesPerFile = totalCountedLines / (1.0 * fileList.length);
        avgLinesPerFile = Math.round(avgLinesPerFile * 100.0) / 100.0;

        avgCharsPerFile = totalChars / (1.0 * fileList.length);
        avgCharsPerFile = Math.round(avgCharsPerFile);
    }

    if (totalCountedLines > 0) {
        avgCharsTotalLines = totalChars / (1.0 * totalCountedLines);
        avgCharsTotalLines = Math.round(avgCharsTotalLines * 100.0) / 100.0;
    }
}

// Charts
var activeChartView = 0;
var chartUnits = ['# of Lines', '# of Characters', 'Avg. Characters per Line'];

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
    var content = '<h4 class="main-header text-center">Summary</h4>'

    // Update summary box.
    if (selectedFiles) {
        var actualTotalLineCount = totalCountedLines + totalCommentedLines + totalEmptyLines;

        content += '<b>Files Analyzed:</b> ' + filesSuccessfullyRead.toLocaleString() + ' files.<br>';
        content += '<br>';
        content += '<b>Total Line Count:</b> ' + totalCountedLines.toLocaleString() + ' lines.<br>';
        content += '<b>Average Lines per File:</b> ' + avgLinesPerFile.toLocaleString() + ' lines.<br>';

        if (ignoreCommentedLines || ignoreEmptyLines) {
            content += '<br>';
        }

        if (ignoreCommentedLines) {
            var percentOfTotal = (totalCommentedLines * 100.0) / actualTotalLineCount;
            percentOfTotal = Math.round(percentOfTotal * 100.0) / 100.0;
            content += '<b>Commented Line Count:</b> ' + totalCommentedLines.toLocaleString() + ' lines (' + percentOfTotal + '% of total).<br>';
        }

        if (ignoreEmptyLines) {
            var percentOfTotal = (totalEmptyLines * 100.0) / actualTotalLineCount;
            percentOfTotal = Math.round(percentOfTotal * 100.0) / 100.0;
            content += '<b>Empty Line Count:</b> ' + totalEmptyLines.toLocaleString() + ' lines (' + percentOfTotal + '% of total).<br>';
        }

        content += '<br>';
        content += '<b>Total Character Count:</b> ' + totalChars.toLocaleString() + ' characters.<br>';
        content += '<b>Average Character Count per File:</b> ' + avgCharsPerFile.toLocaleString() + ' characters.<br>';
        content += '<b>Average Character Count per Line:</b> ' + avgCharsTotalLines.toLocaleString() + ' characters.<br>';

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
    }
    else {
        content += 'You haven\'t analyzed any files yet... but that can be changed right now!';
    }

    summaryText.innerHTML = content;

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

    if (dataCount === 0) {
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
        var ext = fileList[i].extension;

        if (ext) {
            ext = ext.toUpperCase();
        }
        else {
            ext = '<NULL>'; // Make it clear there is no extension.
        }

        var indexInExtArr = extNames.indexOf(ext);
        var fileSize = fileList[i].size;

        if (indexInExtArr > -1) {
            // Exists already, accumulate.
            extSizes[indexInExtArr] += fileSize;
        }
        else {
            names.push('% of .' + ext + ' files');
            extNames.push(ext);
            extSizes.push(fileSize);
        }

        totalSize += fileSize;
    }

    for (var i = 0; i < names.length; i++) {
        if (totalSize > 0) {
            extSizes[i] *= (100.0 / totalSize);
            // Trim decimal places.
            extSizes[i] = Math.round(extSizes[i] * 100.0) / 100.0;
        }

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
    if (viewIndex === activeChartView) {
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
                barPercentage: 0.95,
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

    var newHeight = Math.max(BASE_CHART_HEIGHT, chartData[0].length * BAR_SIZE);
    dataChartParent.style.height = newHeight + 'px';
}

// Returns a JSON object: {items (list), max (float/int)}.
function retrieveChartData() {
    var dataCount = Math.min(fileList.length, CHART_ENTRIES_PER_PAGE);

    if (dataCount === 0) {
        return [[], [], [], [], 100];
    }

    // We do not want to sort the file list itself. So create a copy of this array.
    var sortedFiles = fileList.slice(0);
    sortedFiles.sort(sortFilesBehavior);

    var names = [];
    var vals = [];
    var fillCols = [];
    var borderCols = [];
    var chartMax = 1;

    for (var i = 0; i < dataCount; i++) {
        // Get the value depending on chart view.
        var val = sortedFiles[i].lineCount;

        if (activeChartView === 1) {
            val = sortedFiles[i].charCount;
        }
        else if (activeChartView === 2) {
            val = sortedFiles[i].avgCharsPerLine;
        }

        // Set new maximum if applicable.
        if (val > chartMax) {
            chartMax = val;
        }

        names.push(sortedFiles[i].name);
        vals.push(val);

        // Create a gradient from colors
        var factor = i / (1.0 * dataCount);
        var rg = Math.round(lerp(180, 80, factor));
        fillCols.push('rgba(255,' + rg + ',56,0.125)');
        borderCols.push('rgba(205,' + rg + ',105,0.8)');
    }

    chartMax = Math.ceil(chartMax / 4) * 4;
    return [names, vals, fillCols, borderCols, chartMax];
}

function sortFilesBehavior(a, b) {
    if (activeChartView === 1) {
        // Sort by descending character count.
        return (b.charCount - a.charCount);
    }
    else if (activeChartView === 2) {
        // Sort by descending average characters per line.
        return (b.avgCharsPerLine - a.avgCharsPerLine);
    }

    // Sort by descending line count.
    return (b.lineCount - a.lineCount);
}

// HELPERS
function isWhiteSpace(char) {
    return (char === ' ' || char === '\t'); // Spaces and tabs.
}

function lerp(a, b, t) {
    return a + ((b - a) * t);
}