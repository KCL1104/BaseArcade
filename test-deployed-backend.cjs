const https = require('https');
const http = require('http');

// Configuration
const BASE_URL = 'https://basearcade-574764965670.northamerica-northeast1.run.app';
const TIMEOUT = 10000; // 10 seconds

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

// Helper function to make HTTP requests
function makeRequest(url, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'Backend-Test-Script/1.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };

    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : null;
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: jsonBody,
            rawBody: body
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: null,
            rawBody: body
          });
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Test function
async function runTest(testName, testFn) {
  console.log(`\n🧪 Testing: ${testName}`);
  try {
    const result = await testFn();
    if (result.success) {
      console.log(`✅ PASSED: ${testName}`);
      if (result.message) console.log(`   ${result.message}`);
      testResults.passed++;
    } else {
      console.log(`❌ FAILED: ${testName}`);
      console.log(`   ${result.message}`);
      testResults.failed++;
    }
    testResults.tests.push({ name: testName, ...result });
  } catch (error) {
    console.log(`❌ ERROR: ${testName}`);
    console.log(`   ${error.message}`);
    testResults.failed++;
    testResults.tests.push({ name: testName, success: false, message: error.message });
  }
}

// Test cases
async function testHealthEndpoint() {
  const response = await makeRequest(`${BASE_URL}/health`);
  return {
    success: response.statusCode === 200,
    message: `Status: ${response.statusCode}, Response: ${response.rawBody}`
  };
}

async function testCanvasInfo() {
  const response = await makeRequest(`${BASE_URL}/api/canvas/info`);
  return {
    success: response.statusCode === 200 && response.body,
    message: `Status: ${response.statusCode}, Has data: ${!!response.body}`
  };
}

async function testCanvasRegion() {
  const response = await makeRequest(`${BASE_URL}/api/canvas/region?x=0&y=0&width=10&height=10`);
  return {
    success: response.statusCode === 200,
    message: `Status: ${response.statusCode}, Response type: ${typeof response.body}`
  };
}

async function testGameStats() {
  const response = await makeRequest(`${BASE_URL}/api/game-stats`);
  return {
    success: response.statusCode === 200 && response.body,
    message: `Status: ${response.statusCode}, Has stats: ${!!response.body}`
  };
}

async function testGameStatsHealth() {
  const response = await makeRequest(`${BASE_URL}/api/game-stats/health`);
  return {
    success: response.statusCode === 200,
    message: `Status: ${response.statusCode}, Response: ${response.rawBody}`
  };
}

async function testRecentPixels() {
  const response = await makeRequest(`${BASE_URL}/api/canvas/recent?limit=10`);
  return {
    success: response.statusCode === 200,
    message: `Status: ${response.statusCode}, Response type: ${typeof response.body}`
  };
}

async function testPixelPrice() {
  const response = await makeRequest(`${BASE_URL}/api/canvas/price/0/0`);
  return {
    success: response.statusCode === 200,
    message: `Status: ${response.statusCode}, Response: ${response.rawBody}`
  };
}

async function testSpecificPixel() {
  const response = await makeRequest(`${BASE_URL}/api/canvas/pixel/0/0`);
  return {
    success: response.statusCode === 200 || response.statusCode === 404,
    message: `Status: ${response.statusCode}, Response: ${response.rawBody}`
  };
}

async function testCORSHeaders() {
  const response = await makeRequest(`${BASE_URL}/health`);
  const hasCORS = response.headers['access-control-allow-origin'] !== undefined;
  return {
    success: hasCORS,
    message: `CORS header present: ${hasCORS}`
  };
}

async function testInvalidEndpoint() {
  const response = await makeRequest(`${BASE_URL}/api/nonexistent`);
  return {
    success: response.statusCode === 404,
    message: `Status: ${response.statusCode} (should be 404)`
  };
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Backend Service Tests');
  console.log(`📍 Testing URL: ${BASE_URL}`);
  console.log('=' .repeat(50));

  // Core functionality tests
  await runTest('Health Endpoint', testHealthEndpoint);
  await runTest('Game Stats Health', testGameStatsHealth);
  await runTest('Canvas Info', testCanvasInfo);
  await runTest('Game Statistics', testGameStats);
  
  // Canvas API tests
  await runTest('Canvas Region', testCanvasRegion);
  await runTest('Recent Pixels', testRecentPixels);
  await runTest('Pixel Price', testPixelPrice);
  await runTest('Specific Pixel', testSpecificPixel);
  
  // Infrastructure tests
  await runTest('CORS Headers', testCORSHeaders);
  await runTest('Invalid Endpoint (404)', testInvalidEndpoint);

  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('=' .repeat(50));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  if (testResults.failed === 0) {
    console.log('\n🎉 All tests passed! Backend service is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the issues above.');
  }
  
  console.log('\n📋 Detailed Results:');
  testResults.tests.forEach(test => {
    const status = test.success ? '✅' : '❌';
    console.log(`${status} ${test.name}: ${test.message}`);
  });
}

// Run the tests
runAllTests().catch(console.error);