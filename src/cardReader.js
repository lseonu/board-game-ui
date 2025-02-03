// This module would control your physical card reader hardware

class CardReader {
  constructor() {
    this.port = null;
    this.reader = null;
  }

  async connect() {
    try {
      // Connect to card reader via Serial API
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 9600 });
      
      this.reader = this.port.readable.getReader();
      
      console.log('Card reader connected successfully');
    } catch (error) {
      console.error('Failed to connect to card reader:', error);
      throw error;
    }
  }

  async drawCard() {
    if (!this.port) {
      throw new Error('Card reader not connected');
    }

    try {
      // Send command to draw card
      const writer = this.port.writable.getWriter();
      const command = new Uint8Array([0x01]); // Example command
      await writer.write(command);
      writer.releaseLock();
      
      // Wait for confirmation
      const response = await this.readResponse();
      if (response !== 'SUCCESS') {
        throw new Error('Card reader failed to draw card');
      }
    } catch (error) {
      console.error('Error drawing card:', error);
      throw error;
    }
  }

  async readResponse() {
    try {
      const { value, done } = await this.reader.read();
      if (done) {
        throw new Error('Card reader disconnected');
      }
      return new TextDecoder().decode(value);
    } catch (error) {
      console.error('Error reading from card reader:', error);
      throw error;
    }
  }
}

export const controlCardReader = new CardReader(); 