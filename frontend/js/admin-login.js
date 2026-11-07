function login(){
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  fetch("http://localhost:8088/api/auth/login", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ email, password })
  })
  .then(res => {
    if(!res.ok) throw new Error("Login failed");
    return res.json();
  })
  .then(data => {
    if(data.role !== "ADMIN"){
      document.getElementById("error").innerText =
        "⛔ Tài khoản không có quyền quản trị";
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("role", data.role);
    localStorage.setItem("email", data.email);

    location.href = "admin.html";
  })
  .catch(()=>{
    document.getElementById("error").innerText =
      "Sai email hoặc mật khẩu";
  });
}
