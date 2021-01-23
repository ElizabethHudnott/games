'use strict';
let columnsToWin = 3;
let maxCounters = 3;
let boardHeight = 13;

let emptySpaceColor = 'hsl(120, 2%, 53%)';
let temporaryColor = '#000000';
let stripeColor = 'hsl(90, 80%, 87%)';
let playerColors = ['hsl(210, 95%, 60%)', 'hsl(30, 95%, 60%)'];
let colorNames = ['Blue', 'Orange'];
// playerColors = ['#505050', '#c8c8c8'];
let cellPaddingFraction = 0.1;
let minCellPaddingPx = 2;
let secondCounterOffsetFraction = 0.15;
let textFraction = 0.25;

const container = document.body;
const TWO_PI = 2 * Math.PI;
const COMBINATIONS = [171, 302, 461, 580, 727, 834, 727, 580, 461, 302, 171];

function numericCompare(a, b) {
	return a - b;
}

class MoveInfo {
	constructor(state, columnsWon, score, tieBreakScore) {
		this.state = state;
		this.columnsWon = columnsWon;
		this.score = score;
		this.tieBreakScore = tieBreakScore;
		this.freeCounters = state.freeCounters();
	}
}

/**
 * Returns a positive number if move 2 is worse than move 1, a negative number if move 2
 * is better than move 1 or zero if they're equally good.
 */
function compareMoves(move1, move2) {
	if (move1.columnsWon !== move2.columnsWon) {
		return move2.columnsWon - move1.columnsWon;
	}
	if (move1.freeCounters !== move2.freeCounters) {
		return move2.freeCounters - move1.freeCounters;
	}
	if (move1.score !== move2.score) {
		return move2.score - move1.score;
	}
	if (move1.tieBreakScore !== move2.tieBreakScore) {
		return move2.tieBreakScore - move1.tieBreakScore;
	}
	return move2.state.totalMoveLength - move1.state.totalMoveLength
}


class BoardState {
	constructor(stateToCopy) {
		if (stateToCopy === undefined) {
			const player1 = new Array(11);
			for (let i = 0; i < 6; i++) {
				player1[5 - i] = 2 * i;
				player1[5 + i] = 2 * i;
			}
			this.playerStates = [player1, player1.slice()];
			this.currentColumns = new Set();
			this.totalMoveLength = 0;
			this.gain = 0;
			this.turn = 0;
		} else {
			this.playerStates = [stateToCopy.playerStates[0].slice(), stateToCopy.playerStates[1].slice()];
			this.currentColumns = new Set(stateToCopy.currentColumns);
			this.totalMoveLength = stateToCopy.totalMoveLength;
			this.gain = stateToCopy.gain;
			this.turn = stateToCopy.turn;
		}
	}

	freeCounters() {
		return maxCounters - this.currentColumns.size;
	}

	maxAdvance(playerNum, columnNum) {
		const index = columnNum - 2;
		if (this.playerStates[1 - playerNum][index] === boardHeight) {
			return 0;
		} else {
			return boardHeight - this.playerStates[playerNum][index];
		}
	}

	completedColumn(playerNum, columnNum) {
		return this.playerStates[playerNum][columnNum - 2] === boardHeight;
	}

	executeMove(move) {
		const state = this.playerStates[this.turn];
		for (let columnNum of move) {
			state[columnNum - 2]++;
			this.currentColumns.add(columnNum);
			this.totalMoveLength++;
			this.gain += boardHeight / (boardHeight - 2 * Math.abs(columnNum - 7));
		}
	}

	endTurn() {
		this.currentColumns.clear();
		this.totalMoveLength = 0;
		this.gain = 0;
		this.turn = 1 - this.turn;
	}

	getWinner() {
		for (let playerNum = 0; playerNum < 2; playerNum++) {
			let columnsWon = 0;
			const state = this.playerStates[playerNum];
			for (let i = 0; i < 11; i++) {
				if (state[i] === boardHeight) {
					columnsWon++;
					if (columnsWon === columnsToWin) {
						return playerNum;
					}
				}
			}
		}
		return undefined;
	}

