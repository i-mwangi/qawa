# Design Document

## Overview

This design transforms the Chai Platform's FAQ section from a traditional accordion interface into a modern sticky scroll experience with rotated cards. The implementation focuses on CSS-based solutions to create a visually engaging scroll experience where FAQ cards stack with varied rotations and remain visible as users scroll through the content.

The design removes all interactive JavaScript accordion functionality and replaces it with a purely visual, scroll-driven experience that showcases all FAQ content simultaneously.

## Architecture

### Component Structure

The FAQ section consists of three main layers:

1. **Container Layer** (`.faq-section`)
   - Provides the overall section wrapper with minimum viewport height
   - Establishes the scrollable context for sticky positioning

2. **Content Layer** (`.faq-container`)
   - Uses flexbox layout with vertical direction
   - Creates spacing between cards using gap property
   - Serves as the sticky positioning parent

3. **Card Layer** (`.faq-item`)
   - Individual FAQ cards with sticky positioning
   - Each card contains question and answer as always-visible content
   - Applies rotation transforms based on position

### Layout System

```
.faq-section (min-height: 100vh)
  └── .faq-container (display: flex, flex-direction: column, gap: 30vh)
        ├── .faq-item (position: sticky, top: 160px, transform: rotate(2deg))
        │     ├── .faq-question
        │     └── .faq-answer
        ├── .faq-item (position: sticky, top: 160px, transform: rotate(-2deg))
        │     ├── .faq-question
        │     └── .faq-answer
        └── ... (additional FAQ items)
```

## Components and Interfaces

### CSS Component: .faq-section

**Purpose:** Main container for the FAQ section

**Properties:**
- `min-height: 100vh` - Ensures sufficient scroll space
- `padding: 80px 20px` - Maintains existing spacing
- `background-color: transparent` - Preserves existing background

**Rationale:** The minimum viewport height ensures there's enough scroll distance for the sticky effect to work properly, creating the stacking visual as users scroll.

### CSS Component: .faq-container

**Purpose:** Flexbox container that spaces FAQ cards vertically

**Properties:**
- `display: flex`
- `flex-direction: column`
- `gap: 30vh` - Creates substantial vertical spacing between cards
- `max-width: 800px` - Maintains existing width constraint
- `margin: 0 auto` - Centers the container

**Rationale:** The 30vh gap creates enough space for the sticky scroll effect to be noticeable. As users scroll, cards will appear to "stack" on top of each other at the 160px mark before the next card pushes them up.

### CSS Component: .faq-item

**Purpose:** Individual FAQ card with sticky positioning and rotation

**Properties:**
- `position: sticky`
- `top: 160px` - Sticks below the navigation bar (80px) with additional spacing
- `background: white` - Solid background replacing glass effect
- `padding: 40px` - Increased from 22px for better readability
- `min-height: 300px` - Ensures cards have substantial presence
- `border-radius: 10px` - Maintains existing rounded corners
- `box-shadow: 0 8px 24px rgba(0,0,0,0.3)` - Enhanced shadow for depth
- `border: 1px solid var(--border-glass)` - Maintains existing border

**Rotation Variants:**
- `:nth-child(odd)` → `transform: rotate(2deg)`
- `:nth-child(even)` → `transform: rotate(-2deg)`
- `:nth-child(3n)` → `transform: rotate(4deg)`
- `:nth-child(4n)` → `transform: rotate(-4deg)`

**Rationale:** The sticky positioning at 160px accounts for the 80px navigation height plus additional spacing. Multiple nth-child selectors create varied rotations that compound, giving each card a unique tilt. The solid white background improves readability compared to the glass effect.

### CSS Component: .faq-question

**Purpose:** Question heading within each FAQ card

**Properties:**
- `font-size: 1.25rem` - Increased from 1.1rem
- `font-weight: 700` - Increased from 600
- `margin-bottom: 24px` - Increased from implicit spacing
- `color: var(--text-light)` - Maintains existing color
- `cursor: default` - Changed from pointer (no longer clickable)

**Removed Properties:**
- `cursor: pointer` - No longer needed without accordion
- `::after` pseudo-element - Arrow indicator removed
- `:hover` background effect - No interaction needed

**Rationale:** Larger, bolder typography improves hierarchy and readability. Removing interactive styling signals that cards are informational rather than interactive.

