/* Simple JavaScript Inheritance
 * By John Resig http://ejohn.org/
 * MIT Licensed.
 */
// Inspired by base2 and Prototype
(function() {
    var initializing = false,
        fnTest = /xyz/.test(function() {
            xyz;
        }) ? /\b_super\b/ : /.*/;

    // The base Class implementation (does nothing)
    this.Class = function() {};

    // Create a new Class that inherits from this class
    Class.extend = function(prop) {
        var _super = this.prototype;

        // Instantiate a base class (but only create the instance,
        // don't run the init constructor)
        initializing = true;
        var prototype = new this();
        initializing = false;

        // Copy the properties over onto the new prototype
        for (var name in prop) {
            // Check if we're overwriting an existing function
            prototype[name] = typeof prop[name] == "function" &&
                typeof _super[name] == "function" && fnTest.test(prop[name]) ?
                (function(name, fn) {
                return function() {
                    var tmp = this._super;

                    // Add a new ._super() method that is the same method
                    // but on the super-class
                    this._super = _super[name];

                    // The method only need to be bound temporarily, so we
                    // remove it when we're done executing
                    var ret = fn.apply(this, arguments);
                    this._super = tmp;

                    return ret;
                };
            })(name, prop[name]) :
                prop[name];
        }

        // The dummy class constructor
        function Class() {
            // All construction is actually done in the init method
            if (!initializing && this.init)
                this.init.apply(this, arguments);
        }

        // Populate our constructed prototype object
        Class.prototype = prototype;

        // Enforce the constructor to be what we expect
        Class.prototype.constructor = Class;

        // And make this class extendable
        Class.extend = arguments.callee;

        return Class;
    };
})();
window.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
    window.webkitRequestAnimationFrame || window.oRequestAnimationFrame;

var Salmon = {};
Salmon.util = {};
Salmon.Canvas = Class.extend({
    init: function(element, options) {
        if (options) {
            if (options.fullscreen) {
                this.fullscreen = true;
            } else {
                this.width = options.width || 0;
                this.height = options.height || 0;
            }

            this.center = options.center || false;
            this.centerVertically = options.centerVertically || false;

            this.domElement = element;
            this.context = this.domElement.getContext('2d') || null;

            this.keys = [];
        }

        var that = this;

        window.addEventListener("keydown", function(e) {
            that.keys[e.keyCode] = true;
        });

        window.addEventListener("keyup", function(e) {
            that.keys[e.keyCode] = false;
        });
    }
});
Salmon.util.loadImage = function(src) {
    var img = new Image();
    img.src = src;
    return img;
};

Salmon.util.boundingBox = function(b1_x, b1_y, b1_w, b1_h, b2_x, b2_y, b2_w, b2_h) {
    if ((b1_x > b2_x + b2_w - 1) ||
        (b1_y > b2_y + b2_h - 1) ||
        (b2_x > b1_x + b1_w - 1) ||
        (b2_y > b1_y + b1_h - 1)) {
        return false;
    }

    return true;
};

Salmon.util.setCanvasFullscreen = function(element) {
    document.body.style.margin = 0;

    element.width = window.innerWidth;
    element.height = window.innerHeight;
    element.style.display = "inline-block";
    element.style.float = "left";
}

Salmon.initCanvas = function(canvas, options) {
    var element = null;

    if (typeof canvas === "string") {
        element = document.getElementById(canvas);
    }

    if (!element) element = canvas;

    if (options) {
        if (options.fullscreen) {
            Salmon.util.setCanvasFullscreen(element);

            window.addEventListener("resize", function() {
                Salmon.util.setCanvasFullscreen(element);
            });
        } else {
            if (options.width && options.height) {
                element.width = options.width;
                element.height = options.height;
            }

            if (options.center) {
                element.style.marginRight = "auto";
                element.style.marginLeft = "auto";
                element.style.display = "block";
            }

            if (options.centerVertically) {
                element.style.position = "fixed";
                element.style.top = "50%";
                element.style.left = "50%";

                element.style.marginLeft = (element.width / 2 * -1) + "px"
                element.style.marginTop = (element.height / 2 * -1) + "px"
            }
        }
    }

    var canvasObject = new Salmon.Canvas(element, options);

    return canvasObject;
};

Salmon.init = function(options) {
    var elements = document.querySelectorAll("canvas");

    elements.forEach(function(element) {
        if (element.hasAttribute("salmon") || element.hasAttribute("data-salmon")) {
            Salmon.initCanvas(element, options);
        }
    });
};

Salmon.initLoop = function(run) {
    run.tick = function() {
        run();
        window.requestAnimationFrame(run.tick);
    }

    run.tick();
};
Salmon.Sprite = Class.extend({
    textureRect: {
        position: {
            x: 0,
            y: 0
        },

        size: {
            x: 0,
            y: 0
        }
    },

    init: function(_texture, _position, _size) {
        this.position = _position || {
            x: 0,
            y: 0
        };

        this.size = _size || {
            x: 0,
            y: 0
        };

        this.texture = _texture || null;
    },

    render: function(context) {
        if (context && this.texture) {
            context.drawImage(this.texture, this.position.x, this.position.y);
        }
    },

    renderCropped: function(context) {
        if (context && this.texture && this.textureRect) {
            context.drawImage(this.texture, this.textureRect.position.x, this.textureRect.position.y, this.textureRect.size.x, this.textureRect.size.y, this.position.x, this.position.y, this.size.x, this.size.y);
        }
    },

    colliding: function(sprite) {
        return Salmon.util.boundingBox(this.position.x, this.position.y, this.size.x, this.size.y, sprite.position.x, sprite.position.y, sprite.size.x, sprite.size.y);
    }
});
Salmon.RectangleShape = Class.extend({
    init: function(_color, _position, _size) {
        this.size = _size || {
            x: 0,
            y: 0
        };

        this.position = _position || {
            x: 0,
            y: 0
        };

        this.color = _color || "#000";
    },

    render: function(context) {
        if (context) {
            var oldStyle = context.fillStyle;
            context.fillStyle = this.color;
            context.fillRect(this.position.x, this.position.y, this.size.x, this.size.y);
            context.fillStyle = oldStyle;
        }
    }
});
Salmon.CircleShape = Class.extend({
    init: function(_color, _position, _radius) {
        this.radius = _radius || 0;

        this.position = _position || {
            x: 0,
            y: 0
        };

        this.color = _color || "#000";
    },

    render: function(context) {
        if (context) {
            var oldStyle = context.fillStyle;
            context.arc(this.position.x + this.radius, this.position.y + this.radius, this.radius, 0, 2 * Math.PI, false);
            context.fillStyle = this.color;
            context.fill();
            context.fillStyle = oldStyle;
        }
    }
});