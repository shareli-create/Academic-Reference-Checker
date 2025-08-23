
export interface Citation {
  original: string;
  authors: string;
  year: string;
  normalized: string;
  type: string;
}

export interface Reference {
  original: string;
  firstAuthor: string;
  allAuthors: string;
  year: string;
  normalized: string;
  firstAuthorNormalized: string;
}

export interface MatchResult {
  citation: Citation;
  reference: Reference;
  confidence: number | string;
  matchType: string;
}

export interface UnmatchedResult {
  citation: Citation;
  suggestions: any[]; // Can be defined further if suggestions have a structure
}

export interface UnusedResult {
  reference: Reference;
  possibleMatches: any[]; // Can be defined further if matches have a structure
}

export interface Summary {
  totalCitations: number;
  totalReferences: number;
  fullMatches: number;
  partialMatches: number;
  probableSpellingErrors: number;
  missingReferences: number;
  unusedReferences: number;
}

export interface AnalysisResults {
  citations: Citation[];
  references: Reference[];
  fullMatches: MatchResult[];
  partialMatches: MatchResult[];
  probableSpellingErrors: MatchResult[];
  missing: UnmatchedResult[];
  unused: UnusedResult[];
  summary: Summary;
}

export interface SuggestionCandidate {
  text: string;
  position: number;
  confidence: number;
  type: string;
  matchedTerms?: string[];
  sentence?: string;
}

export interface UnusedRefSuggestion {
    reference: Reference;
    candidates: SuggestionCandidate[];
}

export interface MissingCitationSuggestion {
    citation: Citation;
    candidates: SuggestionCandidate[];
}