/** @format */
const {players}=require('../world/socket');
const messages=require('./service');
const MAX_LEN=300;
function attach(io,socket) {
 let lastChatAt=0,lastPrivateAt=0,lastWaveAt=0;
 const sender=()=>players.get(socket.id);
 const sameRoom=(id)=>players.get(id)?.room===socket.data.room;
 socket.on('chatMessage',message=>{
  const player=sender();if(!player||typeof message!=='string'||Date.now()-lastChatAt<350)return;
  const body=message.trim().slice(0,MAX_LEN);if(!body)return;lastChatAt=Date.now();
  io.to(socket.data.room).emit('chatMessage',{playerId:socket.id,username:player.username,message:body,timestamp:Date.now()});
 });
 socket.on('privateMessage',async data=>{
  const player=sender();if(!player||!data||typeof data.message!=='string'||Date.now()-lastPrivateAt<350)return;
  const body=data.message.trim().slice(0,MAX_LEN);if(!body)return;
  const target=players.get(data.to);
  const offlineUserId=Number.isSafeInteger(data.toUserId) && data.toUserId>0 ? data.toUserId : null;
  if(target && (!sameRoom(data.to)||data.to===socket.id))return;
  if(!target && !(player.userId && offlineUserId))return;
  if(offlineUserId && target && target.userId !== offlineUserId)return;
  lastPrivateAt=Date.now();
  if(player.userId&&(target?.userId||offlineUserId)) {
   try {
    const saved=await messages.send(player.userId,target?.userId||offlineUserId,body);
    const event={from:socket.id,fromUserId:player.userId,fromUsername:player.username,message:body,timestamp:new Date(saved.created_at).getTime(),messageId:saved.id};
    if(target) io.to(data.to).emit('privateMessage',event);
    socket.emit('privateMessageSent',{to:data.to,toUserId:target?.userId||offlineUserId,message:body,timestamp:event.timestamp,messageId:saved.id});
   }catch(err){console.error('private message:',err.message);socket.emit('privateMessageError','Envoi impossible');}
  }else if(target) {
   io.to(data.to).emit('privateMessage',{from:socket.id,fromUsername:player.username,message:body,timestamp:Date.now()});
   socket.emit('privateMessageSent',{to:data.to,message:body,timestamp:Date.now()});
  }
 });
 socket.on('privateMessageHistory',async()=>{
  if(!socket.data.user)return;
  try {socket.emit('privateMessageHistory',await messages.inbox(socket.data.user.id));}
  catch(err){console.error('private message history:',err.message);}
 });
 socket.on('privateMessageRead',async data=>{
  if(!socket.data.user||!Number.isSafeInteger(data?.userId))return;
  try{await messages.markRead(socket.data.user.id,data.userId);}catch(err){console.error('message read:',err.message);}
 });
 socket.on('emote',data=>{
  const player=sender();if(!player||!data||data.type!=='wave'||!sameRoom(data.to)||data.to===socket.id||Date.now()-lastWaveAt<1000)return;
  lastWaveAt=Date.now();
  const event={from:socket.id,fromUsername:player.username,type:'wave',timestamp:Date.now()};
  io.to(data.to).emit('emote',event);socket.emit('emote',event);
 });
}
module.exports={attach};
