const classesTableBody = document.getElementById("classesTableBody");
const classesMessage = document.getElementById("classesMessage");

function setMessage(element, text, type = "") {
    element.textContent = text;
    element.classList.remove("success", "error");
    if (type) {
        element.classList.add(type);
    }
}

async function parseResponse(response) {
    const result = await response.json();
    if (!response.ok || result.success === false) {
        throw new Error(result.error || "Request failed.");
    }
    return result;
}

function formatDate(value) {
    if (!value) {
        return "";
    }
    return value.slice(0, 10);
}

function renderClasses(classes) {
    classesTableBody.innerHTML = "";

    if (classes.length === 0) {
        classesTableBody.innerHTML = '<tr><td colspan="7">No classes found.</td></tr>';
        return;
    }

    classes.forEach((item) => {
        const row = document.createElement("tr");
        row.classList.add("fade-in");
        row.innerHTML = `
            <td>${item.ClassId}</td>
            <td>${item.ClassName ?? ""}</td>
            <td>${item.CourseName ?? ""}</td>
            <td>${item.TeacherName ?? ""}</td>
            <td>${formatDate(item.StartDate)}</td>
            <td>${formatDate(item.EndDate)}</td>
            <td>${item.Status ?? ""}</td>
        `;
        classesTableBody.appendChild(row);
    });
}

async function loadClasses() {
    try {
        const response = await fetch("/api/classes");
        const result = await parseResponse(response);
        renderClasses(result.data);
        setMessage(classesMessage, "Class data loaded.", "success");
    } catch (error) {
        setMessage(classesMessage, error.message, "error");
    }
}

loadClasses();
