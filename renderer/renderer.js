const plantStage = document.getElementById('plantStage');
const plantGrowth = document.getElementById('plantGrowth');
const statusText = document.getElementById('statusText');
const waterBtn = document.getElementById('waterBtn');
const fertilizeBtn = document.getElementById('fertilizeBtn');

function formatStatus(state) {
  const needs = [];
  if (!state.wateredToday) {
    needs.push('water');
  }
  if (!state.fertilizedToday) {
    needs.push('fertilizer');
  }

  const growthLabel = `Stage ${state.growthStage}`;
  if (state.lastGrowthDried) {
    return `${growthLabel} · last growth dried out · needs ${needs.join(' & ') || 'nothing'}`;
  }
  return `${growthLabel} · needs ${needs.join(' & ') || 'nothing'}`;
}

function applyGrowth(stage) {
  const scale = 0.6 + stage * 0.04;
  plantGrowth.style.transform = `scale(${scale})`;
}

async function refresh() {
  const state = await window.plantApi.getState();
  applyGrowth(state.growthStage);
  statusText.textContent = formatStatus(state);
}

plantStage.addEventListener('mouseenter', () => {
  plantStage.classList.add('hovered');
});

plantStage.addEventListener('mouseleave', () => {
  plantStage.classList.remove('hovered');
});

waterBtn.addEventListener('click', async () => {
  const state = await window.plantApi.water();
  applyGrowth(state.growthStage);
  statusText.textContent = formatStatus(state);
});

fertilizeBtn.addEventListener('click', async () => {
  const state = await window.plantApi.fertilize();
  applyGrowth(state.growthStage);
  statusText.textContent = formatStatus(state);
});

refresh();
