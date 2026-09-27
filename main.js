const API = "/api"; 
let UID = 1; 
let userEmail = localStorage.getItem('fitcommit_email');
let profile = { kaloriOtomatis: 2000, foto_profil: "", target_bb: null, program_start_date: null };
let weekly = {}; let foodLog = { sarapan: [], siang: [], malam: [], camilan: [] };
let datesArray = []; 
let activeDateStr = null; 
let tempSport = null, tempImg = null;
let overLimitAlertTriggered = false; 

const dbOlahraga = { "Lari": { icon: "fa-running", kalM: 10, kalK: 65 }, "Bersepeda": { icon: "fa-biking", kalM: 8, kalK: 30 }, "Angkat Beban": { icon: "fa-dumbbell", kalM: 6, kalK: 0 }, "Renang": { icon: "fa-swimmer", kalM: 12, kalK: 250 }, "Pencak Silat": { icon: "fa-user-ninja", kalM: 9, kalK: 0 }, "Jalan Cepat": { icon: "fa-walking", kalM: 5, kalK: 50 }, "Istirahat Total": { icon: "fa-bed", kalM: 0, kalK: 0 } };
const dbMakanan = [{ nama: "Nasi Putih (1 Centong)", kalori: 130 }, { nama: "Nasi Merah (100g)", kalori: 110 }, { nama: "Dada Ayam Bakar", kalori: 165 }, { nama: "Ayam Goreng Paha", kalori: 250 }, { nama: "Telur Rebus", kalori: 78 }];

let map = null, polyline = null, marker = null, watchId = null;
let isTracking = false, startTime = null, trackDist = 0, trackTimer = null, coords = [];

document.addEventListener("DOMContentLoaded", async () => {
    updateClock(); setInterval(updateClock, 1000); 
    if(!userEmail) document.getElementById('login-layer').classList.remove('hidden');
    else await prosesLoginSukses(userEmail);
    
    const grid = document.getElementById('sport-grid');
    if (grid) for(let k in dbOlahraga) grid.innerHTML += `<div onclick="pilihO('${k}')" class="bg-white/5 border border-white/10 rounded-2xl p-4 text-center cursor-pointer hover:border-purple-400/50 transition"><i class="fas ${dbOlahraga[k].icon} text-2xl text-white mb-2 block drop-shadow-md"></i><span class="text-[9px] uppercase tracking-wider font-bold text-slate-300 block">${k}</span></div>`;
});

function switchAuthTab(tab) {
    const loginBtn = document.getElementById('tab-login-btn');
    const regBtn = document.getElementById('tab-register-btn');
    const formLogin = document.getElementById('form-login');
    const formReg = document.getElementById('form-register');

    if(tab === 'login') {
        loginBtn.className = "flex-1 py-2 text-xs font-bold rounded-full bg-white text-black transition";
        regBtn.className = "flex-1 py-2 text-xs font-bold rounded-full text-slate-400 transition";
        formLogin.classList.remove('hidden'); formReg.classList.add('hidden');
    } else {
        regBtn.className = "flex-1 py-2 text-xs font-bold rounded-full bg-white text-black transition";
        loginBtn.className = "flex-1 py-2 text-xs font-bold rounded-full text-slate-400 transition";
        formReg.classList.remove('hidden'); formLogin.classList.add('hidden');
    }
}

async function prosesLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    if(!email || !password) return alert("Email dan password wajib diisi!");

    const r = await fetch(`${API}/login`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email, password})});
    if(r.status === 200) {
        const data = await r.json();
        localStorage.setItem('fitcommit_email', email);
        userEmail = email; UID = data.user.id;
        await prosesLoginSukses(email);
    } else {
        const err = await r.json();
        alert(err.msg || "Gagal masuk!");
    }
}

async function prosesRegister() {
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const confirm_password = document.getElementById('reg-confirm').value;

    if(!email || !password || !confirm_password) return alert("Semua kolom wajib diisi!");
    if(password !== confirm_password) return alert("Konfirmasi password tidak cocok!");

    const r = await fetch(`${API}/register`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email, password, confirm_password})});
    if(r.status === 200) {
        alert("Registrasi Berhasil! Silakan Masuk.");
        switchAuthTab('login');
        document.getElementById('login-email').value = email;
    } else {
        const err = await r.json();
        alert(err.msg || "Gagal registrasi!");
    }
}

