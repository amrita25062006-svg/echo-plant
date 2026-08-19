// ─── CONFIG ───────────────────────────────────────────────
// Paste your Gemini API key here
const API_KEY = 'AQ.Ab8RN6LNszvrCg17-Q7Z2QExTpHT2jpZWTv5zjnhyD3ln98Bew';
const MODEL = 'gemini-2.5-flash';
// ──────────────────────────────────────────────────────────

let imageB64    = '';
let imageType   = 'image/jpeg';
let plantContext = '';

const fileIn      = document.getElementById('file-in');
const preview     = document.getElementById('preview');
const previewWrap = document.getElementById('preview-wrap');
const resultCard  = document.getElementById('result-card');
const identifyBtn = document.getElementById('identify-btn');
const resetBtn    = document.getElementById('reset-btn');
const loadingBar  = document.getElementById('loading-bar');

// ─── FILE HANDLING ────────────────────────────────────────
fileIn.addEventListener('change', e => loadFile(e.target.files[0]));

const dropZone = document.getElementById('drop-zone');
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.style.borderColor = '#639922'; });
dropZone.addEventListener('dragleave', ()  => { dropZone.style.borderColor = '#b0c8a0'; });
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.style.borderColor = '#b0c8a0';
  loadFile(e.dataTransfer.files[0]);
});

function loadFile(file) {
  if (!file) return;
  imageType = file.type || 'image/jpeg';
  const reader = new FileReader();
  reader.onload = ev => {
    imageB64 = ev.target.result.split(',')[1];
    preview.src = ev.target.result;
    previewWrap.style.display = 'block';
    resultCard.style.display = 'none';
    document.getElementById('ask-row').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

// ─── RESET ────────────────────────────────────────────────
resetBtn.addEventListener('click', () => {
  imageB64 = plantContext = '';
  fileIn.value = '';
  previewWrap.style.display = 'none';
  resultCard.style.display = 'none';
});

// ─── IDENTIFY ─────────────────────────────────────────────
identifyBtn.addEventListener('click', async () => {
  if (!imageB64) return;
  if (!API_KEY) {
  alert('API key missing');
  return;
}
  setLoading(identifyBtn, 'Listening to the plant...', true);
  setBar(40);

  const prompt = `Analyze this plant image. Respond ONLY with a valid JSON object — no markdown, no backticks, no extra text.

{
  "common_name": "string",
  "scientific_name": "string",
  "emoji": "one plant-related emoji",
  "health_status": "healthy" | "needs attention" | "struggling",
  "health_note": "one short sentence about visible health",
  "speech": "2-3 sentences spoken in first person AS THE PLANT. Be witty, dramatic, and personality-filled. Mention how you currently feel and one care tip you urgently need.",
  "care": {
    "water": "e.g. every 7 days",
    "light": "e.g. bright indirect",
    "humidity": "e.g. 40–60%",
    "soil": "e.g. well-draining mix"
  }
}`;

  try {
    setBar(70);
const res = await callAPI(imageB64, imageType, prompt);

const raw =
  res.candidates?.[0]?.content?.parts
    ?.map(part => part.text || '')
    .join('') || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const p     = JSON.parse(clean);
    plantContext = JSON.stringify(p);

    renderResult(p);
    setBar(100);
    setTimeout(() => setBar(0), 600);
  } catch (err) {
    alert('Could not identify plant: ' + err.message);
    setBar(0);
  }

  setLoading(identifyBtn, '<i class="ti ti-sparkles"></i> Identify &amp; listen', false);
});

// ─── FOLLOW-UP ────────────────────────────────────────────
document.getElementById('ask-btn').addEventListener('click', async () => {
  const q      = document.getElementById('ask-input').value.trim();
  const ansDiv = document.getElementById('follow-ans');
  if (!q || !plantContext) return;

  setLoading(document.getElementById('ask-btn'), 'The plant is thinking...', true);
  ansDiv.style.display = 'none';

  try {
    const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': API_KEY
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text:
                `You are this plant: ${plantContext}\n\n` +
                `Answer entirely in first person as the plant.\n\n` +
                `Question: "${q}"`
            }
          ]
        }
      ]
    })
  }
);

const res = await response.json();

const ans =
  res.candidates?.[0]?.content?.parts
    ?.map(part => part.text || '')
    .join('')
    .trim() || '';
    ansDiv.textContent = '\u201c' + ans + '\u201d';
    ansDiv.style.display = 'block';
  } catch (err) {
    ansDiv.textContent = 'Your plant seems too distressed to answer right now.';
    ansDiv.style.display = 'block';
  }

  setLoading(document.getElementById('ask-btn'), '<i class="ti ti-message"></i> Ask', false);
});

// ─── RENDER ───────────────────────────────────────────────
function renderResult(p) {
  document.getElementById('plant-emoji').textContent = p.emoji || '🌿';
  document.getElementById('plant-name').textContent  = p.common_name;
  document.getElementById('plant-sci').textContent   = p.scientific_name;
  document.getElementById('plant-speech').textContent = '\u201c' + p.speech + '\u201d';

  const badgeColors = {
    healthy:          ['#EAF3DE', '#27500A'],
    'needs attention': ['#FAEEDA', '#633806'],
    struggling:       ['#FCEBEB', '#791F1F']
  };
  const badgeIcons = {
    healthy:          'ti-heart',
    'needs attention': 'ti-alert-triangle',
    struggling:       'ti-mood-sad'
  };
  const [bg, fg] = badgeColors[p.health_status] || badgeColors['healthy'];
  document.getElementById('health-badge-wrap').innerHTML =
    `<span class="status-badge" style="background:${bg};color:${fg}">
      <i class="ti ${badgeIcons[p.health_status] || 'ti-heart'}"></i>
      ${p.health_status} — ${p.health_note}
    </span>`;

  const careLabels = {
    water:    ['ti-droplet', 'Watering'],
    light:    ['ti-sun',     'Light'],
    humidity: ['ti-cloud',   'Humidity'],
    soil:     ['ti-shovel',  'Soil']
  };
  document.getElementById('care-grid').innerHTML =
    Object.entries(p.care).map(([k, v]) => {
      const [icon, label] = careLabels[k] || ['ti-leaf', k];
      return `<div class="care-chip">
        <div class="label"><i class="ti ${icon}"></i> ${label}</div>
        <div class="val">${v}</div>
      </div>`;
    }).join('');

  document.getElementById('ask-row').style.display = 'block';
  resultCard.style.display = 'block';
}

// ─── HELPERS ──────────────────────────────────────────────
async function callAPI(imageB64, imageType, prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': API_KEY
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: imageType,
                  data: imageB64
                }
              },
              {
                text: prompt
              }
            ]
          }
        ]
      })
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${response.status}`);
  }

  return response.json();
}

function setLoading(btn, html, disabled) {
  btn.innerHTML = html;
  btn.disabled = disabled;
}

function setBar(pct) {
  loadingBar.style.width = pct + '%';
}

