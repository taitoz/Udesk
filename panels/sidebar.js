
function buildMenuItem(item) {
    let li = document.createElement("li")

    if (item.hasOwnProperty("innerItems")) {
        let div = document.createElement("div")
        div.setAttribute("class", "item-link")
        let a = document.createElement("a")
        a.setAttribute("href", "#")
        let ico = document.createElement("i")
        ico.setAttribute("class", "bx bx-collection")
        let span = document.createElement("span")
        span.setAttribute("class", "item-name")
        span.textContent = item.name
        a.appendChild(ico)
        a.appendChild(span)
        div.appendChild(a)
        let i = document.createElement("i")
        i.setAttribute("class", "bx bxs-chevron-down arrow")
        div.appendChild(i)
        li.appendChild(div)
        let ul = document.createElement("ul")
        ul.setAttribute("class", "sub-menu")
        item.innerItems.forEach((innerItem) => {
            let a = document.createElement("a")
            a.textContent = innerItem.name
            let li = document.createElement("li")
            li.addEventListener('click', async () => {
                //const filePath = await window.electronAPI.loadUrl(innerItem.link)
                window.electronAPI.loadUrl(innerItem.link)
            })
            li.appendChild(a)
            ul.appendChild(li)
        })
        li.appendChild(ul)
    } else {
        li.addEventListener('click', async () => {
            window.electronAPI.loadUrl(item.link)
        })
        let a = document.createElement("a")
        a.setAttribute("href", "#")
        let ico = document.createElement("i")
        ico.setAttribute("class", item.icon)
        let span = document.createElement("span")
        span.setAttribute("class", "item-name")
        span.textContent = item.name
        a.appendChild(ico)
        a.appendChild(span)
        li.appendChild(a)
    }
    return li
}

function addEvents() {
    const sidebar = document.querySelector(".sidebar")
    document.querySelector(".bx-menu").addEventListener("click", () => {
        sidebar.classList.toggle("close")
        window.electronAPI.sidebarToggle()
    })

    let sidebarBtn = document.querySelectorAll(".bx-collection")
    sidebarBtn.forEach((item) => {
        item.addEventListener("click", (e) => {
            sidebar.classList.toggle("close")
            window.electronAPI.sidebarToggle()
            let liParent = e.target.parentElement.parentElement.parentElement
            //console.log(e.target.parentElement.parentElement.parentElement)
            liParent.classList.toggle("showMenu")
        })
    })

    let arrow = document.querySelectorAll(".arrow")
    arrow.forEach((item) => {
        item.addEventListener("click", (e) => {
            let liParent = e.target.parentElement.parentElement
            //console.log(arrowParent)
            liParent.classList.toggle("showMenu")
        })
    })

    const body = document.querySelector("body")
    body.querySelector(".bx-cog").addEventListener("click", () => {
        window.electronAPI.openSettings()
    })
    // body.querySelector(".bx-sun").addEventListener("click", () => {
        // body.classList.toggle("light")
        // if (body.classList.contains("dark")) {
        //   modeText.innerText = "Light mode"
        // } else {
        //   modeText.innerText = "Dark mode"
        // }
    // })

}

function buildMenu() {
    /*menuObject.menuItems.forEach((item) => {
        document.getElementById("menuItems").appendChild(buildMenuItem(item))
    })*/
    fetch('sidebar.json')
        .then(response => response.json())
        .then(data => {
            window.electronAPI.loadUrl(data.menuItems[0].link)
            data.menuItems.forEach((item) => {
                document.getElementById("menuItems").appendChild(buildMenuItem(item))
            })
        })
        .then(() => addEvents())
        .catch(error => console.error("Error fetching JSON data:", error))
}

//let dataJSON = '{"menuItems": [{"name": "Test1","icon": "bx bx-bell icon","link": "#"},{"name": "Test2","icon": "bx bx-bar-chart-alt-2 icon","innerItems": [{"name": "Test2-1","icon": "bx bx-bar-chart-alt-2 icon","link": ""},{"name": "Test2-2","icon": "bx bx-bar-chart-alt-2 icon","link": ""}]}]}'
//let dataObject = JSON.parse(dataJSON)
//buildMenu(dataObject)
buildMenu()

window.electronAPI.onThemeToggle((value) => {
    document.querySelector("body").classList.toggle("light")
})
