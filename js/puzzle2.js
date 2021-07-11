// Rectangle object - used to track position and hitboxes for puzzle pieces, puzzle slots,
//  and areas of the game board
//  top, left - x,y of top left corner
//  bottom, right - x,y of bottom right corner
function Rectangle(left, top, right, bottom) {
    this.top = top;
    this.left = left;
    this.bottom = bottom;
    this.right = right;

    this.width = right - left;
    this.height = bottom - top;

    // Returns whether or not this Rectangle contains the given coordinate
    this.contains = function (x, y) {
        // y must be between top and bottom, x must be between left and right
        if ( this.left <= x  && this.right >= x  && this.top <= y && this.bottom >= y ) {
            return true;
        }
        // By default, return false
        return false;
    };
}

// Puzzle piece object.  Constructed with image position and size (takes a small box from
//  the image to display), and tracks board position where it's currently displayed.
function PuzzlePiece(imgX, imgY, boxSize) {
    this.imageX = imgX;
    this.imageY = imgY;
    this.width = this.height = boxSize;

    this.isHighlighted = false;

    this.imagePiece = new Rectangle(this.imageX, this.imageY, this.imageX + this.width, this.imageY + this.height);

    // Set the x,y position of this piece on the board
    this.setBoardPosition = function (x, y) {
        this.boardPosition = new Rectangle(x, y, x + this.width, y + this.height);
    };
}

// Puzzle Slot object.  Stationary puzzle piece recepticle, it gets constructed with the
//  piece that belongs within its area.
class PuzzleSlot {
    constructor (boardX, boardY, boxSize, boardBounds, targetPiece) {
        this.boardX = boardX;
        this.boardY = boardY;
        this.boxSize = boxSize;
        this.boardBounds = boardBounds;
        this.targetPiece = targetPiece;
        this.heldPieces = new Set();

        this.setTargetArea();
    }

    // Set up the area on the canvas representing this puzzle slot
    setTargetArea() {
        let left = this.boardX + this.boardBounds.left;
        let top = this.boardY + this.boardBounds.top;
        this.targetArea = new Rectangle(left, top, left + this.boxSize, top + this.boxSize);
    }

    // Update the bounds containing this puzzle slot
    updateBounds(newBoardBounds) {
        this.boardBounds = newBoardBounds;
        this.setTargetArea();
        for ( let held of this.heldPieces ) {
            held.setBoardPosition(this.targetArea.left, this.targetArea.top);
        }
    }

    // Is the target piece within this slot's area?
    hasCorrectPiece() {
        // Slot has correct piece if the target piece is located within the target area
        var pp = this.targetPiece.boardPosition;
        return ( pp.left == this.targetArea.left && pp.top == this.targetArea.top );
    }

    holdPiece(newPiece) {
        this.heldPieces.add(newPiece);
    };

    unholdPiece(oldPiece) {
        if ( this.heldPieces.has(oldPiece) ) {
            this.heldPieces.delete(oldPiece);
        }
    };
}


