const plantStage = document.getElementById('plantStage');
const plantLeaves = document.getElementById('plantLeaves');
const plantGrowth = document.getElementById('plantGrowth');
const waterBtn = document.getElementById('waterBtn');
const fertilizeBtn = document.getElementById('fertilizeBtn');
let dragging = false;
let dragStart = { x: 0, y: 0, winX: 0, winY: 0 };

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
}

if (plantLeaves) {
  plantLeaves.addEventListener('mouseenter', () => {
    plantLeaves.classList.add('hovered');
  });

  plantLeaves.addEventListener('mouseleave', () => {
    plantLeaves.classList.remove('hovered');
  });
}

plantStage.addEventListener('mousedown', (event) => {
  dragging = true;
  dragStart = {
    x: event.screenX,
    y: event.screenY,
    winX: window.screenX,
    winY: window.screenY
  };
});

window.addEventListener('mouseup', () => {
  dragging = false;
});

window.addEventListener('mousemove', (event) => {
  if (!dragging) {
    return;
  }
  const nextX = dragStart.winX + (event.screenX - dragStart.x);
  const nextY = dragStart.winY + (event.screenY - dragStart.y);
  window.plantApi.moveWindow(nextX, nextY);
});

waterBtn.addEventListener('click', async () => {
  const state = await window.plantApi.water();
  applyGrowth(state.growthStage);
});

fertilizeBtn.addEventListener('click', async () => {
  const state = await window.plantApi.fertilize();
  applyGrowth(state.growthStage);
});

refresh();
