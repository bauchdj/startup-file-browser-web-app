function search(event) {
	const el = event.srcElement[0];
	const input = el.value;

	if (input === undefined || input === '') return false;

	const regex = (input => {
		try {
			const pattern = input.replace(/(^\/)|(\/[a-z]*$)/g, '');
			const flags = input.match(/[^/]+$/)[0];
			const regex = new RegExp(pattern, flags);
			return regex;
		} catch (err) {
			return new RegExp(input);
		}
	})(input);

	const filteredFiles = Object.values(filesHash).filter(fileStats => regex.test(fileStats.filename));

	pathNavBtn("Clear search results", selectionHash, path => {
		el.value = '';
		addFilesToTable(Object.values(filesHash))
	});

	if (document.querySelector("#subfolder-search").checked) {
		// ajax call for all files that match regex
		console.log("Backend subfolder search")
	} else {
		addFilesToTable(filteredFiles);
	}
}

function downloadFiles(files, num) {
	let time = 0;
	while (num-- > 0) {
		const path = selectionHash.next(files);
		const a = document.createElement('a');
		a.href = `/download?type=file&path=${encodeURIComponent(path)}`;
		setTimeout(() => {
			a.click();
		}, time);
		time += 1000;
	}
}

function downloadZip(files) {
	const a = document.createElement('a');
	a.href = `/download?type=zip&data=${encodeURIComponent(JSON.stringify(files))}`;
	a.click();
}

function download(event) {
	const numSelected = selectionHash.length();
	const title = "Download";
	const includesFolder = !selectionHash.onlyFiles();
	const files = selectionHash.files();
	const filenames = selectionHash.filenames();

	if (numSelected == 0) {
		console.log("Nothing is selected silly. Select something to download.");
		createPopUp("message", { title: "Attempted to Download", message: "Nothing selected" });
		return;
	} else if (!includesFolder) {
		const message = numSelected === 1 ? "How you like to download this file?" : `How would you like to download these ${numSelected} files: ${filenames.join(', ')}`;

		const btns = {
			primary: [
				{ text: "Zip", callback: event => downloadZip(files) },
				{ text: "Raw file(s)", callback: event => downloadFiles(files, numSelected) },
			]
		};

		createPopUp("options", { title: title + (numSelected === 1 ? '' : ` - ${numSelected} files`), message: message, btns: btns, callback: event => {
			createPopUp("message", { title: "Downloading file / files", message: `Currently preparing zip or downloading file / files: "${filenames.join(', ')}"` });
		}});
	} else {
		const message = `Would you like to download all ${numSelected}: ${filenames.join(', ')}`;

		const btns = {
			primary: [
				{ text: "Zip", callback: event => downloadZip(files) },
			]
		};

		createPopUp("options", { title: `${title} - ${numSelected} items`, message: message, btns: btns, callback: event => {
			createPopUp("message", { title: "Downloading folder", message: `Currently preparing zip for download: "${filenames.join(', ')}"` });
		}});
	}
}

function input({ route, type, data, filename, inputType, title, message, cbTitle, cbMessage }) {
	createPopUp("input", { title: title, message: message, filename: filename, inputType: inputType, callback: value => {
		selectionHash.clear();

		ajaxPost(route, { path: currentPath, type: type, data: data, name: value, }, postValue => {
			const message = cbMessage({ value: value, postValue: postValue });

			console.log(message);

			createPopUp("message", { title: cbTitle({ value: value, postValue: postValue }), message: message, callback: () => { 
				ajaxPost('/getfiles', { path: currentPath }, data => addFilesToTable(data));
			}});
		});
	}});
}

function createTextFile(event) {
	input({
		route: '/create', 
		type: "file",
		title: "Create file",
		message: "Type filename",
		cbTitle: ({ value, postValue }) => "Created a file",
		cbMessage: ({ value, postValue }) => `New file: "${postValue}"`,
	});
}

function createFolder(event) {
	input({
		route: '/create', 
		type: "folder",
		title: "Create folder",
		message: "Type folder name",
		cbTitle: ({ value, postValue }) => "Created a folder",
		cbMessage: ({ value, postValue }) => `New file: "${postValue}"`,
	});
}

function downloadURL(event) {
	const title = "Download directly to server";
	const message = "Enter URL to download file or folder to current directory";
	input({
		route: '/downloadURL',
		type: "url",
		title: title,
		message: message,
		cbTitle: ({ value, postValue }) => "Downloaded from URL",
		cbMessage: ({ value, postValue }) => `Downloaded: "${postValue}" from "${value}"`,
	});
}

function rename(event) {
	const numSelected = selectionHash.length();
	const title = "Rename";
	if (numSelected !== 1) {
		const message = (numSelected === 0 ) ? "Nothing is selected silly. Select one to rename." : "You can only select one. You tried to rename " + numSelected + ".";
		createPopUp("message", { title: title, message: message });
		return;
	}
	const message = "Type new name";
	input({
		route: '/rename',
		data: selectionHash.files(),
		filename: selectionHash.filenames[0],
		inputType: "filename",
		title: title,
		message: message,
		cbTitle: ({ value, postValue }) => "Rename",
		cbMessage: ({ value, postValue }) => `Renamed: "${this.file}" to "${postValue}"`,
	});
}

function createLink(event) {
	const title = "Create Shareable Link";
	if (selectionHash.length() === 0) {
		createPopUp("message", { title: title, message: "Nothing is selected silly. Select files to share." });
		return;
	}
	const message = "Type link name";
	input({
		route: '/createLink',
		data: selectionHash.files(),
		title: title,
		message: message,
		cbTitle: ({ value, postValue }) => "Created sharable link",
		cbMessage: ({ value, postValue }) => `Created link: "${value}"`,
	});
}

