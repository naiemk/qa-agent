# Create a pay link

area: commerce
start: /create
priority: 1

## Steps
- In "Who are you billing?" enter Acme QA
- In "What's this for?" enter QA retainer
- Leave Amount at 10.00
- Click "Add details (optional)"
- In "EVM merchant wallet" enter 0x1111111111111111111111111111111111111111
- Click "Create pay link"

## Expected
- A dialog says the payment link is ready

## Criteria
- text_visible: Your payment link is ready
- dialog_open: true
