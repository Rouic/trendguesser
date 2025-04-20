import React from 'react';
import { SearchTerm } from '../types';

/**
 * Platform-agnostic SearchTermCard component
 * 
 * This component is central to the TrendGuesser game logic:
 * - Both cards (known and hidden) ALWAYS display the term name
 * - Only the known term shows its volume (when showVolume=true)
 * - The hidden term has its volume hidden - this is what players need to guess
 */
export interface SearchTermCardProps {
  term: SearchTerm;
  isKnown: boolean; // Whether this is the known term (true) or the hidden term to guess (false)
  showVolume: boolean; // Controls whether to show the volume (only for known terms)
  renderContainer: (children: React.ReactNode) => React.ReactNode;
  renderText: (text: string, style: 'title' | 'subtitle' | 'volume') => React.ReactNode;
}

export const SearchTermCard: React.FC<SearchTermCardProps> = ({
  term,
  isKnown,
  showVolume,
  renderContainer,
  renderText,
}) => {
  // CRITICAL GAME LOGIC:
  // 1. Always display the term name regardless of known status
  // 2. Only show volume indicator when the term is known AND showVolume is true
  return renderContainer(
    <>
      {renderText(term.term, 'title')}
      {renderText(isKnown ? 'is trending' : 'is trending higher or lower?', 'subtitle')}
      {isKnown && showVolume && renderText(`Volume: ${term.volume}`, 'volume')}
    </>
  );
};