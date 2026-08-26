const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\jguanin\\.gemini\\antigravity\\brain\\bc8be499-d0b0-46b1-8b96-067f9ca07c51';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function clickTabByText(page, textSnippet) {
  const tabs = await page.$$('button[role="tab"]');
  for (const tab of tabs) {
    const text = await page.evaluate(el => el.textContent, tab);
    if (text && text.includes(textSnippet)) {
      await tab.click();
      await new Promise(r => setTimeout(r, 2000));
      return true;
    }
  }
  return false;
}

async function run() {
  console.log('Iniciando Puppeteer con Edge...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    defaultViewport: { width: 1440, height: 1100 },
  });

  const page = await browser.newPage();
  
  console.log('Navegando a http://localhost:4321/rescate-vial...');
  await page.goto('http://localhost:4321/rescate-vial', { waitUntil: 'networkidle2', timeout: 30000 });

  await page.evaluate(() => {
    localStorage.setItem('access_token', 'dev_token');
    localStorage.setItem('user_role', 'ADMIN');
    localStorage.setItem('user_full_name', 'Administrador Sistema');
  });

  await page.goto('http://localhost:4321/rescate-vial', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3500));

  // 1. Dashboard Tab Screenshot
  const shot1 = path.join(ARTIFACT_DIR, 'screenshot_1_dashboard.png');
  await page.screenshot({ path: shot1, fullPage: true });
  console.log('Captura 1 guardada (Dashboard):', shot1);

  // 2. Hotspots Tab
  if (await clickTabByText(page, 'Tramos Críticos')) {
    const shot2 = path.join(ARTIFACT_DIR, 'screenshot_2_hotspots.png');
    await page.screenshot({ path: shot2, fullPage: true });
    console.log('Captura 2 guardada (Hotspots):', shot2);
  }

  // 3. Temporal Tab
  if (await clickTabByText(page, 'Patrones Temporales')) {
    const shot3 = path.join(ARTIFACT_DIR, 'screenshot_3_temporal.png');
    await page.screenshot({ path: shot3, fullPage: true });
    console.log('Captura 3 guardada (Temporal):', shot3);
  }

  // 4. Despliegue Tab
  if (await clickTabByText(page, 'Plan de Despliegue')) {
    const shot4 = path.join(ARTIFACT_DIR, 'screenshot_4_despliegue.png');
    await page.screenshot({ path: shot4, fullPage: true });
    console.log('Captura 4 guardada (Despliegue):', shot4);
  }

  // 5. Reportes MTOP Tab
  if (await clickTabByText(page, 'Reportes MTOP')) {
    const shot5 = path.join(ARTIFACT_DIR, 'screenshot_5_reportes.png');
    await page.screenshot({ path: shot5, fullPage: true });
    console.log('Captura 5 guardada (Reportes MTOP):', shot5);
  }

  // 6. Modal Nueva Asistencia
  try {
    const btnNueva = await page.$('button.bg-red-600');
    if (btnNueva) {
      await btnNueva.click();
      await new Promise(r => setTimeout(r, 1500));
      const shot6 = path.join(ARTIFACT_DIR, 'screenshot_6_modal_registro.png');
      await page.screenshot({ path: shot6, fullPage: true });
      console.log('Captura 6 guardada (Modal Registro):', shot6);
    }
  } catch (e) {
    console.error('Error abriendo modal:', e);
  }

  await browser.close();
  console.log('Todas las capturas de pantalla se generaron exitosamente.');
}

run().catch(console.error);
