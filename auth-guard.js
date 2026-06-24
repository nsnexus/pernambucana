(function(){
  const ok = sessionStorage.getItem('pernambucanaFinanceAuth') === 'ok';
  if(!ok){
    const page = window.location.pathname.split('/').pop() || 'painel.html';
    const target = encodeURIComponent(page);
    window.location.replace(`index.html?login=1&next=${target}`);
  }
})();
