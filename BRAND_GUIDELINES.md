# 🎨 Brand Guidelines - newfurniture.live

## Typography Hierarchy

### Primary Font
**Inter** - Clean, modern, highly readable sans-serif font
- Source: Google Fonts
- Weights: 300 (Light), 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold)

### Font Hierarchy

#### Level 1: Main Headlines (H1)
- **Size**: 2rem (32px)
- **Weight**: 600 (SemiBold)
- **Usage**: Page titles, main dashboard headings
- **Color**: `#e6edf3` (Primary text)
- **Line Height**: 1.2

#### Level 2: Section Headlines (H2)
- **Size**: 1.5rem (24px)
- **Weight**: 600 (SemiBold)
- **Usage**: Section titles, card headers
- **Color**: `#e6edf3` (Primary text)
- **Line Height**: 1.3

#### Level 3: Sub Headlines (H3)
- **Size**: 1.2rem (19.2px)
- **Weight**: 500 (Medium)
- **Usage**: Sub-section titles, modal headers
- **Color**: `#e6edf3` (Primary text)
- **Line Height**: 1.4

#### Level 4: Card Titles (H4)
- **Size**: 1.1rem (17.6px)
- **Weight**: 600 (SemiBold)
- **Usage**: Furniture titles, request titles
- **Color**: `#e6edf3` (Primary text)
- **Line Height**: 1.4

#### Body Text - Large
- **Size**: 1rem (16px)
- **Weight**: 400 (Regular)
- **Usage**: Main content, descriptions
- **Color**: `#e6edf3` (Primary text)
- **Line Height**: 1.5

#### Body Text - Regular
- **Size**: 0.9rem (14.4px)
- **Weight**: 400 (Regular)
- **Usage**: General content, navigation labels
- **Color**: `#e6edf3` (Primary text)
- **Line Height**: 1.5

#### Body Text - Small
- **Size**: 0.85rem (13.6px)
- **Weight**: 400 (Regular)
- **Usage**: Meta information, secondary details
- **Color**: `#7d8590` (Secondary text)
- **Line Height**: 1.4

#### Caption Text
- **Size**: 0.75rem (12px)
- **Weight**: 500 (Medium)
- **Usage**: Labels, badges, status indicators
- **Color**: `#7d8590` (Secondary text)
- **Line Height**: 1.3

### Responsive Typography

#### Mobile (≤768px)
- H1: 1.8rem → 1.5rem
- H2: 1.3rem → 1.2rem
- H3: 1.1rem → 1rem
- Body: Maintain sizes but increase line-height by 0.1

#### Small Mobile (≤480px)
- H1: 1.5rem → 1.3rem
- H2: 1.2rem → 1.1rem
- H3: 1rem → 0.95rem
- Reduce margins and padding

## Color Palette

### Primary Colors
- **Background Dark**: `#0a0c10` (Main background)
- **Background Medium**: `#0d1117` (Card backgrounds)
- **Background Light**: `#111418` (Elevated elements)

### Text Colors
- **Primary Text**: `#e6edf3` (Main content)
- **Secondary Text**: `#7d8590` (Meta information)
- **Accent Blue**: `#58a6ff` (Links, primary actions)
- **Accent Light Blue**: `#79c0ff` (Hover states)

### Status Colors
- **Success**: `#3fb950` (Completed, success states)
- **Warning**: `#d29922` (Pending, warning states)
- **Error**: `#f85149` (Error, danger states)
- **Info**: `#58a6ff` (Information, neutral states)

### Gradient Colors
```css
/* Primary Gradient */
background: linear-gradient(135deg, #58a6ff, #79c0ff);

/* Card Background */
background: linear-gradient(135deg, rgba(22, 27, 34, 0.95) 0%, rgba(30, 35, 42, 0.9) 100%);

/* Subtle Accent */
background: radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.1) 0%, transparent 50%);
```

## Spacing System

### Base Unit: 8px

#### Spacing Scale
- **xs**: 4px (0.25rem)
- **sm**: 8px (0.5rem)
- **md**: 16px (1rem)
- **lg**: 24px (1.5rem)
- **xl**: 32px (2rem)
- **2xl**: 48px (3rem)
- **3xl**: 64px (4rem)

#### Component Spacing
- **Card Padding**: 20px-24px
- **Section Margins**: 30px-40px
- **Element Gaps**: 12px-20px
- **Button Padding**: 12px 24px

## Component Styles

### Buttons

