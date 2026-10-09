// Discord accounts explicitly trusted to enter the Admin Panel via Discord OAuth.
// Only add IDs belonging to people you trust with full administrator access.
export const OWNER_IDS = ['1373581087506301003', '896582112487043082'] as const

// Keep the primary owner ID for existing ticket/permission behavior.
export const OWNER_ID = OWNER_IDS[0]
