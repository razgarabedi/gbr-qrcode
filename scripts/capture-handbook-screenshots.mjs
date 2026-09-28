/**
 * Captures screenshots for the Start-mode user handbook.
 * Requires: npm run dev (http://localhost:5173)
 */
import { chromium, devices } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'docs', 'benutzerhandbuch', 'screenshots')
const BASE = process.env.HANDBOOK_URL ?? 'http://localhost:5173/'

async function fillSampleContact(page) {
  await page.getByRole('textbox', { name: 'Vorname' }).fill('Max')
  await page.getByRole('textbox', { name: 'Nachname' }).fill('Mustermann')
  await page.getByRole('textbox', { name: 'Geschäftliche E-Mail-Adresse' }).fill('max.mustermann@firma.de')
  await page.getByRole('textbox', { name: 'Geschäftliche Mobilnummer' }).fill('+49 170 1234567')
}

async function ensureStartMode(page) {
  const startBtn = page.getByRole('radio', { name: 'Start' })
  if ((await startBtn.getAttribute('aria-checked')) !== 'true') {
    await startBtn.click()
  }
}

async function captureDesktop(browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await ensureStartMode(page)

  await page.screenshot({ path: join(OUT, '01-desktop-start-hero.png'), fullPage: false })

  await page.locator('#kontaktdaten').scrollIntoViewIfNeeded()
  await page.screenshot({ path: join(OUT, '02-desktop-kontaktdaten.png') })

  await fillSampleContact(page)
  await page.waitForTimeout(400)

  await page.locator('#logo').scrollIntoViewIfNeeded()
  await page.getByRole('radio', { name: 'Gebr.Becker' }).click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: join(OUT, '03-desktop-logo.png') })

  await page.locator('#qr-vorschau').scrollIntoViewIfNeeded()
  await page.waitForTimeout(800)
  await page.screenshot({ path: join(OUT, '04-desktop-qr-vorschau.png') })

  await page.locator('#hintergrundbild').scrollIntoViewIfNeeded()
  await page.waitForTimeout(800)
  await page.screenshot({ path: join(OUT, '05-desktop-hintergrundbild.png') })

  await context.close()
}

async function captureMobile(browser) {
  const iphone = devices['iPhone 13']
  const context = await browser.newContext({
    ...iphone,
  })
  const page = await context.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await ensureStartMode(page)
  await fillSampleContact(page)
  await page.getByRole('radio', { name: 'Stein' }).click()
  await page.waitForTimeout(300)

  await page.locator('#qr-vorschau').scrollIntoViewIfNeeded()
  await page.waitForTimeout(800)
  await page.screenshot({ path: join(OUT, '06-ios-qr-und-hinweis.png'), fullPage: false })

  await context.close()
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch()
  try {
    await captureDesktop(browser)
    await captureMobile(browser)
    console.log('Screenshots saved to', OUT)
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
