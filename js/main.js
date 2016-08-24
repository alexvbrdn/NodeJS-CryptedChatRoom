var password = prompt('Please enter the password:');
var pseudo = prompt('What is your pseudonym ?');
var socket;
var view = true;
var key;
var aesCtr;
var jsSHA1;
var myId;
var myColor;
var autolinker = new Autolinker({
	urls : {
		schemeMatches : true,
		wwwMatches    : true,
		tldMatches    : false
	},
	email       : false,
	phone       : false,
	twitter     : false,
	hashtag     : false,
	stripPrefix : false,
	newWindow   : true,
	truncate : {
		length   : 0,
		location : 'end'
	},
	className : ''
});

window.onblur = function(){
	view = false;
}
window.onfocus = function(){
	view = true;
	document.title = "Chat";
}
function escapeHtml(text) {
	var map = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#039;'
	};
	return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}
function log(text) {
	$log = $('#log');
	//Add text to log
	var date=new Date()
	var h=date.getHours();
	if (h<10) {h = "0" + h}
	var m=date.getMinutes();
	if (m<10) {m = "0" + m}
	var s=date.getSeconds();
	if (s<10) {s = "0" + s}
	var time = h+":"+m+":"+s;
	$log.append($log.val()+'<table><tr><td class="rowMessage">'+text+'</td><td class="rowTime">'+time+'</td></tr></table>');
	//Autoscroll
	$log[0].scrollTop = $log[0].scrollHeight - $log[0].clientHeight;
}
function newMsg(pseudo, id, message) {
	log('<strong style="color:'+color(id)+';">'+escapeHtml(pseudo)+":</strong> "+autolinker.link(escapeHtml(message)));
	if(view==false) {
		document.title = "* Chat";
	}
}
function newMsgFile(pseudo, id, file) {
	log('<strong style="color:'+color(id)+';">'+escapeHtml(pseudo)+':</strong></td><td>'+file);
	if(view==false) {
		document.title = "* Chat";
	}
}
function send(message){
	message = cleanMessage(message);
	if(message == ""){
		return false;
	}
	var encryptedBytes = Aes.Ctr.encrypt(message, key, 256);
	if(sizeof(encryptedBytes)>1500){
		alert("[ERROR] The message is too long.");
	}
	else {
		socket.emit('message', encryptedBytes);
		newMsg("You",myId, message);
	}
}
function cleanMessage(message){
	message = message.trim();
	return message;
}
function color(string) {
	jsSHA1 = new jsSHA("SHA-1", "TEXT");
	jsSHA1.update(string);
	return '#' + jsSHA1.getHash("HEX").slice(0, 6);
}
function sizeof(object){
	var objects = [object];
	var size    = 0;
	for (var index = 0; index < objects.length; index ++){
	switch (typeof objects[index]){
		case 'boolean': size += 4; break;
		case 'number': size += 8; break;
		case 'string': size += 2 * objects[index].length; break;
		case 'object':
			if (Object.prototype.toString.call(objects[index]) != '[object Array]'){
				for (var key in objects[index]) size += 2 * key.length;
			}
			for (var key in objects[index]){
			var processed = false;
			for (var search = 0; search < objects.length; search ++){
				if (objects[search] === objects[index][key]){
					processed = true;
					break;
				}
			}
			if (!processed) objects.push(objects[index][key]);
			}
		}
	}
	return size;
}
function sendFile() {
	var file = document.getElementById('picture').files[0];
	var reader = new FileReader();
	var size = file.size;
	
	reader.addEventListener("load", function () {
		var b64 = reader.result;
		var img = document.createElement('img');
		img.crossOrigin = "anonymous";
        	img.onload = function() {
        		
        		var maxWidth=800;
        		var maxHeight=800;
        		
			var canvas = document.createElement('canvas');
			var ctx = canvas.getContext('2d');
		
			var width=img.width;
			var height=img.height;
			var wantedWidth = width;
			var wantedHeight = height;
			
			if(wantedWidth>maxWidth){
				wantedWidth = maxWidth;
				wantedHeight = (height*wantedWidth)/width;
			}
			if(wantedHeight>maxHeight){
				wantedHeight = maxHeight;
				wantedWidth = (width*wantedHeight)/height;
			}
			
			canvas.width = wantedWidth;
			canvas.height = wantedHeight;
			
			ctx.drawImage(this, 0, 0, wantedWidth, wantedHeight);
			
			canvas.toBlob(function(blob){
				console.log(blob.toString());
				console.log(Aes.Ctr.encrypt(blob.toString(), key, 256));
			},"image/jpeg",0.5);
			
			var dataURI = canvas.toDataURL("image/jpeg",0.5);
			var encryptedBytes = Aes.Ctr.encrypt(dataURI, key, 256);
			if(sizeof(encryptedBytes)>300000){
				alert("[ERROR] The file is too large.");
			}
			else{
				socket.emit('file', encryptedBytes);
				newMsgFile("You",myId, '<img src="'+dataURI+'" target="_blank">');
			}
		};
		
		img.src = b64;
	}, false);

	if (file) {
		reader.readAsDataURL(file);
	}
}

