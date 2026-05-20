const API_BASE = window.location.protocol === "file:"
  ? "http://localhost:8080/api"
  : `${window.location.origin}/api`;
const AUTH_KEY = "gms_admin";
const page = document.body.dataset.page;
let cachedMembers = [];
let cachedPayments = [];
let cachedTickets = [];

const toTitle = (value) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : "");
const normalizeValue = (value) => (value ? value.toString().trim().toLowerCase() : "");

const getStatusClass = (status) => {
  const normalized = normalizeValue(status);
  if (["paid", "active", "reviewed"].includes(normalized)) return "badge-success";
  if (["pending", "trial"].includes(normalized)) return "badge-warning";
  if (["overdue", "expired"].includes(normalized)) return "badge-danger";
  if (["frozen"].includes(normalized)) return "badge-muted";
  return "badge-info";
};

const getModalInstance = (id) => {
  const modalEl = document.getElementById(id);
  return modalEl ? bootstrap.Modal.getOrCreateInstance(modalEl) : null;
};

const setupNav = () => {
  const navLinks = document.querySelectorAll(".app-nav .nav-link");
  navLinks.forEach((link) => {
    if (link.getAttribute("href") && link.getAttribute("href").includes(page)) {
      link.classList.add("active");
    }
    if (page === "dashboard" && link.getAttribute("href") === "index.html") {
      link.classList.add("active");
    }
  });
};

const setupAuth = () => {
  if (page === "login") {
    if (localStorage.getItem(AUTH_KEY)) {
      window.location.href = "index.html";
    }
    return;
  }

  if (!localStorage.getItem(AUTH_KEY)) {
    window.location.href = "login.html";
  }
};

const setupLogout = () => {
  document.querySelectorAll(".logout-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      localStorage.removeItem(AUTH_KEY);
      window.location.href = "login.html";
    });
  });
};

const setupLoginForm = () => {
  const form = document.getElementById("loginForm");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    if (username === "admin" && password === "admin123") {
      localStorage.setItem(AUTH_KEY, "true");
      window.location.href = "index.html";
      return;
    }

    alert("Invalid admin credentials.");
  });
};

const fetchJson = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

const setFilterButtons = () => {
  const filterButtons = document.querySelectorAll(".btn-filter");
  const table = document.getElementById("memberTable");
  if (!filterButtons.length || !table) return;

  const searchInput = document.getElementById("memberSearch");
  const typeSelect = document.getElementById("memberType");

  const applyFilters = () => {
    const activeButton = document.querySelector(".btn-filter.active");
    const statusFilter = activeButton ? activeButton.dataset.filter : "all";
    const search = searchInput.value.toLowerCase();
    const planFilter = typeSelect.value;

    table.querySelectorAll("tbody tr").forEach((row) => {
      const status = row.dataset.status;
      const plan = row.dataset.plan;
      const text = row.textContent.toLowerCase();
      const statusMatch = statusFilter === "all" || statusFilter === status;
      const planMatch = planFilter === "all" || planFilter === plan;
      const searchMatch = text.includes(search);
      row.style.display = statusMatch && planMatch && searchMatch ? "" : "none";
    });
  };

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterButtons.forEach((item) => item.classList.remove("active"));
      btn.classList.add("active");
      applyFilters();
    });
  });

  searchInput.addEventListener("input", applyFilters);
  typeSelect.addEventListener("change", applyFilters);

  const resetButton = document.getElementById("resetMemberFilters");
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      searchInput.value = "";
      typeSelect.value = "all";
      filterButtons[0].classList.add("active");
      filterButtons.forEach((item, index) => {
        if (index !== 0) item.classList.remove("active");
      });
      applyFilters();
    });
  }
};

const renderMembers = (members) => {
  const table = document.getElementById("memberTable");
  if (!table) return;
  const body = table.querySelector("tbody");
  body.innerHTML = "";

  members.forEach((member) => {
    const status = (member.membershipStatus || "Active").toLowerCase();
    const plan = (member.membershipType || "standard").toLowerCase();
    const joinDate = member.joinDate ? new Date(member.joinDate).toLocaleDateString() : "--";
    const row = document.createElement("tr");
    row.dataset.status = status;
    row.dataset.plan = plan;
    row.innerHTML = `
      <td>${member.fullName}</td>
      <td>${member.email}</td>
      <td>${member.contactNumber || "--"}</td>
      <td>${member.membershipType ? toTitle(member.membershipType) : "Standard"}</td>
      <td>${joinDate}</td>
      <td><span class="badge ${getStatusClass(member.membershipStatus)}">${member.membershipStatus ? toTitle(member.membershipStatus) : "Active"}</span></td>
      <td>
        <button class="btn btn-sm btn-outline-light edit-member" data-id="${member.memberId}">Edit</button>
        <button class="btn btn-sm btn-outline-danger delete-member" data-id="${member.memberId}">Delete</button>
      </td>
    `;
    body.appendChild(row);
  });
};

