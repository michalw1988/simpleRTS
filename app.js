var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/',function(req, res) {
	res.sendFile(__dirname + '/client/index.html');
});
app.use('/client',express.static(__dirname + '/client'));

serv.listen(process.env.PORT || 2000);
console.log("--- simpleRTS server started ---");

var SOCKET_LIST = {};
var PLAYER_LIST = {};
var GAME_LIST = {};

var Player = function(id){
	var self = {
		id:id,
		name:"",
		isInLobby:false,
		gameId:"",
		playing:false,
		
		x:250,
		y:250,
		number:"" + Math.floor(10*Math.random()),
		pressingRight:false,
		pressingLeft:false,
		pressingUp:false,
		pressingDown:false,
		maxSpd:10,
	}
	self.updatePosition = function(){
		if(self.pressingRight)
			self.x += self.maxSpd;
		if(self.pressingLeft)
			self.x -= self.maxSpd;
		if(self.pressingUp)
			self.y -= self.maxSpd;
		if(self.pressingDown)
			self.y += self.maxSpd;
	}
	return self;
}

var Game = function(id){
	var self = {
		id:id,
		player1Id:"",
		player2Id:"",
		ready:false,
		started:false,
	}
	return self;
}

// ---------------------------------------------- //

var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket){
	socket.id = Math.random();
	SOCKET_LIST[socket.id] = socket;
	var player = Player(socket.id);
	PLAYER_LIST[socket.id] = player;
	
	// emiting selfId to new player
	socket.emit('selfId',socket.id);
	
	socket.on('disconnect',function(){
		// if need to close room or update someone's room list
		var player = PLAYER_LIST[socket.id];
		if (player.gameId !== ""){
			var game = GAME_LIST[player.gameId];
			if (game.player1Id === socket.id){ // player was host - close room
				if (game.player2Id !== ""){ // kick other player if needed
				PLAYER_LIST[game.player2Id].gameId = "";
				SOCKET_LIST[game.player2Id].emit('kickedFromRoom');
			}
				delete GAME_LIST[player.gameId];
			} else if (game.player2Id === socket.id){ // player was guest - update game players list
				game.player2Id = "";
				updateGamePlayersList(game.id);
				SOCKET_LIST[game.player1Id].emit('gameStartButton',{status:false});
			}
			updateLobbyGamesList();
		}
		
		delete SOCKET_LIST[socket.id];
		delete PLAYER_LIST[socket.id];
		//console.log('Player "' + player.name + '" disconnected.');
		updateLobbyPlayersList();
	});
	
	socket.on('joinedLobby',function(data){
		player.isInLobby = true;
		player.name = data.name;
		//console.log('Player "' + player.name + '" joined lobby.');
		updateLobbyPlayersList();
		updateLobbyGamesList();
	});
	
	socket.on('leftLobby',function(){
		player.isInLobby = false;
		//console.log('Player "' + player.name + '" left lobby.');
		updateLobbyPlayersList();
	});
	
	socket.on('lobbyChatMessage',function(data){
		var message = PLAYER_LIST[data.id].name + ': ' + data.message
		for(var i in SOCKET_LIST){
			var socket = SOCKET_LIST[i];
			socket.emit('lobbyChatMessageToDisplay',message);
		}
	});
	
	socket.on('createNewGame',function(){
		var id = Math.random();
		var game = Game(id);
		GAME_LIST[id] = game;
		PLAYER_LIST[socket.id].gameId = id;
		game.player1Id = socket.id;
		updateGamePlayersList(id);
		updateLobbyGamesList();
		SOCKET_LIST[socket.id].emit('gameID',{id:id});
	});
	
	socket.on('closeRoom',function(data){
		var game = GAME_LIST[data.gameId];
		PLAYER_LIST[game.player1Id].gameId = "";
		if (game.player2Id !== ""){
			PLAYER_LIST[game.player2Id].gameId = "";
			SOCKET_LIST[game.player2Id].emit('kickedFromRoom');
		}
		delete GAME_LIST[data.gameId];
		updateLobbyGamesList();
	});
	
	socket.on('leaveRoom',function(data){
		var game = GAME_LIST[data.gameId];
		PLAYER_LIST[game.player2Id].gameId = "";
		GAME_LIST[data.gameId].player2Id = "";
		updateGamePlayersList(data.gameId);
		updateLobbyGamesList();
		SOCKET_LIST[game.player1Id].emit('gameStartButton',{status:false});
	});
	
	socket.on('joinGame',function(data){
		GAME_LIST[data.gameId].player2Id = data.player2Id;
		PLAYER_LIST[socket.id].gameId = data.gameId;
		
		updateGamePlayersList(data.gameId);
		updateLobbyGamesList();
		SOCKET_LIST[socket.id].emit('gameID',{id:data.gameId});
	});
	
	socket.on('roomChatMessage',function(data){
		var game = GAME_LIST[data.gameId];
		var message = PLAYER_LIST[data.playerId].name + ": " + data.message;
		SOCKET_LIST[game.player1Id].emit('roomChatMessageToDisplay',{message:message});
		if (game.player2Id !== ""){
			SOCKET_LIST[game.player2Id].emit('roomChatMessageToDisplay',{message:message});
		}
	});
	
	socket.on('gameReady',function(data){
		var game = GAME_LIST[data.gameId];
		if(data.status === true){
			game.ready = true;
			SOCKET_LIST[game.player1Id].emit('gameStartButton',{status:true});
		} else {
			game.ready = false;
			SOCKET_LIST[game.player1Id].emit('gameStartButton',{status:false});
		}
	});
	
	socket.on('startGame',function(data){
		var game = GAME_LIST[data.gameId];
		var player1 = PLAYER_LIST[game.player1Id];
		var player2 = PLAYER_LIST[game.player2Id];
		game.started = true;
		player1.playing = true;
		player2.playing = true;
		SOCKET_LIST[game.player1Id].emit('gameStarted',{player1name:player1.name, player2name:player2.name});
		SOCKET_LIST[game.player2Id].emit('gameStarted',{player1name:player1.name, player2name:player2.name});
	});
	
	
	
	
	
	
	
	
	
	
	socket.on('keyPress',function(data){
		if(data.inputId === 'left')
			player.pressingLeft = data.state;
		else if(data.inputId === 'right')
			player.pressingRight = data.state;
		else if(data.inputId === 'up')
			player.pressingUp = data.state;
		else if(data.inputId === 'down')
			player.pressingDown = data.state;
	});
	
});