function logout() { localStorage.removeItem('fitcommit_email'); location.reload(); }

async function prosesLoginSukses(email) {
    document.getElementById('login-layer').classList.add('hidden');
    document.getElementById('profile-email-display').innerText = email;
    try {
        const p = await fetch(`${API}/profile/${UID}`).then(r => r.json());
        if(!p.error) {
            profile = { ...profile, ...p };
            document.getElementById('input-nama').value = profile.nama || ""; document.getElementById('input-usia').value = profile.usia || "";
            document.getElementById('input-tb').value = profile.tb || ""; document.getElementById('input-bb').value = profile.bb || "";
            document.getElementById('input-jenis-program').value = profile.jenis_program || "cutting";
            let ava = profile.foto_profil || `https://ui-avatars.com/api/?name=${(profile.nama||"U").replace(/ /g,'+')}&background=07090e&color=f8fafc`;
            document.getElementById('profil-avatar').src = ava; document.getElementById('header-avatar').src = ava;
        }
        hitungOtomatisKalori(); await sinkronisasiDataHarian();
    } catch(e) { console.log(e); }
}

async function sinkronisasiDataHarian() {
    if(profile.program_start_date) {
        datesArray = []; let startObj = new Date(profile.program_start_date);
        for(let i=0; i<7; i++) { let nextD = new Date(startObj); nextD.setDate(startObj.getDate() + i); datesArray.push(nextD.toISOString().split('T')[0]); }
        datesArray.forEach(d => { weekly[d] = { tanggal: d, olahraga: null, jam: "", selesai: false, foto: "" }; });
        const wp = await fetch(`${API}/plan/${UID}`).then(r => r.json());
        if(wp && !wp.error) wp.forEach(p => { if(weekly[p.tanggal]) weekly[p.tanggal] = p; });
    }
    const tglIni = new Date().toISOString().split('T')[0];
    foodLog = { sarapan: [], siang: [], malam: [], camilan: [] };
    const fl = await fetch(`${API}/food/${UID}?tanggal=${tglIni}`).then(r => r.json());
    if(fl && !fl.error) fl.forEach(f => { if(foodLog[f.kategori]) foodLog[f.kategori].push({nama: f.nama_makanan, kalori: parseInt(f.kalori)}); });
    cekKunci(); renderFood(); renderHome();
}