function move(event) {
	const title = "Move";

	if (selectionHash.length() === 0) {	
		createPopUp("message", { title: title, message: "Nothing is selected silly. Select something to move." });
		return;
	}

	const files = selectionHash.files();
	const filenames = selectionHash.filenames();

	pathNavBtn(title, selectionHash, value => {
		// Check if any of the files names exist in newPath && if any of selected have same name (between different directories)
		const message = `Confirm move of "${filenames.join(', ')}"`;
		createPopUp("message", { title: title, message: message, callback: () => {
			console.log(`Request backend to move ${filenames.join(', ')} to "${value}"`);
			ajaxPost('/rename', { data: files, path: value }, () => {
				const message = `Moved "${filenames.join(', ')}" to "${value}"`;
				console.log(message);
				createPopUp("message", { title: "Moved files", message: message, callback: () => { 
					ajaxPost('/getfiles', { path: currentPath }, data => addFilesToTable(data));
				}});
			});
		}});
	});
}

function copy(event) {
	const title = "Copy";
	if (selectionHash.length() === 0) {	
		createPopUp("message", { title: title, message: "Nothing is selected silly. Select something to copy." });
		return;
	}
	const files = selectionHash.files();
	const filenames = selectionHash.filenames();
	pathNavBtn(title, selectionHash, newPath => {
		const message = `Confirm copy of "${filenames.join(', ')}"`;
		createPopUp("message", { title: title, message: message, callback: () => {
			console.log(`Request backend to copy "${filenames.join(', ')}" to "${newPath}"`);
			/*
			ajaxPost('/copy', { files: files, newPath: newPath }, () => {
				const message = `Copied "${filenames.join(', ')}" to "${newPath}"`;
				console.log(message);
				createPopUp("message", { title: "Copied files", message: message, callback: () => { 
					ajaxPost('/getfiles', { path: currentPath }, data => addFilesToTable(data));
				}});
			});
			*/
		}});
	});
}

function symbolicLink(event) {
	const numSelected = selectionHash.length();
	const title = "Symbolic Link";
	if (selectionHash.length() === 0) {	
		createPopUp("message", { title: title, message: "Nothing is selected silly. Select something to copy." });
		return;
	}
	const files = selectionHash.files();
	const filenames = selectionHash.filenames();
	pathNavBtn(title, selectionHash, newPath => {
		const message = `Confirm copy of "${filenames.join(', ')}"`;
		createPopUp("message", { title: title, message: message, callback: () => {
			console.log(`Request backend to copy "${filenames.join(', ')}" to "${newPath}"`);
			/*
			ajaxPost('/copy', { files: files, newPath: newPath }, () => {
				const message = `Copied "${filenames.join(', ')}" to "${newPath}"`;
				console.log(message);
				createPopUp("message", { title: "Copied files", message: message, callback: () => { 
					ajaxPost('/getfiles', { path: currentPath }, data => addFilesToTable(data));
				}});
			});
			*/
		}});
	});
	if (selectionHash.length() == 1) { // Make it work with multiple, like move and copy
		const file = selectionHash.files();
		pathNavBtn(title, selectionHash, newPath => {
			const message = "Type name of link";
			createPopUp("input", { title: title, message: message, file: filename, inputType: "filename", callback: linkName => {
				console.log("Request to create symbolic link " + filename + " " + linkName, `Path: ${path}, newPath: ${newPath}`);
				/*
				ajaxPost('/symbolicLink', { path: path, newPath: newPath, filename: filename, linkName: linkName }, linkName => {
					const message = `Symbollically linked: "${filename}" to "${linkName}"`;
					console.log(message);
					createPopUp("message", { title: "Created symbolic link", message: message, callback: () => {
						ajaxPost('/getfiles', { path: currentPath }, data => addFilesToTable(data));
					}});
				});
				*/
			}});
		});
	}
}

function trash(event) {
	createPopUp("message", { title: "Trash", message: "Confirm to enter trash" });
}

function del(event) {
	createPopUp("message", { title: "Delete", message: "Confirm to permenantely delete" });
}

function upload(event) {
	event.preventDefault();
	createPopUp("message", { title: "Upload", message: "Confirm upload of selected file(s) / folder(s)" });

	/*
	<form id="uploadForm" enctype="multipart/form-data">
		<input type="file" id="folderInput" webkitdirectory="" directory="" multiple />
		<input type="submit" value="Upload and Zip Folder" />
	</form>
	const folderInput = document.getElementById("folderInput"); // Need input element for files list

	if (!folderInput.files.length) {
		alert("Please select a folder to upload.");
		return;
	}

	const zip = new JSZip();
	let filesProcessed = 0;

	for (const folder of folderInput.files) {
		const reader = new FileReader();

		reader.onload = function (event) {
			zip.file(folder.webkitRelativePath, event.target.result);

			filesProcessed++;

			if (filesProcessed === folderInput.files.length) {
				const zip = new JSZip();

				// Add files to the zip object here (e.g., using zip.file())
				zip.generateAsync({ type: "blob", mimeType: "application/zip" }, function (content) {
					// 'content' is the generated zip content as a Blob
					const formData = new FormData();
					formData.append("zipFile", content, "folder.zip");

					$.ajax({
						url: "/upload",
						method: "POST",
						data: formData, // formData
						processData: false,
						contentType: false,
						success: function (response) {
							console.log("Upload successful");
						},
						error: function (error) {
							console.error("Upload failed: ", error);
						},
					});
				});
			}
		};

		reader.readAsArrayBuffer(folder);
	}
	*/
}

