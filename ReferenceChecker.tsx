
import React, { useState } from 'react';
import { FileText, Search, CheckCircle, AlertCircle, RefreshCw, Info, X, Download } from './icons';
import { AnalysisResults, Citation, MatchResult, MissingCitationSuggestion, Reference, UnmatchedResult, UnusedRefSuggestion, UnusedResult } from '../types';

const ReferenceChecker: React.FC = () => {
  const [documentText, setDocumentText] = useState('');
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [secondAnalysis, setSecondAnalysis] = useState<UnusedRefSuggestion[] | null>(null);
  const [thirdAnalysis, setThirdAnalysis] = useState<MissingCitationSuggestion[] | null>(null);
  const [fourthAnalysis, setFourthAnalysis] = useState<UnusedRefSuggestion[] | null>(null);
  const [isSecondAnalysisRunning, setIsSecondAnalysisRunning] = useState(false);
  const [isThirdAnalysisRunning, setIsThirdAnalysisRunning] = useState(false);
  const [isFourthAnalysisRunning, setIsFourthAnalysisRunning] = useState(false);

  const normalize = (text: string): string => {
    return text.toLowerCase()
      .replace(/[.,&()]/g, '')
      .replace(/\s*et\s+al\.?/g, '')
      .replace(/[-\s]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\b(e\.g|see|cf)\b/g, '')
      .trim();
  };

  const extractFirstAuthor = (authorString: string): string => {
    const cleaned = authorString.replace(/\s*et\s+al\.?/i, '').trim();
    const parts = cleaned.split(/\s*[&,]\s*/);
    return parts[0].replace(/\s+et\s+al\.?/i, '').trim();
  };

  const extractCitations = (text: string): Citation[] => {
    const citations: Citation[] = [];
    const foundCitations = new Set<string>();
    
    const parentheticalPattern1 = /\(([^)]*(?:[A-Z][a-zA-Z\-\']+[^)]*\d{4}[a-z]?[^)]*)+)\)/g;
    
    let match;
    while ((match = parentheticalPattern1.exec(text)) !== null) {
      const content = match[1].trim();
      
      if (content.match(/^p\.|^pp\.|^page|^see p/i)) continue;
      if (content.match(/^\d+$/)) continue; 
      if (content.length < 8) continue;
      
      const parts = content.split(/;(?=\s*[A-Z])/);
      
      parts.forEach(part => {
        part = part.trim();
        if (part.length < 5) return;
        
        const yearMatch = part.match(/(\d{4}[a-z]?)(?:\s*[,;)]|$)/);
        if (!yearMatch) return;
        
        const year = yearMatch[1];
        const yearIndex = part.indexOf(year);
        const beforeYear = part.substring(0, yearIndex).replace(/[,\s]+$/, '').trim();
        
        if (beforeYear.length > 2 && beforeYear.match(/[A-Za-z]/)) {
          const citationKey = normalize(beforeYear + ' ' + year);
          if (!foundCitations.has(citationKey)) {
            citations.push({
              original: `(${part})`,
              authors: beforeYear,
              year: year,
              normalized: citationKey,
              type: 'parenthetical'
            });
            foundCitations.add(citationKey);
          }
        }
      });
    }

    const narrativePattern = /\b([A-Z][a-zA-Z\-\']+(?:\s*,\s*[A-Z][a-zA-Z\-\']+)*(?:\s*,?\s*&\s*[A-Z][a-zA-Z\-\']+)?(?:\s+et\s+al\.?)?)\s+\((\d{4}[a-z]?)\)/g;
    
    while ((match = narrativePattern.exec(text)) !== null) {
      const authors = match[1];
      const year = match[2];
      const citationKey = normalize(authors + ' ' + year);
      
      if (!foundCitations.has(citationKey)) {
        citations.push({
          original: `${authors} (${year})`,
          authors: authors,
          year: year,
          normalized: citationKey,
          type: 'narrative'
        });
        foundCitations.add(citationKey);
      }
    }

    const complexNarrativePattern = /\b([A-Z][a-zA-Z\-\']+(?:\s*,\s*[A-Z][a-zA-Z\-\']+)*(?:\s*,?\s*&\s*[A-Z][a-zA-Z\-\']+)+)\s+\((\d{4}[a-z]?)\)/g;
    
    while ((match = complexNarrativePattern.exec(text)) !== null) {
      const authors = match[1];
      const year = match[2];
      const citationKey = normalize(authors + ' ' + year);
      
      if (!foundCitations.has(citationKey)) {
        citations.push({
          original: `${authors} (${year})`,
          authors: authors,
          year: year,
          normalized: citationKey,
          type: 'narrative-complex'
        });
        foundCitations.add(citationKey);
      }
    }

    const multiAuthorParenPattern = /\(([A-Z][a-zA-Z\-\']+(?:\s*,\s*[A-Z][a-zA-Z\-\']+)*\s*,?\s*&\s*[A-Z][a-zA-Z\-\']+)\s*,\s*(\d{4}[a-z]?)\)/g;
    
    while ((match = multiAuthorParenPattern.exec(text)) !== null) {
      const authors = match[1];
      const year = match[2];
      const citationKey = normalize(authors + ' ' + year);
      
      if (!foundCitations.has(citationKey)) {
        citations.push({
          original: `(${authors}, ${year})`,
          authors: authors,
          year: year,
          normalized: citationKey,
          type: 'parenthetical-multi'
        });
        foundCitations.add(citationKey);
      }
    }

    return citations;
  };

  const getTextToSearchForCitations = (text: string): string => {
    const refHeaderRegex = /(References|Bibliography|Works Cited)\s*\n/i;
    const refSectionMatch = text.match(refHeaderRegex);

    if (!refSectionMatch || typeof refSectionMatch.index === 'undefined') {
      return text;
    }

    const textBeforeRefs = text.substring(0, refSectionMatch.index);
    const textFromRefsHeaderOn = text.substring(refSectionMatch.index);
    const contentAfterRefHeader = textFromRefsHeaderOn.substring(refSectionMatch[0].length);
    const footnoteHeaderRegex = /\n\s*(Footnotes|Endnotes)\s*\n/i;
    const footnoteMatch = contentAfterRefHeader.match(footnoteHeaderRegex);

    if (footnoteMatch && typeof footnoteMatch.index !== 'undefined') {
      const footnotesAndAfter = contentAfterRefHeader.substring(footnoteMatch.index);
      return textBeforeRefs + footnotesAndAfter;
    } else {
      return textBeforeRefs;
    }
  };

  const parseReferencesFromTextBlob = (textBlob: string): Reference[] => {
    const lines = textBlob.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const references: string[] = [];
    let currentRef = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isNewRefStart = 
        /^\d+\.\s+/.test(line) ||
        /^[A-Z][a-zA-Z\-\']+,\s+[A-Z]/.test(line) ||
        (/^[A-Z]/.test(line) && line.includes('(') && /\(\d{4}/.test(line)) ||
        (currentRef.endsWith('.') && /^[A-Z]/.test(line) && line.length > 20);
      
      if (isNewRefStart && currentRef.length > 30) {
        if (currentRef.includes('(') && /\(\d{4}/.test(currentRef)) {
          references.push(currentRef.trim());
        }
        currentRef = line;
      } else {
        currentRef += (currentRef.length > 0 ? ' ' : '') + line;
      }
    }
    
    if (currentRef.length > 30 && currentRef.includes('(') && /\(\d{4}/.test(currentRef)) {
      references.push(currentRef.trim());
    }
    
    const processedReferences: Reference[] = [];
    references.forEach((refText) => {
      const cleanedRefText = refText.replace(/^\d+\.\s+/, '');
      const yearMatches = cleanedRefText.match(/\((\d{4}[a-z]?)\)/g);
      if (!yearMatches) return;
      
      const yearMatch = yearMatches[0].match(/\((\d{4}[a-z]?)\)/);
      if (!yearMatch) return;
      const year = yearMatch[1];
      
      const yearIndex = cleanedRefText.indexOf(`(${year})`);
      const beforeYear = cleanedRefText.substring(0, yearIndex).trim();
      const cleanedAuthors = beforeYear.replace(/\.$/, '').trim();
      
      let firstAuthor = '';
      const firstCommaIndex = cleanedAuthors.indexOf(',');
      if (firstCommaIndex !== -1) {
        firstAuthor = cleanedAuthors.substring(0, firstCommaIndex).trim();
      } else {
        firstAuthor = cleanedAuthors.split(/\s+/)[0] || '';
      }
      
      if (!firstAuthor || firstAuthor.length < 2) return;
      
      const processedRef: Reference = {
        original: cleanedRefText,
        firstAuthor: firstAuthor,
        allAuthors: cleanedAuthors,
        year: year,
        normalized: normalize(cleanedAuthors + ' ' + year),
        firstAuthorNormalized: normalize(firstAuthor + ' ' + year)
      };
      processedReferences.push(processedRef);
    });
    
    return processedReferences;
  };

  const extractReferences = (text: string): Reference[] => {
    let allReferences: Reference[] = [];

    const refHeaderRegex = /(References|Bibliography|Works Cited)\s*\n/i;
    const refSectionMatch = text.match(refHeaderRegex);

    if (refSectionMatch && refSectionMatch.index !== undefined) {
      let potentialRefContent = text.substring(refSectionMatch.index + refSectionMatch[0].length);
      const footnoteHeaderRegex = /\n\s*(Footnotes|Endnotes)\s*\n/i;
      const footnoteMatch = potentialRefContent.match(footnoteHeaderRegex);
      
      if (footnoteMatch && footnoteMatch.index !== undefined) {
        potentialRefContent = potentialRefContent.substring(0, footnoteMatch.index);
      }
      allReferences = allReferences.concat(parseReferencesFromTextBlob(potentialRefContent));
    }

    const footnoteSectionRegex = /(Footnotes|Endnotes)\s*\n([\s\S]*)/i;
    const footnoteSectionMatch = text.match(footnoteSectionRegex);

    if (footnoteSectionMatch) {
      const footnotesContent = footnoteSectionMatch[2];
      allReferences = allReferences.concat(parseReferencesFromTextBlob(footnotesContent));
    }

    const uniqueReferences = allReferences.filter((ref, index, self) =>
      index === self.findIndex((r) => r.normalized === ref.normalized)
    );
    
    return uniqueReferences;
  };

  const matchCitationsToReferences = (citations: Citation[], references: Reference[]) => {
    const fullMatches: MatchResult[] = [];
    const partialMatches: MatchResult[] = [];
    const probableSpellingErrors: MatchResult[] = [];
    const unmatched: UnmatchedResult[] = [];
    const usedReferences = new Set<number>();

    citations.forEach((citation) => {
      let bestMatch: { reference: Reference; index: number; confidence: number; matchType: string; } | null = null;
      let bestScore = 0;

      references.forEach((ref, refIndex) => {
        const citationYear = citation.year.replace(/[a-z]$/, '');
        const refYear = ref.year.replace(/[a-z]$/, '');
        
        if (citationYear !== refYear) return;

        const extractSurname = (name: string) => {
          return name.replace(/\s*et\s+al\.?/gi, '')
                    .replace(/[,\.]/g, '')
                    .split(/\s+/)
                    .filter(word => word.length > 1 && !/^[A-Z]\.?$/.test(word))
                    .pop() || name;
        };

        const citationSurname = normalize(extractSurname(citation.authors));
        const refSurname = normalize(extractSurname(ref.firstAuthor));

        let score = 0;
        let currentMatchType = 'none';

        if (citationSurname === refSurname && citationSurname.length > 2) {
          score = 100;
          currentMatchType = 'full';
        }
        else if (citationSurname.length > 3 && refSurname.length > 3) {
          if (citationSurname.includes(refSurname) || refSurname.includes(citationSurname)) {
            score = 90;
            currentMatchType = 'partial';
          }
        }
        else if (citationSurname.length > 3 && refSurname.length > 3) {
          const similarity = calculateSimilarity(citationSurname, refSurname);
          if (similarity >= 0.75) {
            score = Math.round(similarity * 90);
            currentMatchType = 'spelling_error';
          }
        }

        if (citation.authors.includes(',') || citation.authors.includes('&') || citation.authors.includes('and')) {
          const citationSurnames = citation.authors
            .replace(/\s*et\s+al\.?/gi, '')
            .split(/[,&]|\sand\s/)
            .map(author => normalize(extractSurname(author.trim())))
            .filter(surname => surname.length > 2);
          
          const refAllSurnames = ref.allAuthors
            .split(/[,&]|\sand\s/)
            .map(author => normalize(extractSurname(author.trim())))
            .filter(surname => surname.length > 2);
          
          let exactMatches = 0, fuzzyMatches = 0, partialMatchesCount = 0;
          
          citationSurnames.forEach(citSurname => {
            let bestAuthorMatch = 0, bestAuthorType = 'none';
            
            refAllSurnames.forEach(refSurname => {
              if (refSurname === citSurname) {
                bestAuthorMatch = 100;
                bestAuthorType = 'exact';
              } else if (bestAuthorType !== 'exact') {
                const sim = calculateSimilarity(citSurname, refSurname);
                if (sim >= 0.75 && sim * 100 > bestAuthorMatch) {
                  bestAuthorMatch = sim * 100;
                  bestAuthorType = 'fuzzy';
                } else if (bestAuthorType !== 'fuzzy' && (refSurname.includes(citSurname) || citSurname.includes(refSurname))) {
                  bestAuthorMatch = 85;
                  bestAuthorType = 'partial';
                }
              }
            });
            
            if (bestAuthorType === 'exact') exactMatches++;
            else if (bestAuthorType === 'fuzzy') fuzzyMatches++;
            else if (bestAuthorType === 'partial') partialMatchesCount++;
          });
          
          const totalAuthors = citationSurnames.length;
          const matchRatio = (exactMatches + fuzzyMatches * 0.9 + partialMatchesCount * 0.7) / totalAuthors;
          
          if (matchRatio >= 0.7) {
            const newScore = 70 + (matchRatio * 25);
            if (newScore > score) {
              score = newScore;
              if (fuzzyMatches > 0) currentMatchType = 'spelling_error';
              else if (exactMatches >= totalAuthors * 0.8) currentMatchType = 'full';
              else currentMatchType = 'partial';
            }
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = { reference: ref, index: refIndex, confidence: score, matchType: currentMatchType };
        }
      });

      if (bestMatch && bestMatch.confidence >= 70) {
        const matchData: MatchResult = {
          citation: citation,
          reference: bestMatch.reference,
          confidence: bestMatch.confidence,
          matchType: bestMatch.matchType
        };

        if (bestMatch.matchType === 'spelling_error') probableSpellingErrors.push(matchData);
        else if (bestMatch.matchType === 'full' || bestMatch.confidence >= 90) fullMatches.push(matchData);
        else partialMatches.push(matchData);
        
        usedReferences.add(bestMatch.index);
      } else {
        unmatched.push({ citation: citation, suggestions: [] });
      }
    });

    const unusedReferences: UnusedResult[] = references
      .filter((_ref, index) => !usedReferences.has(index))
      .map(ref => ({ reference: ref, possibleMatches: [] }));

    return { fullMatches, partialMatches, probableSpellingErrors, unmatched, unusedReferences };
  };

  const calculateSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1.0;
    const editDistance = getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };

  const getEditDistance = (str1: string, str2: string): number => {
    const matrix: number[][] = [];
    for (let i = 0; i <= str2.length; i++) { matrix[i] = [i]; }
    for (let j = 0; j <= str1.length; j++) { matrix[0][j] = j; }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  };
  
  const performSecondAnalysis = (unusedRefs: UnusedResult[], documentText: string): UnusedRefSuggestion[] => {
    const suggestions: UnusedRefSuggestion[] = [];
    const mainDocument = getTextToSearchForCitations(documentText);
    
    unusedRefs.forEach(unusedRef => {
      const ref = unusedRef.reference;
      const refFirstAuthor = extractFirstAuthor(ref.firstAuthor).toLowerCase();
      const refYear = ref.year;
      const candidates: UnusedRefSuggestion['candidates'] = [];
      const authorVariations = [ refFirstAuthor, refFirstAuthor.charAt(0).toUpperCase() + refFirstAuthor.slice(1) ];
      
      if (refFirstAuthor.includes(' ')) {
        const parts = refFirstAuthor.split(' ');
        if (parts.length > 1) {
          authorVariations.push(parts.join(' '));
          const surname = parts[parts.length - 1];
          if (surname.length > 3) {
            authorVariations.push(surname);
            authorVariations.push(surname.charAt(0).toUpperCase() + surname.slice(1));
          }
        }
      }
      
      authorVariations.forEach(authorVar => {
        if (authorVar.length < 3) return;
        const escapedAuthor = authorVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        try {
          const yearVariations = [refYear, refYear.replace(/[a-z]$/, '')];
          yearVariations.forEach(yearVar => {
            const narrativeRegex = new RegExp(`\\b${escapedAuthor}[A-Za-z\\-]*(?:\\s+et\\s+al\\.?)?(?:'s)?\\s*\\(${yearVar}[a-z]?\\)`, 'gi');
            let match;
            while ((match = narrativeRegex.exec(mainDocument)) !== null) {
              candidates.push({ text: match[0], position: match.index, confidence: 0.95, type: 'narrative-citation' });
            }
            const parentheticalRegex = new RegExp(`\\([^)]*${escapedAuthor}[^)]*${yearVar}[a-z]?[^)]*\\)`, 'gi');
            while ((match = parentheticalRegex.exec(mainDocument)) !== null) {
              candidates.push({ text: match[0], position: match.index, confidence: 0.9, type: 'parenthetical-citation' });
            }
          });
        } catch (e) { /* Skip regex fails */ }
      });
      
      const uniqueCandidates = candidates
        .filter((c, i, arr) => arr.findIndex(c2 => c2.text.trim() === c.text.trim()) === i)
        .filter(c => c.text.length > 5 && c.text.length < 200 && !c.text.includes('doi.org') && !c.text.includes('University') && !c.text.includes('Journal of'))
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3);
      
      if (uniqueCandidates.length > 0) {
        suggestions.push({ reference: ref, candidates: uniqueCandidates });
      }
    });
    return suggestions;
  };

  const performThirdAnalysis = (missingCitations: UnmatchedResult[], documentText: string): MissingCitationSuggestion[] => {
    const suggestions: MissingCitationSuggestion[] = [];
    missingCitations.forEach(missing => {
      const citation = missing.citation;
      const citationFirstAuthor = extractFirstAuthor(citation.authors).toLowerCase();
      const citationYear = citation.year;
      const candidates: MissingCitationSuggestion['candidates'] = [];
      const authorVariations = [
        citationFirstAuthor.substring(0, Math.max(3, citationFirstAuthor.length)),
        citationFirstAuthor.split(' ')[0],
        citation.authors.toLowerCase().substring(0, 6)
      ];
      
      authorVariations.forEach(authorVar => {
        if (authorVar.length < 2) return;
        try {
          const yearVariations = [citationYear, citationYear.replace(/[a-z]$/, '')];
          yearVariations.forEach(yearVar => {
            const yearOnlyRegex = new RegExp(`\\(${yearVar}[a-z]?\\)`, 'gi');
            let match;
            while ((match = yearOnlyRegex.exec(documentText)) !== null) {
              const context = documentText.substring(Math.max(0, match.index - 100), match.index + 100);
              if (!context.toLowerCase().includes('reference') && !context.toLowerCase().includes('bibliography')) {
                candidates.push({ text: context, position: match.index, confidence: 0.7, type: 'year-match' });
              }
            }
          });
        } catch (e) { /* Skip regex fails */ }
      });
      
      const uniqueCandidates = candidates
        .filter((c, i, arr) => arr.findIndex(c2 => c2.text === c.text) === i)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);
      
      if (uniqueCandidates.length > 0) {
        suggestions.push({ citation: citation, candidates: uniqueCandidates });
      }
    });
    return suggestions;
  };

  const performFourthAnalysis = (unusedRefs: UnusedResult[], documentText: string): UnusedRefSuggestion[] => {
    const suggestions: UnusedRefSuggestion[] = [];
    const mainDocument = getTextToSearchForCitations(documentText);
    
    unusedRefs.forEach(unusedRef => {
      const ref = unusedRef.reference;
      const candidates: UnusedRefSuggestion['candidates'] = [];
      const refText = ref.original.toLowerCase();
      const refYear = ref.year;
      const allAuthorSurnames = ref.allAuthors.toLowerCase().split(/[,&]|\sand\s/).map(author => {
          const cleaned = author.replace(/\s*et\s+al\.?/gi, '').trim();
          const parts = cleaned.split(/\s+/);
          return parts.filter(part => part.length > 2 && !/^[a-z]\.?$/.test(part)).pop() || '';
        }).filter(s => s.length > 2);
      const commonWords = ['the', 'and', 'for', 'with', 'from', 'this', 'that', 'they', 'have', 'been', 'were', 'will', 'their', 'there', 'when', 'where', 'what', 'which', 'while'];
      const titleWords = refText.replace(/\([^)]*\)/g, '').split(/\s+/).filter(w => w.length > 4 && !commonWords.includes(w) && !/^\d+$/.test(w)).slice(0, 8);
      const sentences = mainDocument.split(/[.!?]+/).filter(s => s.trim().length > 20);
      
      sentences.forEach((sentence, sentIndex) => {
        const sentenceLower = sentence.toLowerCase();
        let score = 0;
        let matchedTerms: string[] = [];
        if (sentenceLower.includes(refYear)) { score += 30; matchedTerms.push(`year:${refYear}`); }
        allAuthorSurnames.forEach(surname => {
          if (surname.length > 2 && sentenceLower.includes(surname)) { score += 25; matchedTerms.push(`author:${surname}`); }
        });
        let titleMatches = 0;
        titleWords.forEach(word => {
          if (sentenceLower.includes(word)) { titleMatches++; matchedTerms.push(`title:${word}`); }
        });
        if (titleMatches > 0) { score += (titleMatches / titleWords.length) * 40; }
        const normalizedScore = Math.min(100, score);
        
        if (normalizedScore >= 60) {
          const contextStart = Math.max(0, sentIndex - 1);
          const contextEnd = Math.min(sentences.length, sentIndex + 2);
          const context = sentences.slice(contextStart, contextEnd).join('. ').trim();
          candidates.push({ text: context, sentence: sentence.trim(), position: sentIndex, confidence: normalizedScore / 100, matchedTerms, type: 'lenient-text-match' });
        }
      });
      
      const uniqueCandidates = candidates
        .filter((c, i, arr) => arr.findIndex(c2 => c2.sentence?.trim() === c.sentence?.trim()) === i)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);
      
      if (uniqueCandidates.length > 0) {
        suggestions.push({ reference: ref, candidates: uniqueCandidates });
      }
    });
    return suggestions;
  };

  const processDocument = async () => {
    if (!documentText.trim()) {
      alert('Please paste your document text first.');
      return;
    }
    setIsProcessing(true);
    setResults(null);
    setSecondAnalysis(null);
    setThirdAnalysis(null);
    setFourthAnalysis(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      const citations = extractCitations(documentText);
      const references = extractReferences(documentText);
      if (citations.length === 0 && references.length === 0) {
        alert('No citations or references found.');
        setIsProcessing(false);
        return;
      }
      const matchResults = matchCitationsToReferences(citations, references);
      const summary: AnalysisResults['summary'] = {
        totalCitations: citations.length,
        totalReferences: references.length,
        fullMatches: matchResults.fullMatches.length,
        partialMatches: matchResults.partialMatches.length,
        probableSpellingErrors: matchResults.probableSpellingErrors.length,
        missingReferences: matchResults.unmatched.length,
        unusedReferences: matchResults.unusedReferences.length
      };
      setResults({
        citations, references,
        fullMatches: matchResults.fullMatches,
        partialMatches: matchResults.partialMatches,
        probableSpellingErrors: matchResults.probableSpellingErrors,
        missing: matchResults.unmatched,
        unused: matchResults.unusedReferences,
        summary
      });
    } catch (error: any) {
      alert('Error processing document: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const runSecondAnalysis = () => {
    if (!results || !results.unused.length) return;
    setIsSecondAnalysisRunning(true);
    setTimeout(() => {
      const suggestions = performSecondAnalysis(results.unused, documentText);
      setSecondAnalysis(suggestions);
      setIsSecondAnalysisRunning(false);
    }, 100);
  };

  const runThirdAnalysis = () => {
    if (!results || !results.missing.length) return;
    setIsThirdAnalysisRunning(true);
    setTimeout(() => {
      const suggestions = performThirdAnalysis(results.missing, documentText);
      setThirdAnalysis(suggestions);
      setIsThirdAnalysisRunning(false);
    }, 100);
  };

  const runFourthAnalysis = () => {
    if (!results || !results.unused.length) return;
    setIsFourthAnalysisRunning(true);
    setTimeout(() => {
      const suggestions = performFourthAnalysis(results.unused, documentText);
      setFourthAnalysis(suggestions);
      setIsFourthAnalysisRunning(false);
    }, 100);
  };
  
    const markAsMatch = (refIndex: number, candidateText: string) => {
    if (!secondAnalysis) return;
    
    const selectedSuggestion = secondAnalysis[refIndex];
    setSecondAnalysis(prev => prev ? prev.filter((_, index) => index !== refIndex) : null);
    if (fourthAnalysis) {
      setFourthAnalysis(prev => prev ? prev.filter(s => s.reference.original !== selectedSuggestion.reference.original) : null);
    }
    
    setResults(prev => {
        if (!prev) return null;
        const newUnused = prev.unused.filter(u => u.reference.original !== selectedSuggestion.reference.original);
        const newMatch: MatchResult = {
            citation: { original: candidateText, authors: selectedSuggestion.reference.firstAuthor, year: selectedSuggestion.reference.year, type: 'confirmed', normalized: '' },
            reference: selectedSuggestion.reference,
            confidence: 'User Confirmed',
            matchType: 'user_confirmed'
        };
        const newPartialMatches = [...prev.partialMatches, newMatch];
        const summary = { ...prev.summary, partialMatches: newPartialMatches.length, unusedReferences: newUnused.length };
        return { ...prev, partialMatches: newPartialMatches, unused: newUnused, summary };
    });
  };

  const markAsNonMatch = (refIndex: number) => {
    setSecondAnalysis(prev => prev ? prev.filter((_, index) => index !== refIndex) : null);
  };
  
  const markThirdAsMatch = (citationIndex: number, candidateText: string) => {
    if (!thirdAnalysis) return;
    const selectedSuggestion = thirdAnalysis[citationIndex];
    setThirdAnalysis(prev => prev ? prev.filter((_, index) => index !== citationIndex) : null);

    setResults(prev => {
        if (!prev) return null;
        const newMissing = prev.missing.filter(m => m.citation.original !== selectedSuggestion.citation.original);
        const newMatch: MatchResult = {
            citation: selectedSuggestion.citation,
            reference: { original: candidateText, firstAuthor: selectedSuggestion.citation.authors, allAuthors: selectedSuggestion.citation.authors, year: selectedSuggestion.citation.year, normalized: '', firstAuthorNormalized: '' },
            confidence: 'User Confirmed',
            matchType: 'user_confirmed_missing'
        };
        const newFullMatches = [...prev.fullMatches, newMatch];
        const summary = { ...prev.summary, fullMatches: newFullMatches.length, missingReferences: newMissing.length };
        return { ...prev, fullMatches: newFullMatches, missing: newMissing, summary };
    });
  };

  const markThirdAsNonMatch = (citationIndex: number) => {
    setThirdAnalysis(prev => prev ? prev.filter((_, index) => index !== citationIndex) : null);
  };

  const markFourthAsMatch = (refIndex: number, candidateText: string) => {
    if (!fourthAnalysis) return;
    const selectedSuggestion = fourthAnalysis[refIndex];
    setFourthAnalysis(prev => prev ? prev.filter((_, index) => index !== refIndex) : null);
    if (secondAnalysis) {
      setSecondAnalysis(prev => prev ? prev.filter(s => s.reference.original !== selectedSuggestion.reference.original) : null);
    }
    setResults(prev => {
        if (!prev) return null;
        const newUnused = prev.unused.filter(u => u.reference.original !== selectedSuggestion.reference.original);
        const newMatch: MatchResult = {
            citation: { original: candidateText, authors: selectedSuggestion.reference.firstAuthor, year: selectedSuggestion.reference.year, type: 'confirmed', normalized: '' },
            reference: selectedSuggestion.reference,
            confidence: 'User Confirmed',
            matchType: 'user_confirmed_fourth'
        };
        const newPartialMatches = [...prev.partialMatches, newMatch];
        const summary = { ...prev.summary, partialMatches: newPartialMatches.length, unusedReferences: newUnused.length };
        return { ...prev, partialMatches: newPartialMatches, unused: newUnused, summary };
    });
  };

  const markFourthAsNonMatch = (refIndex: number) => {
    setFourthAnalysis(prev => prev ? prev.filter((_, index) => index !== refIndex) : null);
  };

  const generateReport = (): string => {
    if (!results) return "";
    let report = `ACADEMIC REFERENCE CHECKER REPORT\nGenerated on: ${new Date().toLocaleString()}\n===============================================\n\nSUMMARY STATISTICS:\n- Total Citations Found: ${results.summary.totalCitations}\n- Total References Found: ${results.summary.totalReferences}\n- Perfect Matches: ${results.summary.fullMatches}\n- Partial Matches: ${results.summary.partialMatches}\n- Missing References: ${results.summary.missingReferences}\n- Unused References: ${results.summary.unusedReferences}\n\n===============================================\n\nDETAILED RESULTS:\n\n`;
    if (results.fullMatches.length > 0) {
      report += `PERFECT MATCHES (${results.fullMatches.length}):\n`;
      results.fullMatches.forEach((m, i) => report += `${i + 1}. Citation: ${m.citation.original}\n   Reference: ${m.reference.original}\n\n`);
    }
    if (results.probableSpellingErrors.length > 0) {
        report += `PROBABLE SPELLING ERRORS (${results.probableSpellingErrors.length}):\n`;
        results.probableSpellingErrors.forEach((m, i) => report += `${i + 1}. Citation: ${m.citation.original}\n   Likely matches: ${m.reference.original}\n   Suggestion: Check if "${m.citation.authors}" should be "${m.reference.firstAuthor}"\n\n`);
    }
    if (results.partialMatches.length > 0) {
        report += `PARTIAL MATCHES (${results.partialMatches.length}):\n`;
        results.partialMatches.forEach((m, i) => report += `${i + 1}. Citation: ${m.citation.original}\n   Reference: ${m.reference.original}\n\n`);
    }
    if (results.missing.length > 0) {
      report += `CITATIONS WITHOUT REFERENCES (${results.missing.length}):\n`;
      results.missing.forEach((m, i) => report += `${i + 1}. ${m.citation.original}\n`);
      report += '\n';
    }
    if (results.unused.length > 0) {
      report += `UNUSED REFERENCES (${results.unused.length}):\n`;
      results.unused.forEach((u, i) => report += `${i + 1}. ${u.reference.original}\n`);
      report += '\n';
    }
    return report;
  };

  const downloadReport = () => {
    const report = generateReport();
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reference-check-report-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <FileText className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-900">Academic Reference Checker</h1>
          </div>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Advanced 4-stage analysis system to match in-text citations with references. 
            Find missing citations, unused references, and potential matches using multiple algorithms.
          </p>
        </header>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Document Input
            </label>
            <textarea
              value={documentText}
              onChange={(e) => setDocumentText(e.target.value)}
              placeholder="Paste your academic document here (including both the main text with citations and the reference list)..."
              className="w-full h-64 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-4"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <button
              onClick={processDocument}
              disabled={isProcessing || !documentText.trim()}
              className="bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
            >
              {isProcessing ? (<><RefreshCw className="w-4 h-4 animate-spin" />Processing...</>) : (<><Search className="w-4 h-4" />Stage 1: Initial</>)}
            </button>
            <button
              onClick={runSecondAnalysis}
              disabled={isSecondAnalysisRunning || !results || !results.unused.length}
              className="bg-orange-600 text-white py-3 px-4 rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
            >
              {isSecondAnalysisRunning ? (<><RefreshCw className="w-4 h-4 animate-spin" />Running...</>) : (<><Search className="w-4 h-4" />Stage 2: Citations</>)}
            </button>
            <button
              onClick={runThirdAnalysis}
              disabled={isThirdAnalysisRunning || !results || !results.missing.length}
              className="bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
            >
              {isThirdAnalysisRunning ? (<><RefreshCw className="w-4 h-4 animate-spin" />Running...</>) : (<><Search className="w-4 h-4" />Stage 3: References</>)}
            </button>
            <button
              onClick={runFourthAnalysis}
              disabled={isFourthAnalysisRunning || !results || !results.unused.length}
              className="bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
            >
              {isFourthAnalysisRunning ? (<><RefreshCw className="w-4 h-4 animate-spin" />Running...</>) : (<><Search className="w-4 h-4" />Stage 4: Lenient</>)}
            </button>
          </div>
        </div>

        {results && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Info className="w-5 h-5" />Stage 1: Analysis Summary</h2>
                <button onClick={downloadReport} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 font-medium"><Download className="w-4 h-4" />Download Report</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg"><div className="text-2xl font-bold text-blue-600">{results.summary.totalCitations}</div><div className="text-sm text-gray-600">Citations</div></div>
                <div className="text-center p-3 bg-purple-50 rounded-lg"><div className="text-2xl font-bold text-purple-600">{results.summary.totalReferences}</div><div className="text-sm text-gray-600">References</div></div>
                <div className="text-center p-3 bg-green-50 rounded-lg"><div className="text-2xl font-bold text-green-600">{results.summary.fullMatches}</div><div className="text-sm text-gray-600">Perfect</div></div>
                <div className="text-center p-3 bg-orange-50 rounded-lg"><div className="text-2xl font-bold text-orange-600">{results.summary.probableSpellingErrors}</div><div className="text-sm text-gray-600">Spelling</div></div>
                <div className="text-center p-3 bg-yellow-50 rounded-lg"><div className="text-2xl font-bold text-yellow-600">{results.summary.partialMatches}</div><div className="text-sm text-gray-600">Partial</div></div>
                <div className="text-center p-3 bg-red-50 rounded-lg"><div className="text-2xl font-bold text-red-600">{results.summary.missingReferences}</div><div className="text-sm text-gray-600">Missing</div></div>
                <div className="text-center p-3 bg-gray-50 rounded-lg"><div className="text-2xl font-bold text-gray-600">{results.summary.unusedReferences}</div><div className="text-sm text-gray-600">Unused</div></div>
              </div>
            </div>

            {results.fullMatches.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-green-700 mb-4 flex items-center gap-2"><CheckCircle className="w-5 h-5" />Perfect Matches ({results.fullMatches.length})</h3>
                <div className="space-y-3">{results.fullMatches.map((match, index) => (<div key={index} className="border-l-4 border-green-500 pl-4 py-2 bg-green-50 rounded-r"><div className="font-medium text-gray-900">{match.citation.original}</div><div className="text-sm text-gray-600 mt-1"><strong>Ref:</strong> {match.reference.original}</div></div>))}</div>
              </div>
            )}
            
            {results.probableSpellingErrors.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-orange-700 mb-4 flex items-center gap-2"><AlertCircle className="w-5 h-5" />Probable Spelling Errors ({results.probableSpellingErrors.length})</h3>
                <div className="space-y-3">{results.probableSpellingErrors.map((match, index) => (<div key={index} className="border-l-4 border-orange-500 pl-4 py-3 bg-orange-50 rounded-r"><div className="font-medium text-gray-900 mb-2">{match.citation.original}</div><div className="text-sm text-gray-600 mb-2"><strong>Likely matches:</strong> {match.reference.original}</div><div className="bg-orange-100 p-3 rounded text-sm text-orange-800"><strong>💡 Suggestion:</strong> Check if "{match.citation.authors}" should be "{match.reference.firstAuthor}".</div></div>))}</div>
              </div>
            )}

            {results.partialMatches.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-yellow-700 mb-4 flex items-center gap-2"><AlertCircle className="w-5 h-5" />Partial Matches ({results.partialMatches.length})</h3>
                <div className="space-y-3">{results.partialMatches.map((match, index) => (<div key={index} className="border-l-4 border-yellow-500 pl-4 py-2 bg-yellow-50 rounded-r"><div className="font-medium text-gray-900">{match.citation.original}</div><div className="text-sm text-gray-600 mt-1"><strong>Ref:</strong> {match.reference.original}</div></div>))}</div>
              </div>
            )}

            {secondAnalysis && secondAnalysis.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-orange-700 mb-4 flex items-center gap-2"><Search className="w-5 h-5" />Stage 2: Hidden Citation Suggestions ({secondAnalysis.length})</h3>
                <div className="space-y-4">{secondAnalysis.map((s, i) => (<div key={i} className="border border-orange-200 rounded-lg p-4 bg-orange-50"><div><strong>Unused Ref:</strong></div><div className="text-sm italic mb-3">{s.reference.original}</div><div className="space-y-2">{s.candidates.map((c, ci) => (<div key={ci} className="bg-white p-3 rounded border-l-4 border-orange-400"><div>"{c.text}"</div><div className="text-xs text-orange-600 mb-2">Conf: {Math.round(c.confidence*100)}%</div><button onClick={() => markAsMatch(i, c.text)} className="bg-green-600 text-white text-xs px-3 py-1 rounded">✓ Match</button></div>))}</div><button onClick={() => markAsNonMatch(i)} className="mt-2 bg-red-600 text-white text-xs px-3 py-1 rounded"><X className="w-3 h-3 inline mr-1"/>Dismiss</button></div>))}</div>
              </div>
            )}
            
            {thirdAnalysis && thirdAnalysis.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                 <h3 className="text-lg font-semibold text-red-700 mb-4 flex items-center gap-2"><Search className="w-5 h-5" />Stage 3: Missing Reference Suggestions ({thirdAnalysis.length})</h3>
                 <div className="space-y-4">{thirdAnalysis.map((s, i) => (<div key={i} className="border border-red-200 rounded-lg p-4 bg-red-50"><div><strong>Missing Citation:</strong> {s.citation.original}</div><div className="space-y-2 mt-2">{s.candidates.map((c, ci) => (<div key={ci} className="bg-white p-3 rounded border-l-4 border-red-400"><div>"{c.text}"</div><div className="text-xs text-red-600 mb-2">Conf: {Math.round(c.confidence*100)}%</div><button onClick={() => markThirdAsMatch(i, c.text)} className="bg-green-600 text-white text-xs px-3 py-1 rounded">✓ Match</button></div>))}</div><button onClick={() => markThirdAsNonMatch(i)} className="mt-2 bg-red-600 text-white text-xs px-3 py-1 rounded"><X className="w-3 h-3 inline mr-1"/>Dismiss</button></div>))}</div>
              </div>
            )}
            
            {fourthAnalysis && fourthAnalysis.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-purple-700 mb-4 flex items-center gap-2"><Search className="w-5 h-5" />Stage 4: Lenient Matches ({fourthAnalysis.length})</h3>
                <div className="space-y-4">{fourthAnalysis.map((s, i) => (<div key={i} className="border border-purple-200 rounded-lg p-4 bg-purple-50"><div><strong>Unused Ref:</strong></div><div className="text-sm italic mb-3">{s.reference.original}</div><div className="space-y-2">{s.candidates.map((c, ci) => (<div key={ci} className="bg-white p-3 rounded border-l-4 border-purple-400"><div>"{c.text}"</div><div className="text-xs text-purple-600 mb-2">Conf: {Math.round(c.confidence*100)}% | Terms: {c.matchedTerms?.join(', ')}</div><button onClick={() => markFourthAsMatch(i, c.text)} className="bg-green-600 text-white text-xs px-3 py-1 rounded">✓ Match</button></div>))}</div><button onClick={() => markFourthAsNonMatch(i)} className="mt-2 bg-red-600 text-white text-xs px-3 py-1 rounded"><X className="w-3 h-3 inline mr-1"/>Dismiss</button></div>))}</div>
              </div>
            )}

            {results.missing.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-red-700 mb-4 flex items-center gap-2"><AlertCircle className="w-5 h-5" />Citations Without References ({results.missing.length})</h3>
                <div className="space-y-3">{results.missing.map((missing, index) => (<div key={index} className="border-l-4 border-red-500 pl-4 py-2 bg-red-50 rounded-r"><div className="font-medium text-gray-900">{missing.citation.original}</div></div>))}</div>
              </div>
            )}
            
            {results.unused.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2"><FileText className="w-5 h-5" />Unused References ({results.unused.length})</h3>
                <div className="space-y-3">{results.unused.map((unused, index) => (<div key={index} className="border-l-4 border-gray-500 pl-4 py-2 bg-gray-50 rounded-r"><div className="text-sm text-gray-800">{unused.reference.original}</div></div>))}</div>
              </div>
            )}
          </div>
        )}

        {!results && !isProcessing && (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              Paste your academic document above to start the 4-stage analysis.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferenceChecker;
