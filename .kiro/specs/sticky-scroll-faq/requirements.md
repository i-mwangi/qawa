# Requirements Document

## Introduction

This feature transforms the traditional accordion-style FAQ section on the Chai Platform landing page into a modern sticky scroll FAQ with card rotations and animations, inspired by the HedFunds implementation. The new design creates a more engaging and visually dynamic user experience by displaying FAQ cards that stick to the viewport as users scroll, with each card having a unique rotation angle to create a tilted stack effect.

## Glossary

- **FAQ Section**: The Frequently Asked Questions section on the landing page that displays common questions and answers about the Chai Platform
- **Sticky Scroll**: A CSS positioning technique where elements remain fixed at a specific position in the viewport while scrolling through their container
- **Card Rotation**: CSS transform property that tilts FAQ cards at various angles to create visual interest
- **Accordion Functionality**: The current interactive behavior where clicking a question expands/collapses the answer
- **Viewport**: The visible area of the web page in the browser window
- **Glass Effect**: The current semi-transparent background styling with backdrop blur

## Requirements

### Requirement 1

**User Story:** As a website visitor, I want to see FAQ cards that remain visible as I scroll, so that I can easily read through all questions and answers without them disappearing from view.

#### Acceptance Criteria

1. WHEN the user scrolls through the FAQ section, THE FAQ Section SHALL position each card with sticky positioning at 160px from the top of the viewport
2. WHILE the user is scrolling through the FAQ section, THE FAQ Section SHALL maintain a minimum height of 100vh for the container
3. THE FAQ Section SHALL display all FAQ answers as permanently visible without requiring user interaction
4. THE FAQ Section SHALL space each FAQ card with 30vh gaps between them
5. THE FAQ Section SHALL remove all accordion expand/collapse functionality from the FAQ cards

### Requirement 2

**User Story:** As a website visitor, I want to see FAQ cards with varied rotation angles, so that the design feels more dynamic and visually interesting.

#### Acceptance Criteria

1. THE FAQ Section SHALL apply a 2-degree clockwise rotation to odd-numbered FAQ cards
2. THE FAQ Section SHALL apply a 2-degree counter-clockwise rotation to even-numbered FAQ cards
3. THE FAQ Section SHALL apply a 4-degree clockwise rotation to every third FAQ card
4. THE FAQ Section SHALL apply a 4-degree counter-clockwise rotation to every fourth FAQ card
5. THE FAQ Section SHALL ensure rotation transforms do not interfere with card readability

### Requirement 3

**User Story:** As a website visitor, I want FAQ cards to have clear, readable typography and solid backgrounds, so that I can easily read the content without visual distractions.

#### Acceptance Criteria

1. THE FAQ Section SHALL display FAQ question text with font-size of 1.25rem and font-weight of 700
2. THE FAQ Section SHALL provide 24px margin-bottom spacing below each question
3. THE FAQ Section SHALL replace the glass effect background with solid white background on FAQ cards
4. THE FAQ Section SHALL increase card padding to 40px on all sides
5. THE FAQ Section SHALL set minimum card height to 300px

### Requirement 4

**User Story:** As a website visitor, I want the FAQ section to work properly on mobile devices, so that I can access the information regardless of my device.

#### Acceptance Criteria

1. WHEN the viewport width is less than 768px, THE FAQ Section SHALL disable sticky positioning behavior
2. WHEN the viewport width is less than 768px, THE FAQ Section SHALL reduce or remove rotation angles for better mobile readability
3. THE FAQ Section SHALL ensure all FAQ content remains accessible and readable on small screens
4. THE FAQ Section SHALL maintain proper spacing and layout on mobile devices

### Requirement 5

**User Story:** As a developer, I want all accordion-related code removed, so that the codebase is clean and maintainable without unused functionality.

#### Acceptance Criteria

1. THE FAQ Section SHALL remove all JavaScript event listeners that handle .faq-item.active class toggling
2. THE FAQ Section SHALL remove the ::after arrow pseudo-element CSS from .faq-question
3. THE FAQ Section SHALL remove max-height transitions from .faq-answer
4. THE FAQ Section SHALL remove hover background effects from .faq-question
5. THE FAQ Section SHALL remove all CSS rules related to .faq-item.active state
