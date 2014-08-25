function convertArray(array) {
	var tiles = [];

	for (var i = 0; i < array.length; i++) {
		var row = array[i];
		for (var j = 0; j < row.length; j++) {
			if (typeof row[j] === "number") {
				var tile = {
					position: {
						y: i * 64,
						x: j * 64
					},

					type: row[j],
					arrayPosition: [i, j]
				};

				tiles.push(tile);
			}
		}
	}

	return {
		tiles: tiles
	};
}