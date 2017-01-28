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
		player1Credits: 5000,
		player2Credits: 5000,
		player1Base: {x: 100, y: 284, hp: 3000, hpMax: 3000, spin: Math.random()*360,},
		player2Base: {x: 1100, y: 284, hp: 3000, hpMax: 3000, spin: Math.random()*360,},
		mines: [
			{id: Math.random(), x: 150, y: 84, owner: 0, spin: Math.random()*360, countdown: 0},
			{id: Math.random(), x: 150, y: 484, owner: 0, spin: Math.random()*360, countdown: 0},
			{id: Math.random(), x: 1050, y: 84, owner: 0, spin: Math.random()*360, countdown: 0},
			{id: Math.random(), x: 1050, y: 484, owner: 0, spin: Math.random()*360, countdown: 0},
			{id: Math.random(), x: 600, y: 134, owner: 0, spin: Math.random()*360, countdown: 0},
			{id: Math.random(), x: 600, y: 434, owner: 0, spin: Math.random()*360, countdown: 0},
			{id: Math.random(), x: 450, y: 284, owner: 0, spin: Math.random()*360, countdown: 0},
			{id: Math.random(), x: 750, y: 284, owner: 0, spin: Math.random()*360, countdown: 0},
		],
		player1ProductionProgress: 0,
		player2ProductionProgress: 0,
		player1ProductionType: 0,
		player1ProductionType: 0,
		player1Units: {},
		player2Units: {},
		laserShots: [],
		player1CountdownToWin: 50,
		player2CountdownToWin: 50,
	}
	
	self.spinBuildings = function(){
		self.player1Base.spin += 1;
		if (self.player1Base.spin >= 360) self.player1Base.spin = 0;
		self.player2Base.spin += 1;
		if (self.player2Base.spin >= 360) self.player2Base.spin = 0;
		for (var i in self.mines){
			var mine = self.mines[i];
			mine.spin += 0.5;
			if (mine.spin >= 360) mine.spin = 0;
		}
	}
	
	self.addCredits = function(){
		for(var i in self.mines){
			var mine = self.mines[i];
			mine.countdown++;
			if (mine.countdown > 50){
				mine.countdown = 0;
			}
			if (mine.countdown === 30 && mine.owner === 1){
				self.player1Credits += 50;
			} else if (mine.countdown === 30 && mine.owner === 2){
				self.player2Credits += 50;
			}
		}
	}
	
	self.startProducingUnit = function(whichPlayer,type){
		if(whichPlayer === 1){
			if (type === 1){
				self.player1ProductionProgress = 5;
			} else if (type === 2){
				self.player1ProductionProgress = 10;
			} else if (type === 3){
				self.player1ProductionProgress = 2;
			} else if (type === 4){
				self.player1ProductionProgress = 1;
			}
			self.player1ProductionType = type;
		} else {
			if (type === 1){
				self.player2ProductionProgress = 5;
			} else if (type === 2){
				self.player2ProductionProgress = 10;
			} else if (type === 3){
				self.player2ProductionProgress = 2;
			} else if (type === 4){
				self.player2ProductionProgress = 1;
			}
			self.player2ProductionType = type;
		}
	}
	
	self.continueProducingUnit = function(){
		// continuing production for player 1 - if was started
		if(self.player1Base.hp > 0){
			if(self.player1ProductionProgress !== 0){
				if (self.player1ProductionType === 1){
					self.player1ProductionProgress += 5;
				} else if (self.player1ProductionType === 2){
					self.player1ProductionProgress += 10;
				} else if (self.player1ProductionType === 3){
					self.player1ProductionProgress += 2;
				} else if (self.player1ProductionType === 4){
					self.player1ProductionProgress += 1;
				}
				// add unit if finished
				if(self.player1ProductionProgress >= 100){
					self.finishProducingUnit(1, self.player1ProductionType);
					self.player1ProductionProgress = 0;
					self.player1ProductionType = 0;
				}
			}
		} else {
			self.player1ProductionProgress = 0;
		}
		// continuing production for player 2 - if was started
		if(self.player2Base.hp > 0){
			if(self.player2ProductionProgress !== 0){
				if (self.player2ProductionType === 1){
					self.player2ProductionProgress += 5;
				} else if (self.player2ProductionType === 2){
					self.player2ProductionProgress += 10;
				} else if (self.player2ProductionType === 3){
					self.player2ProductionProgress += 2;
				} else if (self.player2ProductionType === 4){
					self.player2ProductionProgress += 1;
				}
				// add unit if finished
				if(self.player2ProductionProgress >= 100){
					self.finishProducingUnit(2, self.player2ProductionType);
					self.player2ProductionProgress = 0;
					self.player2ProductionType = 0;
				}
			}
		} else {
			self.player2ProductionProgress = 0;
		}
	}
	
	self.finishProducingUnit = function(whichPlayer,type){
		var id = Math.random();
		var x = 0;
		var y = 0;
		var destinationX = 0;
		var destinationY = 0;
		if (whichPlayer === 1) {
			x = self.player1Base.x;
			y = self.player1Base.y;
			destinationX = self.player1Base.x-5;
			destinationY = self.player1Base.y;
		} else {
			x = self.player2Base.x;
			y = self.player2Base.y;
			destinationX = self.player2Base.x+5;
			destinationY = self.player2Base.y;
		}
		var unit = Unit(id,type,x,y,destinationX,destinationY);
		unit.initUnit(type);
		if (whichPlayer === 1) {
			self.player1Units[id] = unit;
		} else {
			self.player2Units[id] = unit;
		}
	}
	
	self.updateUnits = function(){
		for (var i in self.player1Units){
			var unit = self.player1Units[i];
			unit.executeOrder(self.id, 1);
			unit.fireAtWill(self.id, 1);
		}
		for (var i in self.player2Units){
			var unit = self.player2Units[i];
			unit.executeOrder(self.id, 2);
			unit.fireAtWill(self.id, 2);
		}
	}
	
	self.checkIfWin = function(){
		if(self.player2Base.hp <= 0){
			self.player1CountdownToWin--;
			if (self.player1CountdownToWin <= 0){
				SOCKET_LIST[self.player1Id].emit('gameEnded',{message: "<div style='color: #3DF53D; margin-bottom: 2px;'><b>Congratulations!</b></div>You destroyed opponent's base ."});
				SOCKET_LIST[self.player2Id].emit('gameEnded',{message: "<div style='color: #F72828; margin-bottom: 2px;'><b>Game over.</b></div>Your base was destroyed."});
				
				PLAYER_LIST[self.player1Id].playing = false;
				PLAYER_LIST[self.player1Id].gameId = "";
				PLAYER_LIST[self.player2Id].playing = false;
				PLAYER_LIST[self.player2Id].gameId = "";
				delete GAME_LIST[self.id];
				updateLobbyGamesList();
				updateLobbyPlayersList();
			}
		}
		if(self.player1Base.hp <= 0){
			self.player2CountdownToWin--;
			if (self.player2CountdownToWin <= 0){
				SOCKET_LIST[self.player1Id].emit('gameEnded',{message: "<div style='color: #F72828; margin-bottom: 2px;'><b>Game over.</b></div>Your base was destroyed."});
				SOCKET_LIST[self.player2Id].emit('gameEnded',{message: "<div style='color: #3DF53D; margin-bottom: 2px;'><b>Congratulations!</b></div>You destroyed opponent's base ."});
				
				PLAYER_LIST[self.player1Id].playing = false;
				PLAYER_LIST[self.player1Id].gameId = "";
				PLAYER_LIST[self.player2Id].playing = false;
				PLAYER_LIST[self.player2Id].gameId = "";
				delete GAME_LIST[self.id];
				updateLobbyGamesList();
				updateLobbyPlayersList();
			}
		}
	}
	
	return self;
}


