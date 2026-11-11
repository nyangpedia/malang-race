// ================================================================
// Online server settings (Supabase). Both values are public by design: the database itself
// decides what each login may read or write (row level security + checked functions).
// Leave them empty and the game runs fully offline, saving only on this device.
// ================================================================
const ONLINE_CFG = { url: '/*SB_URL*/', key: '/*SB_KEY*/' };
