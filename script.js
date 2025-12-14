
// Frontend logic for dashboard: map, AOI drawing, tile layers, charts, exports
(function(){
  const { API_BASE, GOOGLE_CLIENT_ID } = window.APP_CONFIG || {};

  // Map init
  const map = L.map('map').setView([30.3396, -81.5657], 9);
  const basemap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);
  const drawnItems = new L.FeatureGroup().addTo(map);
  const drawControl = new L.Control.Draw({ position:'topright', draw:{ polygon:true, rectangle:true, circle:false, marker:false, polyline:false }, edit:{ featureGroup: drawnItems }});
  map.addControl(drawControl);

  let currentAOI = null; // GeoJSON geometry
  map.on(L.Draw.Event.CREATED, (e)=>{ drawnItems.addLayer(e.layer); currentAOI = e.layer.toGeoJSON().geometry; setStatus('AOI captured. Ready for analysis.'); });
  map.on('click', (e)=>{ document.getElementById('infoBox').innerText = `Clicked at: ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`; });

  // Elements
  const datasetEl = document.getElementById('dataset');
  const startEl = document.getElementById('start');
  const endEl = document.getElementById('end');
  const vizEl = document.getElementById('viz');
  const layersListEl = document.getElementById('layersList');
  const infoBox = document.getElementById('infoBox');
  const chartCanvas = document.getElementById('chart');
  const authBadge = document.getElementById('authBadge');
  let chart;

  // Legend swatches
  const chlLegend = document.getElementById('chlLegend');
  ['#2c7fb8','#41b6c4','#a1dab4','#ffffcc','#fdae61','#f46d43','#d73027'].forEach(c=>{ const sw=document.createElement('div'); sw.className='swatch'; sw.style.background=c; chlLegend.appendChild(sw); });

  // Layer management
  const activeLayers = []; // {name, layer}
  function addLayer(name, leafletLayer){ leafletLayer.addTo(map); activeLayers.push({name, layer:leafletLayer}); renderLayersList(); }
  function clearLayers(){ activeLayers.forEach(x=>map.removeLayer(x.layer)); activeLayers.length=0; renderLayersList(); }
  function renderLayersList(){ layersListEl.innerHTML=''; activeLayers.forEach((x,i)=>{ const div=document.createElement('div'); div.className='layer-item'; div.innerHTML = `<span>${x.name}</span><div><button class="btn btn-outline" style="padding:6px 10px" onclick="toggleLayer(${i})"><i class="fa-solid fa-eye"></i></button><button class="btn btn-red" style="padding:6px 10px;margin-left:6px" onclick="removeLayer(${i})"><i class="fa-solid fa-trash"></i></button></div>`; layersListEl.appendChild(div); }); }
  window.toggleLayer = (i)=>{ const x=activeLayers[i]; if(map.hasLayer(x.layer)) map.removeLayer(x.layer); else x.layer.addTo(map); };
  window.removeLayer = (i)=>{ const x=activeLayers[i]; map.removeLayer(x.layer); activeLayers.splice(i,1); renderLayersList(); };

  // Helpers
  function setStatus(msg){ document.getElementById('statusMsg').innerText = 'Status: ' + msg; }
  function requireAOI(){ if(!currentAOI){ alert('Please draw an AOI on the map first.'); return false; } return true; }
  function layerName(prefix){ return `${prefix} • ${datasetEl.value} • ${startEl.value}→${endEl.value}`; }
  function makeTileLayer(url){ return L.tileLayer(url,{attribution:'GEE'}); }
  function s2Sensor(){ return datasetEl.value==='S2' ? 'COPERNICUS/S2_SR' : 'LANDSAT/LC08/C02/T1_L2'; }

  async function postJSON(path, body){
    const token = localStorage.getItem('app_token');
    const headers = { 'Content-Type':'application/json' };
    if(token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`,{ method:'POST', headers, body:JSON.stringify(body) });
    if(!res.ok){ const t = await res.text(); throw new Error(t); }
    return await res.json();
  }

  // Actions
  async function loadData(){
    if(!requireAOI()) return; setStatus('Loading tiles…');
    const aoi=currentAOI, start=startEl.value, end=endEl.value, viz=vizEl.value;
    try{
      if(viz==='ndvi'){
        const data = await postJSON('/tiles/ndvi', { aoi, start, end, sensor: s2Sensor() });
        addLayer(layerName('NDVI Composite'), makeTileLayer(data.tileUrl));
      }else if(viz.startsWith('ci_')){
        const ci_type = viz==='ci_rededge' ? 'rededge' : 'green';
        const data = await postJSON('/tiles/ci_composite', { aoi, start, end, ci_type, water_threshold:0.0, use_cloudprob:true, cloudprob_threshold:65 });
        addLayer(layerName('CI Composite'), makeTileLayer(data.tileUrl));
      }else{
        alert('True Color demo uses basemap only. Choose NDVI or CI for analysis tiles.');
      }
      setStatus('Tiles added.');
    }catch(err){ console.error(err); setStatus('Error: '+err.message); }
  }

  async function addLayerFromSelectedDate(){
    if(!requireAOI()) return; setStatus('Loading nearest image tiles…');
    const aoi=currentAOI, start=startEl.value, end=endEl.value, viz=vizEl.value, date=start;
    try{
      if(viz.startsWith('ci_')){
        const ci_type = viz==='ci_rededge' ? 'rededge' : 'green';
        const data = await postJSON('/tiles/ci_by_date', { aoi, start, end, ci_type, date });
        addLayer(`CI ${data.resolvedDate}`, makeTileLayer(data.tileUrl));
        setStatus('CI by date added: '+data.resolvedDate);
      }else{
        alert('Add Layer (by date) wired for CI. Use Calculate NDVI for NDVI tiles.');
      }
    }catch(err){ console.error(err); setStatus('Error: '+err.message); }
  }

  async function calculateNDVI(){
    if(!requireAOI()) return; setStatus('Calculating NDVI…');
    const aoi=currentAOI, start=startEl.value, end=endEl.value;
    try{
      const data = await postJSON('/tiles/ndvi', { aoi, start, end, sensor: s2Sensor() });
      addLayer(layerName('NDVI'), makeTileLayer(data.tileUrl));
      setStatus('NDVI layer added.');
    }catch(err){ console.error(err); setStatus('Error: '+err.message); }
  }

  async function timeSeries(){
    if(!requireAOI()) return; setStatus('Computing time series…');
    const aoi=currentAOI, start=startEl.value, end=endEl.value, viz=vizEl.value;
    try{
      if(viz.startsWith('ci_')){
        const ci_type = viz==='ci_rededge' ? 'rededge' : 'green';
        const out = await postJSON('/stats/ci_timeseries_aoi?interval=month', { aoi, start, end, ci_type, water_threshold:0.0, use_cloudprob:true, cloudprob_threshold:65 });
        const features = out.features||[], labels = features.map(f=>f.properties.period), values = features.map(f=>f.properties.medianCI ?? null);
        drawLine(labels, values, 'CI (median) by month', 'CI');
      }else{
        const out = await postJSON('/stats/ndvi_timeseries?interval=month', { aoi, start, end });
        const features = out.features||[], labels = features.map(f=>f.properties.period), values = features.map(f=>f.properties.meanNDVI ?? null);
        drawLine(labels, values, 'NDVI (mean) by month', 'NDVI');
      }
      setStatus('Time series ready.');
    }catch(err){ console.error(err); setStatus('Error: '+err.message); }
  }

  async function getStatistics(){
    if(!requireAOI()) return; setStatus('Computing statistics…');
    const aoi=currentAOI, start=startEl.value, end=endEl.value, date=start;
    try{
      const out = await postJSON('/stats/ci_histogram_by_date?bins=20&bins=30&bins=40&bins=50&bins=60&bins=70', { aoi, start, end, ci_type:'green', date, water_threshold:0.0, use_cloudprob:true, cloudprob_threshold:65 });
      const histObj = out.histogram||{}; const classes = Object.keys(histObj).map(k=>parseInt(k,10)).sort((a,b)=>a-b); const counts = classes.map(k=>histObj[k]);
      drawBar(classes.map(c=>'Class '+c), counts, `CI Histogram • ${out.resolvedDate}`, 'Pixels');
      setStatus('Statistics ready.');
    }catch(err){ console.error(err); setStatus('Error: '+err.message); }
  }

  async function exportImage(){
    if(!requireAOI()) return; setStatus('Submitting export…');
    const aoi=currentAOI, start=startEl.value, end=endEl.value, date=start;
    try{
      const out = await postJSON('/export/ci_selected', { aoi, start, end, ci_type:'green', date, description:'ci_selected_export', file_prefix:'ci_selected', to_drive:false });
      alert(`Export started.
Task: ${out.taskId}
Date: ${out.resolvedDate}
State: ${out.state}`);
      setStatus('Export started.');
    }catch(err){ console.error(err); setStatus('Error: '+err.message); }
  }

  // Charts
  function drawLine(labels, values, title, series){ if(chart) chart.destroy(); chart = new Chart(chartCanvas,{ type:'line', data:{ labels, datasets:[{ label:series, data:values, borderColor:'#2368ff', backgroundColor:'#2368ff22', tension:.25, pointRadius:3 }] }, options:{ responsive:true, plugins:{ title:{ display:true, text:title } }, scales:{ x:{ ticks:{ maxRotation:0, autoSkip:true } } } } }); }
  function drawBar(labels, values, title, series){ if(chart) chart.destroy(); chart = new Chart(chartCanvas,{ type:'bar', data:{ labels, datasets:[{ label:series, data:values, backgroundColor:'#41b6c4' }] }, options:{ responsive:true, plugins:{ title:{ display:true, text:title } } } }); }

  // Bind UI
  document.getElementById('loadBtn').addEventListener('click', loadData);
  document.getElementById('addLayerBtn').addEventListener('click', addLayerFromSelectedDate);
  document.getElementById('clearBtn').addEventListener('click', clearLayers);
  document.getElementById('exportBtn').addEventListener('click', exportImage);
  document.getElementById('calcNdviBtn').addEventListener('click', calculateNDVI);
  document.getElementById('tsBtn').addEventListener('click', timeSeries);
  document.getElementById('statsBtn').addEventListener('click', getStatistics);

  // Google Identity Services button (optional)
  window.onload = function(){
    try{
      if(GOOGLE_CLIENT_ID){
        google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: async (res)=>{
          try{
            const r = await fetch(`${API_BASE}/auth/google`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id_token: res.credential }) });
            if(!r.ok) return alert('Sign-in failed');
            const data = await r.json();
            localStorage.setItem('app_token', data.appToken);
            authBadge.textContent = `Signed in: ${data.user.email}`;
          }catch(e){ console.error(e); alert('Sign-in failed'); }
        }});
        google.accounts.id.renderButton(document.getElementById('signInBtn'), { theme:'outline', size:'large' });
      }else{
        document.getElementById('signInBtn').addEventListener('click', ()=>alert('Configure GOOGLE_CLIENT_ID in config.js'));
      }
    }catch(e){ /* no-op */ }
  };
})();
