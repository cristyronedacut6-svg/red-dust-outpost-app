// decompress KHR_draco_mesh_compression in a .glb -> plain .glb (for the offline model baker)
const fs = require('fs'), draco3d = require('/home/claude/draco/javascript/npm/draco3d/draco3d.js');
const [, , inp, out] = process.argv;
draco3d.createDecoderModule({}).then(M => {
  const b = fs.readFileSync(inp); let o = 12, J = null, BIN = null;
  while (o < b.length) { const cl = b.readUInt32LE(o), ct = b.readUInt32LE(o + 4), d = b.subarray(o + 8, o + 8 + cl); o += 8 + cl; if (ct === 0x4E4F534A) J = JSON.parse(d.toString()); else if (ct === 0x004E4942) BIN = d; }
  const chunks = [Buffer.from(BIN)]; let len = BIN.length; const pad = () => { const p = (4 - len % 4) % 4; if (p) { chunks.push(Buffer.alloc(p)); len += p; } };
  const addView = (buf) => { pad(); const bv = { buffer: 0, byteOffset: len, byteLength: buf.length }; chunks.push(buf); len += buf.length; J.bufferViews.push(bv); return J.bufferViews.length - 1; };
  const dec = new M.Decoder(); let nprim = 0;
  for (const mesh of J.meshes || []) for (const pr of mesh.primitives) {
    const ex = pr.extensions && pr.extensions.KHR_draco_mesh_compression; if (!ex) continue;
    const bv = J.bufferViews[ex.bufferView], data = BIN.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
    const db = new M.DecoderBuffer(); db.Init(new Int8Array(data.buffer, data.byteOffset, data.byteLength), data.byteLength);
    const m = new M.Mesh(); const st = dec.DecodeBufferToMesh(db, m); if (!st.ok()) throw new Error('draco ' + st.error_msg());
    const nf = m.num_faces(), np = m.num_points(), ia = new M.DracoInt32Array(), idx = new Uint32Array(nf * 3);
    for (let i = 0; i < nf; i++) { dec.GetFaceFromMesh(m, i, ia); idx[i * 3] = ia.GetValue(0); idx[i * 3 + 1] = ia.GetValue(1); idx[i * 3 + 2] = ia.GetValue(2); }
    const iv = addView(Buffer.from(idx.buffer)); J.accessors.push({ bufferView: iv, componentType: 5125, count: idx.length, type: 'SCALAR' }); pr.indices = J.accessors.length - 1;
    for (const [name, uid] of Object.entries(ex.attributes)) {
      const att = dec.GetAttributeByUniqueId(m, uid), nc = att.num_components(), arr = new M.DracoFloat32Array(); dec.GetAttributeFloatForAllPoints(m, att, arr);
      const f = new Float32Array(np * nc); for (let i = 0; i < f.length; i++) f[i] = arr.GetValue(i); M.destroy(arr);
      const v = addView(Buffer.from(f.buffer)); J.accessors.push({ bufferView: v, componentType: 5126, count: np, type: ['SCALAR', 'VEC2', 'VEC3', 'VEC4'][nc - 1] }); pr.attributes[name] = J.accessors.length - 1;
    }
    delete pr.extensions.KHR_draco_mesh_compression; M.destroy(m); M.destroy(db); M.destroy(ia); nprim++;
  }
  pad(); const nb = Buffer.concat(chunks); J.buffers = [{ byteLength: nb.length }];
  let js = Buffer.from(JSON.stringify(J)); const jp = (4 - js.length % 4) % 4; js = Buffer.concat([js, Buffer.alloc(jp, 32)]);
  const hdr = Buffer.alloc(12); hdr.write('glTF', 0); hdr.writeUInt32LE(2, 4); hdr.writeUInt32LE(12 + 8 + js.length + 8 + nb.length, 8);
  const h1 = Buffer.alloc(8); h1.writeUInt32LE(js.length, 0); h1.writeUInt32LE(0x4E4F534A, 4); const h2 = Buffer.alloc(8); h2.writeUInt32LE(nb.length, 0); h2.writeUInt32LE(0x004E4942, 4);
  fs.writeFileSync(out, Buffer.concat([hdr, h1, js, h2, nb])); console.log('ok', out.split('/').pop(), nprim, 'primitives');
});