### CSS Component: .faq-answer

**Purpose:** Answer text within each FAQ card

**Properties:**
- `max-height: none` - Changed from 0 (always visible)
- `overflow: visible` - Changed from hidden
- `padding: 0` - Simplified from conditional padding
- `color: var(--text-dark)` - Maintains existing color
- `line-height: 1.7` - Maintains existing line height

**Removed Properties:**
- `max-height: 0` and transition - No longer needed
- Conditional padding based on `.active` state

**Rationale:** Making answers always visible eliminates the need for state management and transitions, simplifying the implementation while improving content accessibility.

## Data Models

No data models are required for this feature. All FAQ content remains in the existing HTML structure with no changes to the data layer.

## Error Handling

### Browser Compatibility

**Issue:** Older browsers may not support CSS `position: sticky`

**Solution:** Implement a fallback using `@supports` query:

```css
@supports not (position: sticky) {
  .faq-item {
    position: relative;
    transform: none;
  }
}
```

**Rationale:** Graceful degradation ensures the FAQ remains functional even if the sticky effect doesn't work, falling back to a standard vertical layout.

### Mobile Considerations

**Issue:** Sticky positioning and rotations may not work well on small screens

**Solution:** Disable sticky behavior and reduce rotations on mobile:

```css
@media (max-width: 768px) {
  .faq-container {
    gap: 40px; /* Reduced from 30vh */
  }
  
  .faq-item {
    position: relative; /* Disable sticky */
    transform: none; /* Remove rotations */
  }
}
```

**Rationale:** Mobile screens have limited vertical space, making sticky positioning less effective. Removing rotations improves readability on small screens.

## Testing Strategy

### Visual Testing

1. **Scroll Behavior Test**
   - Verify cards stick at 160px from top
   - Confirm cards stack properly as user scrolls
   - Check that cards don't overlap incorrectly

2. **Rotation Test**
   - Verify each card has the correct rotation angle
   - Confirm rotations don't make text unreadable
   - Check that rotations create visual variety

3. **Spacing Test**
   - Verify 30vh gaps create proper spacing
   - Confirm minimum height creates sufficient scroll space
   - Check that spacing works across different viewport heights

### Cross-Browser Testing

Test in the following browsers:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

Verify:
- Sticky positioning works correctly
- Rotations render properly
- Fallbacks work in unsupported browsers

### Responsive Testing

Test at the following breakpoints:
- Desktop: 1920px, 1440px, 1024px
- Tablet: 768px
- Mobile: 375px, 320px

Verify:
- Mobile fallback activates at 768px
- Content remains readable at all sizes
- Spacing adjusts appropriately

### Accessibility Testing

1. **Keyboard Navigation**
   - Verify FAQ content is accessible via keyboard
   - Confirm tab order is logical

2. **Screen Reader Testing**
   - Test with NVDA/JAWS on Windows
   - Verify all content is announced properly
   - Confirm semantic HTML structure is maintained

3. **Color Contrast**
   - Verify text meets WCAG AA standards (4.5:1 for normal text)
   - Check contrast on white background

### Performance Testing

1. **Scroll Performance**
   - Monitor frame rate during scrolling
   - Verify no jank or stuttering
   - Check that transforms don't cause repaints

2. **Paint Performance**
   - Use browser DevTools to check for excessive repaints
   - Verify sticky positioning doesn't cause layout thrashing

## Implementation Notes

### CSS Specificity

The new styles should override existing accordion styles. Ensure the new CSS is loaded after existing styles or use appropriate specificity.

### Transition Removal

All transition properties related to accordion functionality must be removed to prevent unexpected animations during the initial render.

### Content Accessibility

With answers always visible, ensure the FAQ section doesn't become overwhelming. The 30vh spacing helps create visual breathing room between cards.

### Future Enhancements (Optional)

While not required for the initial implementation, consider these potential enhancements:

1. **Scroll-triggered animations** - Fade in cards as they enter viewport
2. **Parallax effects** - Subtle movement of background elements
3. **Dynamic rotation** - Adjust rotation based on scroll position
4. **Smooth scroll** - Add smooth scrolling when clicking FAQ link in navigation

These enhancements would require JavaScript but are not necessary for the core sticky scroll functionality.
