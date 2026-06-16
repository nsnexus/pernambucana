const AUTH_USER = 'nsnexus';
const AUTH_PASS = '123456';
const AUTH_KEY = 'pernambucanaFinanceAuth';
const modal = document.getElementById('loginModal');
const form = document.getElementById('loginForm');
const error = document.getElementById('loginError');
const user = document.getElementById('loginUser');
const pass = document.getElementById('loginPass');

function openLogin(){
  if(sessionStorage.getItem(AUTH_KEY)==='ok'){
    window.location.href = 'painel.html';
    return;
  }
  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');
  setTimeout(()=>user.focus(),80);
}
function closeLogin(){
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden','true');
  form.reset();
  error.textContent = '';
}
document.querySelectorAll('[data-open-login]').forEach(btn=>btn.addEventListener('click',openLogin));
document.querySelectorAll('[data-close-login]').forEach(btn=>btn.addEventListener('click',closeLogin));
window.addEventListener('keydown', e=>{ if(e.key==='Escape' && modal.classList.contains('show')) closeLogin(); });
form.addEventListener('submit', e=>{
  e.preventDefault();
  const login = user.value.trim().toLowerCase();
  const password = pass.value.trim();
  if(login === AUTH_USER && password === AUTH_PASS){
    sessionStorage.setItem(AUTH_KEY,'ok');
    window.location.href = 'painel.html';
  }else{
    error.textContent = 'Login ou senha inválidos.';
    pass.select();
  }
});
if(new URLSearchParams(location.search).get('login')==='1') openLogin();

const reveals = document.querySelectorAll('.service-card,.management,.indicator-card,.section-title,.footer');
reveals.forEach(el=>el.classList.add('reveal'));
const io = new IntersectionObserver(entries=>{
  entries.forEach(entry=>{ if(entry.isIntersecting){ entry.target.classList.add('in'); io.unobserve(entry.target); } });
},{threshold:.12});
reveals.forEach(el=>io.observe(el));

const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');
let dots = [];
function resize(){
  canvas.width = innerWidth * devicePixelRatio;
  canvas.height = innerHeight * devicePixelRatio;
  canvas.style.width = innerWidth+'px'; canvas.style.height = innerHeight+'px';
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  const count = Math.min(90, Math.max(34, Math.floor(innerWidth/18)));
  dots = Array.from({length:count},()=>({x:Math.random()*innerWidth,y:Math.random()*innerHeight,vx:(Math.random()-.5)*.35,vy:(Math.random()-.5)*.35,r:Math.random()*1.8+0.6}));
}
function animate(){
  ctx.clearRect(0,0,innerWidth,innerHeight);
  for(const d of dots){
    d.x += d.vx; d.y += d.vy;
    if(d.x<0||d.x>innerWidth) d.vx*=-1;
    if(d.y<0||d.y>innerHeight) d.vy*=-1;
    ctx.beginPath(); ctx.arc(d.x,d.y,d.r,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,.45)'; ctx.fill();
  }
  for(let i=0;i<dots.length;i++) for(let j=i+1;j<dots.length;j++){
    const a=dots[i],b=dots[j],dx=a.x-b.x,dy=a.y-b.y,dist=Math.hypot(dx,dy);
    if(dist<120){ ctx.strokeStyle=`rgba(31,182,255,${(1-dist/120)*.16})`; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); }
  }
  requestAnimationFrame(animate);
}
addEventListener('resize',resize); resize(); animate();
