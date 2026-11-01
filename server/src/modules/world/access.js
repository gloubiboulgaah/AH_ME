/** @format */
const db = require('../../db/pool');
async function currentRoom(user) {
 const {rows}=await db.query('SELECT id,visibility FROM servers WHERE is_active=true LIMIT 1');
 const room=rows[0];
 if(!room) return 'lobby';
 if(!user) return room.visibility==='public' ? `server:${room.id}` : null;
 const member=await db.query('SELECT 1 FROM server_members WHERE server_id=$1 AND user_id=$2',[room.id,user.id]);
 return member.rows.length ? `server:${room.id}` : null;
}
module.exports={currentRoom};
