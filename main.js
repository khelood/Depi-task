const API_USERS = "https://jsonplaceholder.typicode.com/users";
const API_POSTS = "https://jsonplaceholder.typicode.com/posts";
const API_COMMENTS = "https://jsonplaceholder.typicode.com/comments";

// simple localStorage helpers
const ls = {
  get(k, d){ try{ return JSON.parse(localStorage.getItem(k)) ?? d }catch{ return d } },
  set(k,v){ localStorage.setItem(k, JSON.stringify(v)) }
};

// theme
function applyTheme(){
  const t = ls.get('theme','light');
  document.documentElement.setAttribute('data-theme', t);
  document.getElementById('themeToggle').textContent = t==='dark' ? '☀️ Light' : '🌙 Dark';
}
document.addEventListener('DOMContentLoaded', ()=>{
  applyTheme();
  document.getElementById('themeToggle').addEventListener('click', ()=>{
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    ls.set('theme', cur); applyTheme();
  });
});

// loader show/hide for ajax
$(document).ajaxStart(()=>$('#loader').removeClass('hidden'));
$(document).ajaxStop(()=>$('#loader').addClass('hidden'));

// navigation (single page)
const views = document.querySelectorAll('.view');
document.querySelectorAll('.menu button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.menu button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const v = btn.getAttribute('data-view');
    document.getElementById('viewTitle').textContent = btn.textContent;
    views.forEach(s=> s.id===v ? s.classList.remove('hidden') : s.classList.add('hidden'));
    // load content when opening view
    if(v==='users') loadUsers();
    if(v==='posts') loadPosts();
    if(v==='comments') loadComments();
  });
});

// Dashboard counts
function loadCounts(){
  $.get(API_USERS, d=>$('#usersCount').text(d.length));
  $.get(API_POSTS, d=>$('#postsCount').text(d.length));
  $.get(API_COMMENTS, d=>$('#commentsCount').text(d.length));
}
loadCounts();

// Users - DataTable with favorites + edit (local)
let usersTable = null;
const favKey = 'favUsers';
let favs = new Set(ls.get(favKey, []));

function favButton(id){ return `<button data-fav="${id}">${favs.has(id)?'⭐':'☆'}</button>` }

function loadUsers(){
  if(usersTable) return; // load once
  $.get(API_USERS, users=>{
    usersTable = $('#usersTable').DataTable({
      data: users,
      columns: [
        { title: "Fav", data: "id", render: id => favButton(id), orderable:false },
        { title: "ID", data: "id" },
        { title: "Name", data: "name" },
        { title: "Email", data: "email" },
        { title: "City", data: "address.city" },
        { title: "Actions", data:null, render: (r, t, row)=>`<button class="edit" data-id="${row.id}">Edit</button>` , orderable:false }
      ]
    });
    toastr.success('Users loaded');
    // delegate favorite clicks
    $('#usersTable').on('click','button[data-fav]', function(){
      const id = Number(this.getAttribute('data-fav'));
      if(favs.has(id)){ favs.delete(id); toastr.info('Removed favorite'); } else { favs.add(id); toastr.success('Added favorite'); }
      ls.set(favKey, Array.from(favs));
      $(this).html(favs.has(id)?'⭐':'☆');
    });
    // edit
    $('#usersTable').on('click','button.edit', function(){
      const id = Number(this.getAttribute('data-id'));
      const row = usersTable.rows().data().toArray().find(u=>u.id===id);
      const name = prompt('Edit name', row.name);
      if(name==null) return;
      const email = prompt('Edit email', row.email);
      if(email==null) return;
      row.name = name; row.email = email;
      usersTable.rows().every(function(){ this.invalidate(); });
      toastr.success('User updated locally');
    });
    // show favorites btn
    document.getElementById('showFavs').addEventListener('click', ()=>{
      const ids = Array.from(favs);
      if(!ids.length){ toastr.warning('No favorites'); return; }
      usersTable.column(1).search('^(' + ids.join('|') + ')$', true, false).draw();
    });
    document.getElementById('clearFavs').addEventListener('click', ()=>{
      favs.clear(); ls.set(favKey, []); usersTable.search('').columns().search('').draw(); toastr.info('Favorites cleared');
      $('#usersTable button[data-fav]').each(function(){ $(this).html('☆') });
    });
  });
}

// Posts - load, add, edit, delete locally + comments
let posts = [];
let nextId = 100000;
function renderPosts(list){
  const q = $('#searchPost').val().toLowerCase();
  const filtered = list.filter(p => p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q));
  const html = filtered.map(p=>`<div class="post">
    <h3>${escapeHtml(p.title)}</h3>
    <p>${escapeHtml(p.body)}</p>
    <div class="btns">
      <button data-edit="${p.id}">Edit</button>
      <button data-comments="${p.id}">Comments</button>
      <button class="danger" data-del="${p.id}">Delete</button>
    </div>
    <div id="comments-${p.id}" class="comments" style="display:none"></div>
  </div>`).join('');
  $('#postsContainer').html(html);
}

function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function loadPosts(){
  if(posts.length) { renderPosts(posts); return; }
  $.get(API_POSTS, data=>{ posts = data.slice(0,20); renderPosts(posts); toastr.success('Posts loaded'); });
}

$('#searchPost').on('input', ()=> renderPosts(posts));

$('#addPost').on('click', ()=>{
  const title = prompt('Post title'); if(!title) return;
  const body = prompt('Post body')||'';
  const p = { id: nextId++, title, body };
  posts.unshift(p); renderPosts(posts); toastr.success('Post added (local)');
});

$('#postsContainer').on('click','[data-del]', function(){
  const id = Number(this.getAttribute('data-del'));
  posts = posts.filter(p=>p.id!==id); renderPosts(posts); toastr.warning('Post deleted (local)');
});
$('#postsContainer').on('click','[data-edit]', function(){
  const id = Number(this.getAttribute('data-edit')); const p = posts.find(x=>x.id===id);
  const title = prompt('Edit title', p.title); if(title==null) return;
  const body = prompt('Edit body', p.body); if(body==null) return;
  p.title = title; p.body = body; renderPosts(posts); toastr.info('Post updated (local)');
});
$('#postsContainer').on('click','[data-comments]', function(){
  const id = Number(this.getAttribute('data-comments')); const box = $('#comments-'+id);
  if(box.is(':visible')) return box.slideUp(120);
  if(box.data('loaded')) return box.slideDown(120);
  $.get(API_COMMENTS + '?postId=' + id, cmts=>{
    if(!cmts.length) box.html('<em>No comments</em>');
    else box.html(cmts.slice(0,5).map(c=>`<div><strong>${escapeHtml(c.email)}</strong>: ${escapeHtml(c.body)}</div>`).join(''));
    box.data('loaded', true).slideDown(120);
  });
});

// Comments view
function loadComments(){
  if(document.getElementById('commentsList').dataset.loaded) return;
  $.get(API_COMMENTS, data=>{
    const list = data.slice(0,12).map(c=>`<div class="post"><strong>${escapeHtml(c.name)}</strong><br><small>${escapeHtml(c.email)}</small><p>${escapeHtml(c.body)}</p></div>`).join('');
    $('#commentsList').html(list); $('#commentsList').data('loaded', true);
  });
}

// initial load: dashboard counts already called; ensure DataTables CSS applied after load
$(document).ready(()=>{ /* nothing else */ });

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("modeToggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      document.body.classList.toggle("light-mode");
    });
  }
});
