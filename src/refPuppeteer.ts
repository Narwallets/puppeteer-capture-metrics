import { writeFileSync } from "fs";
import { Browser, ElementHandle, Page } from "puppeteer"
const puppeteer = require('puppeteer')
const fetch = require('node-fetch')

export interface RefPuppeteerData {
    octStNearApr: number
    metaStNearApr: number;
    wNearStNearApr: number;
}

let lastObtainedTimeMs: number = 0;

let browser: Browser
let page: Page
const farmUrl = "https://app.ref.finance/v2farms/"
const WNEAR_STNEAR_STABLE = "3514-r"

async function goToRefFarm(waitForPool: number|string): Promise<Boolean> {

    page = await browser.newPage()
    await page.goto(`${farmUrl}${waitForPool}`)
    try {
        await page.waitForSelector(`div.poolbaseInfo`, { timeout: 20000 })
        return true;
    }
    catch (ex) {
        console.error("waitForSelector (1)", waitForPool, ex)
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

async function getPercentage(poolId: number|string): Promise<number> {
    try {
        // If there are more than one farm (one active and other inactives)
        // we can have MORE THAN ONE div id="xxx"
        if(!await goToRefFarm(poolId)) return 0
        let selector = `div.poolbaseInfo:not(.hidden)`
        let allFarms = await page.$$(selector)
        for (let container of allFarms) {
            let percentageElementParentHandler: ElementHandle<HTMLElement> | null = await container.$eval('div[data-for]', (element, poolId) => (element as HTMLElement).getAttribute("data-for")?.includes(`aprIdv2.ref-finance.near@${poolId}`) ? element : null)
            if(percentageElementParentHandler) {
                let percentageText: string = await percentageElementParentHandler.$eval("label.text-base", element => (element as HTMLElement).innerHTML || "0")
                let pos = percentageText.indexOf("%")
                if (pos > 0) {
                    let asNumber = Number(percentageText.slice(0, pos));
                    if (!isNaN(asNumber)) {
                        return asNumber;
                    }
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
            headless: false,
            slowMo: 0,
            devtools: false,
        })
        globalBrowserIsOpen = true;
        try {
            let data: Record<string, any> = {}
            data.wNearStNearStableApr = await getPercentage(WNEAR_STNEAR_STABLE)
            data.lastObtainedTimeMs = Date.now()
            writeFileSync("puppeteer-result.json", JSON.stringify(data))
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

type TrisolarisDataV2Item = {
    id: number;
    poolId: number;
    lpAddress: string;
    totalSupply: number;
    totalStaked: number;
    totalStakedInUSD: number;
    totalRewardRate: number;
    allocPoint: number;
    apr: number;
    apr2: number;
    chefVersion: string
}

function extract(data:TrisolarisDataV2Item[], poolId:number, name:string, punctual:Record<string, any>){
    const item = data.find(item => item.poolId == poolId)
    if (item) {
        punctual[`trisolaris_${name}_apr`] = item.apr + (item.apr2||0)
        punctual[`trisolaris_${name}_supply`] = (item.totalSupply/1e18).toFixed(2)
    }
}

async function processTriSolaris() {
    //---
    try {
        console.log(new Date().toISOString(), "processTrisolaris start")
        const URL = "https://cdn.trisolaris.io/datav2.json"
        let result = await fetch(URL);
        let data = await result.json() as TrisolarisDataV2Item[];
        try {

            let punctual: Record<string, any> = {}
            extract(data,11,"xTRI_stNEAR",punctual)
            extract(data,5,"TRI_wNEAR",punctual)
            extract(data,12,"stNEAR_wNear",punctual)
            extract(data,22,"liNEAR_wNear",punctual)

            writeFileSync("trisolaris-result.json", JSON.stringify(punctual))
        }
        catch (ex) {
            console.error("err processing fetch result at processTriSolaris", ex)
        }
        finally {
            console.log(new Date().toISOString(), "processTrisolaris finally")
        }
    }
    catch (ex) {
        console.error("err retrieving " + URL, ex)
    }

}

async function process() {
    await processTriSolaris()
    await processRef()
}


process()
