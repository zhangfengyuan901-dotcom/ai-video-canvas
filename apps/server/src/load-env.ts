// =========================================================================
// Load .env from project root — must be imported FIRST in index.ts
// ESM evaluates static imports in source order, so this module's
// side effect (config()) runs before other imports are evaluated.
// =========================================================================

import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(import.meta.dirname, "../../../.env") });