const loadMembers = async () => {
  const table = document.getElementById("memberTable");
  if (!table) return;
  try {
    const members = await fetchJson("/members");
    cachedMembers = members;
    renderMembers(members);
    updateMemberInsights(members);
  } catch (error) {
    console.warn("Members API unavailable.", error);
  }
};

const updateSupportFeedbackScore = (tickets) => {
  const el = document.getElementById("feedbackScore");
  if (!el) return;

  const ratings = tickets
    .map((t) => Number(t.rating))
    .filter((r) => r >= 1 && r <= 5);

  if (ratings.length === 0) {
    el.textContent = "No ratings yet";
    return;
  }

  const total = ratings.reduce((sum, r) => sum + r, 0);
  const avg = total / ratings.length;

  el.textContent = `Average rating: ${avg.toFixed(1)} / 5 ⭐`;
};

const loadSupportMemberSelector = async () => {

  const select = document.getElementById("supportMemberId");

  if (!select) return;

  try {

    const members = await fetchJson("/members");

    select.innerHTML = `
      <option value="">Select Member</option>
    `;

    members.forEach((member) => {

      const option = document.createElement("option");

      option.value = member.memberId;

      option.textContent =
        `${member.memberId} - ${member.fullName}`;

      select.appendChild(option);
    });

  } catch (error) {

    console.error("Failed loading members:", error);

    select.innerHTML = `
      <option value="">Unable to load members</option>
    `;
  }
};

const handleMemberForm = () => {
  const form = document.getElementById("memberForm");
  const table = document.getElementById("memberTable");
  const memberIdInput = document.getElementById("memberId");
  const modalTitle = document.querySelector("#memberModal .modal-title");
  const submitButton = document.querySelector("#memberForm button[type='submit']");
  if (!form || !table) return;

  const addButton = document.querySelector("[data-bs-target='#memberModal']");
  if (addButton) {
    addButton.addEventListener("click", () => {
      form.reset();
      if (memberIdInput) memberIdInput.value = "";
      if (modalTitle) modalTitle.textContent = "Add Member";
      if (submitButton) submitButton.textContent = "Save Member";
    });
  }

  table.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.classList.contains("edit-member")) {
      const memberId = parseInt(target.dataset.id || "", 10);
      const member = cachedMembers.find((item) => item.memberId === memberId);
      if (!member) return;
      if (memberIdInput) memberIdInput.value = String(member.memberId);
      document.getElementById("memberName").value = member.fullName || "";
      document.getElementById("memberEmail").value = member.email || "";
      document.getElementById("memberContact").value = member.contactNumber || "";
      document.getElementById("memberPlan").value = (member.membershipType || "standard").toLowerCase();
      document.getElementById("memberStatus").value = (member.membershipStatus || "active").toLowerCase();
      if (modalTitle) modalTitle.textContent = "Edit Member";
      if (submitButton) submitButton.textContent = "Update Member";
      const modal = getModalInstance("memberModal");
      if (modal) modal.show();
      return;
    }

    if (target.classList.contains("delete-member")) {
      const memberId = parseInt(target.dataset.id || "", 10);
      if (!memberId) return;
      if (!confirm("Delete this member?")) return;
      try {
        await fetchJson(`/members/${memberId}`, { method: "DELETE" });
        await loadMembers();
      } catch (error) {
        console.warn("Delete member failed.", error);
      }
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = document.getElementById("memberName").value.trim();
    const email = document.getElementById("memberEmail").value.trim();
    const contactNumber = document.getElementById("memberContact").value.trim();
    const plan = document.getElementById("memberPlan").value;
    const status = document.getElementById("memberStatus").value;
    const memberId = memberIdInput && memberIdInput.value ? parseInt(memberIdInput.value, 10) : null;

    const payload = {
      memberId: memberId || 0,
      fullName: name,
      email,
      contactNumber,
      membershipType: plan,
      membershipStatus: status,
      joinDate: new Date().toISOString()
    };

    try {
      const path = memberId ? `/members/${memberId}` : "/members";
      const method = memberId ? "PUT" : "POST";
      await fetchJson(path, {
        method,
        body: JSON.stringify(payload)
      });
      await loadMembers();
    } catch (error) {
      console.warn("Members API unavailable.", error);
      alert("Unable to save member. Check the API connection and try again.");
    }

    form.reset();
    if (memberIdInput) memberIdInput.value = "";
    if (modalTitle) modalTitle.textContent = "Add Member";
    if (submitButton) submitButton.textContent = "Save Member";
    const modal = getModalInstance("memberModal");
    if (modal) modal.hide();
  });
};

