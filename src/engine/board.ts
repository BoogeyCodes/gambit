/**
 * Board representation and FEN.
 *
 * Squares are 0..63 with a1 = 0, b1 = 1, ... h1 = 7, a2 = 8, ... h8 = 63, so
 * `file = sq & 7` and `rank = sq >> 3` (rank 0 is White's home rank). The board is a
 * flat array of 64 single-character cells: uppercase = White, lowercase = Black, '.' = empty.
 */

export type Color = 'w' | 'b'
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'

export const EMPTY = '.'

export interface Castling {
  wk: boolean
  wq: boolean
  bk: boolean
  bq: boolean
}

export interface Move {
  from: number
  to: number
  /** Promotion piece type (lowercase), when a pawn reaches the last rank. */
  promo?: PieceType
  /** True for an en-passant capture. */
  ep?: boolean
  /** True for a two-square pawn advance (sets the en-passant target). */
  double?: boolean
  /** 'k' or 'q' for castling. */
  castle?: 'k' | 'q'
}

export interface Position {
  board: string[]
  turn: Color
  castling: Castling
  /** The square a pawn may capture onto by en passant, or null. */
  ep: number | null
  halfmove: number
  fullmove: number
}

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const FILES = 'abcdefgh'

export const fileOf = (sq: number): number => sq & 7
export const rankOf = (sq: number): number => sq >> 3
export const square = (rank: number, file: number): number => rank * 8 + file
export const onBoard = (rank: number, file: number): boolean =>
  rank >= 0 && rank < 8 && file >= 0 && file < 8

export const isWhitePiece = (ch: string): boolean => ch >= 'A' && ch <= 'Z'
export const colorOf = (ch: string): Color => (isWhitePiece(ch) ? 'w' : 'b')

export function squareName(sq: number): string {
  return FILES[fileOf(sq)] + (rankOf(sq) + 1)
}

export function parseSquare(name: string): number {
  return square(Number(name[1]) - 1, FILES.indexOf(name[0]))
}

export function cloneCastling(c: Castling): Castling {
  return { wk: c.wk, wq: c.wq, bk: c.bk, bq: c.bq }
}

export function parseFen(fen: string): Position {
  const [boardPart, turn, castling, ep, half, full] = fen.trim().split(/\s+/)
  const board = new Array<string>(64).fill(EMPTY)
  const rows = boardPart.split('/')
  if (rows.length !== 8) {
    throw new Error(`invalid FEN board: ${boardPart}`)
  }
  for (let i = 0; i < 8; i++) {
    const rank = 7 - i // FEN lists rank 8 first
    let file = 0
    for (const ch of rows[i]) {
      if (ch >= '1' && ch <= '8') {
        file += Number(ch)
      } else {
        board[square(rank, file)] = ch
        file++
      }
    }
  }
  return {
    board,
    turn: turn === 'b' ? 'b' : 'w',
    castling: {
      wk: castling.includes('K'),
      wq: castling.includes('Q'),
      bk: castling.includes('k'),
      bq: castling.includes('q'),
    },
    ep: ep && ep !== '-' ? parseSquare(ep) : null,
    halfmove: half ? Number(half) : 0,
    fullmove: full ? Number(full) : 1,
  }
}

export function toFen(pos: Position): string {
  const rows: string[] = []
  for (let rank = 7; rank >= 0; rank--) {
    let row = ''
    let empty = 0
    for (let file = 0; file < 8; file++) {
      const ch = pos.board[square(rank, file)]
      if (ch === EMPTY) {
        empty++
      } else {
        if (empty > 0) {
          row += empty
          empty = 0
        }
        row += ch
      }
    }
    if (empty > 0) row += empty
    rows.push(row)
  }
  const c = pos.castling
  const castle = (c.wk ? 'K' : '') + (c.wq ? 'Q' : '') + (c.bk ? 'k' : '') + (c.bq ? 'q' : '')
  return [
    rows.join('/'),
    pos.turn,
    castle || '-',
    pos.ep !== null ? squareName(pos.ep) : '-',
    pos.halfmove,
    pos.fullmove,
  ].join(' ')
}

export function startPosition(): Position {
  return parseFen(START_FEN)
}
