import { GameEntity, CONFIG } from './Types';
import { SoundEffects } from './SoundEffects';

export class UI {
  // Screen views
  private menuScreen = document.getElementById('menu-screen')!;
  private hudOverlay = document.getElementById('hud-overlay')!;
  private rewindOverlay = document.getElementById('rewind-overlay')!;
  private gameoverScreen = document.getElementById('gameover-screen')!;
  private victoryScreen = document.getElementById('victory-screen')!;
  private sidebarToggle = document.getElementById('sidebar-toggle')!;
  private hudSidebar = document.getElementById('hud-sidebar')!;

  // Values
  private scoreVal = document.getElementById('score-val')!;
  private multVal = document.getElementById('mult-val')!;
  private lengthBar = document.getElementById('length-bar')!;
  private lengthVal = document.getElementById('length-val')!;
  private timerVal = document.getElementById('timer-val')!;
  private alertContainer = document.getElementById('anomaly-alerts')!;
  private layerContainer = document.getElementById('layer-indicators-container')!;
  private audioToggle = document.getElementById('audio-toggle')!;

  // Stats summaries
  private goCause = document.getElementById('gameover-cause')!;
  private goScore = document.getElementById('go-score')!;
  private goLength = document.getElementById('go-length')!;
  private goLayers = document.getElementById('go-layers')!;
  private goAnomalies = document.getElementById('go-anomalies')!;

  private vicScore = document.getElementById('vic-score')!;
  private vicLength = document.getElementById('vic-length')!;
  private vicLayers = document.getElementById('vic-layers')!;
  private vicAnomalies = document.getElementById('vic-anomalies')!;

  private rewindSever = document.getElementById('rewind-sever-count')!;

  constructor(
    private onStartGame: () => void,
    private sfx: SoundEffects
  ) {
    this.setupListeners();
  }

  private setupListeners() {
    // Menu start button
    document.getElementById('start-button')!.addEventListener('click', () => {
      this.sfx.enableAudio();
      this.onStartGame();
    });

    // Post-game buttons
    document.getElementById('restart-go-button')!.addEventListener('click', () => {
      this.onStartGame();
    });

    document.getElementById('restart-vic-button')!.addEventListener('click', () => {
      this.onStartGame();
    });

    // Sound hum toggle
    this.audioToggle.addEventListener('click', () => {
      this.sfx.enableAudio();
      const currentLabel = this.audioToggle.textContent || '';
      if (currentLabel.includes('ON')) {
        this.sfx.setHumEnabled(false);
        this.audioToggle.textContent = '🔇 HUM OFF';
        this.audioToggle.classList.add('btn-red');
      } else {
        this.sfx.setHumEnabled(true);
        this.audioToggle.textContent = '🔊 HUM ON';
        this.audioToggle.classList.remove('btn-red');
      }
    });

    // Sidebar legend toggle
    this.sidebarToggle.addEventListener('click', () => {
      this.hudSidebar.classList.toggle('hidden');
    });
  }

  public showMenu() {
    this.hideAll();
    this.menuScreen.classList.remove('hidden');
  }

  public showGameplay() {
    this.hideAll();
    this.hudOverlay.classList.remove('hidden');
  }

  public showRewind(severCount: number) {
    this.rewindSever.textContent = severCount.toString();
    this.rewindOverlay.classList.remove('hidden');
  }

  public hideRewind() {
    this.rewindOverlay.classList.add('hidden');
  }

  public showGameOver(cause: string, stats: { score: number; maxLength: number; maxLayers: number; anomalies: number }) {
    this.hideAll();
    this.goCause.textContent = cause;
    this.goScore.textContent = stats.score.toLocaleString();
    this.goLength.textContent = stats.maxLength.toString();
    this.goLayers.textContent = stats.maxLayers.toString();
    this.goAnomalies.textContent = stats.anomalies.toString();
    this.gameoverScreen.classList.remove('hidden');
  }

  public showVictory(stats: { score: number; maxLength: number; maxLayers: number; anomalies: number }) {
    this.hideAll();
    this.vicScore.textContent = stats.score.toLocaleString();
    this.vicLength.textContent = stats.maxLength.toString();
    this.vicLayers.textContent = stats.maxLayers.toString();
    this.vicAnomalies.textContent = stats.anomalies.toString();
    this.victoryScreen.classList.remove('hidden');
  }

  private hideAll() {
    this.menuScreen.classList.add('hidden');
    this.hudOverlay.classList.add('hidden');
    this.rewindOverlay.classList.add('hidden');
    this.gameoverScreen.classList.add('hidden');
    this.victoryScreen.classList.add('hidden');
  }

  /**
   * Update all numeric HUD variables
   */
  public updateHUD(
    score: number,
    multiplier: number,
    length: number,
    timeSec: number,
    unlockedLayers: number,
    activeLayer: number
  ) {
    // Score pads with zeros
    this.scoreVal.textContent = score.toString().padStart(6, '0');
    this.multVal.textContent = `x${multiplier.toFixed(1)}`;
    
    // Scale timer format mm:ss
    const mins = Math.floor(timeSec / 60);
    const secs = Math.floor(timeSec % 60);
    this.timerVal.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    // Update length bar
    // Standard square thresholds grow dynamically as L = n^2
    let threshold = 16;
    if (length >= 16) {
      const nextN = Math.floor(Math.sqrt(length)) + 1;
      threshold = nextN * nextN;
    }
    const percent = Math.min(100, (length / threshold) * 100);
    this.lengthBar.style.width = `${percent}%`;
    this.lengthVal.textContent = `${length} / ${threshold}`;

    // Update layer dot indicators in UI
    this.updateLayersUI(unlockedLayers, activeLayer);
  }

  private updateLayersUI(unlocked: number, active: number) {
    this.layerContainer.innerHTML = '';
    
    for (let i = 0; i < CONFIG.MAX_LAYERS; i++) {
      const dot = document.createElement('span');
      dot.className = 'layer-dot';
      dot.textContent = `D${i}`;

      if (i >= unlocked) {
        dot.className += ' locked';
        let req = 16;
        if (i === 2) req = 25;
        dot.title = `Dimension ${i} - Unlocks at L = ${req}`;
      } else {
        dot.title = `Dimension ${i} - Unlocked`;
        if (i === active) {
          dot.className += ' active';
        }
      }
      this.layerContainer.appendChild(dot);
    }
  }

  /**
   * Populate incoming critical alerts for Upstream Causal Anomalies
   */
  public updateAlerts(anomalies: GameEntity[]) {
    this.alertContainer.innerHTML = '';

    for (const ent of anomalies) {
      const card = document.createElement('div');
      card.className = 'anomaly-alert-card';

      const progress = ent.cascadeProgress || 0;
      const isImminent = ent.hasCascaded;
      
      const title = isImminent 
        ? `🚨 PARADOX ACTIVE - D${ent.z}`
        : `⚠️ CASUAL ANOMALY - D${ent.z}`;

      const description = isImminent
        ? `Upstream cascade firing! Base Timeline taking damage. Ram spawner on D${ent.z} to cancel!`
        : `Causal cascade stream imminent! Navigate to Horizon on D${ent.z} and RAM spawner.`;

      card.innerHTML = `
        <div class="alert-header">
          <span>${title}</span>
          <span>${Math.round(progress * 100)}%</span>
        </div>
        <div class="alert-body">
          ${description}
        </div>
        <div class="alert-progress-container">
          <div class="alert-progress" style="width: ${progress * 100}%; background-color: ${isImminent ? 'var(--red)' : 'var(--pink)'}"></div>
        </div>
      `;

      this.alertContainer.appendChild(card);
    }
  }
}
