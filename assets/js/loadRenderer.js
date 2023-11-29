const updateOnlineStatus = () => {
    document.getElementById('status').innerHTML = navigator.onLine ? 'online' : 'offline'
    //window.open("https://www.youraddress.com","_self")
  }
  
  window.addEventListener('online', updateOnlineStatus)
  window.addEventListener('offline', updateOnlineStatus)
  
  updateOnlineStatus()