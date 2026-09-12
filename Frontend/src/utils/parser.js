/**
 * Parses a finding string emitted by a specialist agent conclude node.
 * Examples:
 * "- Insecure eval call in backend/app.py:123: user input is evaluated"
 * "- Hardcoded secret key found in config.py line 42"
 * "- Unused import 'sys' in main.py"
 */
export function parseFinding(rawString, category = 'security', index = 0) {
  if (!rawString) return null;
  const clean = rawString.replace(/^[-*•\d.)\s]+/, '').trim();
  if (!clean || clean.toUpperCase().includes('NONE CONFIRMED')) return null;

  // Detect file path and line number
  // Regex matches: relative/path/to/file.ext:123 or in file.ext line 123
  let filePath = null;
  let lineNumber = null;

  const fileLineMatch = clean.match(/(?:in\s+|at\s+)?([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)(?::(\d+)|(?:\s+line\s+(\d+)))/i);
  if (fileLineMatch) {
    filePath = fileLineMatch[1];
    lineNumber = fileLineMatch[2] || fileLineMatch[3] || null;
  } else {
    // Try just matching a file path
    const fileOnlyMatch = clean.match(/(?:in\s+|at\s+)?([a-zA-Z0-9_\-./\\]+\.(?:py|js|ts|jsx|tsx|json|yaml|yml|env|html|css|txt))/i);
    if (fileOnlyMatch) {
      filePath = fileOnlyMatch[1];
    }
  }

  // Determine severity
  let severity = 'medium';
  const lower = clean.toLowerCase();
  if (category === 'security') {
    if (lower.includes('critical') || lower.includes('rce') || lower.includes('injection') || lower.includes('secret') || lower.includes('credential')) {
      severity = 'critical';
    } else if (lower.includes('high') || lower.includes('auth') || lower.includes('ssrf') || lower.includes('deserialization')) {
      severity = 'high';
    } else {
      severity = 'medium';
    }
  } else if (category === 'performance') {
    if (lower.includes('n+1') || lower.includes('blocking') || lower.includes('leak') || lower.includes('deadlock')) {
      severity = 'high';
    } else if (lower.includes('redundant') || lower.includes('expensive') || lower.includes('cache')) {
      severity = 'medium';
    } else {
      severity = 'low';
    }
  } else {
    // Style
    if (lower.includes('unused') || lower.includes('dead code') || lower.includes('syntax')) {
      severity = 'medium';
    } else {
      severity = 'low';
    }
  }

  // Split into title and description
  let title = clean;
  let description = '';

  const splitIdx = clean.indexOf(': ');
  if (splitIdx > 0 && splitIdx < 90) {
    title = clean.substring(0, splitIdx).trim();
    description = clean.substring(splitIdx + 1).trim();
  } else if (clean.length > 90) {
    const periodIdx = clean.indexOf('. ');
    if (periodIdx > 0 && periodIdx < 120) {
      title = clean.substring(0, periodIdx + 1).trim();
      description = clean.substring(periodIdx + 2).trim();
    }
  }

  return {
    id: `${category}-${index}-${Math.abs(hashString(clean))}`,
    category,
    severity,
    raw: clean,
    title,
    description: description || clean,
    filePath,
    lineNumber,
  };
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/**
 * Parses the initial analysis string from analyzer node
 */
export function parseInitialAnalysis(text) {
  if (!text) return { verdict: null, cleanText: '' };
  const upper = text.toUpperCase();
  const hasIssues = upper.includes('VERDICT: ISSUES');
  const isClean = upper.includes('VERDICT: CLEAN');

  // Strip the trailing VERDICT line for cleaner display
  const cleanText = text
    .replace(/VERDICT:\s*(?:ISSUES|CLEAN)/gi, '')
    .trim();

  return {
    verdict: hasIssues ? 'ISSUES' : isClean ? 'CLEAN' : null,
    cleanText,
  };
}

