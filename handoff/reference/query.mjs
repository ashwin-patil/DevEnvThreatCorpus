import {readFileSync} from 'node:fs';
const c=JSON.parse(readFileSync(new URL('corpus.json',import.meta.url),'utf8'));
const [command='help',kind,id]=process.argv.slice(2);
const allowed=['campaigns','paths','evidence','sources','behaviors','frameworks','mappings','telemetry','detections','otel'];
let result;
if(command==='list'&&allowed.includes(kind))result=c[kind].map(e=>({id:e.id,name:e.name||e.title||e.claim,origin:e.origin,reviewStatus:e.reviewStatus}));
else if(command==='get'&&allowed.includes(kind)){result=c[kind].find(e=>e.id===id);if(!result){console.error('Entity not found');process.exit(1)}}
else if(command==='bundle'){
 const campaign=c.campaigns.find(e=>e.id===kind);if(!campaign){console.error('Campaign not found');process.exit(1)}
 const paths=c.paths.filter(p=>p.campaignId===campaign.id),evidence=c.evidence.filter(e=>e.campaignId===campaign.id),behaviorIds=new Set(paths.flatMap(p=>p.nodes.flatMap(n=>n.patternIds))),mappings=c.mappings.filter(m=>m.campaignId===campaign.id);
 result={schemaVersion:c.schemaVersion,buildDigest:c.build.digest,campaign,paths,evidence,sources:c.sources.filter(s=>campaign.sourceIds.includes(s.id)),behaviors:c.behaviors.filter(b=>behaviorIds.has(b.id)),mappings,frameworks:c.frameworks.filter(t=>mappings.some(m=>m.techniqueId===t.id)),telemetry:c.telemetry.filter(t=>behaviorIds.has(t.behaviorId)),detections:c.detections.filter(d=>behaviorIds.has(d.behaviorId)),otel:c.otel.filter(o=>behaviorIds.has(o.behaviorId)),consumerRules:c.governance.rules};
}else result={usage:['node query.mjs list evidence','node query.mjs get paths path-nx','node query.mjs bundle deadbugz'],policy:'Read-only. Bundles contain LLM-derived, unreviewed representations and synthetic telemetry proposals; cite evidence IDs and source locators.'};
console.log(JSON.stringify(result,null,2));
