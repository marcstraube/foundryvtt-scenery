/**
 * Test script for Scenery module in Foundry v13
 * 
 * To use this script:
 * 1. Create a test scene in Foundry VTT
 * 2. Open the browser console (F12)
 * 3. Copy and paste this entire script
 * 4. Follow the test instructions
 */

console.log("=== Scenery Module Test Suite ===");

// Test 1: Check if module is active
const testModuleActive = () => {
  const isActive = game.modules.get('scenery')?.active;
  console.log(`Test 1 - Module Active: ${isActive ? 'PASS ✓' : 'FAIL ✗'}`);
  return isActive;
};

// Test 2: Check if Scenery class is available
const testSceneryClass = () => {
  const hasClass = typeof Scenery !== 'undefined';
  console.log(`Test 2 - Scenery Class Available: ${hasClass ? 'PASS ✓' : 'FAIL ✗'}`);
  return hasClass;
};

// Test 3: Open Scenery dialog for current scene
const testOpenDialog = async () => {
  try {
    const scene = canvas.scene;
    if (!scene) {
      console.log("Test 3 - Open Dialog: SKIP (No scene active)");
      return false;
    }
    
    const scenery = new Scenery({ sceneId: scene.id });
    await scenery.render(true);
    console.log("Test 3 - Open Dialog: PASS ✓ (Check if dialog opened)");
    return true;
  } catch (e) {
    console.error("Test 3 - Open Dialog: FAIL ✗", e);
    return false;
  }
};

// Test 4: Check context menu integration
const testContextMenu = () => {
  const hasHook = Hooks._hooks.getSceneDirectoryEntryContext?.some(h => h.fn.name.includes('_onContextMenu'));
  console.log(`Test 4 - Context Menu Hook: ${hasHook ? 'PASS ✓' : 'FAIL ✗'}`);
  return hasHook;
};

// Test 5: Check settings registration
const testSettings = () => {
  const hasSetting = game.settings.settings.has('scenery.showVariationsLabel');
  console.log(`Test 5 - Settings Registration: ${hasSetting ? 'PASS ✓' : 'FAIL ✗'}`);
  return hasSetting;
};

// Test 6: Test flag operations
const testFlags = async () => {
  try {
    const scene = canvas.scene;
    if (!scene) {
      console.log("Test 6 - Flag Operations: SKIP (No scene active)");
      return false;
    }
    
    // Test setting a flag
    await scene.setFlag('scenery', 'test', { value: 'test123' });
    const flag = scene.getFlag('scenery', 'test');
    const success = flag?.value === 'test123';
    
    // Clean up
    await scene.unsetFlag('scenery', 'test');
    
    console.log(`Test 6 - Flag Operations: ${success ? 'PASS ✓' : 'FAIL ✗'}`);
    return success;
  } catch (e) {
    console.error("Test 6 - Flag Operations: FAIL ✗", e);
    return false;
  }
};

// Test 7: Theme compatibility
const testTheme = () => {
  const darkMode = document.documentElement.classList.contains('theme-dark');
  const lightMode = document.documentElement.classList.contains('theme-light');
  const hasTheme = darkMode || lightMode;
  console.log(`Test 7 - Theme Detection: ${hasTheme ? 'PASS ✓' : 'FAIL ✗'} (${darkMode ? 'Dark' : 'Light'} mode)`);
  return hasTheme;
};

// Run all tests
const runAllTests = async () => {
  console.log("\nStarting Scenery module tests...\n");
  
  const results = {
    moduleActive: testModuleActive(),
    sceneryClass: testSceneryClass(),
    contextMenu: testContextMenu(),
    settings: testSettings(),
    theme: testTheme()
  };
  
  // Async tests
  results.openDialog = await testOpenDialog();
  results.flags = await testFlags();
  
  // Summary
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;
  
  console.log(`\n=== Test Summary ===`);
  console.log(`Passed: ${passed}/${total}`);
  console.log(`Status: ${passed === total ? 'All tests passed! ✓' : 'Some tests failed ✗'}`);
  
  console.log("\n=== Manual Tests Required ===");
  console.log("1. Right-click a scene in the directory and check for 'Scenery' option");
  console.log("2. Open Scenery dialog and test:");
  console.log("   - Add/delete variations");
  console.log("   - Scan for variations");
  console.log("   - Select GM/Player images");
  console.log("   - Save and verify images change correctly");
  console.log("3. Test with both light and dark themes");
  console.log("4. Check scene navigation badges show variation count");
  
  return results;
};

// Execute tests
runAllTests(); 