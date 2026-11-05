import { type Color, type Position, fileOf, onBoard, rankOf, square } from './board'

export const KNIGHT_DELTAS: ReadonlyArray<[number, number]> = [
  [2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2],
]
export const KING_DELTAS: ReadonlyArray<[number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
]
export const BISHOP_DIRS: ReadonlyArray<[number, number]> = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
export const ROOK_DIRS: ReadonlyArray<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]]

/** The board character for a piece type of a given colour. */
export function pieceChar(type: string, color: Color): string {
  return color === 'w' ? type.toUpperCase() : type.toLowerCase()
}

/** Whether `sq` is attacked by any piece of colour `by`. */
export function isSquareAttacked(pos: Position, sq: number, by: Color): boolean {
  const board = pos.board
  const r = rankOf(sq)
  const f = fileOf(sq)

  // Pawns: a pawn of `by` attacks diagonally forward, so it sits one rank "behind" sq.
  const pawn = pieceChar('p', by)
  const pawnRank = by === 'w' ? r - 1 : r + 1
  for (const df of [-1, 1]) {
    if (onBoard(pawnRank, f + df) && board[square(pawnRank, f + df)] === pawn) {
      return true
    }
  }

  // Knights.
  const knight = pieceChar('n', by)
  for (const [dr, df] of KNIGHT_DELTAS) {
    if (onBoard(r + dr, f + df) && board[square(r + dr, f + df)] === knight) {
      return true
    }
  }

  // King.
  const king = pieceChar('k', by)
  for (const [dr, df] of KING_DELTAS) {
    if (onBoard(r + dr, f + df) && board[square(r + dr, f + df)] === king) {
      return true
    }
  }

  // Sliding pieces: bishops/queens on diagonals, rooks/queens on files/ranks.
  if (slidingHit(pos, r, f, BISHOP_DIRS, pieceChar('b', by), pieceChar('q', by))) return true
  if (slidingHit(pos, r, f, ROOK_DIRS, pieceChar('r', by), pieceChar('q', by))) return true

  return false
}

function slidingHit(
  pos: Position,
  r: number,
  f: number,
  dirs: ReadonlyArray<[number, number]>,
  slider: string,
  queen: string,
): boolean {
  for (const [dr, df] of dirs) {
    let nr = r + dr
    let nf = f + df
    while (onBoard(nr, nf)) {
      const ch = pos.board[square(nr, nf)]
      if (ch !== '.') {
        if (ch === slider || ch === queen) return true
        break
      }
      nr += dr
      nf += df
    }
  }
  return false
}

/** The square of the given colour's king, or -1 if absent (shouldn't happen in a legal game). */
export function kingSquare(pos: Position, color: Color): number {
  const king = pieceChar('k', color)
  for (let sq = 0; sq < 64; sq++) {
    if (pos.board[sq] === king) return sq
  }
  return -1
}

/** Whether the side `color`'s king is currently in check. */
export function inCheck(pos: Position, color: Color): boolean {
  const ksq = kingSquare(pos, color)
  if (ksq < 0) return false
  return isSquareAttacked(pos, ksq, color === 'w' ? 'b' : 'w')
}

export const otherColor = (c: Color): Color => (c === 'w' ? 'b' : 'w')
