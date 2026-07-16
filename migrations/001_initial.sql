-- product-downloads-for-shop schema. Every table is prefixed pdl_ and all DDL is
-- idempotent (IF NOT EXISTS) so this file is both the fresh-install schema and
-- safe to re-run. Later schema changes ship as new numbered files (002_*.sql,
-- ...) rather than edits here: editing this one in place only ever reaches fresh
-- installs, never the sites already running.

-- One downloadable file attached to a product - a manual, a spec sheet, a care
-- card, an assembly drawing.
--
-- Deliberately NOT shp_digital_files, which is a different thing wearing a
-- similar hat: that is the product itself, sold and delivered against an order,
-- gated behind a token with an expiry and a download count. These are free
-- literature about the product, public to anyone on the page, and a shopper
-- reads them BEFORE deciding to buy. Sharing a table would mean one of the two
-- features permanently explaining why half its columns are null.
--
-- Cross-module foreign key to shp_products is safe because shop installs first
-- (requiresModules), so the referenced table always exists. ON DELETE CASCADE
-- means deleting a product takes its downloads with it.
CREATE TABLE IF NOT EXISTS "pdl_files" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "product_id" TEXT NOT NULL,
    -- What the site owner calls this file in plain English ("Assembly
    -- instructions"), and what the shopper sees and downloads it as. Separate
    -- from `filename` because "TZ-4491-rev-c-web.pdf" is what came off the
    -- supplier's website and is nobody's idea of a label.
    "name" TEXT NOT NULL,
    -- The name of the file as uploaded. Kept for the admin's sake, so a site
    -- owner can tell which of two similarly-named uploads is which, and as the
    -- fallback download name if `name` sanitises away to nothing.
    "filename" TEXT NOT NULL,
    -- Public url of the stored file. Not what the shopper is given: downloads
    -- are served through this module's own route so the file arrives under its
    -- proper name rather than under the storage key's. See
    -- app/api/public/files/[id]/route.ts.
    "url" TEXT NOT NULL,
    -- Provider + storage key, kept so a download can be read straight from the
    -- bucket with the server's own credentials, and so deleting a file can
    -- delete the blob rather than leaving it to rot. Reading by key is also what
    -- keeps downloads working after the media Worker moves to a new address -
    -- shop's digital files store only a url and every one of their links dies at
    -- that point.
    "media_provider" TEXT,
    "media_key" TEXT,
    -- The core Media row this file was recorded as, so it shows in the library in
    -- the product's own folder rather than being a file only this module can see.
    -- Nullable: a file whose library row has since been deleted still downloads.
    "media_id" TEXT,
    -- The type the file is served back as. Stored rather than derived, because
    -- the storage key's extension cannot be trusted to carry it: core builds that
    -- extension from the MIME subtype, so a .docx lands under a key ending
    -- ".vnd.openxmlformats-officedocument.wordprocessingml.document".
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pdl_files_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pdl_files_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "shp_products"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "pdl_files_product_id_idx" ON "pdl_files" ("product_id");
