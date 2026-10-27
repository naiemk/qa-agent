# Invalid merchant wallet is rejected

area: commerce
start: /create
priority: 1
lens: invalid-input

## Steps
- Click "Add details (optional)"
- In "EVM merchant wallet" enter 0x123
- Do not click "Create pay link"

## Expected
- An error says the EVM address must be a 0x-prefixed 40-hex-character address

## Criteria
- text_visible: EVM address must be a 0x-prefixed 40-hex-character address
