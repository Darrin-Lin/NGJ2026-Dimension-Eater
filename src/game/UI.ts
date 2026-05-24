import { GameEntity } from './Types';
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
  private immunityBanner = document.getElementById('immunity-banner')!;
  private immunityTimer = document.getElementById('immunity-timer')!;

  // Values
  private scoreVal = document.getElementById('score-val')!;
  private multVal = document.getElementById('mult-val')!;
  private lengthBar = document.getElementById('length-bar')!;
  private lengthVal = document.getElementById('length-val')!;
  private timerVal = document.getElementById('timer-val')!;
  private alertContainer = document.getElementById('anomaly-alerts')!;
  private unlockedDimVal = document.getElementById('unlocked-dim-val')!;
  private audioToggle = document.getElementById('audio-toggle')!;

  // Player 2 elements for Versus Mode
  private score2Box = document.getElementById('score2-box')!;
  private score2Val = document.getElementById('score2-val')!;
  private length2Box = document.getElementById('length2-box')!;
  private length2Bar = document.getElementById('length2-bar')!;
  private length2Val = document.getElementById('length2-val')!;
  private currentMode: 'SINGLE' | 'VERSUS' = 'SINGLE';

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
  
  // Versus results screen elements
  private versusScreen = document.getElementById('versus-screen')!;
  private vsWinnerTitle = document.getElementById('vs-winner-title')!;
  private vsSummaryCause = document.getElementById('vs-summary-cause')!;
  private vsP1Card = document.getElementById('vs-p1-card')!;
  private vsP2Card = document.getElementById('vs-p2-card')!;
  private vsP1Status = document.getElementById('vs-p1-status')!;
  private vsP2Status = document.getElementById('vs-p2-status')!;
  private vsP1Score = document.getElementById('vs-p1-score')!;
  private vsP2Score = document.getElementById('vs-p2-score')!;
  private vsP1Length = document.getElementById('vs-p1-length')!;
  private vsP2Length = document.getElementById('vs-p2-length')!;


  constructor(
    private onStartGame: (mode: 'SINGLE' | 'VERSUS') => void,
    private onReturnToMenu: () => void,
    private sfx: SoundEffects
  ) {
    this.setupListeners();
  }

  private setupListeners() {
    // Menu start buttons
    document.getElementById('start-single')!.addEventListener('click', () => {
      this.sfx.enableAudio();
      this.currentMode = 'SINGLE';
      this.onStartGame('SINGLE');
    });

    document.getElementById('start-versus')!.addEventListener('click', () => {
      this.sfx.enableAudio();
      this.currentMode = 'VERSUS';
      this.onStartGame('VERSUS');
    });

    // Post-game buttons
    document.getElementById('restart-go-button')!.addEventListener('click', () => {
      this.onStartGame(this.currentMode);
    });

    document.getElementById('restart-vic-button')!.addEventListener('click', () => {
      this.onStartGame(this.currentMode);
    });

    document.getElementById('restart-vs-button')!.addEventListener('click', () => {
      this.onStartGame(this.currentMode);
    });

    // Return to Menu buttons
    document.getElementById('menu-go-button')!.addEventListener('click', () => {
      this.showMenu();
      this.onReturnToMenu();
    });

    document.getElementById('menu-vic-button')!.addEventListener('click', () => {
      this.showMenu();
      this.onReturnToMenu();
    });

    document.getElementById('menu-vs-button')!.addEventListener('click', () => {
      this.showMenu();
      this.onReturnToMenu();
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

  public setPlayMode(mode: 'SINGLE' | 'VERSUS') {
    this.currentMode = mode;
    if (mode === 'SINGLE') {
      this.score2Box.classList.add('hidden');
      this.length2Box.classList.add('hidden');
    } else {
      this.score2Box.classList.remove('hidden');
      this.length2Box.classList.remove('hidden');
    }
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

  public showVersusResults(
    winner: 'P1' | 'P2' | 'DRAW',
    cause: string,
    p1Stats: { score: number; maxLength: number; isStabilized: boolean },
    p2Stats: { score: number; maxLength: number; isStabilized: boolean }
  ) {
    this.hideAll();
    
    // Set winner title and neon glow
    if (winner === 'P1') {
      this.vsWinnerTitle.textContent = "PLAYER 1 WINS!";
      this.vsWinnerTitle.className = "screen-title neon-cyan";
      this.vsP1Card.classList.add('winner-highlight');
      this.vsP2Card.classList.remove('winner-highlight');
    } else if (winner === 'P2') {
      this.vsWinnerTitle.textContent = "PLAYER 2 WINS!";
      this.vsWinnerTitle.className = "screen-title neon-pink";
      this.vsP1Card.classList.remove('winner-highlight');
      this.vsP2Card.classList.add('winner-highlight');
    } else {
      this.vsWinnerTitle.textContent = "TIMELINE TIE!";
      this.vsWinnerTitle.className = "screen-title neon-blue";
      this.vsP1Card.classList.remove('winner-highlight');
      this.vsP2Card.classList.remove('winner-highlight');
    }
    
    // Set cause explanation
    this.vsSummaryCause.textContent = cause;
    
    // Set stabilized / collapsed statuses
    this.vsP1Status.textContent = p1Stats.isStabilized ? "STABILIZED" : "COLLAPSED";
    this.vsP1Status.style.color = p1Stats.isStabilized ? "var(--cyan)" : "var(--red)";
    this.vsP1Status.style.borderColor = p1Stats.isStabilized ? "var(--cyan)" : "var(--red)";
    this.vsP1Status.style.boxShadow = p1Stats.isStabilized ? "0 0 10px var(--cyan-dim)" : "0 0 10px var(--red-dim)";
    
    this.vsP2Status.textContent = p2Stats.isStabilized ? "STABILIZED" : "COLLAPSED";
    this.vsP2Status.style.color = p2Stats.isStabilized ? "var(--pink)" : "var(--red)";
    this.vsP2Status.style.borderColor = p2Stats.isStabilized ? "var(--pink)" : "var(--red)";
    this.vsP2Status.style.boxShadow = p2Stats.isStabilized ? "0 0 10px var(--pink-dim)" : "0 0 10px var(--red-dim)";
    
    // Populate stats scores & max lengths
    this.vsP1Score.textContent = Math.floor(p1Stats.score).toLocaleString();
    this.vsP1Length.textContent = p1Stats.maxLength.toString();
    
    this.vsP2Score.textContent = Math.floor(p2Stats.score).toLocaleString();
    this.vsP2Length.textContent = p2Stats.maxLength.toString();
    
    // Show the results overlay screen
    this.versusScreen.classList.remove('hidden');
  }

  private hideAll() {
    this.menuScreen.classList.add('hidden');
    this.hudOverlay.classList.add('hidden');
    this.rewindOverlay.classList.add('hidden');
    this.gameoverScreen.classList.add('hidden');
    this.victoryScreen.classList.add('hidden');
    this.versusScreen.classList.add('hidden');
    this.immunityBanner.classList.add('hidden');
  }

  /**
   * Update the spawn protection / chronal immunity banner remaining time
   */
  public updateImmunity(timeLeft: number) {
    if (timeLeft > 0) {
      this.immunityBanner.classList.remove('hidden');
      this.immunityTimer.textContent = timeLeft.toFixed(1);
    } else {
      this.immunityBanner.classList.add('hidden');
    }
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
    score2?: number,
    length2?: number
  ) {
    // Score pads with zeros
    this.scoreVal.textContent = score.toString().padStart(6, '0');
    this.multVal.textContent = `x${multiplier.toFixed(1)}`;
    
    // Scale timer format mm:ss
    const mins = Math.floor(timeSec / 60);
    const secs = Math.floor(timeSec % 60);
    this.timerVal.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    // Update length bar
    // Standard square thresholds grow dynamically as L = n^2 starting at 4
    let threshold = 4;
    if (length >= 4) {
      const nextN = Math.floor(Math.sqrt(length)) + 1;
      threshold = nextN * nextN;
    }
    const percent = Math.min(100, (length / threshold) * 100);
    this.lengthBar.style.width = `${percent}%`;
    this.lengthVal.textContent = `${length} / ${threshold}`;

    // Update total dimensions count in UI
    this.unlockedDimVal.textContent = unlockedLayers.toString();

    // Player 2 statistics in Versus Mode
    if (this.currentMode === 'VERSUS' && score2 !== undefined && length2 !== undefined) {
      this.score2Val.textContent = score2.toString().padStart(6, '0');
      
      let threshold2 = 4;
      if (length2 >= 4) {
        const nextN2 = Math.floor(Math.sqrt(length2)) + 1;
        threshold2 = nextN2 * nextN2;
      }
      const percent2 = Math.min(100, (length2 / threshold2) * 100);
      this.length2Bar.style.width = `${percent2}%`;
      this.length2Val.textContent = `${length2} / ${threshold2}`;
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
