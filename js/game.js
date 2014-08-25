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

	// Images 

	var images = {};
	images.background = Salmon.util.loadImage("img/background.png");
	images.overlay = Salmon.util.loadImage("img/overlay.png");
	images.tilesheet = Salmon.util.loadImage("img/tilesheet.png");

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
			json: "levels/l1_w1.json"
		},

		world2 = {
			spawnpoint: {},
			informationalTiles: [],
			levelArray: null,
			json: "levels/l1_w2.json"
		};

	var currentLevel = null;

	function loadLevels() {
		$.getJSON(world1.json, function(data) {
			world1.levelArray = data.map;
			world1.spawnpoint = data.spawnpoint;
			world1.informationalTiles = data.informationalTiles || [];
			currentLevel = null;
		});

		$.getJSON(world2.json, function(data) {
			world2.levelArray = data.map;
			world2.spawnpoint = data.spawnpoint;
			world2.informationalTiles = data.informationalTiles || [];
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

		if ((world1.levelArray && world2.levelArray) && !currentLevel) {
			world1Player.position = world1.spawnpoint;
			world2Player.position = world2.spawnpoint;
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

			if (fade.fading) return;

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

			player.velocity.x *= player.friction;
			player.velocity.y += player.gravity;

			player.grounded = false;

			player.position.x += player.velocity.x;
			player.position.y += player.velocity.y;

			for (var i = 0; i < currentLevel.tiles.length; i++) {
				var tile = currentLevel.tiles[i];

				if (tile.type === 3) {
					world1.levelArray[tile.arrayPosition[0]][tile.arrayPosition[1]] = tile.type;
					world2.levelArray[tile.arrayPosition[0]][tile.arrayPosition[1]] = tile.type;

					if (currentWorld === 2) {
						if (pickUpBlock) {
							if (Salmon.util.boundingBox(player.position.x, player.position.y, player.width, player.height, tile.position.x - player.view.x, tile.position.y - player.view.y, TILE_SIZE, TILE_SIZE)) {
								playerHoldingBlock = true;
								currentLevel.tiles.splice(i, 1);
								levelArray[tile.arrayPosition[0]][tile.arrayPosition[1]] = 0;
								world2.levelArray[tile.arrayPosition[0]][tile.arrayPosition[1]] = 0;
								world1.levelArray[tile.arrayPosition[0]][tile.arrayPosition[1]] = 0;
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
			// Clear the canvas
			context.fillStyle = "#fff";
			context.fillRect(0, 0, canvas.width, canvas.height);

			// Background
			context.drawImage(images.background, 0, 0);

			// Draw the current level
			if (currentLevel !== null) {
				// Draw the level

				var hideInformationalText = false;

				for (var i = 0; i < currentLevel.tiles.length; i++) {
					var tile = currentLevel.tiles[i];

					if (tile.type === 1) {
						context.drawImage(images.tilesheet, 768, 0, 256, 256, tile.position.x - player.view.x, tile.position.y - player.view.y, TILE_SIZE, TILE_SIZE);
					}

					if (tile.type === 2) {
						context.drawImage(images.tilesheet, 768, 256, 256, 256, tile.position.x - player.view.x, tile.position.y - player.view.y, TILE_SIZE, TILE_SIZE);
					}

					if (tile.type === 3) {
						// Transdimensional block 
						context.drawImage(images.tilesheet, 768, 640, 256, 256, tile.position.x - player.view.x, tile.position.y - player.view.y, TILE_SIZE, TILE_SIZE);

						if (Salmon.util.boundingBox(player.position.x, player.position.y, player.width, player.height, tile.position.x - player.view.x, tile.position.y - player.view.y, TILE_SIZE, TILE_SIZE)) {
							context.textBaseline = "middle";
							context.textAlign = "center";
							context.fillStyle = "rgba(0, 0, 0, 0.5)";
							context.font = "20px 'animated'"

							context.fillText("Press [E] to pick up the transdimensional block.", canvas.width / 2, canvas.height / 2 - 50);

							hideInformationalText = true;
						} else {
							hideInformationalText = false;
						}
					}
				}


				// Player shadow 
				// if (player.grounded) {
				// 	context.fillStyle = "rgba(0, 0, 0, 0.2)";
				// 	context.beginPath();
				// 	context.arc(player.position.x + (player.width / 2), player.position.y + player.height, 20, 0, Math.PI, false);
				// 	context.fill();
				// }

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

				// Informational text
				for (var i = 0; i < ((currentWorld === 1) ? world1.informationalTiles.length : world2.informationalTiles.length); i++) {
					var informationalTile = (currentWorld === 1) ? world1.informationalTiles[i] : world2.informationalTiles[i];

					context.fillStyle = "rgba(0, 0, 0, 0.2)";
					context.textBaseline = "middle";
					context.textAlign = "center";
					context.font = "50px 'animated'"

					context.fillText("?", (informationalTile.x + TILE_SIZE / 2) - player.view.x, (informationalTile.y + TILE_SIZE / 2) - player.view.y);

					if (!hideInformationalText && Salmon.util.boundingBox(player.position.x, player.position.y, player.width, player.height, informationalTile.x - player.view.x, informationalTile.y - player.view.y, TILE_SIZE, TILE_SIZE)) {
						context.fillStyle = "rgba(0, 0, 0, 0.5)";
						context.font = "20px 'animated'"
						context.fillText(informationalTile.text, canvas.width / 2, canvas.height / 2 - 50);

						if (informationalTile.activateHud) showHud = true;
					}
				}

				// Draw the player

				if (currentWorld === 2) {
					context.save();

					context.globalAlpha = 0.2;
					context.drawImage(images.tilesheet, 54, 256, 150, 252, world1Player.view.x + world1Player.position.x - player.view.x, world1Player.view.y + world1Player.position.y - player.view.y, world1Player.width, world1Player.height);

					context.restore();
				}

				if (!canvas.keys[68] && !canvas.keys[65]) {
					context.drawImage(images.tilesheet, 54, 256 * playerIdleAnimation.currentFrame, 150, 252, player.position.x, player.position.y, player.width, player.height);
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
				if (!fade.fading) transitionWorld();
			}

			if (e.keyCode === 69) {
				pickUpBlock = true;
			}

			if (e.keyCode === 39) {
				// Right
				if (currentWorld === 2 && playerHoldingBlock) placeBlock(false)
			}

			if (e.keyCode === 37) {
				// Left
				if (currentWorld === 2 && playerHoldingBlock) placeBlock(true);
			}
		});

		// Load in the first levels
		loadLevels();
	}

	init();
})();