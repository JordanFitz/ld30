(function() {
	// Constant stuff
	var TILE_SIZE = 64;

	// Canvas
	var canvas = Salmon.initCanvas("canvas", {
		width: 960,
		height: 640,
		center: true,
		centerVertically: true
	});

	var context = canvas.context;

	var ScreenState = {
		DRAW: 0,
		PLAY: 1,
		MENU: 2
	};

	var state = ScreenState.MENU;

	var mouse = {
		x: null,
		y: null,
		down: false
	};

	var backgroundMusic = new Audio();
	backgroundMusic.src = "audio/background.wav";

	backgroundMusic.addEventListener('ended', function() {
		this.currentTime = 0;
		this.play();
	}, false);

	backgroundMusic.volume = 0.4;

	// Drawing
	var faceDrawingsExist = (localStorage.getItem("face1") && localStorage.getItem("face2")),
		readyToDraw = false,
		currentDrawing = 1;

	function drawLine(x, y) {
		context.lineTo(x, y);
		context.lineWidth = 50;
		context.stroke();
		context.beginPath();
		context.arc(x, y, 25, 0, Math.PI * 2);
		context.fillStyle = "#000";
		context.fill();
		context.beginPath();
		context.moveTo(x, y);
	}

	// Images 

	var images = {};
	images.background = Salmon.util.loadImage("img/background.png");
	images.overlay = Salmon.util.loadImage("img/overlay.png");
	images.tilesheet = Salmon.util.loadImage("img/tilesheet.png");

	if (faceDrawingsExist) {
		images.face1 = Salmon.util.loadImage(localStorage.getItem("face1"));
		images.face2 = Salmon.util.loadImage(localStorage.getItem("face2"));
	}

	var tilesheetLoaded = false;
	images.tilesheet.onload = function() {
		tilesheetLoaded = true;
	}

	var playerIdleAnimation = {
		frames: 12,
		steps: 5,
		currentStep: 0,
		currentFrame: 0
	}

	var playerRunningAnimation = {
		frames: 8,
		steps: 2,
		currentStep: 0,
		currentFrame: 0
	}

	// HUD
	var showHud = false;

	// Player
	var player = {
		position: {
			x: 0,
			y: 64
		},

		velocity: {
			y: 0,
			x: 0
		},

		jumping: false,
		grounded: false,

		gravity: 0.6,
		friction: 0.85,
		speed: 8,

		height: 64,
		width: 37,

		view: {
			x: 0,
			y: 0
		}
	};

	var playerHoldingBlock = false,
		pickUpBlock = false;

	var world1Player = copyObject(player),
		world2Player = copyObject(player);

	// FPS
	var fps = {
		lastCalledTime: 0,
		value: 0,
		display: ""
	};

	// Levels
	var levelArray;

	var levelArray,
		world1 = {
			spawnpoint: {},
			informationalTiles: [],
			levelArray: null,
			json: "levels/l1_w1.json",
			nextLevelTrigger: {}
		},

		world2 = {
			spawnpoint: {},
			informationalTiles: [],
			levelArray: null,
			json: "levels/l1_w2.json",
			nextLevelTrigger: {}
		};

	var currentLevel = null;

	var loadingLevels = false;

	function loadLevels() {
		var w1Loaded = false,
			w2Loaded = false;

		loadingLevels = true;

		$.getJSON(world1.json, function(data) {
			world1.levelArray = data.map || [];
			world1.spawnpoint = data.spawnpoint || {};
			world1.informationalTiles = data.informationalTiles || [];
			world1.nextLevelTrigger = data.nextLevelTrigger || {};
			currentLevel = null;
			w1Loaded = true;
			currentWorld === 1;
			if (w2Loaded) loadingLevels = false;
		});

		$.getJSON(world2.json, function(data) {
			world2.levelArray = data.map || [];
			world2.spawnpoint = data.spawnpoint || {};
			world2.informationalTiles = data.informationalTiles || [];
			w2Loaded = true;
			if (w1Loaded) loadingLevels = false;
		});
	}

	// Transition between worlds

	var fade = {
		direction: 0,
		opacity: 0,
		fading: false
	};

	var currentWorld = 1;

	function transitionWorld() {
		if (currentWorld === 1) {
			fade.fading = true;
		} else if (currentWorld === 2) {
			fade.fading = true;
			if (fade.opacity >= 1) currentWorld = 1;
		}

		showHud = true;

		canvas.keys = [];
	}

	// Place transdimensional block
	var canPlaceBlock = true;
	var placeBlockMessage = "";
	var resetCanPlaceBlock;

	function checkBlock(arrayX, arrayY) {
		var placeOn = world2.levelArray[arrayY][arrayX];
		var error = false;

		if (arrayX >= 0 && arrayX < levelArray[0].length) {
			if (placeOn === 0) {
				placeOn = world1.levelArray[arrayY][arrayX];
				if (placeOn === 0) {
					if (!Salmon.util.boundingBox(world1Player.view.x + world1Player.position.x, world1Player.view.y + world1Player.position.y, world1Player.width, world1Player.height, arrayX * TILE_SIZE, arrayY * TILE_SIZE, TILE_SIZE, TILE_SIZE)) {
						world1.levelArray[arrayY][arrayX] = 3;
						world2.levelArray[arrayY][arrayX] = 3;

						if (currentWorld === 1) {
							levelArray = world1.levelArray;
							currentLevel = convertArray(levelArray);
						} else if (currentWorld === 2) {
							levelArray = world2.levelArray;
							currentLevel = convertArray(levelArray);
						}

						playerHoldingBlock = false;
					} else {
						// Can't place, other player is there D:
						error = true;
						placeBlockMessage = "Blocks can't be placed where you're standing."
					}
				} else {
					// Can't place, tile isn't blank
					error = true;
					placeBlockMessage = "Blocks can only be placed on blank areas in world 1."
				}
			} else {
				// Can't place, tile isn't blank
				error = true;
				placeBlockMessage = "Blocks can only be placed on blank areas."
			}
		} else {
			// Can't place, outside of bounds
			error = true;
		}

		if (error) {
			canPlaceBlock = false;
			if (resetCanPlaceBlock) clearTimeout(resetCanPlaceBlock);
			resetCanPlaceBlock = setTimeout(function() {
				canPlaceBlock = true
			}, 2500);
		}
	}

	function placeBlock(left) {
		var relativeX = player.view.x + player.position.x,
			relativeY = player.view.y + player.position.y;

		var arrayX = (Math.floor(relativeX / TILE_SIZE) * TILE_SIZE) / TILE_SIZE,
			arrayY = (Math.floor(relativeY / TILE_SIZE) * TILE_SIZE) / TILE_SIZE;

		if (left) {
			// Place to the left, if possible
			checkBlock(arrayX - 1, arrayY);
		} else {
			// To the right!
			checkBlock(arrayX + 1, arrayY);
		}
	}

	// Copy object because JavaScript is weird ( ͡° ͜ʖ ͡°)
	function copyObject(from) {
		return JSON.parse(JSON.stringify(from));
	}

	// Platformer collision

	function checkCollision(tile) {
		// get the vectors to check against
		var vectorX = (player.position.x + (player.width / 2)) - (tile.position.x - player.view.x + (TILE_SIZE / 2)),
			vectorY = (player.position.y + (player.height / 2)) - (tile.position.y - player.view.y + (TILE_SIZE / 2)),
			// add the half widths and half heights of the objects
			halfWidths = (player.width / 2) + (TILE_SIZE / 2),
			halfHeights = (player.height / 2) + (TILE_SIZE / 2),
			collision = null;

		// if the x and y vector are less than the half width or half height, they we must be inside the object, causing a collision
		if (Math.abs(vectorX) < halfWidths && Math.abs(vectorY) < halfHeights) {
			// figures out on which side we are colliding (top, bottom, left, or right)
			var oX = halfWidths - Math.abs(vectorX),
				oY = halfHeights - Math.abs(vectorY);
			if (oX >= oY) {
				if (vectorY > 0) {
					collision = "t";
					player.position.y += oY;
				}

				if (vectorY <= 0) {
					collision = "b";
					player.position.y -= oY;
				}
			} else {
				if (vectorX > 0) {
					collision = "l";
					player.position.x += oX;
				}

				if (vectorX <= 0) {
					collision = "r";
					player.position.x -= oX;
				}
			}
		}

		return collision;
	}

	function update() {
		faceDrawingsExist = (localStorage.getItem("face1") && localStorage.getItem("face2"));

		if (fade.fading) {
			if (fade.direction === 0) {
				if (fade.opacity >= 1) {
					currentWorld = (currentWorld === 1) ? 2 : 1;
					fade.opacity = 0.999;
					fade.direction = 1;

					if (currentWorld === 1) {
						world2Player = copyObject(player);
						player = copyObject(world1Player);
					} else if (currentWorld === 2) {
						world1Player = copyObject(player);
						player = copyObject(world2Player);
					}
				}

				if (fade.opacity < 1) fade.opacity += 0.09;
			} else {
				if (fade.opacity > 0) fade.opacity -= 0.05;
				if (fade.opacity <= 0) {
					fade.fading = false;
					fade.direction = 0;
				}
			}
		}

		if (!images.face1 || !images.face2) {
			if (faceDrawingsExist) {
				images.face1 = Salmon.util.loadImage(localStorage.getItem("face1"));
				images.face2 = Salmon.util.loadImage(localStorage.getItem("face2"));
			}
		}

		if ((world1.levelArray && world2.levelArray) && !currentLevel) {
			world1Player.position = world1.spawnpoint;
			world2Player.position = world2.spawnpoint;

			world1Player.view.x = 0;
			world1Player.view.y = 0;
			world2Player.view.x = 0;
			world2Player.view.y = 0;

			player = copyObject(world1Player);
		}

		if (world1.levelArray && world2.levelArray) {
			if (currentWorld === 1) {
				if (levelArray != world1.levelArray) {
					levelArray = world1.levelArray;
					currentLevel = convertArray(levelArray);
				}
			} else if (currentWorld === 2) {
				if (levelArray != world2.levelArray) {
					levelArray = world2.levelArray;
					currentLevel = convertArray(levelArray);
				}
			}
		}

		if (currentLevel) {
			if (currentWorld !== 2) pickUpBlock = false;

			if (fade.fading || state !== ScreenState.PLAY) return;

			if (canvas.keys[68] /* D key */ ) {
				if (player.position.x + player.width < canvas.width - 384 || player.view.x + canvas.width >= levelArray[0].length * 64) {
					if (player.velocity.x < player.speed && player.position.x + player.width < canvas.width) {
						player.velocity.x++;
					}
				} else {
					player.velocity.x = 0;
					player.view.x += player.speed;
				}
			}

			if (canvas.keys[65] /* A key */ ) {
				if (player.position.x > 384 || player.view.x === 0) {
					if (player.velocity.x > -player.speed && player.position.x > 0) {
						player.velocity.x--;
					}
				} else {
					player.velocity.x = 0;
					player.view.x += -player.speed;
				}

			}

			if (canvas.keys[87] /* W key */ ) {
				if (!player.jumping && player.grounded) {
					player.jumping = true;
					player.grounded = false;
					player.velocity.y = -player.speed * 1.3;
				}
			}

			if (currentWorld === 1 && !world1.nextLevelTrigger.lastLevel) {
				if (!loadingLevels && Salmon.util.boundingBox(player.position.x, player.position.y, player.width, player.height, world1.nextLevelTrigger.x - player.view.x, world1.nextLevelTrigger.y - player.view.y, TILE_SIZE, TILE_SIZE)) {
					world1.json = world1.nextLevelTrigger.world1;
					world2.json = world1.nextLevelTrigger.world2;

					loadLevels();
				}
			}

			player.velocity.x *= player.friction;
			player.velocity.y += player.gravity;

			player.grounded = false;

			player.position.x += player.velocity.x;
			player.position.y += player.velocity.y;

			for (var i = 0; i < currentLevel.tiles.length; i++) {
				var tile = currentLevel.tiles[i];

				if (tile.type === 3) {
					if (world1.levelArray[tile.arrayPosition[0]][tile.arrayPosition[1]] === 0) world1.levelArray[tile.arrayPosition[0]][tile.arrayPosition[1]] = tile.type;
					world2.levelArray[tile.arrayPosition[0]][tile.arrayPosition[1]] = tile.type;

					if (currentWorld === 2) {
						if (pickUpBlock) {
							if (Salmon.util.boundingBox(player.position.x, player.position.y, player.width, player.height, tile.position.x - player.view.x, tile.position.y - player.view.y, TILE_SIZE, TILE_SIZE)) {
								playerHoldingBlock = true;
								currentLevel.tiles.splice(i, 1);
								levelArray[tile.arrayPosition[0]][tile.arrayPosition[1]] = 0;
								world2.levelArray[tile.arrayPosition[0]][tile.arrayPosition[1]] = 0;
								if (world1.levelArray[tile.arrayPosition[0]][tile.arrayPosition[1]] === 3) world1.levelArray[tile.arrayPosition[0]][tile.arrayPosition[1]] = 0;
							}

							pickUpBlock = false;
						}

						continue;
					}
				}

				if (tile.type !== 0) {
					var collision = checkCollision(tile);

					if (collision === "l" || collision === "r") {
						player.velocity.x = 0;
						player.jumping = false;
					} else if (collision === "b") {
						player.grounded = true;
						player.jumping = false;
					} else if (collision === "t") {
						player.velocity.y *= -1;
					}
				}
			}

			if (player.grounded) {
				player.velocity.y = 0;
			}

			if (player.position.x < 0) {
				player.position.x = 0;
			}

			if (player.position.x + player.width > canvas.width) {
				player.position.x = canvas.width - player.width;
			}

			// View
			if (player.view.x < 0) {
				player.view.x = 0;
			}

			if (player.view.x > levelArray[0].length * 64) {
				player.view.x = levelArray[0].length * 64 - canvas.width;
			}
		}

		// Animations

		if (playerIdleAnimation.currentStep < playerIdleAnimation.steps) {
			playerIdleAnimation.currentStep++;
		} else {
			playerIdleAnimation.currentStep = 0;
			if (playerIdleAnimation.currentFrame < playerIdleAnimation.frames - 1) {
				playerIdleAnimation.currentFrame++;
			} else {
				playerIdleAnimation.currentFrame = 0;
			}
		}

		if (canvas.keys[68] || canvas.keys[65]) {
			if (playerRunningAnimation.currentStep < playerRunningAnimation.steps) {
				playerRunningAnimation.currentStep++;
			} else {
				playerRunningAnimation.currentStep = 0;
				if (playerRunningAnimation.currentFrame < playerRunningAnimation.frames - 1) {
					playerRunningAnimation.currentFrame++;
				} else {
					playerRunningAnimation.currentFrame = 0;
				}
			}
		}

		// FPS 

		if (!fps.lastCalledTime) {
			fps.lastCalledTime = new Date().getTime();
			fps.value = 0;
			return;
		}

		var delta = (new Date().getTime() - fps.lastCalledTime) / 1000;

		fps.lastCalledTime = new Date().getTime();

		fps.value = 1 / delta;

		if (fps.display.length === 0) {
			fps.display = "FPS: " + Math.round(fps);
		}
	}

	function draw() {

		if (!tilesheetLoaded) {
			context.fillStyle = "#000";
			context.fillRect(0, 0, canvas.width, canvas.height);

			context.textBaseline = "middle";
			context.textAlign = "center";
			context.font = "50px 'animated'";
			context.fillStyle = "rgba(255, 255, 255, 0.8)";

			context.fillText("Loading Textures", canvas.width / 2, canvas.height / 2);
		} else {
			if (state === ScreenState.MENU) {
				// Clear the canvas
				context.fillStyle = "#fff";
				context.fillRect(0, 0, canvas.width, canvas.height);

				context.drawImage(images.background, 0, 0);

				context.textAlign = "center";
				context.textBaseline = "top";
				context.font = "50px 'animated'";
				context.fillStyle = "rgba(0, 0, 0, 0.8)";

				context.fillText("Connected Worlds", canvas.width / 2, 150);

				context.textBaseline = "bottom"
				context.font = "30px 'animated'";
				context.fillText("A game made in 72 hours", canvas.width / 2, canvas.height - 100);
				context.fillText("By Jacksack (graphics) and JordanFitz (programming)", canvas.width / 2, canvas.height - 50);

				// Play button!
				context.strokeStyle = "#000";
				context.lineWidth = 3;
				var buttonX = canvas.width / 2 - 96,
					buttonY = canvas.height / 2 - 32;

				context.strokeRect(buttonX, buttonY, 192, 64);

				if (mouse.x >= buttonX && mouse.y >= buttonY && mouse.x < buttonX + 192 && mouse.y < buttonY + 64) {
					context.fillStyle = "rgba(0, 0, 0, 0.4)";
					context.fillRect(buttonX, buttonY, 192, 64);

					if (mouse.down) {
						state = (faceDrawingsExist) ? ScreenState.PLAY : ScreenState.DRAW;
						context.fillStyle = "#fff";
						context.fillRect(0, 0, canvas.width, canvas.height);
						return;
					}
				} else {
					context.fillStyle = "rgba(0, 0, 0, 0.5)";
					context.fillRect(buttonX, buttonY, 192, 64);
				}

				context.fillStyle = "#fff";
				context.textBaseline = "middle";
				context.textAlign = "center";

				context.fillText("Play", canvas.width / 2, canvas.height / 2);
			} else if (state === ScreenState.DRAW) {
				if (!readyToDraw) {
					context.fillStyle = "#fff";
					context.fillRect(0, 0, canvas.width, canvas.height);

					context.textBaseline = "middle"
					context.textAlign = "center";
					context.font = "25px 'animated'";
					context.fillStyle = "rgba(0, 0, 0, 0.5)";
					context.fillText("How do you tell the difference between your two characters? Draw their faces!", canvas.width / 2, canvas.height / 2 - 25);
					context.fillText("Press [space] to clear the canvas. Press [enter] to progress.", canvas.width / 2, canvas.height / 2 + 25);
				}
			} else if (state === ScreenState.PLAY) {
				// Clear the canvas
				context.fillStyle = "#fff";
				context.fillRect(0, 0, canvas.width, canvas.height);

				// Background
				context.drawImage(images.background, 0, 0);

				// Draw the current level
				if (currentLevel !== null) {
					var hideInformationalText = false,
						informationalVisible = false;

					// Informational text
					for (var i = 0; i < ((currentWorld === 1) ? world1.informationalTiles.length : world2.informationalTiles.length); i++) {
						var informationalTile = (currentWorld === 1) ? world1.informationalTiles[i] : world2.informationalTiles[i];

						context.fillStyle = "rgba(0, 0, 0, 0.2)";
						context.textBaseline = "middle";
						context.textAlign = "center";
						context.font = "50px 'animated'"

						context.fillText("?", (informationalTile.x + TILE_SIZE / 2) - player.view.x, (informationalTile.y + TILE_SIZE / 2) - player.view.y);

						if (!informationalVisible && !hideInformationalText && Salmon.util.boundingBox(player.position.x, player.position.y, player.width, player.height, informationalTile.x - player.view.x, informationalTile.y - player.view.y, TILE_SIZE, TILE_SIZE)) {
							context.fillStyle = "rgba(0, 0, 0, 0.5)";
							context.font = "20px 'animated'"
							context.fillText(informationalTile.text, canvas.width / 2, canvas.height / 2 - 50);

							if (informationalTile.activateHud) showHud = true;
							informationalVisible = true;
						} else {
							informationalVisible = false;
						}
					}

					// Draw the level
					for (var i = 0; i < currentLevel.tiles.length; i++) {
						var tile = currentLevel.tiles[i];

						if (tile.type === 1) {
							context.drawImage(images.tilesheet, 768, 0, 256, 256, tile.position.x - player.view.x, tile.position.y - player.view.y, TILE_SIZE, TILE_SIZE);
						}

						if (tile.type === 2) {
							context.drawImage(images.tilesheet, 768, 256, 256, 256, tile.position.x - player.view.x, tile.position.y - player.view.y, TILE_SIZE, TILE_SIZE);
						}

						if (tile.type === 4) {
							context.drawImage(images.tilesheet, 768, 1152, 256, 256, tile.position.x - player.view.x, tile.position.y - player.view.y, TILE_SIZE, TILE_SIZE);
						}


						if (tile.type === 3) {
							// Transdimensional block 
							context.drawImage(images.tilesheet, 768, 640, 256, 256, tile.position.x - player.view.x, tile.position.y - player.view.y, TILE_SIZE, TILE_SIZE);

							if (Salmon.util.boundingBox(player.position.x, player.position.y, player.width, player.height, tile.position.x - player.view.x, tile.position.y - player.view.y, TILE_SIZE, TILE_SIZE)) {
								context.textBaseline = "middle";
								context.textAlign = "center";
								context.fillStyle = "rgba(0, 0, 0, 0.5)";
								context.font = "20px 'animated'"

								context.fillText("Press [E] to pick up the transdimensional block.", canvas.width / 2, canvas.height / 2 - 150);

								hideInformationalText = true;
							} else {
								hideInformationalText = false;
							}
						}
					}

					// Next level trigger

					if (currentWorld === 1) {
						context.drawImage(images.tilesheet, 768, 896, 256, 256, world1.nextLevelTrigger.x - player.view.x, world1.nextLevelTrigger.y - player.view.y, TILE_SIZE, TILE_SIZE);
					}

					// HUD stuff

					if (showHud) {
						if (currentWorld === 1) {
							context.drawImage(images.tilesheet, 768, 512, 128, 128, canvas.width - 132, 0, 128, 128);
						} else if (currentWorld === 2) {
							context.drawImage(images.tilesheet, 896, 512, 128, 128, canvas.width - 132, 0, 128, 128);
						}

						context.fillStyle = "rgba(0, 0, 0, 0.5)";
						context.textBaseline = "middle";
						context.textAlign = "right";
						context.font = "17px 'animated'"

						context.fillText("Press [space] to switch worlds", canvas.width - 150, 64);
					}

					if (playerHoldingBlock) {
						if (currentWorld === 2) {
							context.fillStyle = "rgba(0, 0, 0, 0.5)";
							context.textBaseline = "middle";
							context.textAlign = "left";
							context.font = "17px 'animated'";

							context.drawImage(images.tilesheet, 768, 640, 256, 256, 32, 32, 64, 64);
							context.fillText("Use [left] or [right] to place the block", 128, 64)
						}
					}

					// Block place messages

					if (!canPlaceBlock) {
						context.fillStyle = "rgba(0, 0, 0, 0.2)";
						context.textBaseline = "top";
						context.textAlign = "center";
						context.font = "20px 'animated'"

						context.fillText(placeBlockMessage, canvas.width / 2, 96);
					}

					// Draw the player

					if (currentWorld === 2) {
						context.save();

						context.globalAlpha = 0.2;
						context.drawImage(images.tilesheet, 54, 256, 150, 252, world1Player.view.x + world1Player.position.x - player.view.x, world1Player.view.y + world1Player.position.y - player.view.y, world1Player.width, world1Player.height);
						context.drawImage(images.face1, world1Player.view.x + world1Player.position.x - player.view.x + 5, world1Player.view.y + world1Player.position.y - player.view.y + 5, 30, 24);

						context.restore();
					}

					if (!canvas.keys[68] && !canvas.keys[65]) {
						context.drawImage(images.tilesheet, 54, 256 * playerIdleAnimation.currentFrame, 150, 252, player.position.x, player.position.y, player.width, player.height);

						if (currentWorld === 1) {
							context.drawImage(images.face1, player.position.x + 5, player.position.y + 5, 30, 24);
						} else if (currentWorld === 2) {
							context.drawImage(images.face2, player.position.x + 5, player.position.y + 5, 30, 24);
						}
					} else {
						if (!canvas.keys[65]) {
							context.drawImage(images.tilesheet, 310, 256 * playerRunningAnimation.currentFrame, 150, 252, player.position.x, player.position.y, player.width, player.height);
						} else {
							context.drawImage(images.tilesheet, 566, 256 * playerRunningAnimation.currentFrame, 150, 252, player.position.x, player.position.y, player.width, player.height);
						}
					}

					// Overlay
					context.drawImage(images.overlay, 0, 0);

					// Fade
					if (fade.fading) {
						context.fillStyle = "rgba(50, 50, 50, " + fade.opacity + ")";
						context.fillRect(0, 0, canvas.width, canvas.height);
					}

					// FPS

					if (window.location.hash.indexOf("debug") != -1) {
						context.fillStyle = "#000";
						context.textAlign = "left";
						context.textBaseline = "top";
						context.font = "15px monospace";
						context.fillText(fps.display, 7, 3);
					}
				}
			}
		}
	}

	function run() {
		if (tilesheetLoaded) update();
		draw();
	}

	function init() {
		Salmon.initLoop(run);

		setInterval(function() {
			fps.display = "FPS: " + Math.round(fps.value);
		}, 500);

		context.font = "50px 'animated'";

		window.onblur = function() {
			canvas.keys = [];
		}

		window.addEventListener("keyup", function(e) {
			if (e.keyCode === 32) {
				if (state === ScreenState.PLAY) {
					if (!fade.fading) transitionWorld();
				} else if (state === ScreenState.DRAW) {
					context.clearRect(0, 0, canvas.width, canvas.height);
				}
			}

			if (e.keyCode === 69 && state === ScreenState.PLAY) {
				pickUpBlock = true;
			}

			if (e.keyCode === 39 && state === ScreenState.PLAY) {
				// Right
				if (currentWorld === 2 && playerHoldingBlock) placeBlock(false);
			}

			if (e.keyCode === 37 && state === ScreenState.PLAY) {
				// Left
				if (currentWorld === 2 && playerHoldingBlock) placeBlock(true);
			}

			if (e.keyCode === 13) {
				// Enter
				if (state === ScreenState.DRAW) {
					if (readyToDraw) {
						if (currentDrawing === 1) {
							localStorage.setItem("face1", canvas.domElement.toDataURL());
							currentDrawing++;
							context.clearRect(0, 0, canvas.width, canvas.height);
						} else {
							localStorage.setItem("face2", canvas.domElement.toDataURL());
							state = ScreenState.PLAY;
						}
					}

					if (!readyToDraw) {
						readyToDraw = true;
						context.clearRect(0, 0, canvas.width, canvas.height);
					}
				}
			}
		});

		canvas.domElement.addEventListener("mousemove", function(e) {
			mouse.x = e.pageX - canvas.domElement.offsetLeft;
			mouse.y = e.pageY - canvas.domElement.offsetTop;

			if (state === ScreenState.DRAW && mouse.down) {
				drawLine(mouse.x, mouse.y);
			}
		});

		canvas.domElement.addEventListener("mousedown", function() {
			mouse.down = true;

			if (state === ScreenState.DRAW) {
				drawLine(mouse.x, mouse.y);
			}
		});

		canvas.domElement.addEventListener("mouseup", function() {
			mouse.down = false;
			if (state === ScreenState.DRAW) context.beginPath();
		});

		// Load in the first levels
		loadLevels();

		backgroundMusic.play();
	}

	init();
})();