# Preserve originals and version HTML decoding

Public HTML can contain NUL bytes in framework-generated bootstrap content.
Rejecting those bytes before article parsing can discard an otherwise readable
report, as the Nx postmortem demonstrated. HTML compatibility and plain-text
validation need distinct rules: retain the original response privately with its
hash, replace NULs only in the HTML parsing projection, and keep fatal malformed
UTF-8 and plain/supplied-text rejection intact. Never execute page scripts.

Changes to the parsing projection require a new parser version and validation
of earlier revisions under their original transformations. Do not rewrite old
passages or evidence offsets to match a new parser. Regression tests should
cover original archive/hash preservation, normalized text, supported charsets,
repeat intake identity, and continued rejection of invalid plain text.

Fixture success alone does not establish publisher compatibility. Test a real
permitted source in a network-capable environment, inspect per-image results,
and distinguish unavailable agent DNS from application parsing errors. Keep
real source bodies, assets, and private corpus files out of Git and public test
logs; use synthetic regression snippets and report source URLs/outcomes only.