// Game board singleton, handles all the puzzle logic and objects.
const gameBoard = {
    canvas: null,
    context: null,
    image: null,
    pieces: [],
    slots: [],
    pieceSpace: null,
    boardSpace: null,
    pieceSize: 250,
    MAX_PUZZLE_WIDTH: 750,
    MAX_PUZZLE_HEIGHT: 500,
    isDragging: false,

    // Begin the puzzle
    init: function () {
        // Grab the canvas and context to work with, as well as the image
        this.canvas = document.getElementById('game-board');
        window.addEventListener('resize', function () {
            gameBoard.fitCanvas();
            gameBoard.initSpaces();
            gameBoard.playingBoard = gameBoard.getPlayingBoard();
            for ( let i = 0, ln = gameBoard.slots.length; i < ln; i++ ) {
                gameBoard.slots[i].updateBounds(gameBoard.playingBoard);
            }
            gameBoard.redraw();
        });

        this.fitCanvas();
        this.initSpaces();

        // When puzzle image is loaded, initiate the pieces and slots
        this.context = this.canvas.getContext('2d');
        this.image = new Image();
        this.image.onload = function () { gameBoard.initPieces(); };
        this.image.src = 'images/orangesave.jpg';
    },

    fitCanvas: function () {
        const gameSpace = document.getElementById('game-space');
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

    },

    // Create the puzzle pieces and slots we'll be playing with
    initPieces: function () {
        var col = 0, row = 0;
        var imgX, imgY, puzzlePiece;

        this.playingBoard = this.getPlayingBoard();

        // While we're still in the image size, slice and dice into separate pieces
        while ( col * this.pieceSize < this.image.width && row * this.pieceSize < this.image.height ) {
            imgX = col * this.pieceSize;
            imgY = row * this.pieceSize;
            puzzlePiece = new PuzzlePiece(imgX, imgY, this.pieceSize);
            this.pieces.push(puzzlePiece);
            this.slots.push(new PuzzleSlot(imgX, imgY, this.pieceSize, this.playingBoard, puzzlePiece));

            col++;
            if ( col * this.pieceSize >= this.image.width ) {
                col = 0;
                row++;
            }
        }

        // Scramble the pieces into the puzzle piece area, and set up handlers
        this.scramblePieces();
        this.redraw();
        // Event handlers for the puzzle board
        this.canvas.onmousedown = function () {
            gameBoard.onMouseDown.apply(gameBoard, arguments);
        };
        this.canvas.onmouseup = function () {
            gameBoard.onMouseUp.apply(gameBoard, arguments);
        };
        this.canvas.onmousemove = function () {
            gameBoard.onMouseMove.apply(gameBoard, arguments);
        };

        document.getElementById('startBtn').addEventListener('click', function () {
            document.getElementById('level_2').style.display = 'none';
        });
        document.getElementById('playagainBtn').addEventListener('click', function () {
            let congratsDiv = document.getElementById('congrats');
            congratsDiv.style.display = 'none';
            congratsDiv.classList.remove('slidedown');
            gameBoard.scramblePieces();
            gameBoard.redraw();
        });
    },

    // Initiate the playing areas (space for scrambled pieces, and the actual puzzle board)
    initSpaces: function () {
        this.boardSpace = new Rectangle(0, 0, Math.max(this.canvas.width, this.MAX_PUZZLE_WIDTH), this.MAX_PUZZLE_HEIGHT + this.pieceSize);
        this.pieceSpace = new Rectangle(0, this.boardSpace.bottom, Math.max(this.canvas.width, this.MAX_PUZZLE_WIDTH), this.canvas.height);
    },

    getPlayingBoard: function () {
        // TODO: board space may not always be enough for the full image - adjust accordingly!
        let marginHorz = Math.floor( ( this.boardSpace.width - this.image.width ) / 2 );
        let marginVert = Math.floor( ( this.boardSpace.height - this.image.height ) / 2 );
        let playingBoard = new Rectangle(marginHorz, marginVert, marginHorz + this.image.width, marginVert + this.image.height);

        return playingBoard;
    },

    doWinShow: function () {
        // Player has won, do something to show this
        let congratsDiv = document.getElementById('congrats');
        congratsDiv.style.display = 'block';
        congratsDiv.classList.add('slidedown');
    },

    // Since each puzzle slot is stationary where it should be, stroke a line around each.
    drawPuzzleOutline: function () {
        this.context.strokeStyle = "#000000";
        this.context.lineWidth = 15;
        var s;
        for ( var j = 0, ln = this.slots.length; j < ln; j++ ) {
            s = this.slots[j].targetArea;
            this.context.strokeRect(s.left, s.top, s.width, s.height);
        }
    },

    // Loop through each puzzle piece, and draw its current position
    drawPuzzlePieces: function () {
        var p;
        for ( var i = 0, ln = this.pieces.length; i < ln; i++ ) {
            p = this.pieces[i];
            this.context.drawImage(this.image, p.imagePiece.left, p.imagePiece.top, p.imagePiece.width, p.imagePiece.height, p.boardPosition.left, p.boardPosition.top, p.boardPosition.width, p.boardPosition.height);
            if ( p.isHighlighted ) {
                // If the piece is highlighted, make sure we handle that
                this.context.strokeStyle = '#ff0000';
                this.context.lineWidth = 2;
                this.context.strokeRect(p.boardPosition.left + 1, p.boardPosition.top + 1, p.boardPosition.width - 2, p.boardPosition.height - 2);
            }
        }
    },

    // Return the puzzle piece at the given coordinate with the highest "z-index" (piece
    //  closest to the front).  If there are no pieces that apply, return false.
    getClickedPiece: function (canvasX, canvasY) {
        // Determine whether or not we're clicking on a piece
        // Work our way backwards, as the piece closest to the front will be last in our array
        var clickedPiece, ind;
        for ( ind = this.pieces.length - 1; ind >= 0; ind-- ) {
            if ( this.pieces[ind].boardPosition.contains(canvasX, canvasY) ) {
                clickedPiece = this.pieces[ind];
                // Move the piece to the end of our pieces array (it's now closest to the front)
                this.pieces.splice(ind, 1);
                this.pieces.push(clickedPiece);
                return clickedPiece;
                break;
            }
        }

        // No piece clicked, return false
        return false;
    },

    // Return the puzzle slot that is beneath the given coordinate
    getCurrentSlot: function (canvasX, canvasY) {
        // Find the slot we're currently moused over
        for ( var x = 0, ln = this.slots.length; x < ln; x++ ) {
            if ( this.slots[x].targetArea.contains(canvasX, canvasY) ) {
                return this.slots[x];
            }
        }

        // Return false by default
        return false;
    },

    // Check win conditions
    hasPlayerWon: function () {
        for ( var x = 0, ln = this.slots.length; x < ln; x++ ) {
            if ( !this.slots[x].hasCorrectPiece() ) {
                // If any piece is in the wrong slot, or if any slot is empty, game is still going
                return false;
            }
        }

        // Made it through with all slots containing the correct piece? Congrats, game is won!
        return true;
    },

    // Set a puzzle piece as highlighted
    highlightPiece: function ( puzzlePiece ) {
        puzzlePiece.isHighlighted = true;
        this.context.strokeStyle = '#ff0000';
        this.context.lineWidth = 2;
        this.highlightedPiece = puzzlePiece;
        this.context.drawImage(this.image, puzzlePiece.imageX, puzzlePiece.imageY, this.pieceSize, this.pieceSize, puzzlePiece.boardPosition.left, puzzlePiece.boardPosition.top, puzzlePiece.boardPosition.width, puzzlePiece.boardPosition.height);
        this.context.strokeRect(puzzlePiece.boardPosition.left + 1, puzzlePiece.boardPosition.top + 1, puzzlePiece.boardPosition.width - 2, puzzlePiece.boardPosition.height - 2);
    },

    // Redraw the puzzle board
    //  TODO: Optimize! This clears everything and redraws it all - has to be a more
    //  efficient way of doing this
    redraw: function () {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawPuzzleOutline();
        this.drawPuzzlePieces();
    },

    // Place pieces in random positions in the piece area
    scramblePieces: function () {
        var drawWidth = this.pieceSpace.width - this.pieceSize;
        var drawHeight = this.pieceSpace.height - this.pieceSize;
        var x = 0, y = 0, p;

        for ( var i = 0, ln = this.pieces.length; i < ln; i++ ) {
            x = Math.floor( Math.random() * drawWidth );
            y = Math.floor( Math.random() * drawHeight );
            p = this.pieces[i];
            p.setBoardPosition(x + this.pieceSpace.left, y + this.pieceSpace.top);
        }
    },

    // Set a piece as unhighlighted
    unhighlightPiece: function ( puzzlePiece ) {
        this.highlightedPiece.isHighlighted = false;
        this.highlightedPiece = null;
        this.context.drawImage(this.image, puzzlePiece.imageX, puzzlePiece.imageY, this.pieceSize, this.pieceSize, puzzlePiece.boardPosition.left, puzzlePiece.boardPosition.top, puzzlePiece.boardPosition.width, puzzlePiece.boardPosition.height);
    },

    // Mouse down handler
    //  Initiate the drag event, if there has been a puzzle piece clicked
    onMouseDown: function (e) {
        var canvasX = e.layerX;
        var canvasY = e.layerY;

        if ( this.highlightedPiece && !this.highlightedPiece.boardPosition.contains(canvasX, canvasY) ) {
            this.unhighlightPiece(this.highlightedPiece);
        }

        // Has the player put the mouse down on a puzzle piece?  Set things up for the drag event
        var puzzlePiece = this.getClickedPiece(canvasX, canvasY);
        if ( puzzlePiece ) {
            this.highlightPiece(puzzlePiece);
            this.isDragging = true;
            // Mark the offset from the mouse position to the piece top left corner
            //  (otherwise the piece magically "jumps" to the mouse position)
            this.dragOffset = {
                x: canvasX - puzzlePiece.boardPosition.left,
                y: canvasY - puzzlePiece.boardPosition.top
            };

            if ( this.playingBoard.contains(canvasX, canvasY) ) {
                // Player has picked up a piece from the board - find out which slot and get it to release the piece
                let slot = this.getCurrentSlot(canvasX, canvasY);
                if ( slot ) {
                    slot.unholdPiece(puzzlePiece);
                }
            }
        }
    },

    // Mouse move handler
    //  If we're dragging, handle the movement of the puzzle piece
    onMouseMove: function (e) {
        // We only really care if the mouse is moving when we're dragging a puzzle piece
        if ( this.isDragging ) {
            var canvasX = e.layerX;
            var canvasY = e.layerY;
            //var canvasX = e.pageX - this.canvas.offsetLeft;
            //var canvasY = e.pageY - this.canvas.offsetTop;

            if ( this.playingBoard.contains(canvasX, canvasY) ) {
                // Player has dragged a piece over the puzzle outline - find out which slot
                //  and "snap" the piece to it
                var slot = this.getCurrentSlot(canvasX, canvasY);
                if ( slot ) {
                    this.highlightedPiece.setBoardPosition(slot.targetArea.left, slot.targetArea.top);
                }
            }
            else {
                // Move the piece along with the mouse
                this.highlightedPiece.setBoardPosition(canvasX - this.dragOffset.x, canvasY - this.dragOffset.y);
            }

            this.redraw();
        }
    },

    // Mouse up handler
    //  End the drag event, place the puzzle piece in the slot (if applicable).
    onMouseUp: function (e) {
        var canvasX = e.layerX;
        var canvasY = e.layerY;
        if ( this.isDragging ) {
            this.isDragging = false;
            if ( this.playingBoard.contains(canvasX, canvasY) ) {
                // Player has dragged a piece over the puzzle outline - find out which slot
                //  and "snap" the piece to it
                var slot = this.getCurrentSlot(canvasX, canvasY);
                if ( slot ) {
                    this.highlightedPiece.setBoardPosition(slot.targetArea.left, slot.targetArea.top);
                    slot.holdPiece(this.highlightedPiece);
                    // If placed into a slot, unhighlight the piece, and check for win condition
                    this.unhighlightPiece(this.highlightedPiece);
                    if ( this.hasPlayerWon() ) {
                        this.doWinShow();
                    }
                }
            }
            else {
                // Move the piece along with the mouse
                this.highlightedPiece.setBoardPosition(canvasX - this.dragOffset.x, canvasY - this.dragOffset.y);
            }
            this.redraw();
        }
    }
};