const updateMemberInsights = (members) => {
  const el = document.getElementById("memberInsightsText");
  if (!el) return;

  const total = members.length;

  const active = members.filter(
    (m) => normalizeValue(m.membershipStatus) === "active"
  ).length;

  const planMap = {};
  members.forEach((m) => {
    const plan = normalizeValue(m.membershipType || "unknown");
    planMap[plan] = (planMap[plan] || 0) + 1;
  });

  const planCount = Object.keys(planMap).length;

  el.textContent = `${active} active members out of ${total} total (${planCount} plan types)`;
};

const renderAttendance = (logs) => {
  const table = document.getElementById("attendanceTable");
  if (!table) return;
  const body = table.querySelector("tbody");
  body.innerHTML = "";

  logs.forEach((log) => {
    const row = document.createElement("tr");
    const time = log.checkInTime ? new Date(log.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--";
    const memberLabel = log.memberName || (log.memberId ? `Member #${log.memberId}` : "Member");
    row.innerHTML = `
      <td>${memberLabel}</td>
      <td>${log.memberId || "--"}</td>
      <td>${time}</td>
      <td><span class="badge badge-success">${log.status || "Checked in"}</span></td>
    `;
    body.appendChild(row);
  });
};

const loadAttendance = async () => {
  const table = document.getElementById("attendanceTable");
  if (!table) return;
  try {
    const logs = await fetchJson("/attendance");
    renderAttendance(logs);
    updateAttendanceSummary(logs);
  } catch (error) {
    console.warn("Attendance API unavailable.", error);
  }
};

const loadAttendanceMembers = async () => {
  const select = document.getElementById("attendanceMemberSelect");
  const idInput = document.getElementById("attendanceId");

  if (!select) return;

  try {
    const members = await fetchJson("/members");

    select.innerHTML = `<option value="">Select Member</option>`;

    members.forEach((member) => {
      const option = document.createElement("option");
      option.value = member.memberId;
      option.textContent = `${member.fullName} (ID: ${member.memberId})`;
      select.appendChild(option);
    });

    select.addEventListener("change", () => {
      const selectedId = select.value;
      idInput.value = selectedId;
    });

  } catch (error) {
    console.warn("Failed to load members", error);
    select.innerHTML = `<option value="">Unable to load members</option>`;
  }
};

const updateAttendanceSummary = (logs) => {
  const totalEl = document.getElementById("attendanceTotal");
  const peakEl = document.getElementById("attendancePeak");
  const newEl = document.getElementById("attendanceNew");

  if (!totalEl && !peakEl && !newEl) return;

  const today = new Date();

  const todayLogs = logs.filter((log) => {
    if (!log.checkInTime) return false;
    const date = new Date(log.checkInTime);
    return date.toDateString() === today.toDateString();
  });

  if (totalEl) {
    totalEl.textContent = todayLogs.length;
  }

  if (newEl) {
    const uniqueMembers = new Set(
      todayLogs.map((log) => log.memberId).filter(Boolean)
    );
    newEl.textContent = uniqueMembers.size;
  }

  if (peakEl) {
    if (todayLogs.length === 0) {
      peakEl.textContent = "--";
      return;
    }

    const hourMap = new Map();

    todayLogs.forEach((log) => {
      const date = new Date(log.checkInTime);
      const hour = date.getHours();
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
    });

    const peak = [...hourMap.entries()].sort((a, b) => b[1] - a[1])[0];

    if (!peak) {
      peakEl.textContent = "--";
      return;
    }

    const hour = peak[0];
    const label = hour % 12 || 12;
    const ampm = hour >= 12 ? "PM" : "AM";

    peakEl.textContent = `${label} ${ampm}`;
  }
};

const handleAttendanceForm = () => {
  const form = document.getElementById("attendanceForm");
  const table = document.getElementById("attendanceTable");
  if (!form || !table) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = document.getElementById("attendanceName").value.trim();
    const memberId = document.getElementById("attendanceId").value.trim();
    const time = new Date().toISOString();

    const payload = {
      memberId: parseInt(memberId, 10) || 0,
      checkInTime: time,
      status: "CheckedIn"
    };

    try {
      await fetchJson("/attendance", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      await loadAttendance();
    } catch (error) {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${name}</td>
        <td>${memberId}</td>
        <td>${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
        <td><span class="badge badge-success">Checked in</span></td>
      `;
      table.querySelector("tbody").prepend(row);
      console.warn("Attendance API unavailable.", error);
    }

    form.reset();
  });
};

const renderSupportTickets = (tickets) => {
  const table = document.getElementById("supportTable");

  if (!table) return;

  const body = table.querySelector("tbody");

  body.innerHTML = "";

  tickets.forEach((ticket) => {
    const type = normalizeValue(ticket.type || "Support");

    const row = document.createElement("tr");

    row.dataset.type = type;

    const memberLabel =
      ticket.memberName ||
      (ticket.memberId
        ? `Member #${ticket.memberId}`
        : "Member");

    row.innerHTML = `
      <td>${memberLabel}</td>
      <td>${ticket.type || "Support"}</td>
      <td>${ticket.message}</td>
      <td>${ticket.response || "--"}</td>
      <td>${ticket.rating ?? "--"}</td>
      <td>
        <span class="badge ${getStatusClass(ticket.status)}">
          ${ticket.status || "Open"}
        </span>
      </td>
      <td>
        <button
          class="btn btn-sm btn-outline-light edit-ticket"
          data-id="${ticket.supportTicketId}">
          Edit
        </button>

        <button
          class="btn btn-sm btn-outline-danger delete-ticket"
          data-id="${ticket.supportTicketId}">
          Delete
        </button>
      </td>
    `;

    body.appendChild(row);
  });
};

const updateSupportSummary = (tickets) => {
  const openEl = document.getElementById("openTicketsCount");
  const pendingEl = document.getElementById("pendingTicketsCount");
  const resolvedEl = document.getElementById("resolvedTicketsCount");

  if (!openEl || !pendingEl || !resolvedEl) return;

  const now = new Date();

  const openTickets = tickets.filter(
    (ticket) =>
      normalizeValue(ticket.status) === "open"
  ).length;

  const pendingTickets = tickets.filter(
    (ticket) =>
      normalizeValue(ticket.status) === "pending"
  ).length;

  const resolvedThisWeek = tickets.filter((ticket) => {
    if (!ticket.createdAt) return false;

    const createdDate = new Date(ticket.createdAt);

    const diffDays =
      (now - createdDate) / (1000 * 60 * 60 * 24);

    return (
      diffDays <= 7 &&
      ["reviewed", "closed"].includes(
        normalizeValue(ticket.status)
      )
    );
  }).length;

  openEl.textContent = openTickets;
  pendingEl.textContent = pendingTickets;
  resolvedEl.textContent = resolvedThisWeek;
};

const loadSupportTickets = async () => {
  const table = document.getElementById("supportTable");
  if (!table) return;
  try {
    const tickets = await fetchJson("/support-tickets");
    cachedTickets = tickets;
    renderSupportTickets(tickets);
    updateSupportSummary(tickets);
    updateSupportFeedbackScore(tickets);
  } catch (error) {
    console.warn("Support API unavailable.", error);
  }
};

const handleSupportForm = () => {
  const form = document.getElementById("supportForm");
  const table = document.getElementById("supportTable");
  const filter = document.getElementById("supportFilter");
  const ticketIdInput = document.getElementById("supportTicketId");
  const modalTitle = document.querySelector("#supportModal .modal-title");
  const submitButton = document.querySelector("#supportForm button[type='submit']");
  if (!form || !table) return;

  const applySupportFilter = () => {
    if (!filter) return;
    const type = filter.value;
    table.querySelectorAll("tbody tr").forEach((row) => {
      row.style.display = type === "all" || row.dataset.type === type ? "" : "none";
    });
  };

  if (filter) {
    filter.addEventListener("change", applySupportFilter);
  }

  const addButton = document.querySelector("[data-bs-target='#supportModal']");
  if (addButton) {
    addButton.addEventListener("click", () => {
      form.reset();
      if (ticketIdInput) ticketIdInput.value = "";
      document.getElementById("supportStatus").value = "open";
      if (modalTitle) modalTitle.textContent = "New Support Request";
      if (submitButton) submitButton.textContent = "Submit";
    });
  }

  table.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.classList.contains("edit-ticket")) {
      const ticketId = parseInt(target.dataset.id || "", 10);
      const ticket = cachedTickets.find((item) => item.supportTicketId === ticketId);
      if (!ticket) return;
      if (ticketIdInput) ticketIdInput.value = String(ticket.supportTicketId);
      // document.getElementById("supportName").value = ticket.memberName || "";
      document.getElementById("supportType").value = (ticket.type || "support").toLowerCase();
      document.getElementById("supportMemberId").value =
        ticket.memberId ?? "";
      document.getElementById("supportMessage").value = ticket.message || "";
      document.getElementById("supportResponse").value = ticket.response || "";
      document.getElementById("supportStatus").value = (ticket.status || "open").toLowerCase();
      document.getElementById("supportRating").value = ticket.rating ?? "";
      if (modalTitle) modalTitle.textContent = "Edit Support Request";
      if (submitButton) submitButton.textContent = "Update";
      const modal = getModalInstance("supportModal");
      if (modal) modal.show();
      return;
    }

    if (target.classList.contains("delete-ticket")) {
      const ticketId = parseInt(target.dataset.id || "", 10);
      if (!ticketId) return;
      if (!confirm("Delete this ticket?")) return;
      try {
        await fetchJson(`/support-tickets/${ticketId}`, { method: "DELETE" });
        await loadSupportTickets();
      } catch (error) {
        console.warn("Delete ticket failed.", error);
      }
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    // const name = document.getElementById("supportName").value.trim();
    const type = document.getElementById("supportType").value;
    const memberId = document.getElementById("supportMemberId").value.trim();
    const message = document.getElementById("supportMessage").value.trim();
    const response = document.getElementById("supportResponse").value.trim();
    const status = document.getElementById("supportStatus").value;
    const rating = document.getElementById("supportRating").value || null;

    const ticketId =
      ticketIdInput && ticketIdInput.value
        ? parseInt(ticketIdInput.value, 10)
        : null;

    const payload = {
      supportTicketId: ticketId || 0,
      memberId: parseInt(memberId, 10) || 0,
      message,
      response: response || "",
      rating: rating ? parseInt(rating, 10) : null,
      type: toTitle(type),
      status: toTitle(status),
      createdAt: new Date().toISOString()
    };

    try {
      const path = ticketId
        ? `/support-tickets/${ticketId}`
        : "/support-tickets";

      const requestMethod = ticketId ? "PUT" : "POST";

      await fetchJson(path, {
        method: requestMethod,
        body: JSON.stringify(payload)
      });

      await loadSupportTickets();

      alert(ticketId ? "Ticket updated successfully!" : "Ticket saved successfully!");
    } catch (error) {
      console.error("Support ticket save failed:", error);

      alert("Failed to save support ticket. Check backend API.");

      const row = document.createElement("tr");

      row.dataset.type = normalizeValue(type);

      row.innerHTML = `
      <td>${name}</td>
      <td>${toTitle(type)}</td>
      <td>${message}</td>
      <td>${response || "--"}</td>
      <td>${rating || "--"}</td>
      <td>
        <span class="badge ${getStatusClass(status)}">
          ${toTitle(status)}
        </span>
      </td>
      <td>--</td>
    `;

      table.querySelector("tbody").prepend(row);
    }

    form.reset();

    if (ticketIdInput) {
      ticketIdInput.value = "";
    }

    if (modalTitle) {
      modalTitle.textContent = "New Support Request";
    }

    if (submitButton) {
      submitButton.textContent = "Submit";
    }

    const modal = getModalInstance("supportModal");

    if (modal) {
      modal.hide();
    }

    applySupportFilter();
  });
};

