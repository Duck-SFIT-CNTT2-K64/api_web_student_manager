const enrollmentForm = document.getElementById("enrollmentForm");
const paymentForm = document.getElementById("paymentForm");
const scoreForm = document.getElementById("scoreForm");

const enrollmentStudentId = document.getElementById("enrollmentStudentId");
const enrollmentClassId = document.getElementById("enrollmentClassId");
const paymentStudentId = document.getElementById("paymentStudentId");
const scoreEnrollmentId = document.getElementById("scoreEnrollmentId");

const enrollmentMessage = document.getElementById("enrollmentMessage");
const paymentMessage = document.getElementById("paymentMessage");
const scoreMessage = document.getElementById("scoreMessage");

const enrollmentsTableBody = document.getElementById("enrollmentsTableBody");

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

function fillSelect(selectElement, items, valueKey, textBuilder) {
    selectElement.innerHTML = "";

    if (items.length === 0) {
        const emptyOption = document.createElement("option");
        emptyOption.textContent = "No data";
        emptyOption.value = "";
        selectElement.appendChild(emptyOption);
        return;
    }

    items.forEach((item) => {
        const option = document.createElement("option");
        option.value = item[valueKey];
        option.textContent = textBuilder(item);
        selectElement.appendChild(option);
    });
}

function renderEnrollments(enrollments) {
    enrollmentsTableBody.innerHTML = "";

    if (enrollments.length === 0) {
        enrollmentsTableBody.innerHTML = '<tr><td colspan="7">No enrollments found.</td></tr>';
        return;
    }

    enrollments.forEach((item) => {
        const row = document.createElement("tr");
        row.classList.add("fade-in");
        row.innerHTML = `
            <td>${item.EnrollmentId}</td>
            <td>${item.StudentName ?? ""}</td>
            <td>${item.ClassName ?? ""}</td>
            <td>${item.CourseName ?? ""}</td>
            <td>${item.TeacherName ?? ""}</td>
            <td>${formatDate(item.EnrollDate)}</td>
            <td>${item.Status ?? ""}</td>
        `;
        enrollmentsTableBody.appendChild(row);
    });

    fillSelect(
        scoreEnrollmentId,
        enrollments,
        "EnrollmentId",
        (item) => `${item.EnrollmentId} - ${item.StudentName} / ${item.ClassName}`
    );
}

async function loadStudents() {
    const response = await fetch("/api/students");
    const result = await parseResponse(response);

    fillSelect(
        enrollmentStudentId,
        result.data,
        "StudentId",
        (item) => `${item.StudentId} - ${item.FullName}`
    );

    fillSelect(
        paymentStudentId,
        result.data,
        "StudentId",
        (item) => `${item.StudentId} - ${item.FullName}`
    );
}

async function loadClasses() {
    const response = await fetch("/api/classes");
    const result = await parseResponse(response);

    fillSelect(
        enrollmentClassId,
        result.data,
        "ClassId",
        (item) => `${item.ClassId} - ${item.ClassName} (${item.CourseName})`
    );
}

async function loadEnrollments() {
    const response = await fetch("/api/enrollments");
    const result = await parseResponse(response);
    renderEnrollments(result.data);
}

async function initializePage() {
    try {
        await Promise.all([loadStudents(), loadClasses(), loadEnrollments()]);
    } catch (error) {
        setMessage(enrollmentMessage, error.message, "error");
    }
}

enrollmentForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
        StudentId: Number(enrollmentStudentId.value),
        ClassId: Number(enrollmentClassId.value),
        Status: document.getElementById("enrollmentStatus").value.trim() || null,
    };

    try {
        const response = await fetch("/api/enrollments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        await parseResponse(response);

        setMessage(enrollmentMessage, "Enrollment created.", "success");
        await loadEnrollments();
    } catch (error) {
        setMessage(enrollmentMessage, error.message, "error");
    }
});

paymentForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
        StudentId: Number(paymentStudentId.value),
        Amount: Number(document.getElementById("paymentAmount").value),
        Method: document.getElementById("paymentMethod").value.trim() || null,
    };

    try {
        const response = await fetch("/api/payments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        await parseResponse(response);

        paymentForm.reset();
        setMessage(paymentMessage, "Payment created.", "success");
    } catch (error) {
        setMessage(paymentMessage, error.message, "error");
    }
});

scoreForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
        EnrollmentId: Number(scoreEnrollmentId.value),
        Score: Number(document.getElementById("scoreValue").value),
    };

    try {
        const response = await fetch("/api/scores", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        await parseResponse(response);

        scoreForm.reset();
        setMessage(scoreMessage, "Score created.", "success");
    } catch (error) {
        setMessage(scoreMessage, error.message, "error");
    }
});

initializePage();
