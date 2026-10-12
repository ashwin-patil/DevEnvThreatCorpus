# Fresh-start corpus architecture

## Decision

The 0.3.0 corpus is built from newly supplied source inputs. Existing 0.2.0
claims and records are not imported, migrated, or used to seed the new corpus.
The frozen prototype under `handoff/reference/` remains available as historical
reference material; it is not an input dataset or a compatibility target for
the new collection pipeline.

This current decision supersedes the migration proposal in the preserved
handoff documents for Issue #1. Those files remain unchanged as product-history
and design references.

## Intended data flow

The future operator-driven pipeline is expected to:

1. Register a newly supplied URL, text, or text file as a source, recording
   provenance and collection state.
2. Record each retrieved or supplied content version as a source revision with
   raw and normalized hashes and explicit retention metadata.
3. Extract or manually enter claims supported by exact passages and locators,
   or record explicit researcher inferences with their supporting claims.
4. Associate sources and claims with cases without inferring attribution from
   shared sources or similar URLs.
5. Add supported categorizations and timelines, preserving uncertainty,
   conflicts, date precision, and the distinction between publication and
   activity.
6. Submit proposed records for a future review workflow; acceptance requires
   current human review and matching content/dependency hashes.

## What this PR implements

This PR supplies the 0.3.0 JSON Schema, corresponding TypeScript declarations,
offline structural and relationship validation, deterministic identity and
serialization utilities, and visibly synthetic positive/negative fixtures.
Tests exercise these contracts; they are not processed blog records.

This PR does not fetch blogs, run extraction, persist authenticated reviewer
identity, provide review operations or UI, generate exports, or deploy the
pipeline. Those are follow-up implementation work. No legacy migration command,
migration fixture, or migration-only schema field is part of this design.

## Review and trust boundary

The validator can establish that records have the required shape and that
references and supplied hashes are internally consistent. A reviewer name and
hash in a record do not authenticate a person or prove research truth.
Authenticated review, append-only persistence, and release controls belong to
the future application/storage workflow.
