// Drag and drop
var dropArea = document.getElementById('dropArea');
var files = [];

dropArea.addEventListener('drop', function (e) {
    e.stopPropagation();
    e.preventDefault();

    console.log('Dropped');
});

addFiles = function () {
    var selector = document.getElementById('fileSelector');
    var numFilesSelected = selector.files.length;

    // Add items to list (if it isn't already in the list).
    for (var i = 0; i < numFilesSelected; i++) {
        var fileName = selector.files.item(i).name;

        if(!files.includes(fileName))
            files.push(fileName);
    }

    // Update UI reprentation.
    updateFileList();
}

updateFileList = function () {
    var selector = document.getElementById('fileSelector');
    var numFilesSelected = selector.files.length;

    if (numFilesSelected == 0)
        return;

    var list = document.getElementById('fileList');

    // Format list.
    var listContents = '';

    for (var i = 0; i < files.length; ++i) {
        listContents += '<a class="file-list-item">' + files[i] + '</a>';
    }

    var label = '<strong>Selected Files:</strong>'
    list.innerHTML = label + '<div class="list-group">' + listContents + '</div>';

    // Update parallax.
    jQuery(window).trigger('resize').trigger('scroll');
}