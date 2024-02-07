
const body = document.querySelector('body'),
    sidebar = body.querySelector('nav'),
    toggle = body.querySelector(".toggle"),
    searchBtn = body.querySelector(".search-box"),
    modeSwitch = body.querySelector(".toggle-switch"),
    modeText = body.querySelector(".mode-text");
toggle.addEventListener("click", () => {
    sidebar.classList.toggle("close");
})
searchBtn.addEventListener("click", () => {
    sidebar.classList.remove("close");
})
modeSwitch.addEventListener("click", () => {
    body.classList.toggle("dark");
    if (body.classList.contains("dark")) {
        modeText.innerText = "Light mode";
    } else {
        modeText.innerText = "Dark mode";
    }
});

document.addEventListener("DOMContentLoaded", function () {
    fetch('sidebar.json')
        .then(response => response.json())
        .then(data => {
            data.forEach(buildNewItem);
        })
        .catch(error => console.error("Error fetching JSON data:", error));
});

function buildNewItem(item, index) {

    let li = document.createElement("li");
    li.setAttribute("class", "nav-link");
    let a = document.createElement("a");
    a.setAttribute("href", item.link);
    let ico = document.createElement("i");
    ico.setAttribute("class", item.icon);
    let span = document.createElement("span");
    span.setAttribute("class", "text nav-text");
    span.textContent = item.name;
    a.appendChild(ico);
    a.appendChild(span);
    li.appendChild(a);

    document.getElementById('menuItems').appendChild(li);
}
