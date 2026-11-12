// Configure estes dois valores no arquivo config.js antes de publicar.
const CONFIG = window.RF_CONFIG || {};
const supabaseUrl = CONFIG.supabaseUrl;
const supabaseAnonKey = CONFIG.supabaseAnonKey;
const db = (supabaseUrl && supabaseAnonKey) ? window.supabase.createClient(supabaseUrl, supabaseAnonKey) : null;
const $ = id => document.getElementById(id);
let selectedTime = null, services = [], currentSession = null;
const times = ['09:00','09:30','10:00','10:30','11:00','11:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00'];
const now = new Date(); $('date').min = new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
function msg(id,text){$(id).style.display='block';$(id).textContent=text}
function requireDb(){if(!db){throw new Error('O site ainda não foi conectado ao Supabase. Siga o arquivo LEIA-ME.')}} 
async function loadServices(){if(!db){$('serviceSelect').innerHTML='<option>Configure o banco para carregar serviços</option>';return}
 const {data,error}=await db.from('services').select('*').eq('active',true).order('name');if(error)throw error;services=data||[];
 $('serviceSelect').innerHTML=services.map(s=>`<option value="${s.id}">${safe(s.name)} · R$ ${Number(s.price).toFixed(2).replace('.',',')}</option>`).join('');
 $('serviceCards').innerHTML=services.map(s=>`<article class="service"><h3>${safe(s.name)}</h3><p>${Number(s.duration_minutes)} minutos · R$ ${Number(s.price).toFixed(2).replace('.',',')}</p></article>`).join('')||'<p class="muted">Novos serviços em breve.</p>';
}
function safe(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function drawSlots(){selectedTime=null;$('slots').innerHTML='';if(!db||!$('date').value)return;
 const {data,error}=await db.rpc('get_busy_slots',{booking_date:$('date').value});if(error){msg('bookingMessage','Não foi possível consultar os horários. Tente novamente.');return}
 const busy=(data||[]).map(x=>x.start_time.slice(0,5));
 $('slots').innerHTML=times.map(t=>`<button class="slot" type="button" ${busy.includes(t)?'disabled':''} data-time="${t}">${t}</button>`).join('');
 $('slots').querySelectorAll('button:not(:disabled)').forEach(b=>b.addEventListener('click',()=>{selectedTime=b.dataset.time;$('slots').querySelectorAll('.slot').forEach(x=>x.classList.toggle('selected',x===b))}));
}
$('date').addEventListener('change',drawSlots);
$('bookingForm').addEventListener('submit',async e=>{e.preventDefault();try{requireDb();if(!selectedTime)throw new Error('Selecione um horário disponível.');
 const {error}=await db.from('appointments').insert({client_name:$('clientName').value.trim(),phone:$('phone').value.trim(),service_id:$('serviceSelect').value,booking_date:$('date').value,start_time:selectedTime,notes:$('notes').value.trim()});
 if(error)throw error;msg('bookingMessage','Pedido enviado! Aguarde a confirmação do salão pelo WhatsApp.');e.target.reset();selectedTime=null;await drawSlots();
 }catch(err){msg('bookingMessage',err.message||'Não foi possível enviar o pedido.')}});
$('adminOpen').onclick=()=>{$('adminPanel').classList.remove('hidden');$('adminPanel').scrollIntoView({behavior:'smooth'})};
$('loginBtn').onclick=async()=>{try{requireDb();const {data,error}=await db.auth.signInWithPassword({email:$('adminEmail').value,password:$('adminPassword').value});if(error)throw error;currentSession=data.session;$('loginBox').classList.add('hidden');$('dashboard').classList.remove('hidden');await renderAppointments()}catch(e){msg('loginMessage',e.message)}};
$('logoutBtn').onclick=async()=>{await db.auth.signOut();currentSession=null;$('dashboard').classList.add('hidden');$('loginBox').classList.remove('hidden')};
$('refreshBtn').onclick=renderAppointments;
async function renderAppointments(){try{const {data,error}=await db.from('appointments').select('id,client_name,phone,booking_date,start_time,status,notes,services(name)').order('booking_date').order('start_time');if(error)throw error;
 $('appointments').innerHTML=(data||[]).map(a=>`<article class="appointment"><div><b>${safe(a.client_name)}</b><br><small>${safe(a.phone)} · ${safe(a.services?.name||'Serviço')}<br>${safe(a.booking_date)} às ${safe(a.start_time)} · ${safe(a.status)}${a.notes?'<br>Obs.: '+safe(a.notes):''}</small></div><div class="actions"><button data-id="${a.id}" data-status="confirmed">Confirmar</button><button class="secondary" data-id="${a.id}" data-status="cancelled">Cancelar</button></div></article>`).join('')||'<p class="muted">Nenhum agendamento encontrado.</p>';
 $('appointments').querySelectorAll('button').forEach(b=>b.onclick=()=>updateStatus(b.dataset.id,b.dataset.status));
 }catch(e){$('appointments').textContent=e.message}}
async function updateStatus(id,status){const {error}=await db.from('appointments').update({status}).eq('id',id);if(error)alert(error.message);else renderAppointments()}
$('addService').onclick=async()=>{try{const {error}=await db.from('services').insert({name:$('newService').value.trim(),price:Number($('newPrice').value),duration_minutes:Number($('newDuration').value)});if(error)throw error;msg('serviceMessage','Serviço cadastrado.');$('newService').value='';$('newPrice').value='';await loadServices()}catch(e){msg('serviceMessage',e.message)}};
(async()=>{try{await loadServices();await drawSlots()}catch(e){console.error(e)}})();