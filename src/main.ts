import './style.css'
import {
  type Color,
  type Move,
  type Position,
  colorOf,
  fileOf,
  rankOf,
  square,
  squareName,
  startPosition,
} from './engine/board'
import { inCheck } from './engine/attacks'
import { isCheckmate, isStalemate, legalMoves, makeMove } from './engine/movegen'
import { bestMove } from './engine/search'

const GLYPHS: Record<string, string> = {
  P: '♙', N: '♘', B: '♗', R: '♖', Q: '♕', K: '♔',
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚',
}

interface State {
  pos: Position
  humanColor: Color
  depth: number
  selected: number | null
  targets: Move[]
  thinking: boolean
  history: string[] // UCI move log
  flipped: boolean
}

const state: State = {
  pos: startPosition(),
  humanColor: 'w',
  depth: 3,
  selected: null,
  targets: [],
  thinking: false,
  history: [],
  flipped: false,
}

const app = document.querySelector<HTMLDivElement>('#app')!

function gameOver(): string | null {
  if (isCheckmate(state.pos)) {
    const winner = state.pos.turn === 'w' ? 'Black' : 'White'
    return `Checkmate — ${winner} wins`
  }
  if (isStalemate(state.pos)) return 'Stalemate — draw'
  return null
}

function statusText(): string {
  const over = gameOver()
  if (over) return over
  if (state.thinking) return 'Gambit is thinking…'
  const toMove = state.pos.turn === 'w' ? 'White' : 'Black'
  const check = inCheck(state.pos, state.pos.turn) ? ' — check!' : ''
  const who = state.pos.turn === state.humanColor ? ' (your move)' : ''
  return `${toMove} to move${who}${check}`
}

function orderedSquares(): number[] {
  // Rows top-to-bottom. White at the bottom unless flipped.
  const ranks = state.flipped ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0]
  const files = state.flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7]
  const out: number[] = []
  for (const r of ranks) for (const f of files) out.push(square(r, f))
  return out
}

function render(): void {
  const over = gameOver()
  const cells = orderedSquares()
    .map((sq) => {
      const dark = (rankOf(sq) + fileOf(sq)) % 2 === 0
      const piece = state.pos.board[sq]
      const classes = ['sq', dark ? 'dark' : 'light']
      if (sq === state.selected) classes.push('selected')
      if (state.targets.some((m) => m.to === sq)) classes.push(piece === '.' ? 'move' : 'capture')
      const glyph = piece === '.' ? '' : `<span class="piece">${GLYPHS[piece]}</span>`
      return `<div class="${classes.join(' ')}" data-sq="${sq}">${glyph}</div>`
    })
    .join('')

  app.innerHTML = `
    <header>
      <h1>Gambit <span>♟</span></h1>
      <p class="muted">A chess engine you can play. Perft-verified move generation, alpha-beta search.</p>
    </header>
    <div class="status ${over ? 'over' : ''}">${statusText()}</div>
    <div class="board ${over ? 'locked' : ''}">${cells}</div>
    <div class="controls">
      <button id="new">New game</button>
      <label>Play as
        <select id="color">
          <option value="w" ${state.humanColor === 'w' ? 'selected' : ''}>White</option>
          <option value="b" ${state.humanColor === 'b' ? 'selected' : ''}>Black</option>
        </select>
      </label>
      <label>Engine depth
        <select id="depth">
          ${[1, 2, 3, 4].map((d) => `<option value="${d}" ${state.depth === d ? 'selected' : ''}>${d}</option>`).join('')}
        </select>
      </label>
      <button id="flip">Flip board</button>
    </div>
    <p class="moves muted">${state.history.join('  ')}</p>
  `

  app.querySelector('#new')!.addEventListener('click', newGame)
  app.querySelector('#flip')!.addEventListener('click', () => { state.flipped = !state.flipped; render() })
  app.querySelector<HTMLSelectElement>('#color')!.addEventListener('change', (e) => {
    state.humanColor = (e.target as HTMLSelectElement).value as Color
    state.flipped = state.humanColor === 'b'
    newGame()
  })
  app.querySelector<HTMLSelectElement>('#depth')!.addEventListener('change', (e) => {
    state.depth = Number((e.target as HTMLSelectElement).value)
  })
  for (const cell of app.querySelectorAll<HTMLDivElement>('.sq')) {
    cell.addEventListener('click', () => onSquare(Number(cell.dataset.sq)))
  }
}

function onSquare(sq: number): void {
  if (state.thinking || gameOver()) return
  if (state.pos.turn !== state.humanColor) return

  const chosen = state.targets.find((m) => m.to === sq)
  if (chosen) {
    play(pickPromotion(chosen))
    return
  }

  const piece = state.pos.board[sq]
  if (piece !== '.' && colorOf(piece) === state.humanColor) {
    state.selected = sq
    state.targets = legalMoves(state.pos).filter((m) => m.from === sq)
  } else {
    state.selected = null
    state.targets = []
  }
  render()
}

// Promotions default to a queen (the usual choice); other pieces are a niche case.
function pickPromotion(move: Move): Move {
  if (!move.promo) return move
  return state.targets.find((m) => m.to === move.to && m.promo === 'q') ?? move
}

function play(move: Move): void {
  makeMove(state.pos, move)
  state.history.push(squareName(move.from) + squareName(move.to) + (move.promo ?? ''))
  state.selected = null
  state.targets = []
  render()

  if (!gameOver() && state.pos.turn !== state.humanColor) {
    state.thinking = true
    render()
    // Defer so the "thinking" status paints before the (synchronous) search runs.
    setTimeout(() => {
      const { move: reply } = bestMove(state.pos, state.depth)
      state.thinking = false
      if (reply) play(reply)
      else render()
    }, 30)
  }
}

function newGame(): void {
  state.pos = startPosition()
  state.selected = null
  state.targets = []
  state.thinking = false
  state.history = []
  render()
  if (state.pos.turn !== state.humanColor) {
    state.thinking = true
    render()
    setTimeout(() => {
      const { move } = bestMove(state.pos, state.depth)
      state.thinking = false
      if (move) play(move)
    }, 30)
  }
}

render()
