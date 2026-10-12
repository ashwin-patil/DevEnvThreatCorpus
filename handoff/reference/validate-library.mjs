import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const c=JSON.parse(readFileSync(new URL('corpus.json',import.meta.url),'utf8'));
const tables=['campaigns','paths','evidence','sources','behaviors','frameworks','mappings','telemetry','detections','otel'];
const sets=Object.fromEntries(tables.map(k=>{const s=new Set(c[k].map(e=>e.id));assert.equal(s.size,c[k].length,`Duplicate ${k} ID`);return [k,s]}));
const ref=(kind,id)=>assert(sets[kind].has(id),`Dangling ${kind} reference: ${id}`);
for(const s of c.sources)assert.equal(new URL(s.url).protocol,'https:');
for(const e of c.evidence){ref('sources',e.sourceId);ref('campaigns',e.campaignId);assert(e.claim&&e.locator&&e.status&&e.origin);assert.equal(e.reviewStatus,'Unreviewed')}
for(const ca of c.campaigns)for(const id of ca.pathIds){ref('paths',id);assert(c.paths.find(p=>p.id===id).campaignId===ca.id)}
for(const p of c.paths){ref('campaigns',p.campaignId);const nodes=new Set(p.nodes.map(n=>n.id));assert.equal(nodes.size,p.nodes.length);for(const n of p.nodes){assert(n.evidenceIds.length);for(const id of n.evidenceIds){ref('evidence',id);assert.equal(c.evidence.find(e=>e.id===id).campaignId,p.campaignId)}for(const id of n.patternIds)ref('behaviors',id)}for(const e of p.edges){assert(nodes.has(e.from)&&nodes.has(e.to));assert(e.origin&&e.relation);for(const id of e.evidenceIds)ref('evidence',id)}}
for(const m of c.mappings){ref('paths',m.pathId);ref('campaigns',m.campaignId);ref('behaviors',m.behaviorId);ref('frameworks',m.techniqueId);const p=c.paths.find(p=>p.id===m.pathId),n=p.nodes.find(n=>n.id===m.nodeId);assert(n&&n.patternIds.includes(m.behaviorId));assert.equal(p.campaignId,m.campaignId);assert(m.origin&&m.rationale&&m.applicability);for(const id of m.evidenceIds){ref('evidence',id);assert(n.evidenceIds.includes(id))}assert.equal(m.reviewStatus,'Unreviewed')}
for(const b of c.behaviors){for(const id of b.signalIds)ref('telemetry',id);for(const id of b.detectionIds)ref('detections',id);for(const id of b.otelIds)ref('otel',id)}
for(const t of c.telemetry){ref('behaviors',t.behaviorId);assert(t.logicalFields.length&&t.joinKeys.length&&t.availability)}
for(const d of c.detections){ref('behaviors',d.behaviorId);for(const id of d.signalIds)ref('telemetry',id);for(const id of d.otelIds)ref('otel',id);assert.equal(d.validation,'Untested hypothesis')}
for(const o of c.otel){ref('behaviors',o.behaviorId);assert(o.sampleOrigin.includes('synthetic'));assert(o.customFields.every(f=>f.startsWith('devthreat.')));assert(o.sample.Attributes['devthreat.synthetic']);assert(/^[0-9a-f]{32}$/.test(o.sample.TraceId));assert(/^[0-9a-f]{16}$/.test(o.sample.SpanId));for(const id of o.standardSourceIds)ref('sources',id)}
for(const f of c.frameworks)ref('sources',f.sourceId);
const ctx={window:{}};vm.runInNewContext(readFileSync(new URL('corpus.js',import.meta.url),'utf8'),ctx);assert.equal(JSON.stringify(ctx.window.CORPUS),JSON.stringify(c));
new vm.Script(readFileSync(new URL('app-v2.js',import.meta.url),'utf8'));
const rows=readFileSync(new URL('corpus.jsonl',import.meta.url),'utf8').trim().split('\n').map(JSON.parse);assert(rows.length>c.evidence.length);assert(rows.every(r=>r.schemaVersion===c.schemaVersion));
console.log('PASS: normalized references, case-specific mappings, provenance, synthetic labels, JSONL export and browser-data parity.');
