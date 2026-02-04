document.addEventListener("DOMContentLoaded", () => {
  alert("JS LOADED"); // 🔥 YOU MUST SEE THIS

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach(s => {
      s.classList.remove("active");
    });
    document.getElementById(id).classList.add("active");
  }

  const emailInput = document.getElementById("emailInput");
  const sendOtpBtn = document.getElementById("sendOtpBtn");
  const otpInput = document.getElementById("otpInput");
  const verifyOtpBtn = document.getElementById("verifyOtpBtn");
  const startBtn = document.getElementById("startBtn");

  if (!sendOtpBtn || !verifyOtpBtn || !startBtn) {
    alert("BUTTON IDs NOT FOUND — CHECK HTML IDS");
    console.error({
      sendOtpBtn,
      verifyOtpBtn,
      startBtn
    });
    return;
  }

  sendOtpBtn.addEventListener("click", async () => {
    alert("CONTINUE CLICKED");

    const email = emailInput.value.trim();
    if (!email.endsWith("@pondiuni.ac.in")) {
      alert("Invalid email");
      return;
    }

    const res = await fetch("/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "OTP failed");
      return;
    }

    showScreen("otp-screen");
  });

  verifyOtpBtn.addEventListener("click", async () => {
    alert("VERIFY CLICKED");

    const otp = otpInput.value.trim();
    const email = emailInput.value.trim();

    const res = await fetch("/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "OTP verify failed");
      return;
    }

    showScreen("start-screen");
  });

  startBtn.addEventListener("click", () => {
    alert("START CHAT CLICKED");
    showScreen("connecting-screen");
  });
});
