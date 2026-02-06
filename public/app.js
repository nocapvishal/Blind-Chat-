socket.on("group-offer",()=>{
 if(confirm("No partner found 😢 Join group chat?")){
   socket.emit("join-group");
 }
});

socket.on("group-matched",()=>{
 partnerName.innerText="Group chat 🎉";
});
socket.on("waiting", () => {
  partnerName.innerText = "Searching for partner...";
});

socket.on("group-offer", () => {
  if (confirm("No partner found 😢 Join group chat?")) {
    socket.emit("join-group");
  }
});

socket.on("group-matched", () => {
  partnerName.innerText = "🎉 Group Chat Started";
});
