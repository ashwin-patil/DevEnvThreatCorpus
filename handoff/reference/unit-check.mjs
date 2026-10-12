// Unit checks of authored view generation; this does not automate a browser.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const corpus=JSON.parse(readFileSync(new URL('corpus.json',import.meta.url),'utf8'));
const elements=new Map();
function el(id){if(!elements.has(id))elements.set(id,{value:id==='#scope'?'all':'',innerHTML:'',textContent:'',style:{},dataset:{},setAttribute(){},getBoundingClientRect(){return {width:920,height:430}},scrollIntoView(){},setPointerCapture(){}});return elements.get(id)}
const ctx={window:{CORPUS:corpus,addEventListener(){}},document:{querySelector:el,querySelectorAll:()=>[],getElementById:id=>el(id)},localStorage:{getItem:()=>null,setItem(){}},location:{hash:''},setTimeout(){},navigator:{clipboard:{writeText:async()=>{}}},console};
vm.createContext(ctx);vm.runInContext(readFileSync(new URL('app-v2.js',import.meta.url),'utf8'),ctx);
for(const route of ['paths','campaigns','patterns','atlas','telemetry','otel','sources','method']){ctx.location.hash='#'+route;vm.runInContext('readRoute()',ctx);assert(el('#content').innerHTML.length>100,route+' content missing');assert(!el('#content').innerHTML.includes('undefined'),route+' contains missing fields')}
for(const p of corpus.paths){ctx.location.hash='#paths/'+p.id+'/'+p.nodes.at(-1).id;vm.runInContext('readRoute()',ctx);assert(el('#content').innerHTML.includes(p.nodes.at(-1).title),'Node route failed');assert(el('#path-canvas').innerHTML.includes('data-edge'),'Graph edges missing')}
ctx.location.hash='#paths/path-deadbugz/deadbugz-4';vm.runInContext('readRoute()',ctx);assert(el('#content').innerHTML.includes('Intent only'));assert(!corpus.mappings.some(m=>m.campaignId==='deadbugz'&&m.techniqueId==='AML.T0086'),'Intent mapped to completed exfiltration');assert(!corpus.mappings.some(m=>m.nodeId==='nx-5'&&m.techniqueId==='AML.T0098'),'Package scanning mapped as agent retrieval');
el('#search').value='nonexistentxyz';ctx.location.hash='#paths';vm.runInContext('readRoute()',ctx);assert(el('#content').innerHTML.includes('No active paths match'));
el('#search').value='';el('#scope').value='Comparator';ctx.location.hash='#telemetry';vm.runInContext('readRoute()',ctx);assert(el('#content').innerHTML.includes('Operator → AI-driven intrusion commands'));assert(!el('#content').innerHTML.includes('Trusted install → code execution'));
console.log('PASS: 8 view generators, all 5 path routes, SVG edges, intent guardrails, empty search and scope filtering. Browser interaction and visual QA still required.');
