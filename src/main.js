import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config.js';
import BeachScene from './scenes/BeachScene.js';

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
  scene: BeachScene
};

new Phaser.Game(config);