function updateClock() {
    const wib = new Date(new Date().getTime() + (new Date().getTimezoneOffset() * 60000) + (3600000 * 7));
    const ticker = document.getElementById('clock-ticker');
    if(ticker) ticker.innerText = `${wib.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })} • ${wib.toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})} WIB`;
    const homeDate = document.getElementById('waktu-tanggal');
    if(homeDate) homeDate.innerText = wib.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function switchView(id, title, btn) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${id}`).classList.add('active');
    document.getElementById('header-title').innerText = title;
    document.querySelectorAll('.nav-btn').forEach(el => { el.classList.remove('text-white'); el.classList.add('text-slate-500'); });
    btn.classList.remove('text-slate-500'); btn.classList.add('text-white');
    if(id === 'plan') cekKunci();
}

function showToast(msg, type="info") {
    const t = document.createElement('div');
    if(type === "error") { t.className = "bg-rose-950/90 text-white px-5 py-4 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-3 border border-rose-500/50 backdrop-blur-md"; t.innerHTML = `<i class="fas fa-exclamation-triangle text-lg"></i> <div>${msg}</div>`; }
    else { t.className = "bg-white/10 text-white px-5 py-4 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-3 border border-white/20 backdrop-blur-md"; t.innerHTML = `<i class="fas fa-check-circle text-emerald-400 text-lg"></i> <div>${msg}</div>`; }
    document.getElementById('toast-container').appendChild(t); 
    setTimeout(() => t.remove(), type === "error" ? 5000 : 3500);
}

function uploadFotoProfil(e) {
    const f = e.target.files[0]; if(!f) return;
    const r = new FileReader(); r.onload = (ev) => { profile.foto_profil = ev.target.result; document.getElementById('profil-avatar').src = profile.foto_profil; document.getElementById('header-avatar').src = profile.foto_profil; simpanProfilAkun(); }; r.readAsDataURL(f);
}

function hitungOtomatisKalori() {
    const gen = document.getElementById('input-gender').value; const usia = parseInt(document.getElementById('input-usia').value)||22;
    const tb = parseFloat(document.getElementById('input-tb').value)||170; const bb = parseFloat(document.getElementById('input-bb').value)||65;
    const prog = document.getElementById('input-jenis-program').value;
    let bmr = (10 * bb) + (6.25 * tb) - (5 * usia) + (gen === 'L' ? 5 : -161);
    profile.kaloriOtomatis = Math.round(bmr * 1.375 + (prog === 'cutting' ? -500 : (prog === 'bulking' ? 400 : 0)));
    renderHome();
}

async function simpanProfilAkun() {
    profile.nama = document.getElementById('input-nama').value; profile.usia = parseInt(document.getElementById('input-usia').value);
    profile.tb = parseFloat(document.getElementById('input-tb').value); profile.bb = parseFloat(document.getElementById('input-bb').value); profile.jenis_program = document.getElementById('input-jenis-program').value;
    await fetch(`${API}/profile/${UID}`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(profile)}); showToast("Konfigurasi Profil Diperbarui!");
}

function cekKunci() {
    if(!profile.target_bb || !profile.program_start_date) {
        document.getElementById('ui-kunci-target').classList.remove('hidden'); document.getElementById('ui-jadwal-aktif').classList.add('hidden');
        document.getElementById('ui-evaluasi-akhir').classList.add('hidden'); document.getElementById('btn-trigger-finish').classList.add('hidden');
    } else {
        document.getElementById('ui-kunci-target').classList.add('hidden'); document.getElementById('ui-jadwal-aktif').classList.remove('hidden');
        const tglIni = new Date().toISOString().split('T')[0];
        let hariTerpilih = datesArray.includes(tglIni) ? tglIni : datesArray[0]; 
        renderPicker(); pilihHari(hariTerpilih); cekTombolFinish();
    }
}

async function simpanTargetBBAwal() {
    const val = parseFloat(document.getElementById('input-target-bb-awal').value); if(!val) return showToast("Masukkan Target Berat!", "error");
    profile.target_bb = val; profile.program_start_date = new Date().toISOString().split('T')[0];
    await fetch(`${API}/profile/${UID}`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(profile)});
    showToast("Protokol Misi 7 Hari Dimulai!"); await sinkronisasiDataHarian();
}

function renderPicker() {
    const p = document.getElementById('day-picker'); p.innerHTML = "";
    const tglIni = new Date().toISOString().split('T')[0];
    datesArray.forEach((dStr) => {
        const isSelesai = weekly[dStr].selesai; const isFuture = dStr > tglIni;
        const d = new Date(dStr); const formatTgl = d.getDate() + '/' + (d.getMonth()+1); const namaHari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][d.getDay()];
        
        let baseStyle = "min-w-[65px] flex-col rounded-2xl flex items-center justify-center p-3 cursor-pointer transition text-xs border ";
        if(dStr === activeDateStr) baseStyle += "bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.4)] transform scale-105 font-bold";
        else if (isSelesai) baseStyle += "bg-purple-900/30 text-purple-300 border-purple-500/30 font-bold";
        else if (isFuture) baseStyle += "bg-black/20 text-slate-600 border-white/5 opacity-60";
        else baseStyle += "bg-white/5 text-slate-300 border-white/10 font-semibold";

        p.innerHTML += `<div onclick="pilihHari('${dStr}')" class="${baseStyle}"><span class="mb-1 tracking-wider uppercase text-[10px]">${namaHari.substring(0,3)}</span><span class="text-[12px] font-headline">${formatTgl}</span></div>`;
    });
}

function pilihHari(dStr) {
    activeDateStr = dStr; renderPicker(); tempImg = null;
    const d = weekly[dStr]; const tglIni = new Date().toISOString().split('T')[0];
    const dateObj = new Date(dStr);
    
    document.getElementById('selected-day-title').innerText = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][dateObj.getDay()] + ", " + dateObj.getDate() + '/' + (dateObj.getMonth()+1);
    const statusBdg = document.getElementById('badge-status-hari');
    const pFase1 = document.getElementById('fase-perencanaan'); const pFase2 = document.getElementById('fase-evaluasi'); const pFase3 = document.getElementById('fase-terkunci'); const pMasaDepan = document.getElementById('pesan-masa-depan');
    const areaAksi = document.getElementById('area-interaksi-hari');

    if(dStr > tglIni) {
        statusBdg.innerText = "Locked"; statusBdg.className = "text-[9px] font-extrabold px-3 py-1 rounded-full bg-white/5 text-slate-400 border border-white/10";
        areaAksi.classList.add('hidden'); pMasaDepan.classList.remove('hidden'); return;
    }
    
    areaAksi.classList.remove('hidden'); pMasaDepan.classList.add('hidden');
    if(!d.olahraga) {
        statusBdg.innerText = "Kosong"; statusBdg.className = "text-[9px] font-extrabold px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20";
        pFase1.classList.remove('hidden'); pFase2.classList.add('hidden'); pFase3.classList.add('hidden');
        document.getElementById('sport-name-display').innerText = "Pilih Aktivitas Latihan";
        document.getElementById('form-jam-berangkat').classList.remove('hidden');
    } else {
        if(d.selesai) {
            statusBdg.innerText = "Completed"; statusBdg.className = "text-[9px] font-extrabold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
            pFase1.classList.add('hidden'); pFase2.classList.add('hidden'); pFase3.classList.remove('hidden');
            document.getElementById('resume-durjar').innerText = `${d.durasi} Mnt / ${d.jarak} Km`;
            let paceStr = "-:--"; if(d.jarak > 0 && d.durasi > 0) { let pm = Math.floor(d.durasi/d.jarak); let ps = Math.floor(((d.durasi/d.jarak)-pm)*60).toString().padStart(2, '0'); paceStr = `${pm}:${ps}`; }
            document.getElementById('resume-kalpace').innerText = `${d.kalori_bakar} Kkal / ${paceStr}`;
            if(d.foto_bukti) { document.getElementById('photo-preview-locked').src = d.foto_bukti; document.getElementById('photo-preview-locked').classList.remove('hidden'); } else document.getElementById('photo-preview-locked').classList.add('hidden');
        } else {
            statusBdg.innerText = "Active"; statusBdg.className = "text-[9px] font-extrabold px-3 py-1 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30";
            pFase1.classList.add('hidden'); pFase2.classList.remove('hidden'); pFase3.classList.add('hidden');
            const btn = document.getElementById('btn-submit-eval'); btn.disabled = true; btn.className = "w-full bg-white/5 text-slate-500 font-bold py-4 rounded-full text-sm transition"; btn.innerText = "Upload Visual untuk Mengunci";
            document.getElementById('photo-preview-input').classList.add('hidden');
        }
    }
}

function pilihO(n) { 
    tempSport = n; document.getElementById('sport-name-display').innerText = n; document.getElementById('modal-sport').classList.add('hidden');
    if(n === "Istirahat Total") { document.getElementById('form-jam-berangkat').classList.add('hidden'); document.getElementById('plan-time-setup').value = "00:00"; } 
    else document.getElementById('form-jam-berangkat').classList.remove('hidden');
}
function pilihOlahragaManual() { const m = document.getElementById('manual-sport-name').value; if(m) { dbOlahraga[m] = { icon: "fa-dumbbell", kalM: 7, kalK: 0 }; pilihO(m); } }

async function simpanRencanaMingguan() {
    let jam = document.getElementById('plan-time-setup').value; 
    if(!tempSport) return showToast("Pilih aktivitas!", "error");
    if(tempSport !== "Istirahat Total" && !jam) return showToast("Masukkan jam eksekusi!", "error");
    
    let isSelesai = (tempSport === "Istirahat Total");
    weekly[activeDateStr].olahraga = tempSport; weekly[activeDateStr].jam = jam;
    
    await fetch(`${API}/plan/${UID}`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({tanggal: activeDateStr, olahraga: tempSport, jam_mulai: jam, selesai: isSelesai, durasi: 0, jarak: 0, kalori_bakar: 0, foto_bukti: ""})});
    
    if(isSelesai) { weekly[activeDateStr].selesai = true; showToast("Sesi Istirahat berhasil dikunci."); } else showToast("Protokol Jadwal tersimpan!"); 
    pilihHari(activeDateStr); cekTombolFinish();
}

function toggleLiveTracking() {
    const b = document.getElementById('btn-toggle-track');
    if(!isTracking) {
        if(!navigator.geolocation) return showToast("GPS tidak didukung perangkat", "error");
        isTracking = true; b.innerHTML = `Stop`; b.classList.replace('bg-sky-500', 'bg-rose-500'); b.style.boxShadow = '0 0 15px rgba(244,63,94,0.4)';
        document.getElementById('map-frame').classList.remove('hidden'); document.getElementById('live-stats-row').classList.remove('hidden'); document.getElementById('live-stats-row').classList.add('grid');
        
        coords = []; trackDist = 0; startTime = Date.now();
        if(!map) { map = L.map('map-frame').setView([-6.200, 106.816], 15); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map); }
        setTimeout(() => map.invalidateSize(), 300);
        if(polyline) map.removeLayer(polyline); polyline = L.polyline([], {color: '#a855f7', weight: 4}).addTo(map);

        const options = { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 };
        watchId = navigator.geolocation.watchPosition(pos => {
            const latlng = [pos.coords.latitude, pos.coords.longitude];
            if(coords.length > 0) {
                const step = map.distance(coords[coords.length-1], latlng);
                if(step < 100) trackDist += step / 1000;
            }
            coords.push(latlng); polyline.addLatLng(latlng);
            if(!marker) marker = L.circleMarker(latlng, {radius: 6, color: '#fff', fillColor: '#a855f7', fillOpacity: 1, weight: 2}).addTo(map); else marker.setLatLng(latlng);
            map.setView(latlng, 17);
        }, () => showToast("Mencari Sinyal GPS...", "error"), options);
        trackTimer = setInterval(updateStats, 1000);
    } else {
        isTracking = false; b.innerHTML = `Mulai Radar`; b.classList.replace('bg-rose-500', 'bg-sky-500'); b.style.boxShadow = '0 0 15px rgba(14,165,233,0.4)';
        navigator.geolocation.clearWatch(watchId); clearInterval(trackTimer);
        document.getElementById('eval-duration').value = ((Date.now() - startTime) / 60000).toFixed(1);
        document.getElementById('eval-distance').value = trackDist.toFixed(2);
        hitungKaloriEvaluasi();
    }
}

function updateStats() {
    if(!startTime) return; const ms = Date.now() - startTime; const m = ms/60000;
    document.getElementById('live-timer-display').innerText = `${Math.floor(m).toString().padStart(2,'0')}:${Math.floor((ms%60000)/1000).toString().padStart(2,'0')}`;
    document.getElementById('live-dist-display').innerText = `${trackDist.toFixed(2)}`;
    let pace = "-:--"; if(trackDist > 0.05) { const pm = m/trackDist; pace = `${Math.floor(pm)}:${Math.floor((pm-Math.floor(pm))*60).toString().padStart(2,'0')}`; }
    document.getElementById('live-pace-display').innerText = pace;
}

function previewFotoHarian(e) {
    const f = e.target.files[0]; if(!f) return;
    const r = new FileReader(); r.onload = (ev) => {
        tempImg = ev.target.result; document.getElementById('photo-preview-input').src = tempImg; document.getElementById('photo-preview-input').classList.remove('hidden');
        const btn = document.getElementById('btn-submit-eval'); btn.disabled = false; btn.className = "w-full bg-white text-black hover:bg-slate-200 font-headline py-4 rounded-full text-sm shadow-[0_0_20px_rgba(255,255,255,0.3)] active:scale-95 transition-all"; btn.innerText = "Kunci Tugas Harian!";
    }; r.readAsDataURL(f);
}

function hitungKaloriEvaluasi() {
    const drs = parseFloat(document.getElementById('eval-duration').value)||0; const jrk = parseFloat(document.getElementById('eval-distance').value)||0;
    const db = dbOlahraga[weekly[activeDateStr].olahraga] || { kalM: 7, kalK: 0 };
    let kal = Math.round(db.kalK > 0 && jrk > 0 ? db.kalK * jrk : db.kalM * drs);
    document.getElementById('eval-cal').innerText = `${kal} Kkal`; return kal;
}

async function simpanEvaluasiHarian() {
    if(!tempImg) return showToast("Sertakan data visual!", "error"); if(isTracking) toggleLiveTracking();
    const d = parseFloat(document.getElementById('eval-duration').value)||0; const j = parseFloat(document.getElementById('eval-distance').value)||0; const k = hitungKaloriEvaluasi();
    weekly[activeDateStr].selesai = true; weekly[activeDateStr].foto_bukti = tempImg; weekly[activeDateStr].durasi = d; weekly[activeDateStr].jarak = j; weekly[activeDateStr].kalori_bakar = k;
    await fetch(`${API}/plan/${UID}`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({tanggal: activeDateStr, olahraga: weekly[activeDateStr].olahraga, jam_mulai: weekly[activeDateStr].jam, selesai: true, durasi: d, jarak: j, kalori_bakar: k, foto_bukti: tempImg})});
    showToast("Tugas harian tervalidasi."); pilihHari(activeDateStr); cekTombolFinish(); renderHome();
}

function cekTombolFinish() {
    let muncul = true; datesArray.forEach(dStr => { if(!weekly[dStr].olahraga || !weekly[dStr].selesai) muncul = false; });
    if (muncul) document.getElementById('btn-trigger-finish').classList.remove('hidden'); else document.getElementById('btn-trigger-finish').classList.add('hidden');
}
function validasiGarisFinish() {
    let belumIsi = []; let belumSelesai = [];
    datesArray.forEach(dStr => {
        const h = new Date(dStr); const nmHari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][h.getDay()].substring(0,3);
        if(!weekly[dStr].olahraga) belumIsi.push(nmHari); else if(!weekly[dStr].selesai) belumSelesai.push(nmHari);
    });
    if(belumIsi.length > 0 || belumSelesai.length > 0) {
        let msg = "PROTOKOL BELUM LENGKAP!<br>"; if(belumIsi.length > 0) msg += `Kosong: <b>${belumIsi.join(', ')}</b><br>`; if(belumSelesai.length > 0) msg += `Belum dieksekusi: <b>${belumSelesai.join(', ')}</b>`; showToast(msg, "error");
    } else { document.getElementById('btn-trigger-finish').classList.add('hidden'); document.getElementById('ui-jadwal-aktif').classList.add('hidden'); document.getElementById('ui-evaluasi-akhir').classList.remove('hidden'); }
}
async function selesaikanMingguIni() {
    const bb = parseFloat(document.getElementById('input-bb-akhir-minggu').value); const ev = document.getElementById('input-evaluasi-mingguan').value;
    if(!bb || !ev) return showToast("Lengkapi form kalibrasi!", "error");
    profile.bb = bb; profile.target_bb = null; profile.program_start_date = null;
    datesArray.forEach(d => { weekly[d] = { tanggal: d, olahraga: null, jam: "", selesai: false, foto: "" }; });
    document.getElementById('input-bb-akhir-minggu').value = ""; document.getElementById('input-evaluasi-mingguan').value = ""; 
    showToast("Siklus berhasil di-reset!"); cekKunci();
}
function cariDatabaseMakanan() {
    const inpt = document.getElementById('food-search').value.toLowerCase(); const box = document.getElementById('food-suggestions'); box.innerHTML = "";
    if(inpt.length < 2) return box.classList.add('hidden');
    const hsl = dbMakanan.filter(m => m.nama.toLowerCase().includes(inpt));
    if(hsl.length > 0) { box.classList.remove('hidden'); hsl.forEach(h => { box.innerHTML += `<div onclick="pilihMakananDB('${h.nama}', ${h.kalori})" class="p-4 border-b border-white/5 last:border-0 cursor-pointer text-sm font-semibold flex justify-between hover:bg-white/5 transition text-white"><span class="text-slate-300">${h.nama}</span><span class="text-emerald-400 font-headline">${h.kalori} Kkal</span></div>`; }); }
}
function pilihMakananDB(n, k) { document.getElementById('manual-food-name').value = n; document.getElementById('manual-food-cal').value = k; document.getElementById('food-suggestions').classList.add('hidden'); document.getElementById('food-search').value = ""; }
async function tambahMakananManual() {
    const n = document.getElementById('manual-food-name').value; const k = parseInt(document.getElementById('manual-food-cal').value); const c = document.getElementById('food-category-select').value;
    if(n && k) {
        foodLog[c].push({ nama: n, kalori: k }); const tglIni = new Date().toISOString().split('T')[0];
        await fetch(`${API}/food/${UID}`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({tanggal: tglIni, kategori: c, nama_makanan: n, kalori: k})});
        document.getElementById('manual-food-name').value = ""; document.getElementById('manual-food-cal').value = ""; showToast("Log Nutrisi tercatat."); renderFood(); renderHome();
    } else showToast("Parameter kosong!", "error");
}
function renderFood() {
    const c = document.getElementById('diary-list-container'); c.innerHTML = ""; const l = { sarapan: "🍳 Pagi", siang: "🍱 Siang", malam: "🍽️ Malam", camilan: "🍩 Camilan" };
    for(let k in l) {
        let h = foodLog[k].map(i => `<li class="flex justify-between items-center py-4 px-5 bg-white/5 border border-white/10 rounded-2xl mb-3 text-sm font-medium text-slate-300"><span>${i.nama}</span><span class="text-white font-headline">${i.kalori} Kkal</span></li>`).join('');
        c.innerHTML += `<div class="mb-5"><h4 class="font-extrabold text-[10px] text-slate-500 uppercase tracking-widest mb-3">${l[k]}</h4><ul>${h || '<li class="text-slate-600 text-xs italic px-4 py-2 border border-dashed border-white/10 rounded-xl bg-white/5">Belum ada entri</li>'}</ul></div>`;
    }
}
function renderHome() {
    let tMsk = 0; for(let k in foodLog) tMsk += foodLog[k].reduce((s, v) => s + v.kalori, 0);
    const tglIni = new Date().toISOString().split('T')[0]; const pld = weekly[tglIni]; let tBkr = (pld && pld.selesai) ? pld.kalori_bakar : 0;
    const tgt = profile.kaloriOtomatis || 2000; let sisa = tgt - tMsk + tBkr;
    document.getElementById('home-target').innerText = tgt; document.getElementById('home-masuk').innerText = tMsk; document.getElementById('home-bakar').innerText = tBkr || 0; 
    const circle = document.getElementById('circle-progress'); const sisaText = document.getElementById('home-sisa'); const sisaLabel = document.getElementById('home-sisa-label');
    if (sisa < 0) { sisaText.innerText = Math.abs(sisa); sisaText.classList.replace('text-white', 'text-rose-500'); sisaLabel.innerText = "OVER LIMIT!"; sisaLabel.classList.replace('text-slate-400', 'text-rose-500'); circle.classList.add('over-limit'); circle.style.strokeDasharray = `100, 100`; if(!overLimitAlertTriggered) { showToast("PERINGATAN: Batas kalori terlampaui!", "error"); overLimitAlertTriggered = true; } } 
    else { sisaText.innerText = sisa; sisaText.classList.replace('text-rose-500', 'text-white'); sisaLabel.innerText = "Sisa Kkal"; sisaLabel.classList.replace('text-rose-500', 'text-slate-400'); circle.classList.remove('over-limit'); circle.style.strokeDasharray = `${100 - (Math.max((sisa / tgt) * 100, 0))}, 100`; overLimitAlertTriggered = false; }
}