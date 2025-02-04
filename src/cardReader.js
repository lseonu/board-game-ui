// This module would control your physical card reader hardware

class CardReader {
  constructor() {
    this.isConnected = false;
  }

  async connect() {
    if (!this.isConnected) {
      // For testing without hardware, just set connected to true
      this.isConnected = true;
      console.log('Card reader connected successfully');
    }
  }

  async drawCard() {
    if (!this.isConnected) {
      throw new Error('Card reader not connected');
    }

    // For testing, simulate a successful card draw
    return Promise.resolve('SUCCESS');
  }
}

export const controlCardReader = new CardReader(); 