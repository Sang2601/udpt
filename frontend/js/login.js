const API = "http://localhost:8088/api";

function showLogin(){
  loginForm.style.display="block";
  registerForm.style.display="none";
  document.querySelectorAll(".tab")[0].classList.add("active");
  document.querySelectorAll(".tab")[1].classList.remove("active");
}

function showRegister(){
  loginForm.style.display="none";
  registerForm.style.display="block";
  document.querySelectorAll(".tab")[1].classList.add("active");
  document.querySelectorAll(".tab")[0].classList.remove("active");
}

async function login(){
  status.textContent="Đang đăng nhập...";
  try{
    const res = await fetch(API+"/auth/login",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        email:loginEmail.value,
        password:loginPassword.value
      })
    });
    if(!res.ok) throw new Error("Sai email hoặc mật khẩu");
    const data = await res.json();
    localStorage.setItem("token",data.token);
    localStorage.setItem("role",data.role);
    localStorage.setItem("email", loginEmail.value);
    status.textContent="Đăng nhập thành công!";
    status.className="status success";
    setTimeout(()=>location.href="booking.html",1200);
  }catch(e){
    status.textContent=e.message;
    status.className="status error";
  }
}

async function register(){
  status.textContent="Đang đăng ký...";
  try{
    const res = await fetch(API+"/users",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        username: regUsername.value,
        email: regEmail.value,
        password: regPassword.value,
        role: "CUSTOMER"
      })
    });
    if(!res.ok) throw new Error("Đăng ký thất bại");
    status.textContent="Đăng ký thành công – hãy đăng nhập";
    status.className="status success";
    showLogin();
  }catch(e){
    status.textContent=e.message;
    status.className="status error";
  }
}

