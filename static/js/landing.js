(function () {
    var navToggle = document.getElementById("navToggle");
    var navLinks = document.getElementById("navLinks");
    var programSearchInput = document.getElementById("programSearchInput");
    var programSearchForm = document.getElementById("programSearchForm");
    var courseCards = Array.from(document.querySelectorAll(".course-card"));
    var categoryChips = Array.from(document.querySelectorAll(".category-chip"));
    var courseEmptyState = document.getElementById("courseEmptyState");
    var programsSection = document.getElementById("programs");

    function normalizeText(value) {
        return (value || "").toLowerCase().trim();
    }

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

    var currentCategory = "all";
    var currentKeyword = "";

    function applyProgramFilter() {
        var visibleCount = 0;

        courseCards.forEach(function (card) {
            var cardCategory = card.dataset.category || "general";
            var cardText = normalizeText(card.dataset.name);
            var categoryMatch = currentCategory === "all" || currentCategory === cardCategory;
            var keywordMatch = !currentKeyword || cardText.indexOf(currentKeyword) !== -1;
            var isVisible = categoryMatch && keywordMatch;

            card.hidden = !isVisible;
            if (isVisible) {
                visibleCount += 1;
            }
        });

        if (courseEmptyState) {
            courseEmptyState.hidden = visibleCount > 0;
        }
    }

    if (programSearchInput) {
        programSearchInput.addEventListener("input", function () {
            currentKeyword = normalizeText(programSearchInput.value);
            applyProgramFilter();
        });
    }

    if (programSearchForm) {
        programSearchForm.addEventListener("submit", function (event) {
            event.preventDefault();
            currentKeyword = normalizeText(programSearchInput ? programSearchInput.value : "");
            applyProgramFilter();

            if (programsSection) {
                programsSection.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        });
    }

    categoryChips.forEach(function (chip) {
        chip.addEventListener("click", function () {
            currentCategory = chip.dataset.category || "all";

            categoryChips.forEach(function (item) {
                item.classList.remove("is-active");
            });
            chip.classList.add("is-active");

            applyProgramFilter();
        });
    });

    var slides = Array.from(document.querySelectorAll(".hero-slide"));
    var dots = Array.from(document.querySelectorAll(".hero-dot"));
    var heroPrev = document.getElementById("heroPrev");
    var heroNext = document.getElementById("heroNext");
    var heroCarousel = document.getElementById("heroCarousel");
    var activeSlide = 0;
    var slideTimer;

    function showSlide(index) {
        if (!slides.length) {
            return;
        }

        var safeIndex = index;
        if (safeIndex < 0) {
            safeIndex = slides.length - 1;
        }
        if (safeIndex >= slides.length) {
            safeIndex = 0;
        }

        activeSlide = safeIndex;

        if (heroCarousel) {
            heroCarousel.style.transform = "translateX(-" + activeSlide * 100 + "%)";
        }

        slides.forEach(function (slide, slideIndex) {
            slide.classList.toggle("is-active", slideIndex === activeSlide);
        });

        dots.forEach(function (dot, dotIndex) {
            dot.classList.toggle("is-active", dotIndex === activeSlide);
        });
    }

    function moveSlide(step) {
        showSlide(activeSlide + step);
    }

    function stopAutoSlide() {
        if (slideTimer) {
            clearInterval(slideTimer);
            slideTimer = undefined;
        }
    }

    function startAutoSlide() {
        stopAutoSlide();
        if (slides.length < 2) {
            return;
        }

        slideTimer = setInterval(function () {
            moveSlide(1);
        }, 7000);
    }

    if (heroPrev) {
        heroPrev.addEventListener("click", function () {
            moveSlide(-1);
            startAutoSlide();
        });
    }

    if (heroNext) {
        heroNext.addEventListener("click", function () {
            moveSlide(1);
            startAutoSlide();
        });
    }

    dots.forEach(function (dot) {
        dot.addEventListener("click", function () {
            showSlide(Number(dot.dataset.slide || 0));
            startAutoSlide();
        });
    });

    if (heroCarousel) {
        heroCarousel.addEventListener("mouseenter", stopAutoSlide);
        heroCarousel.addEventListener("mouseleave", startAutoSlide);
    }

    document.addEventListener("keydown", function (event) {
        if (event.key === "ArrowLeft") {
            moveSlide(-1);
            startAutoSlide();
        }
        if (event.key === "ArrowRight") {
            moveSlide(1);
            startAutoSlide();
        }
    });

    document.querySelectorAll(".teacher-avatar img").forEach(function (img) {
        img.addEventListener("error", function () {
            var holder = img.closest(".teacher-avatar");
            if (!holder) {
                return;
            }

            var initial = img.dataset.initial || holder.dataset.initial || "T";
            img.remove();

            if (!holder.querySelector("span")) {
                var fallback = document.createElement("span");
                fallback.textContent = initial;
                holder.appendChild(fallback);
            }
        });
    });

    function buildSectionMap() {
        return Array.from(document.querySelectorAll("main section[id]")).map(function (section) {
            return {
                id: section.id,
                top: section.offsetTop,
            };
        });
    }

    var sectionMap = buildSectionMap();

    function updateActiveLink() {
        var scrollTop = window.scrollY + 140;
        var activeId = "hero";

        sectionMap.forEach(function (item) {
            if (scrollTop >= item.top) {
                activeId = item.id;
            }
        });

        document.querySelectorAll(".main-nav a[data-section]").forEach(function (link) {
            var isActive = link.dataset.section === activeId;
            link.classList.toggle("active", isActive);
        });
    }

    window.addEventListener("scroll", updateActiveLink, { passive: true });
    window.addEventListener("resize", function () {
        sectionMap = buildSectionMap();
        updateActiveLink();
    });

    applyProgramFilter();
    showSlide(0);
    startAutoSlide();
    updateActiveLink();
})();