const renderPayments = (payments) => {
  const table = document.getElementById("paymentTable");
  if (!table) return;
  const body = table.querySelector("tbody");
  body.innerHTML = "";

  payments.forEach((payment) => {
    const date = payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString() : "--";
    const row = document.createElement("tr");
    const memberLabel = payment.memberName || (payment.memberId ? `Member #${payment.memberId}` : "Member");
    row.innerHTML = `
      <td>${memberLabel}</td>
      <td>${payment.plan || "--"}</td>
      <td>$${Number(payment.amount || 0).toFixed(2)}</td>
      <td>${date}</td>
      <td><span class="badge ${getStatusClass(payment.status)}">${payment.status || "Paid"}</span></td>
      <td>
        <button class="btn btn-sm btn-outline-light edit-payment" data-id="${payment.paymentId}">Edit</button>
        <button class="btn btn-sm btn-outline-danger delete-payment" data-id="${payment.paymentId}">Delete</button>
      </td>
    `;
    body.appendChild(row);
  });
};

const loadPayments = async () => {
  const table = document.getElementById("paymentTable");
  if (!table) return;
  try {
    const payments = await fetchJson("/payments");
    cachedPayments = payments;
    renderPayments(payments);
    updatePaymentSummary(payments);
  } catch (error) {
    console.warn("Payments API unavailable.", error);
  }
};

