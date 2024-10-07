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
    console.log('executePageActions')
    for (const pageAction of pageActions) {
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
        }
    }
}

async function typeToInput(page, selector, text) {
    try {
        await page.waitForSelector(selector, {timeout: 15 * 1000})
        await page.focus(selector)
        await page.keyboard.type(text)
    } catch (e) {
        // if (e instanceof TimeoutError) {
        //page.reload()
        // }
    }
}

async function clickElement(page, selector) {
    try {
        await page.waitForSelector(selector, {visible: true}, {timeout: 60000}).then(async element => {
            await element.click()
        })
    } catch (e) {
        // if (e instanceof TimeoutError) {
        //page.reload()
        //     console.error("timeout on click: " + selector)
        // }
    }
}

async function selectElement(page, selector, values) {
    try {
        await page.waitForSelector(selector, {timeout: 60000}).then(async () => {
            await page.select(selector, values)
        })
    } catch (e) {
        // if (e instanceof TimeoutError) {
        //page.reload()
        //     console.error("timeout on select: " + selector)
        // }
    }
}

async function waitElement(page, selector) {
    try {
        return await page.waitForSelector(selector, {timeout: 60000})
    } catch (e) {
        // if (e instanceof TimeoutError) {
        //page.reload()
        //     console.error("timeout on wait: " + selector)
        // }
    }
}

function delay(time) {
    return new Promise(function (resolve) {
        setTimeout(resolve, time)
    });
}
