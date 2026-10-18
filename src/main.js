import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config.js';
import BeachScene from './scenes/BeachScene.js';
import ShiftOverlayScene from './scenes/ShiftOverlayScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#172c3a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT
  },
  // BeachScene starts first; it launches the overlay for intro and results cards
  scene: [BeachScene, ShiftOverlayScene]
};

const game = new Phaser.Game(config);

// Expose the game in development only, for debugging from the browser console
if (import.meta.env.DEV) window.beachBoss = game;
