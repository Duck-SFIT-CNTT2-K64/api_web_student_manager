(function () {
    var navToggle = document.getElementById("navToggle");
    var navLinks = document.getElementById("navLinks");

    if (navToggle && navLinks) {
        navToggle.addEventListener("click", function () {
            navLinks.classList.toggle("open");
        });

        navLinks.querySelectorAll("a").forEach(function (link) {
            link.addEventListener("click", function () {
                navLinks.classList.remove("open");
            });
        });
    }

    var weekdayMap = {
        Monday: "Thu Hai",
        Tuesday: "Thu Ba",
        Wednesday: "Thu Tu",
        Thursday: "Thu Nam",
        Friday: "Thu Sau",
        Saturday: "Thu Bay",
        Sunday: "Chu Nhat",
    };

    document.querySelectorAll(".weekday").forEach(function (el) {
        var key = (el.dataset.weekday || "").trim();
        if (weekdayMap[key]) {
            el.textContent = weekdayMap[key];
        }
    });

    var sectionMap = Array.from(document.querySelectorAll("main section[id]")).map(function (section) {
        return {
            id: section.id,
            top: section.offsetTop,
        };
    });

    function updateActiveLink() {
        var scrollTop = window.scrollY + 140;
        var activeId = "";
        sectionMap.forEach(function (item) {
            if (scrollTop >= item.top) {
                activeId = item.id;
            }
        });

        document.querySelectorAll(".nav-links a").forEach(function (link) {
            var isActive = link.getAttribute("href") === "#" + activeId;
            link.classList.toggle("active", isActive);
        });
    }

    window.addEventListener("scroll", updateActiveLink);
    window.addEventListener("resize", function () {
        sectionMap = Array.from(document.querySelectorAll("main section[id]")).map(function (section) {
            return {
                id: section.id,
                top: section.offsetTop,
            };
        });
        updateActiveLink();
    });

    updateActiveLink();
})();
