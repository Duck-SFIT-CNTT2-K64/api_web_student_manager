(function () {
    var portalNav = document.getElementById("portalNav");
    if (portalNav) {
        var pathname = location.pathname.replace(/\/+$/, "");
        var links = Array.from(portalNav.querySelectorAll("a"));
        var matched = false;
        links.forEach(function (link) {
            var href = link.getAttribute("href") || "";
            var normalized = href.replace(/\/+$/, "");
            if (normalized && normalized === pathname) {
                link.classList.add("is-active");
                matched = true;
            } else if (!matched) {
                link.classList.remove("is-active");
            }
        });

        var activeLink = portalNav.querySelector("a.is-active");
        if (activeLink && window.innerWidth < 860) {
            activeLink.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
        }
    }

    document.querySelectorAll(".portal-tile, .portal-nav a").forEach(function (el) {
        el.addEventListener("click", function () {
            el.style.transform = "translateY(-1px)";
            setTimeout(function () {
                el.style.transform = "";
            }, 160);
        });
    });

    var loader = document.getElementById("studentPortalRoot");
    if (loader) {
        var panel = document.querySelector(".portal-panel.is-active");
        if (panel) {
            panel.scrollIntoView({ behavior: "instant", block: "start" });
        }
    }
})();
