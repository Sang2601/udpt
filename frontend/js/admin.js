const BASE="http://localhost:8088/api";

function show(id,el){
  document.querySelectorAll("section").forEach(s=>s.style.display="none");
  document.getElementById(id).style.display="block";
  document.querySelectorAll(".sidebar a").forEach(a=>a.classList.remove("active"));
  el.classList.add("active");
  if(id==="dashboard")loadDashboard();
  if(id==="bookings")loadBookings();
  if(id==="rooms")loadRooms();
  if(id==="users")loadUsers();
}

async function loadDashboard(){
  const [rooms, bookings, users, revenue] = await Promise.all([
    fetch(BASE+"/rooms").then(r=>r.json()),
    fetch(BASE+"/bookings").then(r=>r.json()),
    fetch(BASE+"/users").then(r=>r.json()),
    fetch(BASE+"/payments/revenue/total").then(r=>r.json())
  ]);

  statRooms.innerText = rooms.length;
  statBookings.innerText = bookings.length;
  statUsers.innerText = users.length;
  statRevenue.innerText = revenue.toLocaleString() + " đ";
}

function loadBookings(){
  fetch(BASE+"/bookings/admin").then(r=>r.json()).then(data=>{
    bookingTable.innerHTML="";
    data.forEach(b=>{
      const cls=b.status==="CONFIRMED"?"approved":b.status==="CANCELLED"?"canceled":"pending";
      const act=b.status==="PENDING_PAYMENT"
        ?`<button class="btn btn-primary" onclick="confirmBooking(${b.id})">Duyệt</button>
           <button class="btn btn-outline" onclick="cancelBooking(${b.id})">Huỷ</button>`
        :"—";
      bookingTable.innerHTML+=`
        <tr>
          <td>${b.id}</td>
          <td>${b.userEmail}</td>
          <td>${b.roomName} (${b.roomPrice.toLocaleString()} đ)</td>
          <td>${b.checkIn} → ${b.checkOut}</td>
          <td><span class="badge ${cls}">${b.status}</span></td>
          <td>${act}</td>
        </tr>`;
    });
  });
}

function confirmBooking(id){
  fetch(`${BASE}/bookings/${id}/confirm`,{method:"PUT"}).then(loadBookings);
}
function cancelBooking(id){
  fetch(`${BASE}/bookings/${id}/cancel`,{method:"PUT"}).then(loadBookings);
}

function loadRooms(){
  fetch(BASE+"/rooms").then(r=>r.json()).then(data=>{
    roomTable.innerHTML="";
    data.forEach(r=>{
      roomTable.innerHTML+=`
        <tr>
          <td>${r.id}</td>
          <td>${r.name}</td>
          <td>${r.capacity}</td>
          <td>${r.price.toLocaleString()} đ</td>
          <td><button class="btn btn-outline" disabled>Sửa</button></td>
        </tr>`;
    });
  });
}

function loadUsers(){
  fetch(BASE+"/users").then(r=>r.json()).then(data=>{
    userBody.innerHTML="";
    data.forEach(u=>{
      userBody.innerHTML+=`
        <tr>
          <td>${u.username}</td>
          <td>${u.email}</td>
          <td>${u.role}</td>
        </tr>`;
    });
  });
}

function logout(){
  localStorage.clear();
  location.href="admin-login.html";
}

loadDashboard();
