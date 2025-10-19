const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');

class LoadTester {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:3000';
    this.concurrency = options.concurrency || 10;
    this.duration = options.duration || 60; // seconds
    this.requestsPerSecond = options.requestsPerSecond || 100;
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      errors: [],
      startTime: null,
      endTime: null
    };
  }

  async runLoadTest() {
    console.log('Starting load test...');
    console.log(`Target: ${this.baseUrl}`);
    console.log(`Concurrency: ${this.concurrency}`);
    console.log(`Duration: ${this.duration}s`);
    console.log(`RPS: ${this.requestsPerSecond}`);

    this.results.startTime = performance.now();
    
    const promises = [];
    for (let i = 0; i < this.concurrency; i++) {
      promises.push(this.runWorker());
    }

    // Stop after duration
    setTimeout(() => {
      this.stop = true;
    }, this.duration * 1000);

    await Promise.all(promises);
    
    this.results.endTime = performance.now();
    this.printResults();
  }

  async runWorker() {
    const delay = 1000 / this.requestsPerSecond;
    
    while (!this.stop) {
      const startTime = performance.now();
      
      try {
        await this.makeRequest();
        const endTime = performance.now();
        this.results.responseTimes.push(endTime - startTime);
        this.results.successfulRequests++;
      } catch (error) {
        this.results.failedRequests++;
        this.results.errors.push(error.message);
      }
      
      this.results.totalRequests++;
      
      // Rate limiting
      await this.sleep(delay);
    }
  }

  async makeRequest() {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl);
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: this.getRandomEndpoint(),
        method: 'GET',
        headers: {
          'User-Agent': 'LoadTester/1.0',
          'Accept': 'application/json',
          'Authorization': 'Bearer mock-token'
        }
      };

      const client = url.protocol === 'https:' ? https : http;
      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  getRandomEndpoint() {
    const endpoints = [
      '/api/tasks',
      '/api/tasks?page=1&limit=20',
      '/api/tasks?category=web_development',
      '/api/escrow/transactions',
      '/api/ratings/user/1',
      '/api/support/faq',
      '/health'
    ];
    
    return endpoints[Math.floor(Math.random() * endpoints.length)];
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  printResults() {
    const duration = (this.results.endTime - this.results.startTime) / 1000;
    const rps = this.results.totalRequests / duration;
    const avgResponseTime = this.results.responseTimes.reduce((a, b) => a + b, 0) / this.results.responseTimes.length;
    const p95ResponseTime = this.calculatePercentile(this.results.responseTimes, 95);
    const p99ResponseTime = this.calculatePercentile(this.results.responseTimes, 99);
    const errorRate = (this.results.failedRequests / this.results.totalRequests) * 100;

    console.log('\n=== Load Test Results ===');
    console.log(`Duration: ${duration.toFixed(2)}s`);
    console.log(`Total Requests: ${this.results.totalRequests}`);
    console.log(`Successful: ${this.results.successfulRequests}`);
    console.log(`Failed: ${this.results.failedRequests}`);
    console.log(`Error Rate: ${errorRate.toFixed(2)}%`);
    console.log(`Requests/sec: ${rps.toFixed(2)}`);
    console.log(`Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`95th Percentile: ${p95ResponseTime.toFixed(2)}ms`);
    console.log(`99th Percentile: ${p99ResponseTime.toFixed(2)}ms`);

    if (this.results.errors.length > 0) {
      console.log('\n=== Error Summary ===');
      const errorCounts = {};
      this.results.errors.forEach(error => {
        errorCounts[error] = (errorCounts[error] || 0) + 1;
      });
      Object.entries(errorCounts).forEach(([error, count]) => {
        console.log(`${error}: ${count}`);
      });
    }

    // Performance thresholds
    console.log('\n=== Performance Analysis ===');
    if (avgResponseTime > 1000) {
      console.log('⚠️  Average response time is high (>1000ms)');
    } else {
      console.log('✅ Average response time is acceptable');
    }

    if (p95ResponseTime > 2000) {
      console.log('⚠️  95th percentile response time is high (>2000ms)');
    } else {
      console.log('✅ 95th percentile response time is acceptable');
    }

    if (errorRate > 5) {
      console.log('⚠️  Error rate is high (>5%)');
    } else {
      console.log('✅ Error rate is acceptable');
    }

    if (rps < this.requestsPerSecond * 0.8) {
      console.log('⚠️  Throughput is lower than expected');
    } else {
      console.log('✅ Throughput is acceptable');
    }
  }

  calculatePercentile(arr, percentile) {
    const sorted = arr.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }
}

// Stress Test Scenarios
class StressTester extends LoadTester {
  constructor(options = {}) {
    super(options);
    this.scenarios = [
      { name: 'Normal Load', concurrency: 10, duration: 30 },
      { name: 'High Load', concurrency: 50, duration: 30 },
      { name: 'Peak Load', concurrency: 100, duration: 30 },
      { name: 'Overload', concurrency: 200, duration: 30 }
    ];
  }

  async runStressTest() {
    console.log('Starting stress test...');
    
    for (const scenario of this.scenarios) {
      console.log(`\n=== Running ${scenario.name} ===`);
      this.concurrency = scenario.concurrency;
      this.duration = scenario.duration;
      this.results = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        responseTimes: [],
        errors: [],
        startTime: null,
        endTime: null
      };
      
      await this.runLoadTest();
      
      // Wait between scenarios
      await this.sleep(5000);
    }
  }
}

// Spike Test
class SpikeTester extends LoadTester {
  async runSpikeTest() {
    console.log('Starting spike test...');
    
    // Normal load
    console.log('\n=== Normal Load (30s) ===');
    this.concurrency = 10;
    this.duration = 30;
    await this.runLoadTest();
    
    // Wait
    await this.sleep(10000);
    
    // Spike
    console.log('\n=== Spike Load (10s) ===');
    this.concurrency = 200;
    this.duration = 10;
    await this.runLoadTest();
    
    // Wait
    await this.sleep(10000);
    
    // Recovery
    console.log('\n=== Recovery (30s) ===');
    this.concurrency = 10;
    this.duration = 30;
    await this.runLoadTest();
  }
}

// Volume Test
class VolumeTester extends LoadTester {
  async runVolumeTest() {
    console.log('Starting volume test...');
    
    // Gradually increase load
    const steps = [
      { concurrency: 10, duration: 60 },
      { concurrency: 25, duration: 60 },
      { concurrency: 50, duration: 60 },
      { concurrency: 100, duration: 60 },
      { concurrency: 200, duration: 60 }
    ];
    
    for (const step of steps) {
      console.log(`\n=== Step: ${step.concurrency} concurrent users ===`);
      this.concurrency = step.concurrency;
      this.duration = step.duration;
      this.results = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        responseTimes: [],
        errors: [],
        startTime: null,
        endTime: null
      };
      
      await this.runLoadTest();
      
      // Check if system is still responsive
      if (this.results.failedRequests / this.results.totalRequests > 0.1) {
        console.log('⚠️  System showing signs of stress, stopping volume test');
        break;
      }
      
      await this.sleep(10000);
    }
  }
}

// Memory Leak Test
class MemoryLeakTester extends LoadTester {
  async runMemoryLeakTest() {
    console.log('Starting memory leak test...');
    
    const initialMemory = process.memoryUsage();
    console.log(`Initial memory: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);
    
    // Run load test for extended period
    this.concurrency = 20;
    this.duration = 300; // 5 minutes
    await this.runLoadTest();
    
    const finalMemory = process.memoryUsage();
    console.log(`Final memory: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);
    
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    console.log(`Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
    
    if (memoryIncrease > 100 * 1024 * 1024) { // 100MB
      console.log('⚠️  Potential memory leak detected');
    } else {
      console.log('✅ No significant memory leak detected');
    }
  }
}

// Database Connection Test
class DatabaseConnectionTester {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:3000';
    this.maxConnections = options.maxConnections || 100;
  }

  async runDatabaseConnectionTest() {
    console.log('Starting database connection test...');
    
    const promises = [];
    for (let i = 0; i < this.maxConnections; i++) {
      promises.push(this.testDatabaseConnection(i));
    }
    
    const results = await Promise.allSettled(promises);
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`\n=== Database Connection Test Results ===`);
    console.log(`Successful connections: ${successful}`);
    console.log(`Failed connections: ${failed}`);
    console.log(`Success rate: ${(successful / this.maxConnections * 100).toFixed(2)}%`);
    
    if (failed > 0) {
      console.log('⚠️  Some database connections failed');
    } else {
      console.log('✅ All database connections successful');
    }
  }

  async testDatabaseConnection(id) {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.baseUrl}/health`);
      const options = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method: 'GET',
        timeout: 5000
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve({ id, status: 'success' });
          } else {
            reject(new Error(`Connection ${id} failed with status ${res.statusCode}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Connection ${id} failed: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Connection ${id} timed out`));
      });

      req.end();
    });
  }
}

// Main test runner
async function runAllTests() {
  const baseUrl = process.env.TEST_URL || 'http://localhost:3000';
  
  console.log('🚀 Starting comprehensive load testing suite...');
  console.log(`Target URL: ${baseUrl}`);
  
  try {
    // Basic load test
    console.log('\n1. Basic Load Test');
    const loadTester = new LoadTester({ baseUrl, concurrency: 20, duration: 60 });
    await loadTester.runLoadTest();
    
    // Stress test
    console.log('\n2. Stress Test');
    const stressTester = new StressTester({ baseUrl });
    await stressTester.runStressTest();
    
    // Spike test
    console.log('\n3. Spike Test');
    const spikeTester = new SpikeTester({ baseUrl });
    await spikeTester.runSpikeTest();
    
    // Volume test
    console.log('\n4. Volume Test');
    const volumeTester = new VolumeTester({ baseUrl });
    await volumeTester.runVolumeTest();
    
    // Memory leak test
    console.log('\n5. Memory Leak Test');
    const memoryTester = new MemoryLeakTester({ baseUrl });
    await memoryTester.runMemoryLeakTest();
    
    // Database connection test
    console.log('\n6. Database Connection Test');
    const dbTester = new DatabaseConnectionTester({ baseUrl });
    await dbTester.runDatabaseConnectionTest();
    
    console.log('\n✅ All load tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Load testing failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  LoadTester,
  StressTester,
  SpikeTester,
  VolumeTester,
  MemoryLeakTester,
  DatabaseConnectionTester
};
