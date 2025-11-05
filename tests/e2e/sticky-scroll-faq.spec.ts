/**
 * Visual and Functional Tests for Sticky Scroll FAQ Feature
 * Tests Requirements: 1.1, 1.4, 2.1, 2.2, 2.3, 2.4, 4.1, 4.2, 5.1
 * 
 * This test file validates the CSS implementation and DOM structure
 * of the sticky scroll FAQ feature by parsing the HTML file directly.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Sticky Scroll FAQ - Visual and Functional Tests', () => {
  const htmlContent = readFileSync(join(process.cwd(), 'frontend', 'index.html'), 'utf-8');

  describe('Requirement 1.1 & 1.4: Sticky Positioning and Spacing', () => {
    it('should have sticky positioning at 160px in CSS', () => {
      expect(htmlContent).toContain('position: sticky');
      expect(htmlContent).toContain('top: 160px');
    });

    it('should have 30vh gaps between FAQ cards', () => {
      expect(htmlContent).toContain('gap: 30vh');
    });

    it('should have flexbox layout for FAQ container', () => {
      const faqContainerRegex = /\.faq-container\s*{[^}]*display:\s*flex[^}]*flex-direction:\s*column[^}]*}/s;
      expect(htmlContent).toMatch(faqContainerRegex);
    });

    it('should have minimum height of 100vh for FAQ section', () => {
      const faqSectionRegex = /\.faq-section\s*{[^}]*min-height:\s*100vh[^}]*}/s;
      expect(htmlContent).toMatch(faqSectionRegex);
    });
  });

  describe('Requirement 2.1, 2.2, 2.3, 2.4: Card Rotations', () => {
    it('should apply rotation to odd-numbered cards', () => {
      expect(htmlContent).toContain('.faq-item:nth-child(odd)');
      expect(htmlContent).toMatch(/\.faq-item:nth-child\(odd\)\s*{[^}]*transform:\s*rotate\(2deg\)[^}]*}/s);
    });

    it('should apply rotation to even-numbered cards', () => {
      expect(htmlContent).toContain('.faq-item:nth-child(even)');
      expect(htmlContent).toMatch(/\.faq-item:nth-child\(even\)\s*{[^}]*transform:\s*rotate\(-2deg\)[^}]*}/s);
    });

    it('should apply rotation to every third card', () => {
      expect(htmlContent).toContain('.faq-item:nth-child(3n)');
      expect(htmlContent).toMatch(/\.faq-item:nth-child\(3n\)\s*{[^}]*transform:\s*rotate\(4deg\)[^}]*}/s);
    });

    it('should apply rotation to every fourth card', () => {
      expect(htmlContent).toContain('.faq-item:nth-child(4n)');
      expect(htmlContent).toMatch(/\.faq-item:nth-child\(4n\)\s*{[^}]*transform:\s*rotate\(-4deg\)[^}]*}/s);
    });
  });

  describe('Requirement 3: Typography and Styling', () => {
    it('should have correct question typography', () => {
      expect(htmlContent).toMatch(/font-size:\s*1\.25rem/);
      expect(htmlContent).toMatch(/font-weight:\s*700/);
      expect(htmlContent).toMatch(/margin-bottom:\s*24px/);
    });

    it('should have default cursor on questions (not pointer)', () => {
      expect(htmlContent).toMatch(/\.faq-question\s*{[^}]*cursor:\s*default[^}]*}/s);
    });

    it('should have solid white background on cards', () => {
      expect(htmlContent).toMatch(/\.faq-item\s*{[^}]*background:\s*white[^}]*}/s);
    });

    it('should have 40px padding on cards', () => {
      expect(htmlContent).toMatch(/\.faq-item\s*{[^}]*padding:\s*40px[^}]*}/s);
    });

    it('should have minimum height of 300px on cards', () => {
      expect(htmlContent).toMatch(/\.faq-item\s*{[^}]*min-height:\s*300px[^}]*}/s);
    });

    it('should have enhanced box shadow for depth', () => {
      expect(htmlContent).toMatch(/box-shadow:\s*0\s+8px\s+24px\s+rgba\(0,\s*0,\s*0,\s*0\.3\)/);
    });
  });

  describe('Requirement 4.1, 4.2: Mobile Responsive Behavior', () => {
    it('should have mobile media query at 768px', () => {
      expect(htmlContent).toContain('@media (max-width: 768px)');
    });

    it('should disable sticky positioning on mobile', () => {
      expect(htmlContent).toMatch(/position:\s*relative/);
    });

    it('should remove rotations on mobile', () => {
      expect(htmlContent).toMatch(/transform:\s*none/);
    });

    it('should reduce gap to 40px on mobile', () => {
      expect(htmlContent).toContain('gap: 40px');
    });
  });

  describe('Requirement 5.1: No Accordion Functionality', () => {
    it('should have all answers with max-height: none', () => {
      expect(htmlContent).toMatch(/\.faq-answer\s*{[^}]*max-height:\s*none[^}]*}/s);
    });

    it('should have all answers with overflow: visible', () => {
      expect(htmlContent).toMatch(/\.faq-answer\s*{[^}]*overflow:\s*visible[^}]*}/s);
    });

    it('should not have .faq-item.active CSS rules', () => {
      expect(htmlContent).not.toContain('.faq-item.active .faq-answer');
      expect(htmlContent).not.toContain('.faq-item.active .faq-question');
    });

    it('should not have ::after pseudo-element on questions', () => {
      expect(htmlContent).not.toContain('.faq-question::after');
    });

    it('should not have hover background effects on questions', () => {
      expect(htmlContent).not.toContain('.faq-question:hover');
    });

    it('should not have JavaScript accordion event listeners', () => {
      // Check that there's no code adding click handlers to FAQ items
      expect(htmlContent).not.toMatch(/\.faq-question.*addEventListener.*click/s);
      expect(htmlContent).not.toMatch(/\.faq-item.*addEventListener.*click/s);
      expect(htmlContent).not.toMatch(/querySelectorAll.*faq-question.*forEach/s);
    });
  });

  describe('DOM Structure Validation', () => {
    it('should have FAQ section with correct structure', () => {
      expect(htmlContent).toContain('<section class="faq-section"');
      expect(htmlContent).toContain('<div class="faq-container">');
      expect(htmlContent).toContain('<div class="faq-item">');
    });

    it('should have FAQ questions as h3 elements', () => {
      expect(htmlContent).toContain('<h3 class="faq-question">');
    });

    it('should have FAQ answers as p elements', () => {
      expect(htmlContent).toContain('<p class="faq-answer">');
    });

    it('should have multiple FAQ items', () => {
      const faqItemMatches = htmlContent.match(/<div class="faq-item">/g);
      expect(faqItemMatches).toBeTruthy();
      expect(faqItemMatches!.length).toBeGreaterThan(5);
    });

    it('should have all answers visible in HTML (not hidden)', () => {
      // Verify that answers are present in the HTML and not conditionally rendered
      const answerMatches = htmlContent.match(/<p class="faq-answer">/g);
      expect(answerMatches).toBeTruthy();
      expect(answerMatches!.length).toBeGreaterThan(5);
    });
  });

  describe('Browser Compatibility Fallback', () => {
    it('should have @supports fallback for sticky positioning', () => {
      expect(htmlContent).toContain('@supports not (position: sticky)');
    });

    it('should fallback to relative positioning when sticky is not supported', () => {
      const supportsRegex = /@supports\s+not\s+\(position:\s*sticky\)\s*{[^}]*\.faq-item\s*{[^}]*position:\s*relative[^}]*}/s;
      expect(htmlContent).toMatch(supportsRegex);
    });

    it('should remove transforms in fallback', () => {
      const supportsRegex = /@supports\s+not\s+\(position:\s*sticky\)[^}]*{[^}]*\.faq-item\s*{[^}]*transform:\s*none[^}]*}/s;
      expect(htmlContent).toMatch(supportsRegex);
    });
  });

  describe('Accessibility Validation', () => {
    it('should have semantic heading for FAQ section', () => {
      expect(htmlContent).toMatch(/<h2>Frequently Asked Questions<\/h2>/);
    });

    it('should use semantic HTML elements', () => {
      expect(htmlContent).toContain('<section');
      expect(htmlContent).toContain('<h3');
    });

    it('should have proper color contrast variables', () => {
      // Check that text colors are defined
      expect(htmlContent).toContain('--text-light');
      expect(htmlContent).toContain('--text-dark');
    });
  });
});
