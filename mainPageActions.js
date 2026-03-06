//import {TimeoutError} from "puppeteer-core";

export function addRequestHandlers(page, pageActions) {
    page.setRequestInterception(true);
    page.on('request', request => {
        let url = request.url()
        console.log(url)
        const findTerm = (term) => {
            if (url.includes(term)) {
                return url;
            } else return ''
        };

        switch (url) {
            case findTerm('/swagger'): {
                // selectedLotId = url.substring(url.lastIndexOf('/') + 1)
                console.log('request findTerm')
                try {
                } catch (e) {
                }
                // login(page)
                request.continue()
                break
            }
            default: {
                request.continue()
            }
        }
    })
}

export function addResponseHandlers(page, pageActions) {
    console.log('addResponseHandlers')
    page.on('response', response => {
        //console.log(response.status())
        if (response.status() === 200 && response.url().includes(pageActions.term)) {

        }
    });
}

export async function executePageActions(page, pageActions) {
    console.log(`[PageActions] Executing ${pageActions.length} actions on: ${page.url()}`)
    for (let i = 0; i < pageActions.length; i++) {
        const pageAction = pageActions[i]
        console.log(`[PageActions] [${i + 1}/${pageActions.length}] ${pageAction.action}`, pageAction.selector || '', pageAction.value || '')
        switch (pageAction.action) {
            case 'waitElement': {
                await waitElement(page, pageAction.selector);
                break
            }
            case 'typeToInput': {
                await typeToInput(page, pageAction.selector, pageAction.value)
                break
            }
            case 'clickElement': {
                await clickElement(page, pageAction.selector)
                break
            }
            case 'selectElement': {
                await selectElement(page, pageAction.selector, pageAction.value)
                break
            }
            case 'delay': {
                await delay(pageAction.value || 1000)
                break
            }
        }
        console.log(`[PageActions] [${i + 1}/${pageActions.length}] ${pageAction.action} done`)
    }
    console.log('[PageActions] All actions completed')
}

async function typeToInput(page, selector, text) {
    try {
        await page.waitForSelector(selector, {timeout: 15 * 1000})
        await page.focus(selector)
        await page.keyboard.type(text)
        console.log(`[PageActions] typeToInput OK: ${selector}`)
    } catch (e) {
        console.error(`[PageActions] typeToInput FAILED: ${selector}`, e.message)
    }
}

async function clickElement(page, selector) {
    try {
        await page.waitForSelector(selector, {visible: true}, {timeout: 60000}).then(async element => {
            await element.click()
        })
        console.log(`[PageActions] clickElement OK: ${selector}`)
    } catch (e) {
        console.error(`[PageActions] clickElement FAILED: ${selector}`, e.message)
    }
}

async function selectElement(page, selector, values) {
    try {
        await page.waitForSelector(selector, {timeout: 60000}).then(async () => {
            await page.select(selector, values)
        })
        console.log(`[PageActions] selectElement OK: ${selector}`)
    } catch (e) {
        console.error(`[PageActions] selectElement FAILED: ${selector}`, e.message)
    }
}

async function waitElement(page, selector) {
    try {
        const el = await page.waitForSelector(selector, {timeout: 60000})
        console.log(`[PageActions] waitElement OK: ${selector}`)
        return el
    } catch (e) {
        console.error(`[PageActions] waitElement FAILED: ${selector}`, e.message)
    }
}

function delay(time) {
    return new Promise(function (resolve) {
        setTimeout(resolve, time)
    });
}