const updatePaymentSummary = (payments) => {
  const collectedEl = document.getElementById("paymentsCollected");
  const outstandingEl = document.getElementById("paymentsOutstanding");
  const overdueEl = document.getElementById("paymentsOverdue");
  const progressEl = document.getElementById("collectionProgress");
  const subtitleEl = document.getElementById("collectionSubtitle");
  const methodCardEl = document.getElementById("methodCard");
  const methodTransferEl = document.getElementById("methodTransfer");
  const methodCashEl = document.getElementById("methodCash");

  if (!collectedEl && !outstandingEl && !overdueEl && !progressEl && !subtitleEl) return;

  const now = new Date();
  const monthly = payments.filter((payment) => {
    if (!payment.paymentDate) return false;
    const date = new Date(payment.paymentDate);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });

  const sumByStatus = (status) => monthly
    .filter((payment) => (payment.status || "").toLowerCase() === status)
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const collected = sumByStatus("paid");
  const outstanding = sumByStatus("pending");
  const overdue = sumByStatus("overdue");
  const total = collected + outstanding + overdue;
  const progress = total ? Math.round((collected / total) * 100) : 0;

  if (collectedEl) collectedEl.textContent = `$${collected.toFixed(2)}`;
  if (outstandingEl) outstandingEl.textContent = `$${outstanding.toFixed(2)}`;
  if (overdueEl) overdueEl.textContent = `$${overdue.toFixed(2)}`;
  if (progressEl) {
    progressEl.style.width = `${progress}%`;
    progressEl.textContent = `${progress}%`;
  }
  if (subtitleEl) {
    subtitleEl.textContent = total ? "Monthly target progress." : "No payments yet this month.";
  }

  const methodTotals = monthly.reduce((acc, payment) => {
    const method = (payment.method || "").toLowerCase();
    const amount = Number(payment.amount || 0);
    acc[method] = (acc[method] || 0) + amount;
    return acc;
  }, {});

  const methodSum = Object.values(methodTotals).reduce((sum, value) => sum + value, 0);
  const toPercent = (value) => (methodSum ? Math.round((value / methodSum) * 100) : 0);
  if (methodCardEl) methodCardEl.textContent = `${toPercent(methodTotals.card || 0)}%`;
  if (methodTransferEl) methodTransferEl.textContent = `${toPercent(methodTotals.transfer || 0)}%`;
  if (methodCashEl) methodCashEl.textContent = `${toPercent(methodTotals.cash || 0)}%`;
};

