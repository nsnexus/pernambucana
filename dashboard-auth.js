window.addEventListener('DOMContentLoaded', () => {
  const logout = document.getElementById('logoutBtn');
  if(logout){
    logout.addEventListener('click', () => {
      sessionStorage.removeItem('pernambucanaFinanceAuth');
      window.location.href = 'index.html';
    });
  }
});
