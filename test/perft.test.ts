import { describe, expect, it } from 'vitest'
import { parseFen, startPosition } from '../src/engine/board'
import { perft } from '../src/engine/perft'

describe('perft (move generation correctness)', () => {
  it('counts the starting position', () => {
    const pos = startPosition()
    expect(perft(pos, 1)).toBe(20)
    expect(perft(pos, 2)).toBe(400)
    expect(perft(pos, 3)).toBe(8902)
    expect(perft(pos, 4)).toBe(197281)
  })

  // "Kiwipete" — the standard torture position for castling, pins and en passant.
  it('counts the Kiwipete position', () => {
    const pos = parseFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1')
    expect(perft(pos, 1)).toBe(48)
    expect(perft(pos, 2)).toBe(2039)
    expect(perft(pos, 3)).toBe(97862)
  })

  // Position 3 — lots of en-passant and promotion edge cases.
  it('counts position 3', () => {
    const pos = parseFen('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1')
    expect(perft(pos, 1)).toBe(14)
    expect(perft(pos, 2)).toBe(191)
    expect(perft(pos, 3)).toBe(2812)
    expect(perft(pos, 4)).toBe(43238)
  })

  // Position 5 — promotions and castling under pressure.
  it('counts position 5', () => {
    const pos = parseFen('rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8')
    expect(perft(pos, 1)).toBe(44)
    expect(perft(pos, 2)).toBe(1486)
    expect(perft(pos, 3)).toBe(62379)
  })
})
