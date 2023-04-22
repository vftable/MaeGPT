class Queue {
  constructor() {
    this.items = [];
    this.isProcessing = false;
  }
  
  enqueue(item) {
    this.items.push(item);
    
    if (!this.isProcessing) {
      this.dequeue();
    }
  }
  
  async dequeue() {
    this.isProcessing = true;
    
    while (this.items.length > 0) {
      const item = await this.items.shift();
      await item();
    }
    
    this.isProcessing = false;
  }
}

module.exports = {
  Queue
};