	evaluate(playerNum) {
		const myState = this.playerStates[playerNum];
		const opponentState = this.playerStates[1 - playerNum];
		const myExpectedRolls = new Array(11);
		const opponentExpectedRolls = new Array(11);

		let columnsWon = 0;
		let columnsLost = 0;
		let score = 0, tieBreakScore = 0;
		for (let i = 0; i < 11; i++) {
			if (myState[i] === boardHeight) {
				myExpectedRolls[i] = 0;
				opponentExpectedRolls[i] = Infinity;
				columnsWon++;
			} else if (opponentState[i] === boardHeight) {
				myExpectedRolls[i] = Infinity;
				opponentExpectedRolls[i] = 0;
				columnsLost++;
			} else {
				myExpectedRolls[i] = (1296 / COMBINATIONS[i]) * (boardHeight - myState[i]);
				opponentExpectedRolls[i] = (1296 / COMBINATIONS[i]) * (boardHeight - opponentState[i]);
				if (myExpectedRolls[i] < opponentExpectedRolls[i]) {
					tieBreakScore += opponentExpectedRolls[i] - myExpectedRolls[i];
				}
			}
		}

		myExpectedRolls.sort(numericCompare).splice(0, columnsWon);
		opponentExpectedRolls.sort(numericCompare).splice(0, columnsLost);

		const numColumnsToCount = columnsToWin - columnsWon;
		for (let i = 0; i < numColumnsToCount; i++) {
			score += opponentExpectedRolls[i] - myExpectedRolls[i];
		}
		return new MoveInfo(this, columnsWon, score, tieBreakScore);
	}

	possibleMoves(diceRolls) {
		const diceTotals = new Array(3);
		diceTotals[0] = [diceRolls[0] + diceRolls[1], diceRolls[2] + diceRolls[3]]; // 01 23
		diceTotals[1] = [diceRolls[0] + diceRolls[2], diceRolls[1] + diceRolls[3]]; // 02 13
		diceTotals[2] = [diceRolls[0] + diceRolls[3], diceRolls[1] + diceRolls[2]]; // 03 12

		const moves = [];
		const numCountersFree = this.freeCounters();

		function addMove(move) {
			if (move.length === 0) {
				return;
			}
			move.sort(numericCompare);
			for (let existingMove of moves) {
				if (move.length !== existingMove.length) {
					continue;
				}
				let different = false;
				for (let i = 0; i < move.length; i++) {
					if (existingMove[i] !== move[i]) {
						different = true;
						break;
					}
				}
				if (!different) {
					return;
				}
			}
			moves.push(move);
		}

		for (let i = 0; i < 3; i++) {
			const totals = diceTotals[i];
			let move = [];
			if (totals[0] === totals[1]) {
				const total = totals[0];
				if (this.currentColumns.has(total) || numCountersFree > 0) {
					const moveLength = Math.min(this.maxAdvance(this.turn, total), 2);
					for (let j = 0; j < moveLength; j++) {
						move.push(total);
					}
					addMove(move);
				}
			} else {
				let total = totals[0];
				let existingCounter = this.currentColumns.has(total);
				let usedCounter = !existingCounter;

				if (existingCounter || numCountersFree > 0) {
					if (this.maxAdvance(this.turn, total) > 0) {
						move[0] = total;
					} else {
						usedCounter = false;
					}
				}
				total = totals[1];
				existingCounter = this.currentColumns.has(total);
				if (existingCounter || numCountersFree > 0) {
					if (this.maxAdvance(this.turn, total) > 0) {
						if (!existingCounter && usedCounter && numCountersFree === 1) {
							addMove(move);
							move = [];
						}
						move.push(total);
					}
				}
				addMove(move);
			}
		}
		return moves;
	}

	expectedGain() {
		let sum = 0;
		for (let i = 0; i < 1296; i++) {
			const a = (i % 6) + 1;
			let remainder = Math.trunc(i / 6);
			const b = (remainder % 6) + 1;
			remainder = Math.trunc(i / 6);
			const c = (remainder % 6) + 1;
			remainder = Math.trunc(i / 6);
			const d = (remainder % 6) + 1;
			remainder = Math.trunc(i / 6);

			const possibleMoves = this.possibleMoves([a, b, c, d]);
			if (possibleMoves.length > 0) {
				let maxGain = 0;
				for (let move of possibleMoves) {
					let gain = 0;
					for (let column of move) {
						gain += boardHeight / (boardHeight - 2 * Math.abs(column - 7));
					}
					if (gain > maxGain) {
						maxGain = gain;
					}
				}
				sum += this.gain + maxGain;
			}
		}
		return sum / 1296;
	}

