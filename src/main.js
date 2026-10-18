
import Phaser from 'phaser';

class BeachScene extends Phaser.Scene {
  constructor() {
    super('BeachScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#87CEEB');

    // Ocean
    this.add.rectangle(480, 230, 960, 250, 0x35B9CC);

    // Sand
    this.add.rectangle(480, 475, 960, 230, 0xF4D79B);

    // Game title
    this.add.text(480, 55, 'BEACH BOSS', {
      fontSize: '42px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Beach bar
    this.add.rectangle(130, 350, 180, 130, 0xA66B43);

    this.add.text(130, 350, 'BEACH BAR', {
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Tables
    [380, 580, 780].forEach((x, i) => {
      this.add.rectangle(x, 410, 120, 25, 0x8B5A3C);
      this.add.text(x, 380, `Table ${i + 1}`, {
        fontSize: '18px',
        color: '#333333'
      }).setOrigin(0.5);
    });

    // Waitress
    const waitress = this.add.circle(480, 500, 22, 0xF06292);

    // Move waitress on tap
    this.input.on('pointerdown', pointer => {
      this.tweens.add({
        targets: waitress,
        x: pointer.x,
        y: pointer.y,
        duration: 600
      });
    });
  }
}

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: BeachScene
};

new Phaser.Game(config);