const handlePaymentForm = () => {
  const form = document.getElementById("paymentForm");
  const table = document.getElementById("paymentTable");
  const paymentIdInput = document.getElementById("paymentId");
  const modalTitle = document.querySelector("#paymentModal .modal-title");
  const submitButton = document.querySelector("#paymentForm button[type='submit']");
  if (!form || !table) return;

  const addButton = document.querySelector("[data-bs-target='#paymentModal']");
  if (addButton) {
    addButton.addEventListener("click", () => {
      form.reset();
      if (paymentIdInput) paymentIdInput.value = "";
      if (modalTitle) modalTitle.textContent = "Record Payment";
      if (submitButton) submitButton.textContent = "Save Payment";
    });
  }

  table.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.classList.contains("edit-payment")) {
      const paymentId = parseInt(target.dataset.id || "", 10);
      const payment = cachedPayments.find((item) => item.paymentId === paymentId);
      if (!payment) return;
      if (paymentIdInput) paymentIdInput.value = String(payment.paymentId);
      document.getElementById("paymentMemberId").value = payment.memberId || "";
      document.getElementById("paymentAmount").value = payment.amount ?? "";
      document.getElementById("paymentMethod").value = payment.method || "Card";
      document.getElementById("paymentStatus").value = (payment.status || "Paid").toLowerCase();
      if (payment.paymentDate) {
        const date = new Date(payment.paymentDate);
        document.getElementById("paymentDate").value = date.toISOString().slice(0, 16);
      }
      if (modalTitle) modalTitle.textContent = "Edit Payment";
      if (submitButton) submitButton.textContent = "Update Payment";
      const modal = getModalInstance("paymentModal");
      if (modal) modal.show();
      return;
    }

    if (target.classList.contains("delete-payment")) {
      const paymentId = parseInt(target.dataset.id || "", 10);
      if (!paymentId) return;
      if (!confirm("Delete this payment?")) return;
      try {
        await fetchJson(`/payments/${paymentId}`, { method: "DELETE" });
        await loadPayments();
      } catch (error) {
        console.warn("Delete payment failed.", error);
      }
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const memberId = parseInt(document.getElementById("paymentMemberId").value, 10) || 0;
    const amount = parseFloat(document.getElementById("paymentAmount").value) || 0;
    const method = document.getElementById("paymentMethod").value;
    const status = document.getElementById("paymentStatus").value;
    const paymentDateInput = document.getElementById("paymentDate").value;
    const paymentId = paymentIdInput && paymentIdInput.value ? parseInt(paymentIdInput.value, 10) : null;

    const payload = {
      paymentId: paymentId || 0,
      memberId,
      amount,
      method,
      status: toTitle(status),
      paymentDate: paymentDateInput ? new Date(paymentDateInput).toISOString() : new Date().toISOString()
    };

    try {
      const path = paymentId ? `/payments/${paymentId}` : "/payments";
      const methodVerb = paymentId ? "PUT" : "POST";
      await fetchJson(path, {
        method: methodVerb,
        body: JSON.stringify(payload)
      });
      await loadPayments();
    } catch (error) {
      console.warn("Payments API unavailable.", error);
    }

    form.reset();
    if (paymentIdInput) paymentIdInput.value = "";
    if (modalTitle) modalTitle.textContent = "Record Payment";
    if (submitButton) submitButton.textContent = "Save Payment";
    const modal = getModalInstance("paymentModal");
    if (modal) modal.hide();
  });
};

