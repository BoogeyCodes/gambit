import { type Move, type Position, colorOf } from './board'
import { inCheck } from './attacks'
import { legalMoves, makeMove, unmakeMove } from './movegen'

const VALUE: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }
const MATE = 1_000_000

// Piece-square tables, written a1..h8 (index 0 = a1). White reads them directly; Black reads the
// vertically mirrored square (sq ^ 56). Values are small nudges toward good squares.
// Source: the classic "Simplified Evaluation Function" tables, oriented to this board's indexing.
const PST: Record<string, number[]> = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10,-20,-20, 10, 10,  5,
     5, -5,-10,  0,  0,-10, -5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5,  5, 10, 25, 25, 10,  5,  5,
    10, 10, 20, 30, 30, 20, 10, 10,
    50, 50, 50, 50, 50, 50, 50, 50,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  n: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  b: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  r: [
     0,  0,  0,  5,  5,  0,  0,  0,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     5, 10, 10, 10, 10, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  q: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -10,  5,  5,  5,  5,  5,  0,-10,
      0,  0,  5,  5,  5,  5,  0, -5,
     -5,  0,  5,  5,  5,  5,  0, -5,
    -10,  0,  5,  5,  5,  5,  0,-10,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  k: [
     20, 30, 10,  0,  0, 10, 30, 20,
     20, 20,  0,  0,  0,  0, 20, 20,
    -10,-20,-20,-20,-20,-20,-20,-10,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
  ],
}

/** Static evaluation from White's perspective (positive favours White), in centipawns. */
export function evaluate(pos: Position): number {
  let score = 0
  for (let sq = 0; sq < 64; sq++) {
    const ch = pos.board[sq]
    if (ch === '.') continue
    const type = ch.toLowerCase()
    const white = colorOf(ch) === 'w'
    const material = VALUE[type]
    const positional = PST[type][white ? sq : sq ^ 56]
    score += white ? material + positional : -(material + positional)
  }
  return score
}

function negamax(pos: Position, depth: number, alpha: number, beta: number, ply: number): number {
  const moves = legalMoves(pos)
  if (moves.length === 0) {
    // Checkmate is bad for the side to move; prefer mates that are closer.
    return inCheck(pos, pos.turn) ? -(MATE - ply) : 0
  }
  if (depth === 0) {
    return pos.turn === 'w' ? evaluate(pos) : -evaluate(pos)
  }

  let best = -Infinity
  for (const move of orderMoves(pos, moves)) {
    const undo = makeMove(pos, move)
    const score = -negamax(pos, depth - 1, -beta, -alpha, ply + 1)
    unmakeMove(pos, undo)
    if (score > best) best = score
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best
}

// Search captures first (cheap MVV-style ordering) so alpha-beta prunes more.
function orderMoves(pos: Position, moves: Move[]): Move[] {
  return [...moves].sort((a, b) => captureValue(pos, b) - captureValue(pos, a))
}

function captureValue(pos: Position, move: Move): number {
  const victim = pos.board[move.to]
  if (victim === '.') return move.promo ? 50 : 0
  return 100 + VALUE[victim.toLowerCase()]
}

export interface SearchResult {
  move: Move | null
  score: number
}

/** Pick the best move for the side to move by searching to `depth` plies. */
export function bestMove(pos: Position, depth = 3): SearchResult {
  const moves = legalMoves(pos)
  if (moves.length === 0) return { move: null, score: 0 }

  let best: Move = moves[0]
  let bestScore = -Infinity
  let alpha = -Infinity
  for (const move of orderMoves(pos, moves)) {
    const undo = makeMove(pos, move)
    const score = -negamax(pos, depth - 1, -Infinity, -alpha, 1)
    unmakeMove(pos, undo)
    if (score > bestScore) {
      bestScore = score
      best = move
      if (score > alpha) alpha = score
    }
  }
  return { move: best, score: bestScore }
}

export { MATE }