$(document).ready(function() {
	jsSHA1 = new jsSHA("SHA-1", "TEXT");
	jsSHA1.update(password);
	key = jsSHA1.getHash("HEX").slice(0, 32);
	
	socket = io.connect('http://127.0.0.1:8080', {
		'force new connection': true,
		'connect timeout': 10000
	});
	
	socket.on('message', function(data) {
		var message = Aes.Ctr.decrypt(data.message, key, 256);
		newMsg(cleanMessage(data.pseudo), data.id, message)
	})
	socket.on('connect', function(data) {
		socket.emit('new_client', pseudo);
		log("<em>Connected.</em>");
	})
	socket.on('disconnect', function(data) {
		log("<em>Disconnected.</em>");
	})
	
	socket.on('new_client', function(data) {
		log('<em><strong style="color:'+color(data.id)+';">'+escapeHtml(data.pseudo)+"</strong> has joined the room.</em>");
	})
	socket.on('client_leaves', function(data) {
		log('<em><strong style="color:'+color(data.id)+';">'+escapeHtml(data.pseudo)+"</strong> left the room.</em>");
	})
	socket.on('file', function(data) {
		var file = Aes.Ctr.decrypt(data.file, key, 256);
		if(/^data:image\/jpeg;base64,[a-zA-Z0-9+\/=]+$/.test(file)) {
			newMsgFile(data.pseudo, data.id, '<img src="'+file+'">');
		}
	})
	socket.on('clients', function(data) {
		$("#userCo").text(data.nb+"/"+data.max);
	})
	socket.on('you', function(data) {
		myId=data.id;
		myColor=color(data.id);
		$("#yn").text(data.pseudo);
		$("#yn").css({"color":myColor});
	})
	socket.on('s_error', function(data) {
		alert("[ERROR] "+data);
	})
	socket.on('challenge', function(data) {
		jsSHA512 = new jsSHA("SHA-512", "TEXT");
		jsSHA512.update(data+key);
		var answer = jsSHA512.getHash("HEX");
		socket.emit('challenge', answer);
	})
	socket.on('logged', function() {
		socket.emit('clients');
	})
	socket.on('connect_error', function(){
    		alert('Connection Failed');
	});
	
	$('#send-button').click(function () {
		var message = $('#message').val();
		send(message);
		$("#message").val('');
	});
	$('#message').keypress(function(e) {
		if(e.keyCode == 13 && this.value) {
			send(this.value);
			$("#message").val('');
		}
	});
	$('#send-file').click(function () {
		sendFile();
		$("#file").val('');
		try{
			document.getElementById('picture').value = '';
			if(document.getElementById('picture').value){
				document.getElementById('picture').type = "text";
				document.getElementById('picture').type = "file";
    			}
		}catch(e){}
	});
});
