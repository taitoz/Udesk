 // document.addEventListener("DOMContentLoaded", function () {
 //     fetch('sidebar.json')
 //         .then(response => response.json())
 //         .then(data => {
 //             data.forEach((item) => {
 //                 document.getElementById("menuItems").appendChild(buildMenuItem(item));
 //             });
 //         })
 //         .catch(error => console.error("Error fetching JSON data:", error));
 // });

var dataJSON =
    '{"menuItems": [{"name": "Test1","icon": "bx bx-bell icon","link": "#"},{"name": "Test2","icon": "bx bx-bar-chart-alt-2 icon","innerItems": [{"name": "Test2-1","icon": "bx bx-bar-chart-alt-2 icon","link": ""},{"name": "Test2-2","icon": "bx bx-bar-chart-alt-2 icon","link": ""}]}]}';

var dataObject = JSON.parse(dataJSON);
buildMenu(dataObject);

function buildMenu(menuObject) {
    menuObject.menuItems.forEach((item) => {
        document.getElementById("menuItems").appendChild(buildMenuItem(item));
    });
}

function buildMenuItem(item) {
    var li = document.createElement("li");
    //li.setAttribute("class", "nav-link");

    if (item.hasOwnProperty("innerItems")) {
        var div = document.createElement("div");
        div.setAttribute("class", "iocn-link");
        var a = document.createElement("a");
        a.setAttribute("href", "#");
        var ico = document.createElement("i");
        ico.setAttribute("class", "bx bx-collection");
        var span = document.createElement("span");
        span.setAttribute("class", "link_name");
        span.textContent = item.name;
        a.appendChild(ico);
        a.appendChild(span);
        div.appendChild(a);
        var i = document.createElement("i");
        i.setAttribute("class", "bx bxs-chevron-down arrow");
        div.appendChild(i);
        li.appendChild(div);
        var ul = document.createElement("ul");
        ul.setAttribute("class", "sub-menu");
        item.innerItems.forEach((innerItem) => {
            var a = document.createElement("a");
            a.textContent = innerItem.name;
            var li = document.createElement("li");
            li.appendChild(a);
            ul.appendChild(li);
        });
        li.appendChild(ul);
    } else {
        var a = document.createElement("a");
        a.setAttribute("href", "#");
        var ico = document.createElement("i");
        ico.setAttribute("class", item.icon);
        var span = document.createElement("span");
        span.setAttribute("class", "link_name");
        span.textContent = item.name;
        a.appendChild(ico);
        a.appendChild(span);
        li.appendChild(a);
    }
    return li;
}

const sidebar = document.querySelector(".sidebar");
document.querySelector(".bx-menu").addEventListener("click", (e) => {
    sidebar.classList.toggle("close");
    window.electronAPI.sidebarToggle();
});

let sidebarBtn = document.querySelectorAll(".bx-collection");
sidebarBtn.forEach((item) => {
    item.addEventListener("click", (e) => {
        sidebar.classList.toggle("close");
        window.electronAPI.sidebarToggle();
        let liParent = e.target.parentElement.parentElement.parentElement;
        //console.log(e.target.parentElement.parentElement.parentElement);
        liParent.classList.toggle("showMenu");
    });
});

let arrow = document.querySelectorAll(".arrow");
arrow.forEach((item) => {
    item.addEventListener("click", (e) => {
        let liParent = e.target.parentElement.parentElement;
        //console.log(arrowParent);
        liParent.classList.toggle("showMenu");
    });
});

const body = document.querySelector("body");
body.querySelector(".toggle-switch").addEventListener("click", () => {
    body.classList.toggle("light");
    // if (body.classList.contains("dark")) {
    //   modeText.innerText = "Light mode";
    // } else {
    //   modeText.innerText = "Dark mode";
    // }
});

 // li.addEventListener('click', async () => {
 //     const filePath = await window.electronAPI.loadUrl(item.link)
 // })
