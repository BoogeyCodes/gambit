import {
  BISHOP_DIRS,
  KING_DELTAS,
  KNIGHT_DELTAS,
  ROOK_DIRS,
  inCheck,
  isSquareAttacked,
  otherColor,
  pieceChar,
} from './attacks'
import {
  type Castling,
  type Color,
  type Move,
  type PieceType,
  type Position,
  EMPTY,
  cloneCastling,
  colorOf,
  fileOf,
  onBoard,
  rankOf,
  square,
} from './board'

export interface Undo {
  move: Move
  captured: string
  capturedSq: number
  castling: Castling
  ep: number | null
  halfmove: number
  fullmove: number
}

const PROMO_TYPES: PieceType[] = ['q', 'r', 'b', 'n']

// --- make / unmake -----------------------------------------------------------

export function makeMove(pos: Position, move: Move): Undo {
  const { from, to } = move
  const piece = pos.board[from]
  const color = pos.turn
  const undo: Undo = {
    move,
    captured: EMPTY,
    capturedSq: to,
    castling: cloneCastling(pos.castling),
    ep: pos.ep,
    halfmove: pos.halfmove,
    fullmove: pos.fullmove,
  }

  if (move.ep) {
    const capSq = color === 'w' ? to - 8 : to + 8
    undo.captured = pos.board[capSq]
    undo.capturedSq = capSq
    pos.board[capSq] = EMPTY
  } else if (pos.board[to] !== EMPTY) {
    undo.captured = pos.board[to]
    undo.capturedSq = to
  }

  pos.board[to] = move.promo ? pieceChar(move.promo, color) : piece
  pos.board[from] = EMPTY

  if (move.castle === 'k') {
    const rank = rankOf(from)
    pos.board[square(rank, 5)] = pos.board[square(rank, 7)]
    pos.board[square(rank, 7)] = EMPTY
  } else if (move.castle === 'q') {
    const rank = rankOf(from)
    pos.board[square(rank, 3)] = pos.board[square(rank, 0)]
    pos.board[square(rank, 0)] = EMPTY
  }

  const c = pos.castling
  if (piece === 'K') { c.wk = false; c.wq = false }
  if (piece === 'k') { c.bk = false; c.bq = false }
  // A rook leaving — or being captured on — its home square removes that castling right.
  for (const sq of [from, to]) {
    if (sq === square(0, 0)) c.wq = false
    else if (sq === square(0, 7)) c.wk = false
    else if (sq === square(7, 0)) c.bq = false
    else if (sq === square(7, 7)) c.bk = false
  }

  pos.ep = move.double ? (color === 'w' ? from + 8 : from - 8) : null

  const isPawn = piece === 'P' || piece === 'p'
  pos.halfmove = isPawn || undo.captured !== EMPTY ? 0 : pos.halfmove + 1

  if (color === 'b') pos.fullmove++
  pos.turn = otherColor(color)

  return undo
}

export function unmakeMove(pos: Position, undo: Undo): void {
  const { move } = undo
  const { from, to } = move
  pos.turn = otherColor(pos.turn)
  const color = pos.turn

  pos.fullmove = undo.fullmove
  pos.halfmove = undo.halfmove
  pos.castling = undo.castling
  pos.ep = undo.ep

  pos.board[from] = move.promo ? pieceChar('p', color) : pos.board[to]
  pos.board[to] = EMPTY
  if (undo.captured !== EMPTY) {
    pos.board[undo.capturedSq] = undo.captured
  }

  if (move.castle === 'k') {
    const rank = rankOf(from)
    pos.board[square(rank, 7)] = pos.board[square(rank, 5)]
    pos.board[square(rank, 5)] = EMPTY
  } else if (move.castle === 'q') {
    const rank = rankOf(from)
    pos.board[square(rank, 0)] = pos.board[square(rank, 3)]
    pos.board[square(rank, 3)] = EMPTY
  }
}

// --- generation --------------------------------------------------------------

export function pseudoLegalMoves(pos: Position): Move[] {
  const moves: Move[] = []
  const us = pos.turn
  for (let sq = 0; sq < 64; sq++) {
    const ch = pos.board[sq]
    if (ch === EMPTY || colorOf(ch) !== us) continue
    const type = ch.toLowerCase()
    if (type === 'p') pawnMoves(pos, sq, us, moves)
    else if (type === 'n') stepMoves(pos, sq, us, KNIGHT_DELTAS, moves)
    else if (type === 'k') { stepMoves(pos, sq, us, KING_DELTAS, moves); castleMoves(pos, sq, us, moves) }
    else if (type === 'b') slideMoves(pos, sq, us, BISHOP_DIRS, moves)
    else if (type === 'r') slideMoves(pos, sq, us, ROOK_DIRS, moves)
    else if (type === 'q') { slideMoves(pos, sq, us, BISHOP_DIRS, moves); slideMoves(pos, sq, us, ROOK_DIRS, moves) }
  }
  return moves
}

