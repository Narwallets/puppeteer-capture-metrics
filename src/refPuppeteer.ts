import { writeFileSync } from "fs";
import { Browser, ElementHandle, Page } from "puppeteer"
const puppeteer = require('puppeteer')

export interface RefPuppeteerData {
    octStNearApr: number
    metaStNearApr: number;
    wNearStNearApr: number;
}

let lastObtainedTimeMs: number = 0;

let browser: Browser
let page: Page
const url = "https://app.ref.finance/farms"
const OCT_STNEAR = 1889
const META_STNEAR = 1923
const WNEAR_STNEAR = 535

async function goToRef(waitForPools: number[]): Promise<Boolean> {

    page = await browser.newPage()
    await page.goto(url)
    try {
        for (let poolId of waitForPools) {
            try {
                await page.waitForSelector(`div[id="${poolId}"]`, { timeout: 20000 })
            }
            catch (ex) {
                console.error("waitForSelector (1)", poolId, ex)
                return false;
            }
        }
        return true;
    }
    catch (ex) {
        console.error("waitForSelector (2)", ex)
    }
    return false;
}

/* NOT TESTED 
async function findPoolId(farmPair: string): Promise<number> {
    try {
        // get all a href elements
        // so we can find the pools by name
        let links = await page.$$("a") 
        for(let elem of links) {
            // get href
            let href = await elem.evaluate(node => (node as HTMLAnchorElement).href)
            // if it is a pool link
            if (href.startsWith("/pool/")) {
                let innerText = await elem.evaluate(node => (node as HTMLAnchorElement).innerText)
                console.log(innerText)
                if (innerText==farmPair) {
                    // found!
                    return Number(href.replace("/pool/",""))
                }
            }
        }
        return 0;

    } catch (err) {
        console.log(err)
        return 0;
    }
}
*/

async function getPercentage(poolId: number): Promise<number> {
    try {
        // If there are more than one farm (one active and other inactives)
        // we can have MORE THAN ONE div id="xxx"
        let selector = `div[id="${poolId}"]:not(.hidden)`
        let allFarms = await page.$$(selector)
        for (let container of allFarms) {
            let percentageText: string = await container.$eval('div[data-type="info"]', element => (element as HTMLElement).innerText) || "0"
            let pos = percentageText.indexOf("%")
            if (pos > 0) {
                let asNumber = Number(percentageText.slice(0, pos));
                if (!isNaN(asNumber)) {
                    return asNumber;
                }
            }
        }
        // not found / no farm active
        return 0;

    } catch (err) {
        console.log(err)
        return 0;
    }

}

let globalBrowserIsOpen = false;
export async function processRef() {
    //---
    try {
        console.log(new Date().toISOString(), "pupeteer processRef start")
        browser = await puppeteer.launch({
            headless: true,
            slowMo: 0,
            devtools: false,
        })
        globalBrowserIsOpen = true;
        try {
            if (await goToRef([OCT_STNEAR, META_STNEAR, WNEAR_STNEAR])) {
                let data:Record<string,any> = {}
                data.octStNearApr = await getPercentage(OCT_STNEAR)
                data.metaStNearApr = await getPercentage(META_STNEAR)
                data.wNearStNearApr = await getPercentage(WNEAR_STNEAR)
                data.lastObtainedTimeMs = Date.now()
                writeFileSync("puppeteer-result.json",JSON.stringify(data))
            }
        } catch (ex) {
            console.error("err at Ref process", ex)
        } finally {
            console.log(new Date().toISOString(), "pupeteer processRef finally")
            globalBrowserIsOpen = false;
            await browser.close()
        }
    } catch (ex) {
        console.error("err at puppeteer.launch", ex)
    }
}

processRef()
