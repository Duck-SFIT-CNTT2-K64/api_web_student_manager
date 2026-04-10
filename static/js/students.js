const studentsTableBody = document.getElementById("studentsTableBody");
const studentForm = document.getElementById("studentForm");
const studentMessage = document.getElementById("studentMessage");

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

function renderStudents(students) {
    studentsTableBody.innerHTML = "";

    if (students.length === 0) {
        studentsTableBody.innerHTML = '<tr><td colspan="7">No students found.</td></tr>';
        return;
    }

    students.forEach((student) => {
        const row = document.createElement("tr");
        row.classList.add("fade-in");
        row.innerHTML = `
            <td>${student.StudentId}</td>
            <td>${student.FullName ?? ""}</td>
            <td>${student.Email ?? ""}</td>
            <td>${student.Phone ?? ""}</td>
            <td>${formatDate(student.DateOfBirth)}</td>
            <td>${formatDate(student.CreatedAt)}</td>
            <td>
                <button class="btn btn-danger" data-action="delete" data-id="${student.StudentId}">
                    Delete
                </button>
            </td>
        `;
        studentsTableBody.appendChild(row);
    });
}

async function loadStudents() {
    try {
        const response = await fetch("/api/students");
        const result = await parseResponse(response);
        renderStudents(result.data);
    } catch (error) {
        setMessage(studentMessage, error.message, "error");
    }
}

studentForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
        FullName: document.getElementById("fullName").value.trim(),
        Email: document.getElementById("email").value.trim() || null,
        Phone: document.getElementById("phone").value.trim() || null,
        DateOfBirth: document.getElementById("dateOfBirth").value || null,
    };

    try {
        const response = await fetch("/api/students", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        await parseResponse(response);

        studentForm.reset();
        setMessage(studentMessage, "Student added successfully.", "success");
        await loadStudents();
    } catch (error) {
        setMessage(studentMessage, error.message, "error");
    }
});

studentsTableBody.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action='delete']");
    if (!button) {
        return;
    }

    const studentId = button.dataset.id;
    const isConfirmed = window.confirm("Delete this student?");
    if (!isConfirmed) {
        return;
    }

    try {
        const response = await fetch(`/api/students/${studentId}`, {
            method: "DELETE",
        });
        await parseResponse(response);

        setMessage(studentMessage, "Student deleted.", "success");
        await loadStudents();
    } catch (error) {
        setMessage(studentMessage, error.message, "error");
    }
});

loadStudents();
