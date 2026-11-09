import { describe, expect, it } from 'vitest'
import { parseFen, startPosition, toFen } from '../src/engine/board'
import { inCheck } from '../src/engine/attacks'
import { isCheckmate, isStalemate, legalMoves, makeMove } from '../src/engine/movegen'
import { moveFromUci, moveToUci } from '../src/engine/notation'
import { bestMove, evaluate } from '../src/engine/search'

describe('rules', () => {
  it('detects checkmate (fool\'s mate)', () => {
    const pos = parseFen('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3')
    expect(inCheck(pos, 'w')).toBe(true)
    expect(isCheckmate(pos)).toBe(true)
    expect(legalMoves(pos)).toHaveLength(0)
  })

  it('detects stalemate', () => {
    const pos = parseFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')
    expect(inCheck(pos, 'b')).toBe(false)
    expect(isStalemate(pos)).toBe(true)
  })

  it('handles promotion in move generation and make', () => {
    const pos = parseFen('8/P7/8/8/8/8/8/k6K w - - 0 1')
    const promos = legalMoves(pos).filter((m) => m.promo)
    expect(promos.map((m) => m.promo).sort()).toEqual(['b', 'n', 'q', 'r'])

    const queen = moveFromUci(pos, 'a7a8q')!
    makeMove(pos, queen)
    expect(toFen(pos).startsWith('Q7/')).toBe(true) // a queen now stands on a8
  })

  it('round-trips FEN', () => {
    const fen = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1'
    expect(toFen(parseFen(fen))).toBe(fen)
  })

  it('en-passant capture removes the passed pawn', () => {
    // White pawn e5, black just played d7-d5; white can take e5xd6 e.p.
    const pos = parseFen('rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3')
    const ep = moveFromUci(pos, 'e5d6')!
    expect(ep.ep).toBe(true)
    makeMove(pos, ep)
    // The black d5 pawn is gone and a white pawn sits on d6.
    expect(toFen(pos)).toContain('3P4')
  })
})

describe('search', () => {
  it('scores the starting position as even', () => {
    expect(evaluate(startPosition())).toBe(0)
  })

  it('values a material advantage', () => {
    const pos = parseFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN1 w Qkq - 0 1') // White missing a rook
    expect(evaluate(pos)).toBeLessThan(-400)
  })

  it('finds a back-rank mate in one', () => {
    const pos = parseFen('6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1')
    const result = bestMove(pos, 3)
    expect(result.move).not.toBeNull()
    expect(moveToUci(result.move!)).toBe('e1e8')
    expect(result.score).toBeGreaterThan(100_000)
  })

  it('always returns a legal move from a normal position', () => {
    const pos = startPosition()
    const result = bestMove(pos, 3)
    const legalUcis = legalMoves(pos).map(moveToUci)
    expect(legalUcis).toContain(moveToUci(result.move!))
  })
})
