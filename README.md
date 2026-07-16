# Product Downloads for Shop

Downloadable files for the [Cactus](https://github.com/usersaynoso/cactus-foundation) shop. Attach the assembly instructions, a spec sheet, a care card or a drawing to a product, give each one a name in plain English, and they appear on the product page under a **Downloads** tab that anyone can take them from.

Requires the [shop](https://github.com/cactus-foundation-modules/shop) module (v0.1.47 or newer) and Cactus 0.5.472 or newer.

## What it does

- **A Downloads tab in the product editor.** Add files, name them, drag the order about, remove them. Everything saves as you go, so an upload is never something you can lose by changing tab.
- **A Downloads tab on the product page.** It sits in the product's own tab strip beside Description and Specification, dressed by whatever layout the page uses - not bolted underneath in a box that looks like an advert.
- **Names written for people, not for computers.** The file your supplier called `TZ-4491-rev-c-web-FINAL-v2.pdf` is called "Assembly instructions" on the page, and that is what it saves to the shopper's computer as. This is most of the point of the module.
- **Free to anyone.** These are the things a shopper reads *before* deciding to buy, so there is no login and no gate. Shop's own digital-product downloads are the other thing entirely - those are what you sold them, delivered after they have paid.
- **Nothing appears until you put it there.** A product with no files has no tab, and installing this module changes nothing about a shop until someone attaches something.
- **Filed with the pictures.** Uploads land in the media library under `Shop / <category> / <product> / downloads`, beside the product's own images rather than in a parallel tree you have to go looking for.

## Supported files

PDFs, Word/Excel/PowerPoint documents (old and new), RTF, plain text, CSV, DWG and DXF drawings, JPEG and PNG images, and ZIP archives.

There is deliberately no HTML, SVG or XML. This module hands stored files back from your own site's address, and a file type the browser will run as a web page is not a download, it is a way in.

## The 4 MB limit, and why

**Each file can be up to 4 MB.** That is not us being stingy; it is the hosting platform's ceiling on anything sent through your site, and it rejects a larger file before this module's code gets a look in.

Photographs and 3D models dodge this by going straight from the browser to your media storage, but that road is closed to a document: the media Worker works out what an upload is from its file extension and accepts only images and 3D models, so it turns a PDF away no matter how it is sent. Lifting the limit needs a Cactus release that teaches the Worker about documents, and every site owner to redeploy their Worker - so until then this module says 4 MB plainly rather than promising more and failing at the door.

Most manuals and spec sheets fit. A 200-page illustrated catalogue will not.

## How it hangs together

| Piece | Where |
| --- | --- |
| Admin tab | `shop.product-editor-sections` → `components/admin/ProductDownloadsSection` |
| Product page tab | `shop.product-detail-tabs` → `lib/detail-tab-provider` |
| Schema | `pdl_files` (see `migrations/001_initial.sql`) |
| Upload | `POST /api/m/product-downloads-for-shop/admin/products/<id>/files` |
| Download | `GET /api/m/product-downloads-for-shop/public/files/<id>` |

The module owns all of its own schema and interface. It adds not a column nor a control to shop, and a site running only shop sees no trace of it.

### Why downloads are served through this module

Rather than linking the shopper straight at storage, which would be less code. Cactus builds a stored file's name from its media type, so a `.docx` ends up under a key ending `.vnd.openxmlformats-officedocument.wordprocessingml.document`, with a random prefix for good measure. Link someone at that and they save a file their computer cannot open. The `download` attribute on a link would rename it, except browsers ignore that across origins, and storage is always another origin - so the name has to be set on the way out, which means the file has to come out through here.

While it is passing through, the route also checks that the product is actually on sale: a draft product's manual and a withdrawn product's spec sheet both stop being downloadable, which is the same line the product page itself draws.

## Notes

- A product page tab is contributed through `shop.product-detail-tabs`, which shop grew in v0.1.47 for this module. Any module can use it; see shop's `lib/detail-tabs.ts`.
- On a **digital** product that also carries free literature, shop's own "Downloads" tab (the thing you bought, available after purchase) and this module's "Downloads" tab appear side by side, both correct and both called the same thing. Rare, since it means selling an ebook that also has a manual, but worth knowing before it surprises you.

## Licence

MIT
