function buildMenuItem(item) {
    let li = document.createElement("li")

    if (item.hasOwnProperty("children")) {
        let div = document.createElement("div")
        div.setAttribute("class", "item-link")
        let a = document.createElement("a")
        a.setAttribute("href", "#")
        let ico = document.createElement("i")
        ico.setAttribute("class", "bx bx-collection")
        let span = document.createElement("span")
        span.setAttribute("class", "item-name")
        span.textContent = item.data.key
        a.appendChild(ico)
        a.appendChild(span)
        div.appendChild(a)
        let i = document.createElement("i")
        i.setAttribute("class", "bx bxs-chevron-down arrow")
        div.appendChild(i)
        li.appendChild(div)
        let ul = document.createElement("ul")
        ul.setAttribute("class", "sub-menu")
        item.children.forEach((innerItem) => {
            let a = document.createElement("a")
            a.textContent = innerItem.data.key
            let li = document.createElement("li")
            li.addEventListener('click', async () => {
                //const filePath = await window.electronAPI.loadUrl(innerItem.link)
                window.electronAPI.loadUrl(innerItem.data.value)
            })
            li.appendChild(a)
            ul.appendChild(li)
        })
        li.appendChild(ul)
    } else {
        li.addEventListener('click', async () => {
            window.electronAPI.loadUrl(item.data.value)
        })
        let a = document.createElement("a")
        a.setAttribute("href", "#")
        let ico = document.createElement("i")
        ico.setAttribute("class", item.data.icon)
        let span = document.createElement("span")
        span.setAttribute("class", "item-name")
        span.textContent = item.data.key
        a.appendChild(ico)
        a.appendChild(span)
        li.appendChild(a)
    }
    return li
}

function addEvents() {
    const sidebar = document.querySelector(".sidebar")
    document.querySelector(".app-details").addEventListener("click", () => {
        //window.electronAPI.sidebarToggle()
    })

    let sidebarBtn = document.querySelectorAll(".bx-collection")
    sidebarBtn.forEach((item) => {
        item.addEventListener("click", (e) => {
            //window.electronAPI.sidebarToggle()
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

    document.getElementById('menu-button').addEventListener("click", () => {
        window.electronAPI.menubarToggle();
    });

    document.getElementById('settings-button').addEventListener("click", () => {
        window.electronAPI.openSettings()
    })

    document.getElementById('profile-button').addEventListener("click", () => {
        window.electronAPI.loadUrl('https://id.uchet.kz/account/login/')
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

    let data = window.electronAPI.loadMenu()
    console.log(data)
    data.forEach(item => {
        document.getElementById("menuItems").appendChild(buildMenuItem(item))
    })
    addEvents()

    /*menuObject.menuItems.forEach((item) => {
        document.getElementById("menuItems").appendChild(buildMenuItem(item))
    })*/
    /*fetch('sidebar.json')
        .then(response => response.json())
        .then(data => {
            //window.electronAPI.loadUrl(data.menuItems[0].link)
            data.menuItems.forEach((item) => {
                document.getElementById("menuItems").appendChild(buildMenuItem(item))
            })
        })
        .then(() => addEvents())
        .catch(error => console.error("Error fetching JSON data:", error))*/
}

//let dataJSON = '{"menuItems": [{"name": "Test1","icon": "bx bx-bell icon","link": "#"},{"name": "Test2","icon": "bx bx-bar-chart-alt-2 icon","innerItems": [{"name": "Test2-1","icon": "bx bx-bar-chart-alt-2 icon","link": ""},{"name": "Test2-2","icon": "bx bx-bar-chart-alt-2 icon","link": ""}]}]}'
//let dataObject = JSON.parse(dataJSON)
//buildMenu(dataObject)
//buildMenu()
addEvents()

window.electronAPI.menubarToggle((value) => {
    document.querySelector(".sidebar").classList.toggle("close")
})

window.electronAPI.onThemeToggle((value) => {
    document.querySelector("body").classList.toggle("light")
})
