// Drag and drop
var dropArea = document.getElementById('dropArea');

dropArea.addEventListener('drop', function (e) {
    e.stopPropagation();
    e.preventDefault();

    console.log('Dropped');
});

updateFileList = function () {
    var selector = document.getElementById('fileSelector');
    var numFilesSelected = selector.files.length;

    if (numFilesSelected == 0)
        return;

    var list = document.getElementById('fileList');

    // Formatted list.
    var listContents = '';

    for (var i = 0; i < numFilesSelected; ++i) {
        listContents += '<a class="file-list-item">' + selector.files.item(i).name + '</a>';
    }

    var label = '<strong>Selected Files:</strong>'
    list.innerHTML = label + '<div class="list-group">' + listContents + '</div>';
}