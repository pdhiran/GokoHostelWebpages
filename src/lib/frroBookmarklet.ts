/**
 * Generates a bookmarklet JavaScript snippet that auto-fills the FRRO Form C page.
 * The snippet fetches guest data from our API and fills form fields on indianfrro.gov.in.
 */

export function generateFormCToken(checkinId: number, secret: string): string {
  const expiry = Date.now() + 60 * 60 * 1000;
  const payload = `${checkinId}:${expiry}`;
  const hash = btoa(payload + ":" + secret).replace(/=/g, "");
  return `${btoa(payload).replace(/=/g, "")}.${hash}`;
}

export function generateBookmarkletCode(apiUrl: string): string {
  // This is the JavaScript that runs inside the FRRO page
  return `javascript:void((async()=>{try{const r=await fetch('${apiUrl}');if(!r.ok){alert('Failed to fetch Form C data: '+r.status);return;}const d=await r.json();const F=(n,v)=>{if(!v)return;const els=document.querySelectorAll('input[name=\"'+n+'\"],select[name=\"'+n+'\"],textarea[name=\"'+n+'\"]');if(els.length){els.forEach(el=>{if(el.tagName==='SELECT'){const opts=[...el.options];const match=opts.find(o=>o.text.toUpperCase().includes(v.toUpperCase())||o.value.toUpperCase().includes(v.toUpperCase()));if(match){el.value=match.value;el.dispatchEvent(new Event('change',{bubbles:true}));}else{el.value=v;}}else if(el.type==='radio'){if(el.value.toLowerCase()===v.toLowerCase())el.checked=true;}else{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));}});}};const S=(label,v)=>{if(!v)return;const tds=[...document.querySelectorAll('td,th,label')];const td=tds.find(t=>t.textContent.trim().toLowerCase().includes(label.toLowerCase()));if(td){const row=td.closest('tr')||td.parentElement;if(row){const inputs=row.querySelectorAll('input,select,textarea');if(inputs.length){const el=inputs[0];if(el.tagName==='SELECT'){const opts=[...el.options];const match=opts.find(o=>o.text.toUpperCase().includes(v.toUpperCase())||o.value.toUpperCase().includes(v.toUpperCase()));if(match){el.value=match.value;el.dispatchEvent(new Event('change',{bubbles:true}));}else{el.value=v;}}else if(el.type==='radio'){const radios=row.querySelectorAll('input[type=radio]');radios.forEach(r=>{if(r.value.toLowerCase()===v.toLowerCase()||r.nextSibling?.textContent?.trim().toLowerCase()===v.toLowerCase())r.checked=true;});}else{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));}}}}};const names=d.extractedPassport||{};const visa=d.extractedVisa||{};const surname=names.surname||d.guestName?.split(' ').pop()||'';const givenName=names.givenName||d.guestName?.split(' ').slice(0,-1).join(' ')||'';S('Surname',surname);S('Given Name',givenName);S('Sex',names.sex||'');S('Date of Birth',names.dateOfBirth||'');S('Nationality',d.nationality||'');S('Address in country',d.homeAddress||'');S('City',d.homeCity||'');S('Passport No',names.passportNumber||'');S('Date of issue',names.dateOfIssue||'');S('Valid till',names.expiryDate||'');S('Visa No',visa.visaNumber||'');S('Type of visa',visa.type||'');S('Arrived from Country',d.arrivedFromCountry||'');S('Arrived from City',d.arrivedFromCity||'');S('Arrived from Place',d.arrivedFromPlace||'');S('Date of Arrival in India',d.dateOfArrivalInIndia||'');S('Date of Arrival in Hotel',d.arrivalDate||'');S('Time of Arrival in Hotel',d.arrivalTime||'');S('duration of stay',d.stayingDays||'');S('employed in India',d.employedInIndia||'No');S('Purpose of Visit',d.purposeOfVisit||'Tourism');S('Contact Phone No (In India',d.contact||'');S('Mobile No (In India',d.contact||'');S('Contact Phone No (Permanently',d.homeCountryPhone||'');S('Mobile No (Permanently',d.homeCountryPhone||'');const msg=document.createElement('div');msg.style.cssText='position:fixed;top:20px;right:20px;background:#4CAF50;color:white;padding:16px 24px;border-radius:8px;z-index:99999;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.3)';msg.textContent='Form C fields filled! Please review and click Temporary Save.';document.body.appendChild(msg);setTimeout(()=>msg.remove(),8000);}catch(e){alert('Auto-fill error: '+e.message);}})())`;
}

export function generateBookmarkletUrl(baseUrl: string, checkinId: number, token: string): string {
  const apiUrl = `${baseUrl}/api/form-c/${checkinId}?token=${token}`;
  return generateBookmarkletCode(apiUrl);
}