setInterval(function(){
	var pack = [];
	for(var i in PLAYER_LIST){
		var player = PLAYER_LIST[i];
		player.updatePosition();
		pack.push({
			x:player.x,
			y:player.y,
			number:player.number
		});	
	}
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('newPositions',pack);
	}
},1000/25);


var updateLobbyPlayersList = function(){
	var lobbyPlayersList = [];
	for(var i in PLAYER_LIST){
		var p = PLAYER_LIST[i];
		if (p.isInLobby === true){
			lobbyPlayersList.push({
				id:p.id,
				name:p.name,
			});	
		}
	}
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('lobbyPlayersListUpdate',lobbyPlayersList);
	}
}

var updateGamePlayersList = function(id){
	var player1 = {id:GAME_LIST[id].player1Id, name:PLAYER_LIST[GAME_LIST[id].player1Id].name};
	var player2 = "";
	if (GAME_LIST[id].player2Id !== ""){
		player2 = {id:GAME_LIST[id].player2Id, name:PLAYER_LIST[GAME_LIST[id].player2Id].name};
	}
	SOCKET_LIST[player1.id].emit('gamePlayersListUpdate',{player1:player1, player2:player2});
	
	if (GAME_LIST[id].player2Id !== ""){
		SOCKET_LIST[player2.id].emit('gamePlayersListUpdate',{player1:player1, player2:player2});
	}
}

var updateLobbyGamesList = function(){
	var gamesList = [];
	for(var i in GAME_LIST){
		var g = GAME_LIST[i];
		gamesList.push({
			id:g.id,
			name:PLAYER_LIST[g.player1Id].name,
			player2Id:g.player2Id,
		});
	}
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('lobbyGamesListUpdate',gamesList);
	}
}