	draw(context, previousState, clearerBoard) {
		const canvas = context.canvas;
		const cellSize = Math.trunc(Math.min(canvas.width / 11, canvas.height / boardHeight) / 2) * 2;
		const padding = Math.max(cellSize * cellPaddingFraction, minCellPaddingPx);
		const radius = cellSize / 2 - padding;
		const secondCounterOffset = Math.round(cellSize * secondCounterOffsetFraction);
		const fontSize = Math.max(textFraction * 2 * radius, 15);
		context.font = 'bold ' + fontSize + 'px sans-serif';
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		context.clearRect(0, 0, canvas.width, canvas.height);

		for (let i = 2; i <= 12; i++) {
			const offset = 2 * Math.abs(i - 7);
			const columnHeight = boardHeight - offset;
			const x = (i - 2 + 0.5) * cellSize;
			if (i % 2 === 0) {
				context.fillStyle = stripeColor;
				context.fillRect(x - 0.5 * cellSize, 0, cellSize, canvas.height);
			}
			let columnColor;
			if (this.playerStates[0][i - 2] === boardHeight) {
				columnColor = playerColors[0];
			} else if (this.playerStates[1][i - 2] === boardHeight) {
				columnColor = playerColors[1];
			}
			const isCurrentColumn = this.currentColumns.has(i);
			for (let j = columnHeight; j > 0; j--) {
				let y;
				if (clearerBoard) {
					y = (boardHeight + 0.5 - (j + offset)) * cellSize;
				} else {
					y = (boardHeight + 0.5 - (j + offset / 2)) * cellSize;
				}
				const counters = [];

				if (columnColor !== undefined) {

					if (j === columnHeight && this.currentColumns.has(i)) {
						counters.push(temporaryColor);
					} else {
						counters.push(columnColor);
					}

				} else {

					if (this.playerStates[1][i - 2] === j + offset) {
						counters.push(isCurrentColumn && this.turn === 1 ? temporaryColor : playerColors[1]);
					}
					if (this.playerStates[0][i - 2] === j + offset) {
						if (counters[0] === temporaryColor) {
							counters.unshift(playerColors[0]);
						} else {
							counters.push(isCurrentColumn && this.turn === 0 ? temporaryColor : playerColors[0]);
						}
					}
					if (isCurrentColumn && previousState.playerStates[this.turn][i - 2] === j + offset) {
						counters.push(playerColors[this.turn]);
					}

				}

				const emptySpace = counters.length === 0;
				if (emptySpace) {
					counters.push(emptySpaceColor);
				}

				for (let k = 0; k < counters.length; k++) {
					context.beginPath();
					context.arc(x, y - k * secondCounterOffset, radius, 0, TWO_PI);
					context.fillStyle = counters[k];
					context.fill();
				}
				if (emptySpace) {
					context.fillStyle = 'black';
					context.fillText(i, x, y);
				}
			} // end for each row
		} // end for each column

		context.fillStyle = temporaryColor;
		for (let i = 0; i < maxCounters - this.currentColumns.size; i++) {
			context.beginPath();
			context.arc((i + 0.5) * cellSize, (boardHeight - 0.5) * cellSize, radius, 0, TWO_PI);
			context.fill();
		}
	}

}

const context = document.getElementById('canvas').getContext('2d');
let currentState, previousState, possibleMoves, computerRollAgain;
let firstPlayer = Math.trunc(Math.random() * 2);
let useAI = true;
let boardClarity = false;

function resize(context) {
	const size = Math.min(container.clientWidth, container.clientHeight * 11 / boardHeight);
	const canvas = context.canvas;
	canvas.width = Math.trunc(size);
	canvas.height = Math.trunc(size * boardHeight / 11);
}

function rollDice() {
	const diceRolls = new Array(4);
	for (let i = 0; i < 4; i++) {
		diceRolls[i] = Math.trunc(Math.random() * 6) + 1;
	}
	return diceRolls;
}

function showMoves(chosenOption) {
	const buttonPanel = document.getElementById('btns-moves');
	buttonPanel.innerHTML = '';
	if (possibleMoves.length === 0) {
		const button = document.createElement('BUTTON');
		button.type = 'button';
		button.innerHTML = currentState.totalMoveLength === 0 ? 'Pass' : 'Lose Progress';
		button.classList.add('btn-large', 'display-block');
		button.addEventListener('click', moveClick);
		buttonPanel.appendChild(button);
	} else {
		for (let i = 0; i < possibleMoves.length; i++) {
			const move = possibleMoves[i];
			const button = document.createElement('BUTTON');
			button.type = 'button';
			if (move.length === 1) {
				button.innerHTML = 'Move on ' + move[0];
			} else {
				button.innerHTML = 'Move on ' + move[0] + ' and ' + move[1];
			}
			if (chosenOption === undefined) {
				button.addEventListener('click', moveClick);
			} else if (chosenOption === i) {
				button.addEventListener('click', moveClick);
			} else {
				button.disabled = true;
			}
			button.classList.add('btn-large', 'display-block');
			buttonPanel.appendChild(button);
		}
	}
	buttonPanel.classList.add('show');
}