const renderPlans = (plans) => {
  const container = document.getElementById("planCards");
  if (!container) return;
  container.innerHTML = "";

  plans.forEach((plan, index) => {
    const featuredClass = index === 1 ? "plan-card featured" : "plan-card";
    const card = document.createElement("div");
    card.className = "col-12 col-lg-4";
    card.innerHTML = `
      <div class="${featuredClass}">
        <h3>${plan.name}</h3>
        <p>${plan.description || ""}</p>
        <div class="plan-price">$${Number(plan.monthlyPrice || 0).toFixed(0)}<span>/month</span></div>
        <ul>
          <li>${plan.isActive ? "Active plan" : "Inactive"}</li>
          <li>Update pricing any time</li>
          <li>Member assignment ready</li>
        </ul>
        <button class="btn btn-light w-100">Edit Plan</button>
      </div>
    `;
    container.appendChild(card);
  });
};

const loadPlans = async () => {
  const container = document.getElementById("planCards");
  if (!container) return;
  try {
    const plans = await fetchJson("/membership-plans");
    renderPlans(plans);
  } catch (error) {
    console.warn("Plans API unavailable.", error);
  }
};

const formatShortDate = (dateValue) => {
  if (!dateValue) return "--";
  const date = new Date(dateValue);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const getRenewalDate = (joinDate) => {
  if (!joinDate) return null;
  const date = new Date(joinDate);
  date.setDate(date.getDate() + 30);
  return date;
};

const renderSubscriptions = (members) => {
  const body = document.getElementById("subscriptionTableBody");
  if (!body) return;
  body.innerHTML = "";
  const today = new Date();

  members.forEach((member) => {
    const renewalDate = getRenewalDate(member.joinDate);
    const renewalLabel = renewalDate ? formatShortDate(renewalDate) : "--";
    const statusLabel = renewalDate && (renewalDate - today) / 86400000 <= 14 ? "Due" : "Active";
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${member.fullName}</td>
      <td>${member.membershipType ? toTitle(member.membershipType) : "--"}</td>
      <td>${formatShortDate(member.joinDate)}</td>
      <td>${renewalLabel}</td>
      <td><span class="badge ${getStatusClass(statusLabel)}">${statusLabel}</span></td>
    `;
    body.appendChild(row);
  });
};

const renderRenewals = (members) => {
  const list = document.getElementById("renewalList");
  if (!list) return;
  list.innerHTML = "";

  const today = new Date();
  const upcoming = members
    .map((member) => ({
      member,
      renewalDate: getRenewalDate(member.joinDate)
    }))
    .filter((item) => item.renewalDate)
    .filter((item) => {
      const diffDays = (item.renewalDate - today) / 86400000;
      return diffDays >= 0 && diffDays <= 14;
    })
    .sort((a, b) => a.renewalDate - b.renewalDate)
    .slice(0, 5);

  if (!upcoming.length) {
    const empty = document.createElement("li");
    empty.textContent = "No renewals due in the next 14 days.";
    list.appendChild(empty);
    return;
  }

  upcoming.forEach(({ member, renewalDate }) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <div>
        <strong>${member.fullName}</strong>
        <div class="text-muted">${toTitle(member.membershipType || "Plan")} · Ends ${formatShortDate(renewalDate)}</div>
      </div>
      <span class="badge badge-soft">Due</span>
    `;
    list.appendChild(item);
  });
};

const renderDashboardActivity = (members, payments, tickets) => {
  const body = document.getElementById("activityTableBody");
  if (!body) return;
  body.innerHTML = "";

  const events = [];
  members.forEach((member) => {
    if (!member.joinDate) return;
    events.push({
      member: member.fullName,
      action: "New registration",
      date: new Date(member.joinDate),
      status: "New"
    });
  });

  payments.forEach((payment) => {
    if (!payment.paymentDate) return;
    events.push({
      member: payment.memberId ? `Member #${payment.memberId}` : "Member",
      action: "Payment received",
      date: new Date(payment.paymentDate),
      status: "Complete"
    });
  });

  tickets.forEach((ticket) => {
    if (!ticket.createdAt) return;
    events.push({
      member: ticket.memberId ? `Member #${ticket.memberId}` : "Member",
      action: "Support ticket",
      date: new Date(ticket.createdAt),
      status: ticket.status || "Open"
    });
  });

  events
    .sort((a, b) => b.date - a.date)
    .slice(0, 5)
    .forEach((event) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${event.member}</td>
        <td>${event.action}</td>
        <td>${formatShortDate(event.date)}</td>
        <td><span class="badge ${getStatusClass(event.status)}">${event.status}</span></td>
      `;
      body.appendChild(row);
    });
};

const renderDashboardStats = (members, payments, tickets) => {
  const activeMembersValue = document.getElementById("activeMembersValue");
  const newMembersValue = document.getElementById("newMembersValue");
  const paymentsValue = document.getElementById("paymentsValue");
  const ticketsValue = document.getElementById("ticketsValue");

  if (activeMembersValue) {
    const activeCount = members.filter((member) => normalizeValue(member.membershipStatus) === "active").length;
    activeMembersValue.textContent = activeCount.toString();
  }

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const newMembers = members.filter((member) => member.joinDate && new Date(member.joinDate) >= weekAgo).length;
  if (newMembersValue) {
    newMembersValue.textContent = newMembers.toString();
  }

  const now = new Date();
  const totalPayments = payments
    .filter((payment) => {
      if (!payment.paymentDate) return false;
      const date = new Date(payment.paymentDate);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    })
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  if (paymentsValue) {
    paymentsValue.textContent = `$${totalPayments.toFixed(2)}`;
  }

  const pendingTickets = tickets.filter((ticket) => normalizeValue(ticket.status) === "pending").length;
  if (ticketsValue) {
    ticketsValue.textContent = pendingTickets.toString();
  }
};

const renderWeeklyActivity = (attendanceLogs) => {
  const bars = document.querySelectorAll(".chart-bar");
  if (!bars.length) return;

  const now = new Date();

  const weekData = Array(7).fill(0);

  attendanceLogs.forEach((log) => {
    if (!log.checkInTime) return;

    const date = new Date(log.checkInTime);
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays < 7) {
      const index = 6 - diffDays;
      weekData[index]++;
    }
  });

  const max = Math.max(...weekData, 1);

  weekData.forEach((value, index) => {
    const heightPercent = (value / max) * 100;
    if (bars[index]) {
      bars[index].style.height = `${heightPercent}%`;
      bars[index].title = `${value} visits`;
    }
  });
};

const loadDashboard = async () => {
  if (page !== "dashboard") return;
  try {
    const results = await Promise.allSettled([
      fetchJson("/members"),
      fetchJson("/payments"),
      fetchJson("/support-tickets"),
      fetchJson("/attendance")
    ]);

    const members = results[0].status === "fulfilled" ? results[0].value : [];
    const payments = results[1].status === "fulfilled" ? results[1].value : [];
    const tickets = results[2].status === "fulfilled" ? results[2].value : [];
    const attendance = results[3].status === "fulfilled" ? results[3].value : [];

    renderDashboardStats(members, payments, tickets);
    renderRenewals(members);
    renderDashboardActivity(members, payments, tickets);
    renderWeeklyActivity(attendance);
  } catch (error) {
    console.warn("Dashboard API unavailable.", error);
    renderDashboardStats([], [], []);
  }
};

const loadMemberships = async () => {
  if (page !== "memberships") return;
  try {
    const members = await fetchJson("/members");
    renderSubscriptions(members);
  } catch (error) {
    console.warn("Memberships API unavailable.", error);
  }
};


setupNav();
setupAuth();
setupLogout();
setupLoginForm();
setFilterButtons();
handleMemberForm();
handleAttendanceForm();
handleSupportForm();
handlePaymentForm();
loadMembers();
loadSupportMemberSelector();
loadAttendance();
loadAttendanceMembers();
loadSupportTickets();
loadPayments();
loadPlans();
loadDashboard();
loadMemberships();
