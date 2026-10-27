# Broken pay link leads back to Create invoice

area: commerce
start: /pay
priority: 2
lens: empty-or-error

## Steps
- The page says the pay link is missing
- Click the "Create invoice" link

## Expected
- The create invoice page is shown

## Criteria
- url_includes: /create
- text_visible: Invoice in a minute.
