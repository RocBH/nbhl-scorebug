# NBHL scorebug source backup

Source snapshot: de1f54ef2c8db0dadc2145270bff47fa322b502b (October 14, 2026).

This backup contains application source, overlay graphics, dependency lockfiles, and database schema/migrations. Generated deployment archives, build caches, dependencies, and local environment files are excluded.

Production: https://nbhl-obs-scorebug.mpdzs7g8b7.chatgpt.site/
Control board: https://nbhl-obs-scorebug.mpdzs7g8b7.chatgpt.site/control

Live Cloudflare D1 records (game logs, users, settings) and R2 uploads (sponsor logos) remain in the hosted service and are not included. Database migrations recreate the schema, not those records. Restoring the full live state requires separate D1 and R2 exports.

The existing README describes local setup. The `.openai/hosting.json` manifest identifies the existing Site; this backup does not switch its hosting or automatically synchronize future edits to GitHub.
