/** @format */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validSignature}=require('../src/modules/desk-files/upload');
test('refuse les exécutables renommés en PDF',()=>{
 assert.equal(validSignature('.pdf',Buffer.from('MZxxxx')),false);
});
test('accepte un en-tête PDF correct',()=>{
 assert.equal(validSignature('.pdf',Buffer.from('%PDF-1.7')),true);
});
test('refuse les extensions dangereuses',()=>{
 assert.equal(validSignature('.exe',Buffer.from('MZxxxx')),false);
});
test('vérifie les signatures PNG',()=>{
 assert.equal(validSignature('.png',Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])),true);
 assert.equal(validSignature('.png',Buffer.from('fake png')),false);
});
