(function(){
  const ok = sessionStorage.getItem('pernambucanaFinanceAuth') === 'ok';
  if(!ok){
    const target = encodeURIComponent('painel.html');
    window.location.replace(`index.html?login=1&next=${target}`);
  }
})();
