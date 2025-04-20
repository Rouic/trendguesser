import { TrendGuesserPlayer, TrendGuesserGameState, SearchTerm as WebSearchTerm } from '@/types';
import { IPlayer, GameState, SearchTerm as SharedSearchTerm, SearchCategory } from '@trendguesser/shared';

/**
 * Ensures the category is a valid SearchCategory for the shared type
 */
function ensureValidCategory(category: string | WebSearchTerm['category']): SearchCategory {
  // Convert from web category to shared category
  // Both types have the same string literals for most common categories
  return category as unknown as SearchCategory;
}

/**
 * Adapts web player type to shared player type
 */
export function adaptWebPlayerToShared(player: TrendGuesserPlayer): IPlayer {
  return {
    uid: player.uid,
    name: player.name,
    score: player.score || 0,
    highScores: player.highScores
  };
}

/**
 * Adapts shared player type to web player type
 */
export function adaptSharedPlayerToWeb(player: IPlayer): TrendGuesserPlayer {
  return {
    uid: player.uid || player.id || '',
    name: player.name,
    score: player.score || 0,
    highScores: player.highScores || {}
  };
}

/**
 * Adapts web search term to shared search term
 */
export function adaptWebTermToShared(term: WebSearchTerm): SharedSearchTerm {
  return {
    id: term.id,
    term: term.term,
    category: term.category,
    volume: term.volume,
    imageUrl: term.imageUrl,
    timestamp: term.timestamp
  };
}

/**
 * Adapts shared search term to web search term
 */
export function adaptSharedTermToWeb(term: SharedSearchTerm): WebSearchTerm {
  return {
    id: term.id,
    term: term.term,
    category: term.category as unknown as WebSearchTerm['category'], // Convert string to SearchCategory
    volume: term.volume,
    imageUrl: term.imageUrl || `/api/image?term=${encodeURIComponent(term.term)}`,
    timestamp: term.timestamp || new Date().toISOString()
  };
}

/**
 * Adapts web game state to shared game state
 */
export function adaptWebGameStateToShared(state: TrendGuesserGameState): GameState {
  return {
    gameId: state.gameId || '',
    score: state.currentRound - 1 || 0,
    round: state.currentRound || 1,
    knownTerm: state.knownTerm ? adaptWebTermToShared(state.knownTerm) : null,
    hiddenTerm: state.hiddenTerm ? adaptWebTermToShared(state.hiddenTerm) : null,
    category: ensureValidCategory(state.category),
    finished: state.finished || false,
    highScore: false // Not tracked in web game state
  };
}

/**
 * Adapts shared game state to web game state
 */
export function adaptSharedGameStateToWeb(state: GameState): TrendGuesserGameState {
  return {
    gameId: state.gameId,
    currentRound: state.round,
    knownTerm: state.knownTerm ? adaptSharedTermToWeb(state.knownTerm) : null,
    hiddenTerm: state.hiddenTerm ? adaptSharedTermToWeb(state.hiddenTerm) : null,
    category: state.category as unknown as WebSearchTerm['category'],
    started: true,
    finished: state.finished,
    usedTerms: [],
    terms: []
  };
}