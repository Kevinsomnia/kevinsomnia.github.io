const TYPE_INVALID = -2; // Files that would absolutely not be suitable.
const TYPE_UNSUPPORTED = -1; // Not natively supported, but it will still read.

const INVALID_TYPES = ['exe', 'png', 'jpg', 'jpeg'];

const SUPPORTED_TYPES = {
    'js': 0,
    'html': 1,
    'css': 2,
    'cpp': 3,
    'cs': 4,
    'java': 5,
};

// File class
class FileInfo {
    constructor(file) {
        this.data = file;
        this._determineFileType();

        // Per-file stats.
        this.lineCount = 0;

        if (!this.valid()) {
            console.log(this.name() + ' is an invalid file! Ignoring it...');
        }
        else if (!this.supported()) {
            console.log(this.name() + ' is not natively supported.');
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

    _determineFileType() {
        var extensionName = this._retrieveFileExtension(this.name());
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

    _retrieveFileExtension(fileName) {
        var lastPeriod = fileName.lastIndexOf('.');

        if (lastPeriod > -1) {
            // Return everything after last period.
            return fileName.substring(lastPeriod + 1, fileName.length);
        }

        console.log('No extension for file ' + fileName);
        return null;
    }
}

// Drag and drop
var dropArea = document.getElementById('dropArea');
var fileList = [];

dropArea.addEventListener('drop', function (e) {
    e.stopPropagation();
    e.preventDefault();

    console.log('Dropped');
});

var fileSelector = document.getElementById('fileSelector');
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
        if (data.valid() && !containedInFiles(data)) {
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

var fileListUI = document.getElementById('fileList');

updateFileList = function () {
    var listTitleUI = document.getElementById('fileListTitle');
    var fileCount = fileList.length;

    if (fileCount == 0) {
        // Empty message.
        listTitleUI.innerHTML = '<strong>No files selected...</strong>';
        fileListUI.innerHTML = '';
        return;
    }

    // Format list.
    var listContents = '';

    for (var i = 0; i < fileCount; i++) {
        var styling = ') class="file-list-item';

        if (!fileList[i].supported()) {
            // If file type is not supported, color code it to distinguish that fact.
            styling += ' file-list-item-notsup';
        }

        styling += '">';
        listContents += '<a onclick=onListItemClicked(' + i + styling + fileList[i].name() + '</a>';
    }

    listTitleUI.innerHTML = '<strong>Selected Files (' + fileCount + '):</strong>';
    fileListUI.innerHTML = '<div class="list-group">' + listContents + '</div>';
}

// Event function called after clicking on an item from the list.
onListItemClicked = function (index) {
    if (fileList.length == 0) {
        return;
    }

    fileList.splice(index, 1);
    updateFileList();
}

// Webpage load.
this.updateFileList();


// THIS IS WHERE THE REAL STUFF HAPPENS (file reading).
var isReading = false;
var totalLines = 0;
var filesReadSoFar = 0;
var testOrder = []

processFiles = function () {
    if (fileList.length == 0 || isReading) {
        return;
    }

    // Mark that we are reading, and reset statistics.
    isReading = true;
    totalLines = 0;
    filesReadSoFar = 0;

    for (var i = 0; i < fileList.length; i++) {
        readFile(fileList[i])
    }
}

readFile = function(file) {
    if (!isReading) {
        return;
    }

    var reader = new FileReader;

    // File reading is async, so add a callback for when it completes.
    reader.onload = function(data) {
        filesReadSoFar++;
        file.lineCount = 0;
    
        var text = data.target.result;
    
        for (var i = 0; i < text.length; i++) {
            if (text[i] == '\n') {
                file.lineCount++;
            }
        }

        console.log(file.name() + ': ' + file.lineCount);
        totalLines += file.lineCount;
    
        if (filesReadSoFar == fileList.length) {
            // DONE READING. Show results and statistics.
            calculateExtraStats();
            isReading = false;
        }
    };

    // Begin reading the file.
    reader.readAsText(file.data);
}

calculateExtraStats = function () {
    console.log('calculating stats');
    console.log('total lines: ' + totalLines);

    displayStats();
}

displayStats = function () {
    console.log('displaying stats');
}