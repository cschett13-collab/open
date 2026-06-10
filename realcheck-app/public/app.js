// RealCheck frontend — tab switching, input gathering, and result rendering.

const VERDICT_LABELS = {
	real: 'Genuine',
	fake: 'Fake',
	ai_generated: 'AI-generated',
	scam: 'Scam',
	misleading: 'Misleading',
	uncertain: 'Uncertain',
};
const SEVERITY_DOT = { info: '🔵', caution: '🟠', danger: '🔴' };

let activeTab = 'text';
let imageData = null; // { base64, mediaType }

// --- Engine status pill ------------------------------------------------------
fetch('/api/health')
	.then((r) => r.json())
	.then((h) => {
		const pill = document.getElementById('enginePill');
		if (h.engine === 'claude') {
			pill.textContent = `⚡ Live AI · ${h.model}`;
			pill.classList.add('live');
		} else {
			pill.textContent = '🧪 Demo mode (no API key)';
			pill.classList.add('demo');
		}
	})
	.catch(() => {});

// --- Tabs --------------------------------------------------------------------
document.querySelectorAll('.tab').forEach((tab) => {
	tab.addEventListener('click', () => {
		document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
		tab.classList.add('active');
		activeTab = tab.dataset.tab;
		document.querySelectorAll('.panel').forEach((p) => {
			p.classList.toggle('hidden', p.dataset.panel !== activeTab);
		});
	});
});

// --- Image upload ------------------------------------------------------------
const dropzone = document.getElementById('dropzone');
const imageInput = document.getElementById('imageInput');
const preview = document.getElementById('preview');

imageInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
['dragover', 'dragenter'].forEach((ev) =>
	dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add('drag'); })
);
['dragleave', 'drop'].forEach((ev) =>
	dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove('drag'); })
);
dropzone.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));

function handleFile(file) {
	if (!file || !file.type.startsWith('image/')) return;
	const reader = new FileReader();
	reader.onload = () => {
		const result = reader.result;
		imageData = { base64: result.split(',')[1], mediaType: file.type };
		preview.src = result;
		preview.hidden = false;
		dropzone.querySelector('.dz-text').textContent = file.name;
	};
	reader.readAsDataURL(file);
}

// --- Submit ------------------------------------------------------------------
const checkBtn = document.getElementById('checkBtn');
checkBtn.addEventListener('click', runCheck);

async function runCheck() {
	let payload;
	if (activeTab === 'text') {
		const content = document.getElementById('textInput').value.trim();
		if (!content) return shake();
		payload = { type: 'text', content };
	} else if (activeTab === 'url') {
		const content = document.getElementById('urlInput').value.trim();
		if (!content) return shake();
		payload = { type: 'url', content };
	} else {
		if (!imageData) return shake();
		payload = { type: 'image', content: imageData.base64, mediaType: imageData.mediaType };
	}

	setLoading(true);
	try {
		const res = await fetch('/api/check', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});
		const data = await res.json();
		if (data.error) throw new Error(data.error);
		render(data);
	} catch (err) {
		render({
			verdict: 'uncertain',
			confidence: 0,
			headline: 'Could not complete the check',
			summary: err.message,
			signals: [{ label: 'Error', severity: 'danger', detail: err.message }],
			recommendation: 'Try again in a moment.',
		});
	} finally {
		setLoading(false);
	}
}

function setLoading(on) {
	checkBtn.disabled = on;
	checkBtn.querySelector('.btn-label').textContent = on ? 'Analyzing…' : 'Check it';
	checkBtn.querySelector('.spinner').hidden = !on;
}

function shake() {
	checkBtn.animate(
		[{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
		{ duration: 250 }
	);
}

// --- Render ------------------------------------------------------------------
function render(data) {
	const result = document.getElementById('result');
	result.className = 'result v-' + data.verdict;
	result.classList.remove('hidden');

	document.getElementById('verdictBadge').textContent = VERDICT_LABELS[data.verdict] || data.verdict;
	document.getElementById('headline').textContent = data.headline || '';
	document.getElementById('summary').textContent = data.summary || '';
	document.getElementById('recommendation').textContent = data.recommendation || '';

	// Signals
	const signals = document.getElementById('signals');
	signals.innerHTML = '';
	(data.signals || []).forEach((s) => {
		const el = document.createElement('div');
		el.className = 'signal ' + s.severity;
		el.innerHTML = `<span class="signal-dot">${SEVERITY_DOT[s.severity] || '⚪'}</span>
			<span class="signal-text"><strong></strong><span></span></span>`;
		el.querySelector('strong').textContent = s.label;
		el.querySelector('.signal-text span').textContent = s.detail;
		signals.appendChild(el);
	});

	// Gauge animation
	const pct = Math.max(0, Math.min(100, data.confidence || 0));
	const circumference = 327;
	const fill = document.getElementById('gaugeFill');
	const pctEl = document.getElementById('gaugePct');
	requestAnimationFrame(() => {
		fill.style.strokeDashoffset = circumference * (1 - pct / 100);
	});
	let cur = 0;
	clearInterval(window.__gaugeTimer);
	window.__gaugeTimer = setInterval(() => {
		cur += Math.max(1, Math.round(pct / 25));
		if (cur >= pct) { cur = pct; clearInterval(window.__gaugeTimer); }
		pctEl.textContent = cur + '%';
	}, 24);

	result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