#### Primary Button
```css
.action-button.primary {
    background: linear-gradient(135deg, #58a6ff, #79c0ff);
    color: white;
    font-weight: 500;
    font-size: 0.9rem;
    padding: 12px 24px;
    border-radius: 12px;
    border: none;
    transition: all 0.2s ease;
}
```

#### Secondary Button
```css
.action-button.secondary {
    background: rgba(88, 166, 255, 0.1);
    border: 1px solid rgba(88, 166, 255, 0.3);
    color: #58a6ff;
    font-weight: 500;
    font-size: 0.9rem;
    padding: 12px 24px;
    border-radius: 12px;
    transition: all 0.2s ease;
}
```

### Cards
```css
.card {
    background: linear-gradient(135deg, rgba(22, 27, 34, 0.95) 0%, rgba(30, 35, 42, 0.9) 100%);
    border: 1px solid rgba(240, 246, 252, 0.2);
    border-radius: 16px;
    padding: 24px;
    backdrop-filter: blur(20px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}
```

### Navigation
```css
.nav-item {
    font-size: 0.9rem;
    font-weight: 400;
    color: #e6edf3;
    padding: 12px 16px;
    border-radius: 12px;
    transition: all 0.2s ease;
}

.nav-item.active {
    background: rgba(88, 166, 255, 0.15);
    color: #58a6ff;
    font-weight: 500;
}
```

## Layout Principles

### Grid System
- **Desktop**: 12-column grid with 20px gutters
- **Tablet**: 8-column grid with 16px gutters  
- **Mobile**: 4-column grid with 12px gutters

### Breakpoints
```css
/* Mobile First */
@media (min-width: 480px) { /* Small mobile */ }
@media (min-width: 768px) { /* Tablet */ }
@media (min-width: 1024px) { /* Desktop */ }
@media (min-width: 1200px) { /* Large desktop */ }
```

### Container Widths
- **Mobile**: 100% with 16px padding
- **Tablet**: 100% with 24px padding
- **Desktop**: 1200px max-width, centered

## Icon Guidelines

### Icon Style
- **Style**: Emoji-based icons for consistency and modern appeal
- **Size**: 1.1em relative to parent text size
- **Color**: Inherit from parent or use accent colors

### Common Icons
- 🪑 Furniture/Collection
- 📝 Requests/Forms
- 🎨 Design/Brand Settings  
- 👥 Users/People
- 📊 Analytics/Stats
- ⚙️ Settings/Config
- 🔄 Refresh/Sync
- ✅ Success/Complete
- ⏳ Pending/Loading
- 📤 Upload
- 👁️ View/Preview

## Implementation Guidelines

### CSS Organization
```css
/* 1. CSS Reset/Normalize */
/* 2. CSS Custom Properties (Variables) */
/* 3. Base Typography */
/* 4. Layout Components */
/* 5. UI Components */
/* 6. Utilities */
/* 7. Responsive Overrides */
```

### CSS Variables
```css
:root {
    /* Typography */
    --font-family: 'Inter', sans-serif;
    --font-size-xs: 0.75rem;
    --font-size-sm: 0.85rem;
    --font-size-base: 0.9rem;
    --font-size-lg: 1rem;
    --font-size-xl: 1.2rem;
    --font-size-2xl: 1.5rem;
    --font-size-3xl: 2rem;
    
    /* Colors */
    --color-text-primary: #e6edf3;
    --color-text-secondary: #7d8590;
    --color-accent: #58a6ff;
    --color-accent-light: #79c0ff;
    
    /* Spacing */
    --space-xs: 4px;
    --space-sm: 8px;
    --space-md: 16px;
    --space-lg: 24px;
    --space-xl: 32px;
}
```

## Quality Checklist

### Typography
- [ ] Consistent font family (Inter) across all pages
- [ ] Proper font hierarchy implemented
- [ ] Readable contrast ratios (4.5:1 minimum)
- [ ] Responsive font sizes for mobile

### Colors
- [ ] Consistent color palette usage
- [ ] Proper contrast for accessibility
- [ ] Status colors used consistently
- [ ] Gradient usage follows guidelines

### Spacing
- [ ] Consistent spacing units (8px base)
- [ ] Proper component spacing
- [ ] Responsive margins and padding
- [ ] Visual breathing room maintained

### Components
- [ ] Button styles consistent
- [ ] Card designs uniform
- [ ] Navigation patterns match
- [ ] Interactive states defined

---

**Last Updated**: January 2025
**Version**: 1.0.0
**Maintained By**: AR Furniture Platform Team