/** Legal moves: pseudo-legal moves that don't leave the mover's own king in check. */
export function legalMoves(pos: Position): Move[] {
  const us = pos.turn
  const legal: Move[] = []
  for (const move of pseudoLegalMoves(pos)) {
    const undo = makeMove(pos, move)
    if (!inCheck(pos, us)) legal.push(move)
    unmakeMove(pos, undo)
  }
  return legal
}

function pushPawn(from: number, to: number, promote: boolean, extra: Partial<Move>, out: Move[]): void {
  if (promote) {
    for (const promo of PROMO_TYPES) out.push({ from, to, promo, ...extra })
  } else {
    out.push({ from, to, ...extra })
  }
}

function pawnMoves(pos: Position, from: number, us: Color, out: Move[]): void {
  const r = rankOf(from)
  const f = fileOf(from)
  const dir = us === 'w' ? 1 : -1
  const startRank = us === 'w' ? 1 : 6
  const promoRank = us === 'w' ? 7 : 0

  // Forward one.
  const one = square(r + dir, f)
  if (onBoard(r + dir, f) && pos.board[one] === EMPTY) {
    pushPawn(from, one, r + dir === promoRank, {}, out)
    // Forward two from the start rank.
    const two = square(r + 2 * dir, f)
    if (r === startRank && pos.board[two] === EMPTY) {
      out.push({ from, to: two, double: true })
    }
  }

  // Captures and en passant.
  for (const df of [-1, 1]) {
    if (!onBoard(r + dir, f + df)) continue
    const to = square(r + dir, f + df)
    const target = pos.board[to]
    if (target !== EMPTY && colorOf(target) !== us) {
      pushPawn(from, to, r + dir === promoRank, {}, out)
    } else if (pos.ep !== null && to === pos.ep) {
      out.push({ from, to, ep: true })
    }
  }
}

function stepMoves(pos: Position, from: number, us: Color, deltas: ReadonlyArray<[number, number]>, out: Move[]): void {
  const r = rankOf(from)
  const f = fileOf(from)
  for (const [dr, df] of deltas) {
    if (!onBoard(r + dr, f + df)) continue
    const to = square(r + dr, f + df)
    const target = pos.board[to]
    if (target === EMPTY || colorOf(target) !== us) out.push({ from, to })
  }
}

function slideMoves(pos: Position, from: number, us: Color, dirs: ReadonlyArray<[number, number]>, out: Move[]): void {
  const r = rankOf(from)
  const f = fileOf(from)
  for (const [dr, df] of dirs) {
    let nr = r + dr
    let nf = f + df
    while (onBoard(nr, nf)) {
      const to = square(nr, nf)
      const target = pos.board[to]
      if (target === EMPTY) {
        out.push({ from, to })
      } else {
        if (colorOf(target) !== us) out.push({ from, to })
        break
      }
      nr += dr
      nf += df
    }
  }
}

function castleMoves(pos: Position, from: number, us: Color, out: Move[]): void {
  const rank = us === 'w' ? 0 : 7
  if (from !== square(rank, 4)) return // king not on its home square
  const them = otherColor(us)
  const c = pos.castling
  const canK = us === 'w' ? c.wk : c.bk
  const canQ = us === 'w' ? c.wq : c.bq
  if (!canK && !canQ) return
  if (isSquareAttacked(pos, from, them)) return // can't castle out of check

  const empty = (file: number) => pos.board[square(rank, file)] === EMPTY
  const safe = (file: number) => !isSquareAttacked(pos, square(rank, file), them)

  if (canK && empty(5) && empty(6) && safe(5) && safe(6)) {
    out.push({ from, to: square(rank, 6), castle: 'k' })
  }
  if (canQ && empty(1) && empty(2) && empty(3) && safe(2) && safe(3)) {
    out.push({ from, to: square(rank, 2), castle: 'q' })
  }
}

// --- status ------------------------------------------------------------------

export function isCheckmate(pos: Position): boolean {
  return inCheck(pos, pos.turn) && legalMoves(pos).length === 0
}

export function isStalemate(pos: Position): boolean {
  return !inCheck(pos, pos.turn) && legalMoves(pos).length === 0
}
