import { type Move, type Position, squareName } from './board'
import { legalMoves } from './movegen'

/** Long algebraic / UCI move string, e.g. "e2e4" or "e7e8q". */
export function moveToUci(move: Move): string {
  return squareName(move.from) + squareName(move.to) + (move.promo ?? '')
}

/** Find the legal move in `pos` matching a UCI string, or null. */
export function moveFromUci(pos: Position, uci: string): Move | null {
  for (const move of legalMoves(pos)) {
    if (moveToUci(move) === uci) return move
  }
  return null
}
