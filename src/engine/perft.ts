import { type Position } from './board'
import { legalMoves, makeMove, unmakeMove } from './movegen'
import { moveToUci } from './notation'

/**
 * Count the leaf nodes of the move tree to a given depth. Perft is the standard way to verify a
 * move generator: the counts for well-known positions are published, so any bug in generation,
 * make/unmake, castling, en passant or promotion shows up as a mismatch.
 */
export function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1
  let nodes = 0
  for (const move of legalMoves(pos)) {
    const undo = makeMove(pos, move)
    nodes += perft(pos, depth - 1)
    unmakeMove(pos, undo)
  }
  return nodes
}

/** Per-move perft breakdown — the tool for finding exactly which move a bug hides under. */
export function perftDivide(pos: Position, depth: number): Map<string, number> {
  const result = new Map<string, number>()
  for (const move of legalMoves(pos)) {
    const undo = makeMove(pos, move)
    result.set(moveToUci(move), perft(pos, depth - 1))
    unmakeMove(pos, undo)
  }
  return result
}
