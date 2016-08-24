var app = require('express')(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    fs = require('fs');
    randomstring = require("randomstring"),
    sha1 = require('sha1'),
    sha512 = require('sha512');


var key = sha1("").slice(0, 32);
var maxSize = 100;

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


app.get('/', function (req, res) {
	res.sendfile(__dirname + '/index.html');
});
app.get('/js/Autolinker.min.js', function (req, res) {
	res.sendFile(__dirname + '/js/Autolinker.min.js');
});
app.get('/js/b64.js', function (req, res) {
	res.sendFile(__dirname + '/js/b64.js');
});
app.get('/js/main.js', function (req, res) {
	res.sendFile(__dirname + '/js/main.js');
});
app.get('/js/aes.js', function (req, res) {
	res.sendFile(__dirname + '/js/aes.js');
});
app.get('/js/aes-ctr.js', function (req, res) {
	res.sendFile(__dirname + '/js/aes-ctr.js');
});
app.get('/js/sha.js', function (req, res) {
	res.sendFile(__dirname + '/js/sha.js');
});
app.get('/css/main.css', function (req, res) {
	res.sendFile(__dirname + '/css/main.css');
});



var clients = [];
io.sockets.on('connection', function (socket, pseudo) {
	socket.session = false;
	socket.pseudoOk = false;
	socket.on('new_client', function(pseudo) {
		if(io.engine.clientsCount>maxSize){
			socket.emit('s_error', "The room is full.");
			socket.disconnect();
			return false;
		}
		if(!pseudo){
			socket.emit('s_error', "Invalid pseudo.");
			socket.disconnect();
			return false;
		}
		pseudo = pseudo.trim();
		if(pseudo===""){
			socket.emit('s_error', "Invalid pseudo.");
			socket.disconnect();
			return false;
		}
		socket.pseudo = pseudo;
		socket.pseudoOk=true;
		socket.challenge=randomstring.generate(4);
		socket.challengeAnswer=sha512(socket.challenge+key).toString('hex');
		
		socket.emit('challenge', socket.challenge);
		
	});
	socket.on('challenge', function (challengeAnswer) {
		if(!socket.pseudoOk){
			socket.emit('s_error', "You are not logged.");
			socket.disconnect();
			return false;
		}
		if(challengeAnswer===socket.challengeAnswer){
			socket.session=true;
			console.log(socket.pseudo+" has joined.")
			socket.emit('logged');
			clients.push({pseudo: socket.pseudo, id: socket.id});
			socket.emit('you', {pseudo: socket.pseudo, id: socket.id});
			socket.broadcast.emit('new_client', {pseudo: socket.pseudo, id: socket.id});
			socket.broadcast.emit('clients', {nb: io.engine.clientsCount, max: maxSize, users: clients});
				
		}
		else {
			socket.emit('s_error', "Invalid password.");
			socket.disconnect();
			return false;
		}
	});
	socket.on('message', function (message) {
		if(!socket.session){
			socket.emit('s_error', "You are not logged.");
			socket.disconnect();
			return false;
		}
		//console.log(socket.pseudo+": "+message);
		if(sizeof(message)>1500){
			socket.emit('s_error', "The message is too long.");
		}
		else if(sizeof(message)==0){
			socket.emit('s_error', "The message can't be empty.");
		}
		else{
			socket.broadcast.emit('message', {pseudo: socket.pseudo, id: socket.id, message: message});
		}
	});
	socket.on('file', function (b64) {
		if(!socket.session){
			socket.emit('s_error', "You are not logged.");
			socket.disconnect();
			return false;
		}
		//console.log(socket.pseudo+": "+b64);
		if(sizeof(b64)>150000){
			socket.emit('s_error', "The file is too large.");
		}
		else if(sizeof(b64)==0){
			socket.emit('s_error', "The file is empty.");
		}
		else{
			socket.broadcast.emit('file', {pseudo: socket.pseudo, id: socket.id, file: b64});
		}
	});
	socket.on('clients', function () {
		if(!socket.session){
			socket.emit('s_error', "You are not logged.");
			socket.disconnect();
			return false;
		}
		socket.emit('clients', {nb: io.engine.clientsCount, max: maxSize, users: clients});
	});
	socket.on('disconnect', function(){
		if(!socket.session){
			socket.disconnect();
			return false;
		}
		clients.splice(clients.indexOf({pseudo: socket.pseudo, id: socket.id}), 1);
		console.log(socket.pseudo+" left.")
  		socket.broadcast.emit('client_leaves', {pseudo: socket.pseudo, id: socket.id});
  		socket.broadcast.emit('clients', {nb: io.engine.clientsCount, max: maxSize, users: clients});
  	});
	
});

server.listen(8080);