var Unit = function(id,type,x,y,destinationX,destinationY){
	var self = {
		id:id,
		type: type,
		x:x,
		y:y,
		destinationX: destinationX,
		destinationY: destinationY,
		selected: false,
		activeOrderType: 'none',
		objectId: '',
		angle: 0,
		speed: 0,
		hp: 0,
		hpMax: 0,
		range: 0,
		targetId: '',
		countdown: 0,
		reloadTime: 0,
		damage: 0,
	}
	
	self.initUnit = function(type){
		if (type === 1){
			self.speed = 4;
			self.hp = 10;
			self.hpMax = 10;
		} else if (type === 2){
			self.speed = 2.5;
			self.hp = 100;
			self.hpMax = 100;
			self.range = 75;
			self.reloadTime = 10;
			self.damage = 25;
		} else if (type === 3){
			self.speed = 2;
			self.hp = 150;
			self.hpMax = 150;
			self.range = 150;
			self.reloadTime = 50;
			self.damage = 75;
		} else if (type === 4){
			self.speed = 1.5;
			self.hp = 500;
			self.hpMax = 500;
			self.range = 125;
			self.reloadTime = 7;
			self.damage = 50;
		}
		self.activeOrderType = 'move';
	}
	
	self.executeOrder = function(id, whichPlayer){
		var game = GAME_LIST[id];
		if(self.activeOrderType === 'move'){
			// avoid base 1
			var destinationPointDistanceToBase = Math.sqrt( (game.player1Base.x-self.destinationX)*(game.player1Base.x-self.destinationX) + (game.player1Base.y-self.destinationY)*(game.player1Base.y-self.destinationY) );
			if(destinationPointDistanceToBase < 28){
				var dist = 28;
				var angle = Math.random()*360;
				self.destinationX = game.player1Base.x + dist * Math.sin(angle * Math.PI / 180);
				self.destinationY = game.player1Base.y + dist * Math.cos(angle * Math.PI / 180);
			}
			// avoid base 2
			destinationPointDistanceToBase = Math.sqrt( (game.player2Base.x-self.destinationX)*(game.player2Base.x-self.destinationX) + (game.player2Base.y-self.destinationY)*(game.player2Base.y-self.destinationY) );
			if(destinationPointDistanceToBase < 28){
				var dist = 28;
				var angle = Math.random()*360;
				self.destinationX = game.player2Base.x + dist * Math.sin(angle * Math.PI / 180);
				self.destinationY = game.player2Base.y + dist * Math.cos(angle * Math.PI / 180);
			}
			// avoid mines
			for (var i in game.mines){
				var mine = game.mines[i];
				var destinationPointDistanceToMine = Math.sqrt( (mine.x-self.destinationX)*(mine.x-self.destinationX) + (mine.y-self.destinationY)*(mine.y-self.destinationY) );
				if(destinationPointDistanceToMine < 20){
					var dist = 20;
					var angle = Math.random()*360;
					self.destinationX = mine.x + dist * Math.sin(angle * Math.PI / 180);
					self.destinationY = mine.y + dist * Math.cos(angle * Math.PI / 180);
				}
			}
			//  avoid player 1 units
			for (var i in game.player1Units){
				var unit = game.player1Units[i];
				var destinationPointDistanceToUnit = Math.sqrt( (unit.destinationX-self.destinationX)*(unit.destinationX-self.destinationX) + (unit.destinationY-self.destinationY)*(unit.destinationY-self.destinationY) );
				if(destinationPointDistanceToUnit < 10 && unit.id !== self.id){
					var dist = 10;
					var angle = Math.random()*360;
					self.destinationX = unit.destinationX + dist * Math.sin(angle * Math.PI / 180);
					self.destinationY = unit.destinationY + dist * Math.cos(angle * Math.PI / 180);
					self.activeOrderType = 'move';
				}
			}
			//  avoid player 2 units
			for (var i in game.player2Units){
				var unit = game.player2Units[i];
				var destinationPointDistanceToUnit = Math.sqrt( (unit.destinationX-self.destinationX)*(unit.destinationX-self.destinationX) + (unit.destinationY-self.destinationY)*(unit.destinationY-self.destinationY) );
				if(destinationPointDistanceToUnit < 10 && unit.id !== self.id){
					var dist = 10;
					var angle = Math.random()*360;
					self.destinationX = unit.destinationX + dist * Math.sin(angle * Math.PI / 180);
					self.destinationY = unit.destinationY + dist * Math.cos(angle * Math.PI / 180);
					self.activeOrderType = 'move';
				}
			}
			// keep going
			var distanceToDestination = Math.sqrt( (self.x-self.destinationX)*(self.x-self.destinationX) + (self.y-self.destinationY)*(self.y-self.destinationY) );
			if (distanceToDestination > 3){
				var angleInRadians = Math.atan2(self.destinationY - self.y, self.destinationX - self.x);
				self.angle = angleInRadians;
				self.x += Math.cos(angleInRadians) * self.speed;
				self.y += Math.sin(angleInRadians) * self.speed;
			} else {
				self.activeOrderType = 'none';
			}
		} else if(self.activeOrderType === 'capture'){
			var mineToCapture = '';
			for (var i in game.mines){
				var mine = game.mines[i];
				if(mine.id === self.objectId){
					mineToCapture = mine;
				}
			}
			if(mineToCapture.owner === whichPlayer){ // if the mine is already mine
				self.activeOrderType = 'move';
			} else { // go towards the mine
				var distanceToDestination = Math.sqrt( (self.x-self.destinationX)*(self.x-self.destinationX) + (self.y-self.destinationY)*(self.y-self.destinationY) );
				if (distanceToDestination > 3){
					var angleInRadians = Math.atan2(self.destinationY - self.y, self.destinationX - self.x);
					self.angle = angleInRadians;
					self.x += Math.cos(angleInRadians) * self.speed;
					self.y += Math.sin(angleInRadians) * self.speed;
				} else { // capture the mine
					mineToCapture.owner = whichPlayer;
					if (whichPlayer === 1){
						delete game.player1Units[self.id];
					} else {
						delete game.player2Units[self.id];
					}
				}
			}
		} else if(self.activeOrderType === 'attack'){
			if(self.objectId !== 'base'){ // attack unit
				var enemyUnits = {};
				if (whichPlayer === 1){
					enemyUnits = game.player2Units;
				} else {
					enemyUnits = game.player1Units;
				}
				if(enemyUnits[self.objectId]){
					enemyUnit = enemyUnits[self.objectId];
					self.destinationX = enemyUnit.x;
					self.destinationY = enemyUnit.y;
					var distanceToEnemyUnit = Math.sqrt( (self.x-enemyUnit.x)*(self.x-enemyUnit.x) + (self.y-enemyUnit.y)*(self.y-enemyUnit.y) );
					if (distanceToEnemyUnit > self.range){
						var angleInRadians = Math.atan2(enemyUnit.y - self.y, enemyUnit.x - self.x);
						self.angle = angleInRadians;
						self.x += Math.cos(angleInRadians) * self.speed;
						self.y += Math.sin(angleInRadians) * self.speed;
					} else {
						self.targetId = enemyUnit.id;
					}
				} else {
					self.activeOrderType = 'move';
				}
			} else { // attack base
				var enemyBase = null;
				if (whichPlayer === 1){
					enemyBase = game.player2Base;
				} else {
					enemyBase = game.player1Base;
				}
				if(enemyBase.hp > 0){
					self.destinationX = enemyBase.x;
					self.destinationY = enemyBase.y;
					var distanceToEnemyBase = Math.sqrt( (self.x-enemyBase.x)*(self.x-enemyBase.x) + (self.y-enemyBase.y)*(self.y-enemyBase.y) );
					if (distanceToEnemyBase > self.range){
						var angleInRadians = Math.atan2(enemyBase.y - self.y, enemyBase.x - self.x);
						self.angle = angleInRadians;
						self.x += Math.cos(angleInRadians) * self.speed;
						self.y += Math.sin(angleInRadians) * self.speed;
					} else {
						self.targetId = 'base';
					}
				} else {
					self.activeOrderType = 'move';
					enemyBase.x = -100;
					enemyBase.y = -100;
					
				}
				
			}
		}
	}
	
	self.fireAtWill = function(id, whichPlayer){
		if (self.type !== 1){ // only for non-engineer units
			var game = GAME_LIST[id];
			var enemyUnits = {};
			var enemyBase =  null;
			if (whichPlayer === 1){
				enemyUnits = game.player2Units;
				enemyBase = game.player2Base;
			} else {
				enemyUnits = game.player1Units;
				enemyBase = game.player1Base;
			}
			
			// search for target if there's none yet
			if(self.targetId === ''){
				// target base
				var distanceToEnemyBase = Math.sqrt( (self.x-enemyBase.x)*(self.x-enemyBase.x) + (self.y-enemyBase.y)*(self.y-enemyBase.y) );
				if (distanceToEnemyBase <= self.range && enemyBase.hp > 0){
					self.targetId = 'base';
					//console.log('enemy base is now a target');
				}
				// target enemy units (that order sometimes gives priority to firing to units)
				for (var i in enemyUnits){
					var enemyUnit = enemyUnits[i];
					var distanceToEnemyUnit = Math.sqrt( (self.x-enemyUnit.x)*(self.x-enemyUnit.x) + (self.y-enemyUnit.y)*(self.y-enemyUnit.y) );
					if (distanceToEnemyUnit <= self.range){
						self.targetId = enemyUnit.id;
					}
				}
			} else {
				if (self.targetId === 'base'){
					var distanceToTargetedBase = Math.sqrt( (self.x-enemyBase.x)*(self.x-enemyBase.x) + (self.y-enemyBase.y)*(self.y-enemyBase.y) );
					if(distanceToTargetedBase > self.range){ // unit has lost target (base too far)
						self.targetId = '';
						//console.log('unit has lost target (unit is gone)');
					} else { // fire (if reloaded);
						if (self.countdown === 0){
							//console.log('shoting to enemy base');
							game.laserShots.push({
								whichPlayer: whichPlayer,
								type: self.type,
								shotX: self.x,
								shotY: self.y,
								targetX: enemyBase.x,
								targetY: enemyBase.y,
							});
							self.countdown += self.reloadTime;
							enemyBase.hp -= self.damage;
							if (enemyBase.hp <= 0){
								//console.log('enemy base destroyed');
								self.targetId = '';
							}
						}
					}
				} else { 
					if (enemyUnits[self.targetId]){
						var enemyUnit = enemyUnits[self.targetId];
						var distanceToTargetedUnit = Math.sqrt( (self.x-enemyUnit.x)*(self.x-enemyUnit.x) + (self.y-enemyUnit.y)*(self.y-enemyUnit.y) );
						if(distanceToTargetedUnit > self.range){ // unit has lost target (unit too far)
							self.targetId = '';
						} else { // fire (if reloaded);
							if (self.countdown === 0){		
								game.laserShots.push({
									whichPlayer: whichPlayer,
									type: self.type,
									shotX: self.x,
									shotY: self.y,
									targetX: enemyUnits[self.targetId].x,
									targetY: enemyUnits[self.targetId].y,
								});
								self.countdown += self.reloadTime;
								enemyUnits[self.targetId].hp -= self.damage;
								if (enemyUnits[self.targetId].hp <= 0){
									delete enemyUnits[self.targetId];
								}
							}
						}
					} else  {
						self.targetId = ''; // unit has lost target (unit is gone)
						//console.log('unit has lost target (unit is gone)');
					}
				}
			}
			
			if (self.countdown !== 0){
				self.countdown--;
			}
		
		}
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
			
			// if game not started
			if (game.started === false){
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
			} else { // game started - player disconnected
				if (game.player1Id === socket.id){ // player was host
					PLAYER_LIST[game.player2Id].playing = false;
					PLAYER_LIST[game.player2Id].gameId = "";
					SOCKET_LIST[game.player2Id].emit('gameEnded',{message: '<div style="color: #3DF53D; margin-bottom: 2px;"><b>Game over!</b></div>Your opponent has disconnected.'});
				} else if (game.player2Id === socket.id){ // player was guest
					PLAYER_LIST[game.player1Id].playing = false;
					PLAYER_LIST[game.player1Id].gameId = "";
					SOCKET_LIST[game.player1Id].emit('gameEnded',{message: '<div style="color: #3DF53D; margin-bottom: 2px;"><b>Game over!</b></div>Your opponent has disconnected.'});
				}
				delete GAME_LIST[player.gameId];
				updateLobbyGamesList();
				updateLobbyPlayersList();
			}
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
		updateLobbyGamesList();
		updateLobbyPlayersList();
	});
	
	socket.on('endGame',function(data){ // reason:'surrender', gameId:gameId, playerId:selfId
		var game = GAME_LIST[data.gameId];
		var player1 = PLAYER_LIST[game.player1Id];
		var player2 = PLAYER_LIST[game.player2Id];
		player1.playing = false;
		player1.gameId = "";
		player2.playing = false;
		player2.gameId = "";
		
		if(data.reason === 'surrender'){
			if(game.player1Id === data.playerId){ // player 1 surrendered
				SOCKET_LIST[game.player1Id].emit('gameEnded',{message: '<div style="color: #F72828; margin-bottom: 2px;"><b>Game over.</b></div>You surrendered.'});
				SOCKET_LIST[game.player2Id].emit('gameEnded',{message: '<div style="color: #3DF53D; margin-bottom: 2px;"><b>Congratulations!</b></div>Your opponent has surrendered.'});
			} else { // player 2 surrendered
				SOCKET_LIST[game.player1Id].emit('gameEnded',{message: '<div style="color: #3DF53D; margin-bottom: 2px;"><b>Congratulations!</b></div>Your opponent has surrendered.'});
				SOCKET_LIST[game.player2Id].emit('gameEnded',{message: '<div style="color: #F72828; margin-bottom: 2px;"><b>Game over.</b></div>You surrendered.'});
			}
		}
		
		delete GAME_LIST[data.gameId];
		updateLobbyGamesList();
		updateLobbyPlayersList();
	});
	
	socket.on('procudeUnit',function(data){
		var game = GAME_LIST[data.gameId];
		var whichPlayer = 0;
		if(game.player1Id === data.playerId){
			whichPlayer = 1;
			game.player1Credits -= data.credits;
		} else {
			whichPlayer = 2;
			game.player2Credits -= data.credits;
		}
		game.startProducingUnit(whichPlayer, data.type);
	});
	
	socket.on('selectionBox',function(data){
		var game = GAME_LIST[data.gameId];
		var unitList = null;
		if (data.playerId === game.player1Id){ // player 1 sent selection box
			unitList = game.player1Units;
		} else { // player 2 sent selection box
			unitList = game.player2Units;
		}
		for (var i in unitList){
			var unit = unitList[i];
			if (unit.x > data.topLeftX && 
				unit.x < data.bottomRightX &&
				unit.y > data.topLeftY &&
				unit.y < data.bottomRightY
			){
				unit.selected = true;
				
			} else {
				unit.selected = false;
			}
		}
	});
	
	socket.on('selectedUnit',function(data){
		var game = GAME_LIST[data.gameId];
		var unitList = null;
		if (data.playerId === game.player1Id){ // player 1 sent selected unit
			unitList = game.player1Units;
		} else { // player 2 sent selected unit
			unitList = game.player2Units;
		}
		for (var i in unitList){
			var unit = unitList[i];
			if (unit.id === data.selectedUnitId){
				unit.selected = true;	
			} else {
				unit.selected = false;
			}
		}
	});
	
	socket.on('orderForUnits',function(data){
		var game = GAME_LIST[data.gameId];
		var unitList = null;
		if (data.playerId === game.player1Id){ // player 1 sent order
			unitList = game.player1Units;
		} else { // player 2 sent order
			unitList = game.player2Units;
		}
		for (var i in unitList){
			var unit = unitList[i];
			if (unit.selected === true){
				if (data.actionType === 'move'){
					unit.activeOrderType = 'move';
					unit.destinationX = data.destinationX;
					unit.destinationY = data.destinationY;
				} else if (data.actionType === 'capture'){
					if (unit.type === 1){
						unit.activeOrderType = 'capture';
						unit.objectId = data.objectId;
					} else {
						unit.activeOrderType = 'move';
					}
					unit.destinationX = data.destinationX;
					unit.destinationY = data.destinationY;
				} else if (data.actionType === 'attackBase'){
					if (unit.type !== 1){
						unit.activeOrderType = 'attack';
						unit.objectId = data.objectId;
					} else {
						unit.activeOrderType = 'move';
					}
					unit.destinationX = data.destinationX;
					unit.destinationY = data.destinationY;
				} else if (data.actionType === 'attackUnit'){
					if (unit.type !== 1){
						unit.activeOrderType = 'attack';
						unit.objectId = data.objectId;
					} else {
						unit.activeOrderType = 'move';
					}
					unit.destinationX = data.destinationX;
					unit.destinationY = data.destinationY;
				}
			}
		}
	});
	
	socket.on('rightClick',function(data){
		var game = GAME_LIST[data.gameId];
		var unitList = null;
		if (data.playerId === game.player1Id){ // player 1 sent right click
			unitList = game.player1Units;
		} else { // player 2 sent right click
			unitList = game.player2Units;
		}
		for (var i in unitList){
			var unit = unitList[i];
			unit.selected = false;
		}
	});
	
	
	
	
});



