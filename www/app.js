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

  function clean(s){
    var d=document.createElement('div');d.innerHTML=s||'';return (d.textContent||'').replace(/\s+/g,' ').trim().slice(0,280);
  }

  function fetchFeedClient(url, source){
    if(!url.match(/^https?:\/\//)) url='https://'+url;
    return fetch('https://api.rss2json.com/v1/api.json?rss_url='+encodeURIComponent(url))
      .then(function(r){return r.json()})
      .then(function(res){
        if(res.status!=='ok') return [];
        return (res.items||[]).slice(0,20).map(function(it){
          return {title:clean(it.title),url:it.link,snippet:clean(it.description),source:source};
        });
      }).catch(function(){return [];});
  }

  function fetchAllClient(sections, onProgress){
    var out={sections:[]};
    var promises=sections.map(function(sec){
      var feedPromises=sec.feeds.map(function(f){return fetchFeedClient(f.url,f.source||'');});
      return Promise.all(feedPromises).then(function(results){
        // ponytail: round-robin so all sources appear
        var feedItems=results;
        var allItems=[];
        var idx=0;
        while(feedItems.some(function(fi){return idx<fi.length})){
          feedItems.forEach(function(fi){if(idx<fi.length)allItems.push(fi[idx])});
          idx++;
        }
        var lead=allItems[0]||null;
        var items=allItems.slice(1,15);
        out.sections.push({id:sec.id,title:sec.title,lead:lead,items:items});
      });
    });
    return Promise.all(promises).then(function(){return out});
  }

  function render(){
    setDate();
    var sections=(config&&config.sections)||[];
    var content=document.getElementById('content');
    content.innerHTML='<div class="status-msg">Fetching the morning edition&hellip;</div>';
    fetchAllClient(sections).then(function(data){
      var byId={};
      (data.sections||[]).forEach(function(s){byId[s.id]=s});
      content.innerHTML='';
      var grid=document.createElement('div');
      grid.className='grid-sections';
      sections.forEach(function(cfg){
        var sec=byId[cfg.id]||{id:cfg.id,title:cfg.title,lead:null,items:[]};
        sec.title=cfg.title;
        grid.appendChild(renderSection(sec,cfg));
      });
      content.appendChild(grid);
      document.getElementById('updated').textContent='Updated '+new Date().toLocaleString('en-GB');
    }).catch(function(){
      content.innerHTML='<div class="status-msg">Could not fetch headlines. Try again.</div>';
    });
  }

  function refresh(){
    render();
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
    try{localStorage.setItem('dailyNewsSettings',JSON.stringify(config))}catch(e){}
    if(!STATIC){fetch('/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(config)}).catch(function(){});}
    if(onDone)onDone();
  }

  function addSection(){
    var rows=document.getElementById('settingsRows');
    var i=rows.querySelectorAll('.sec-row').length;
    var row=document.createElement('div');
    row.className='sec-row';
    row.innerHTML='<div class="sec-name"><input type="checkbox" checked data-i="'+i+'" data-k="enabled"> '
      + '<input type="text" class="sec-title" value="New Section" data-i="'+i+'" data-k="title">'
      + '<label class="lead-chk"><input type="checkbox" checked data-i="'+i+'" data-k="lead"> Lead</label>'
      + '<button class="sec-del" data-i="'+i+'" data-k="del-sec">Remove</button></div>'
      + '<div class="feeds"></div>'
      + '<button class="btn-add" data-i="'+i+'" data-k="add-feed">+ Add feed</button>';
    rows.appendChild(row);
  }

  function resetSettings(){
    localStorage.removeItem('dailyNewsSettings');
    fetch('feeds.json').then(function(r){return r.json()}).then(function(c){
      config=c;openSettings();render();
    }).catch(function(){config={sections:[]};openSettings();render();});
  }

  function loadConfig(){
    // #c=<base64> in URL hash = shared config, takes priority
    var hashCfg=location.hash.match(/#c=([A-Za-z0-9_-]+)/);
    if(hashCfg){
      try{
        var json=decodeURIComponent(escape(atob(hashCfg[1].replace(/-/g,'+').replace(/_/g,'/'))));
        config=JSON.parse(json);
        try{localStorage.setItem('dailyNewsSettings',json)}catch(e){}
        render();return;
      }catch(e){}
    }
    var saved=localStorage.getItem('dailyNewsSettings');
    if(saved){try{config=JSON.parse(saved);render();return;}catch(e){}}
    fetch('feeds.json')
      .then(function(r){if(!r.ok)throw new Error(r.status);return r.json()})
      .then(function(c){config=c;render();})
      .catch(function(){config={sections:[]};render();});
  }

  function shareConfig(){
    var json=JSON.stringify(config);
    // ponytail: base64url encode, no deps
    var b64=btoa(unescape(encodeURIComponent(json))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    var url=location.origin+location.pathname+'#c='+b64;
    var inp=document.createElement('input');
    inp.value=url;document.body.appendChild(inp);inp.select();
    try{document.execCommand('copy');
      var btn=document.getElementById('settingsShare');
      var orig=btn.textContent;btn.textContent='Copied!';
      setTimeout(function(){btn.textContent=orig;},2000);
    }catch(e){prompt('Copy this link:',url);}
    inp.remove();
  }

  document.getElementById('gearBtn').addEventListener('click',openSettings);
  document.getElementById('settingsSave').addEventListener('click',applySettingsFromPanel);
  document.getElementById('settingsReset').addEventListener('click',resetSettings);
  document.getElementById('settingsShare').addEventListener('click',shareConfig);
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
      if(!STATIC){
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
      // ponytail: rss2json as client-side RSS validator, no API key needed
      if(!url.match(/^https?:\/\//)) url='https://'+url;
      var candidates=[url];
      var base=url.replace(/\/(feed|rss|rss\.xml|feed\.xml|atom\.xml|rss\/?)$/,'').replace(/\/$/,'');
      if(base!==url) candidates.push(url);
      ['/feed/','/feed','/rss','/rss.xml','/feed.xml','/atom.xml'].forEach(function(p){
        if(base+p!==url) candidates.push(base+p);
      });
      function tryCandidate(idx){
        if(idx>=candidates.length){
          btn.disabled=false;btn.textContent='Test';
          resultDiv.className='feed-result err';
          resultDiv.textContent='No RSS feed found. Try entering the direct feed URL.';
          return;
        }
        fetch('https://api.rss2json.com/v1/api.json?rss_url='+encodeURIComponent(candidates[idx]))
          .then(function(r){return r.json()})
          .then(function(res){
            if(res.status==='ok'){
              btn.disabled=false;btn.textContent='Test';
              resultDiv.className='feed-result ok';
              var msg='Valid feed, '+(res.items||[]).length+' items';
              if(candidates[idx]!==url){
                msg+=' — <a data-i="'+i+'" data-fi="'+fi+'" data-k="use-url">use '+esc(candidates[idx])+'</a>';
              }
              resultDiv.innerHTML=msg;
            }else{
              tryCandidate(idx+1);
            }
          })
          .catch(function(){tryCandidate(idx+1);});
      }
      tryCandidate(0);
      return;
    }
    if(btn.dataset.k==='use-url'){
      var fi2=parseInt(btn.dataset.fi);
      var row=btn.closest('.feed-result').previousElementSibling;
      row.querySelector('.feed-url').value=btn.textContent.replace('use ','');
      btn.closest('.feed-result').className='feed-result';
      return;
    }
    if(btn.dataset.k==='add-feed'){
      var feeds=btn.previousElementSibling;
      var fi=feeds.querySelectorAll('.feed-row').length;
      var div=document.createElement('div');
      div.className='feed-row';
      div.innerHTML='<input type="text" class="feed-url" value="" data-i="'+i+'" data-fi="'+fi+'" data-k="feed-url" placeholder="RSS URL or site URL"><input type="text" class="feed-src" value="" data-i="'+i+'" data-fi="'+fi+'" data-k="feed-src" placeholder="Name"><button class="btn-test" data-i="'+i+'" data-fi="'+fi+'" data-k="test-feed">Test</button><button class="btn-del" data-i="'+i+'" data-fi="'+fi+'" data-k="del-feed">&minus;</button>';
      var res=document.createElement('div');
      res.className='feed-result';
      res.id='feed-result-'+i+'-'+fi;
      feeds.appendChild(div);
      feeds.appendChild(res);
      div.querySelector('.feed-url').focus();
      return;
    }
    if(btn.dataset.k==='del-feed'){
      var fr=btn.closest('.feed-row');
      var resEl=fr.nextElementSibling;
      if(resEl&&resEl.className==='feed-result')resEl.remove();
      fr.remove();
      return;
    }
    if(btn.dataset.k==='del-sec'){
      btn.closest('.sec-row').remove();
      return;
    }
  });

  // add section button
  document.getElementById('settingsAddSec').addEventListener('click',addSection);

  loadConfig();
})();