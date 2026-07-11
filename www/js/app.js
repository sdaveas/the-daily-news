(function(){
  var config = null;

  function esc(s){return (s||'').replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function host(u){try{return new URL(u).hostname.replace('www.','')}catch(e){return ''}}

  function setDate(){
    var d=new Date();
    var opts={weekday:'long',year:'numeric',month:'long',day:'numeric'};
    document.getElementById('date').textContent=d.toLocaleDateString('en-GB',opts);
  }

  function renderSection(sec, cfg){
    var w=document.createElement('div');
    w.className='section-window';
    var h3=document.createElement('h3');
    h3.textContent=sec.title;
    w.appendChild(h3);

    var lead = (cfg && cfg.lead === false) ? null : sec.lead;
    var items=sec.items||[];
    if(!lead && items.length===0){
      var empty=document.createElement('div');
      empty.className='empty';
      empty.textContent='No headlines yet.';
      w.appendChild(empty);
      return w;
    }

    if(lead){
      var lh=document.createElement('div');
      lh.className='lead-head';
      lh.innerHTML='<a href="'+esc(lead.url)+'" target="_blank" rel="noopener">'+esc(lead.title)+'</a>';
      w.appendChild(lh);
      if(lead.snippet){
        var ls=document.createElement('div');
        ls.className='lead-snippet';
        ls.textContent=lead.snippet;
        w.appendChild(ls);
      }
      var lsrc=document.createElement('div');
      lsrc.className='lead-src';
      lsrc.textContent=host(lead.url);
      w.appendChild(lsrc);
    }

    if(items.length){
      var ul=document.createElement('ul');
      ul.className='subs';
      items.forEach(function(it){
        var li=document.createElement('li');
        var a=document.createElement('a');
        a.href=it.url;a.target='_blank';a.rel='noopener';
        a.textContent=it.title;
        li.appendChild(a);
        var s=document.createElement('div');
        s.className='sub-src';
        s.textContent=host(it.url);
        li.appendChild(s);
        ul.appendChild(li);
      });
      w.appendChild(ul);
    }
    return w;
  }

  function render(){
    setDate();
    fetch('data/news.json?_='+Date.now())
      .then(function(r){if(!r.ok)throw new Error(r.status);return r.json()})
      .then(function(data){
        var byId={};
        (data.sections||[]).forEach(function(s){byId[s.id]=s});
        var content=document.getElementById('content');
        content.innerHTML='';
        var grid=document.createElement('div');
        grid.className='grid-sections';
        var sections = (config && config.sections) || [];
        sections.forEach(function(cfg){
          var sec=byId[cfg.id]||{id:cfg.id,title:cfg.title,lead:null,items:[]};
          sec.title=cfg.title;
          grid.appendChild(renderSection(sec, cfg));
        });
        content.appendChild(grid);
        if(data.updated){
          var u=new Date(data.updated);
          document.getElementById('updated').textContent='Updated '+u.toLocaleString('en-GB');
        }
      })
      .catch(function(){
        document.getElementById('content').innerHTML='<div class="status-msg">No edition available yet. Open settings to configure sections.</div>';
      });
  }

  function refresh(){
    if(STATIC){alert('Live refresh not available on GitHub Pages. Content updates every 4h via CI.');return;}
    fetch('/refresh',{method:'POST'})
      .then(function(r){return r.json()})
      .then(function(){
        setTimeout(function(){render();},30000);
      })
      .catch(function(){alert('Refresh failed. Try again.');});
  }

  /* Settings panel */
  function openSettings(){
    var rows=document.getElementById('settingsRows');
    rows.innerHTML='';
    var sections = (config && config.sections) || [];
    sections.forEach(function(sec, i){
      var row=document.createElement('div');
      row.className='sec-row';
      var feedRows = sec.feeds.map(function(f, fi){
        return '<div class="feed-row"><input type="text" class="feed-url" value="'+esc(f.url)+'" data-i="'+i+'" data-fi="'+fi+'" data-k="feed-url" placeholder="RSS URL or site URL"><input type="text" class="feed-src" value="'+esc(f.source||'')+'" data-i="'+i+'" data-fi="'+fi+'" data-k="feed-src" placeholder="Name"><button class="btn-test" data-i="'+i+'" data-fi="'+fi+'" data-k="test-feed">Test</button><button class="btn-del" data-i="'+i+'" data-fi="'+fi+'" data-k="del-feed">&minus;</button></div><div class="feed-result" id="feed-result-'+i+'-'+fi+'"></div>';
      }).join('');
      row.innerHTML='<div class="sec-name"><input type="checkbox" '+(sec.enabled!==false?'checked':'')+' data-i="'+i+'" data-k="enabled"> '
        + '<input type="text" class="sec-title" value="'+esc(sec.title)+'" data-i="'+i+'" data-k="title">'
        + '<label class="lead-chk"><input type="checkbox" '+(sec.lead!==false?'checked':'')+' data-i="'+i+'" data-k="lead"> Lead</label>'
        + '<button class="sec-del" data-i="'+i+'" data-k="del-sec">Remove</button></div>'
        + '<div class="feeds">'+feedRows+'</div>'
        + '<button class="btn-add" data-i="'+i+'" data-k="add-feed">+ Add feed</button>';
      rows.appendChild(row);
    });
    document.getElementById('settingsOverlay').classList.add('open');
    document.getElementById('settingsPanel').style.display='block';
  }

  function closeSettings(){
    document.getElementById('settingsOverlay').classList.remove('open');
    document.getElementById('settingsPanel').style.display='none';
  }

  function collectSettingsFromPanel(){
    var rows=document.getElementById('settingsRows').querySelectorAll('.sec-row');
    var sections=[];
    rows.forEach(function(row, i){
      var sec={feeds:[]};
      var secTitle=row.querySelector('.sec-title');
      var secEnabled=row.querySelector('input[data-k="enabled"]');
      var secLead=row.querySelector('input[data-k="lead"]');
      sec.title=secTitle.value||'Untitled';
      sec.enabled=secEnabled?secEnabled.checked:true;
      sec.lead=secLead?secLead.checked:false;
      var existing=(config&&config.sections&&config.sections[i])?config.sections[i].id:null;
      sec.id=existing||(secTitle.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''))||'section-'+Date.now();
      row.querySelectorAll('.feed-row').forEach(function(fr){
        var url=fr.querySelector('.feed-url').value;
        var src=fr.querySelector('.feed-src').value;
        if(url) sec.feeds.push({url:url,source:src||''});
      });
      sections.push(sec);
    });
    return sections;
  }

  var STATIC = (location.protocol === 'file:') || location.hostname.endsWith('github.io');

  function applySettingsFromPanel(){
    var sections=collectSettingsFromPanel();
    config={sections:sections};
    saveConfig(function(){
      closeSettings();
      render();
    });
  }

  function saveConfig(onDone){
    if(STATIC){
      try{localStorage.setItem('dailyNewsSettings',JSON.stringify(config))}catch(e){}
      if(onDone) onDone();
      return;
    }
    fetch('/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(config)}).then(function(){
      if(onDone) onDone();
    });
  }

  function addSection(){
    var sections=collectSettingsFromPanel();
    sections.push({id:'new-section-'+Date.now(),title:'New Section',enabled:true,lead:true,feeds:[]});
    config={sections:sections};
    saveConfig(function(){openSettings();});
  }

  function resetSettings(){
    localStorage.removeItem('dailyNewsSettings');
    if(STATIC){
      fetch('feeds.json').then(function(r){return r.json()}).then(function(c){
        config=c;openSettings();render();
      }).catch(function(){config={sections:[]};openSettings();render();});
      return;
    }
    fetch('/config').then(function(r){return r.json()}).then(function(c){
      config=c;
      openSettings();
      render();
    });
  }

  function loadConfig(){
    if(STATIC){
      var saved=localStorage.getItem('dailyNewsSettings');
      if(saved){try{config=JSON.parse(saved);render();return;}catch(e){}}
      fetch('feeds.json')
        .then(function(r){if(!r.ok)throw new Error(r.status);return r.json()})
        .then(function(c){config=c;render();})
        .catch(function(){config={sections:[]};render();});
      return;
    }
    fetch('/config')
      .then(function(r){return r.json()})
      .then(function(c){config=c;render();})
      .catch(function(){config={sections:[]};render();});
  }

  document.getElementById('gearBtn').addEventListener('click',openSettings);
  document.getElementById('settingsSave').addEventListener('click',applySettingsFromPanel);
  document.getElementById('settingsReset').addEventListener('click',resetSettings);
  document.getElementById('settingsRefresh').addEventListener('click',function(){applySettingsFromPanel();refresh();});
  document.getElementById('settingsOverlay').addEventListener('click',closeSettings);

  // handle add-feed and delete buttons inside settings
  document.getElementById('settingsRows').addEventListener('click',function(e){
    var btn=e.target;
    if(!btn.dataset.k) return;
    var i=parseInt(btn.dataset.i);
    if(btn.dataset.k==='test-feed'){
      var fi=parseInt(btn.dataset.fi);
      var urlInput=btn.parentElement.querySelector('.feed-url');
      var url=urlInput.value.trim();
      if(!url){return}
      btn.disabled=true;btn.textContent='...';
      var resultDiv=document.getElementById('feed-result-'+i+'-'+fi);
      if(STATIC){
        btn.disabled=false;btn.textContent='Test';
        resultDiv.className='feed-result err';
        resultDiv.textContent='Test not available on GitHub Pages.';
        return;
      }
      fetch('/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:url})})
        .then(function(r){return r.json()})
        .then(function(res){
          btn.disabled=false;btn.textContent='Test';
          resultDiv.className='feed-result '+(res.ok?'ok':'err');
          if(res.ok){
            var html=esc(res.msg||'OK');
            if(res.discovered && res.url && res.url!==url){
              html+=' &mdash; <a data-i="'+i+'" data-fi="'+fi+'" data-k="use-url">use '+esc(res.url)+'</a>';
            }
            resultDiv.innerHTML=html;
          }else{
            resultDiv.textContent=res.error||'Failed';
          }
        })
        .catch(function(){
          btn.disabled=false;btn.textContent='Test';
          resultDiv.className='feed-result err';
          resultDiv.textContent='Check failed.';
        });
      return;
    }
    if(btn.dataset.k==='use-url'){
      var fi2=parseInt(btn.dataset.fi);
      var row=btn.closest('.feed-result').previousElementSibling;
      row.querySelector('.feed-url').value=btn.textContent.replace('use ','');
      btn.closest('.feed-result').className='feed-result';
      return;
    }
    var sections=collectSettingsFromPanel();
    if(btn.dataset.k==='add-feed'){
      sections[i].feeds.push({url:'',source:''});
    }else if(btn.dataset.k==='del-feed'){
      var fi=parseInt(btn.dataset.fi);
      sections[i].feeds.splice(fi,1);
    }else if(btn.dataset.k==='del-sec'){
      sections.splice(i,1);
    }
    config={sections:sections};
    saveConfig(function(){openSettings();});
  });

  // add section button
  document.getElementById('settingsAddSec').addEventListener('click',addSection);

  loadConfig();
})();