function newGame() {
	currentState = new BoardState();
	firstPlayer = 1 - firstPlayer;
	currentState.turn = firstPlayer;
	previousState = new BoardState(currentState);
	currentState.draw(context, previousState, boardClarity);
	document.getElementById('winning-message').hidden = true;
	nextTurn();
}

function nextTurn() {
	possibleMoves = currentState.possibleMoves(rollDice());
	if (useAI && currentState.turn === 1) {
		computerTurn();
	} else {
		showMoves();
	}
}

function computerTurn() {
	if (possibleMoves.length === 0) {
		showMoves();
		return;
	}

	const playerNum = currentState.turn;
	const moveData = [];
	for (let move of possibleMoves) {
		const thinkingState = new BoardState(currentState);
		thinkingState.executeMove(move);
		moveData.push(thinkingState.evaluate(playerNum));
	}
	const sortedMoveData = moveData.slice().sort(compareMoves);
	const bestOption = sortedMoveData[0];
	computerRollAgain = shouldGamble(bestOption);
	showMoves(moveData.indexOf(bestOption));
}

function shouldGamble(bestOption) {
	if (bestOption.freeCounters > 0) {
		return true;
	}
	const bestState = bestOption.state;
	const playerNum = bestState.turn;
	for (let column of bestState.currentColumns) {
		if (bestState.completedColumn(playerNum, column) && !previousState.completedColumn(playerNum, column)) {
			return false;
		}
	}
	const furtherGain = bestState.expectedGain() - bestState.gain;
	if (furtherGain > - 6) console.log(furtherGain);
	return furtherGain > -6;
}

function declareWinner(winner) {
	currentState.endTurn();
	currentState.draw(context, currentState, boardClarity);
	const winnerElement = document.getElementById('winner');
	winnerElement.innerHTML = colorNames[winner];
	winnerElement.style.color = playerColors[winner];
	document.getElementById('winning-message').hidden = false;
}

function moveClick(event) {
	const movePanel = document.getElementById('btns-moves');
	movePanel.classList.remove('show');
	if (possibleMoves.length === 0) {
		currentState = previousState;
		currentState.endTurn();
		previousState = new BoardState(currentState);
		currentState.draw(context, previousState, boardClarity);
		nextTurn();
	} else {
		const index = Array.from(movePanel.children).indexOf(this);
		currentState.executeMove(possibleMoves[index]);
		currentState.draw(context, previousState, boardClarity);
		if (useAI && currentState.turn === 1) {
			document.getElementById('btn-roll').disabled = !computerRollAgain;
			document.getElementById('btn-stop').disabled = computerRollAgain;
		} else {
			document.getElementById('btn-roll').disabled = false;
			document.getElementById('btn-stop').disabled = false;
		}
		const winner = currentState.getWinner();
		if (winner === undefined) {
			possibleMoves = currentState.possibleMoves(rollDice());
			document.getElementById('btns-actions').classList.add('show');
		} else {
			declareWinner(winner);
		}
	}
}

document.getElementById('btn-new').addEventListener('click', newGame);

document.getElementById('btn-toggle-ai').addEventListener('click', function (event) {
	useAI = !useAI;
	if (useAI) {
		this.innerHTML = 'Disable AI';
		if (currentState.turn === 1 && previousState.getWinner() === undefined) {
			document.getElementById('btns-actions').classList.remove('show');
			document.getElementById('btns-moves').classList.remove('show');
			computerTurn();
		}
	} else {
		document.getElementById('btn-roll').disabled = false;
		document.getElementById('btn-stop').disabled = false;
		for (let moveButton of document.getElementById('btns-moves').children) {
			moveButton.disabled = false;
		}
		this.innerHTML = 'Enable AI';
	}
});

document.getElementById('btn-layout').addEventListener('click', function (event) {
	boardClarity = !boardClarity;
	currentState.draw(context, previousState, boardClarity);
	if (boardClarity) {
		this.innerHTML = 'Standard Layout';
	} else {
		this.innerHTML = 'Clearer Layout';
	}
});

document.getElementById('btn-roll').addEventListener('click', function (event) {
	document.getElementById('btns-actions').classList.remove('show');
	if (useAI && currentState.turn === 1) {
		computerTurn();
	} else {
		showMoves();
	}
});

document.getElementById('btn-stop').addEventListener('click', function (event) {
	document.getElementById('btns-actions').classList.remove('show');
	currentState.endTurn();
	previousState = new BoardState(currentState);
	currentState.draw(context, previousState, boardClarity);
	const winner = currentState.getWinner();
	if (winner === undefined) {
		nextTurn();
	} else {
		declareWinner(winner);
	}
});

function initialize() {
	resize(context);
	newGame();
}

if (document.readyState === 'complete') {
	initialize()
} else {
	window.addEventListener('load', initialize);
}