// --- methods ---

var updateLobbyPlayersList = function(){
	var lobbyPlayersList = [];
	for(var i in PLAYER_LIST){
		var p = PLAYER_LIST[i];
		var name = p.name;
		if (p.playing === true){
			name += ' (playing)';
		}
		if (p.isInLobby === true){
			lobbyPlayersList.push({
				id:p.id,
				name:name,
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
		if (g.started === false){
			gamesList.push({
				id:g.id,
				name:PLAYER_LIST[g.player1Id].name,
				player2Id:g.player2Id,
			});
		}
	}
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('lobbyGamesListUpdate',gamesList);
	}
}

// updating game
setInterval(function(){
	for(var i in GAME_LIST){
		var game = GAME_LIST[i];
		if (game.started){
			// update game state on server
			game.laserShots = [];
			game.continueProducingUnit();
			game.spinBuildings();
			game.addCredits();
			game.updateUnits();
			game.checkIfWin();
			
			// send updates to client
			var updatePack = [];
			updatePack = {
				player1Id: game.player1Id,
				player2Id: game.player2Id,
				player1Base: game.player1Base,
				player2Base: game.player2Base,
				mines: game.mines,
				player1Units: game.player1Units,
				player2Units: game.player2Units,
				laserShots: game.laserShots,
			};
			
			SOCKET_LIST[game.player1Id].emit('gameUpdate', updatePack);
			SOCKET_LIST[game.player1Id].emit('hudUpdate', {credits:game.player1Credits, productionProgress: game.player1ProductionProgress});
			
			SOCKET_LIST[game.player2Id].emit('gameUpdate', updatePack);
			SOCKET_LIST[game.player2Id].emit('hudUpdate', {credits:game.player2Credits, productionProgress: game.player2ProductionProgress});
		}
	}
},40); // 25 FPS