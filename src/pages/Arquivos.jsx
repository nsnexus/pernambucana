import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TopNav from '../components/TopNav';
import { db, storage } from '../context/AuthContext';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const CATEGORIES = {
  'Segurança': ['Aso', 'Treinamento', 'Documento normativo', 'Nr-01', 'DSS', 'Campanhas'],
  'Meio ambiente': ['Recolhimento de contaminado', 'Venda de sucatas', 'Documento normativo', 'Evidência do SAO', 'Evidencia AVCB'],
  'Administração': ['Licença de Funcionamento', 'Advertências', 'Folha de pagamento', 'Efetivo (nome, data de nascimento, cpf, endereço, telefone e Pix)', 'Modelo de Documentos']
};

const Arquivos = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  // Theme State
  const [whiteTheme, setWhiteTheme] = useState(() => {
    return localStorage.getItem('pernambucana.financeDashboard.theme.v1') === 'white';
  });

  useEffect(() => {
    document.body.classList.toggle('theme-white', whiteTheme);
    localStorage.setItem('pernambucana.financeDashboard.theme.v1', whiteTheme ? 'white' : 'black');
  }, [whiteTheme]);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);

  // Form State
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState('');
  const [subcategoria, setSubcategoria] = useState('');
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // List State
  const [arquivosList, setArquivosList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter State
  const [filterCategoria, setFilterCategoria] = useState('Todas');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchArquivos = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'arquivos'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = [];
      querySnapshot.forEach((docSnap) => {
        data.push({ id: docSnap.id, ...docSnap.data() });
      });
      setArquivosList(data);
    } catch (error) {
      console.error("Erro ao buscar arquivos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArquivos();
  }, []);

  const handleCategoriaChange = (e) => {
    setCategoria(e.target.value);
    setSubcategoria('');
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!titulo || !categoria || !subcategoria || !file) {
      alert('Por favor, preencha todos os campos e selecione um arquivo.');
      return;
    }

    try {
      setIsUploading(true);
      
      const filePath = `arquivos/${categoria}/${Date.now()}_${file.name}`;
      const fileRef = ref(storage, filePath);
      const snapshot = await uploadBytes(fileRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      await addDoc(collection(db, 'arquivos'), {
        titulo,
        categoria,
        subcategoria,
        fileName: file.name,
        filePath: filePath,
        fileUrl: downloadURL,
        uploadedBy: currentUser?.email || 'Desconhecido',
        createdAt: serverTimestamp()
      });

      setTitulo('');
      setCategoria('');
      setSubcategoria('');
      setFile(null);
      setModalOpen(false);
      alert('Arquivo cadastrado com sucesso!');
      fetchArquivos();

    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      alert('Erro ao enviar o arquivo. Tente novamente.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (arquivo) => {
    if (!window.confirm(`Tem certeza que deseja excluir o arquivo: ${arquivo.titulo}?`)) return;
    
    try {
      if (arquivo.filePath) {
        const fileRef = ref(storage, arquivo.filePath);
        await deleteObject(fileRef).catch(err => console.warn("Arquivo não encontrado no storage, removendo apenas do banco."));
      }
      await deleteDoc(doc(db, 'arquivos', arquivo.id));
      alert('Arquivo excluído com sucesso.');
      fetchArquivos();
    } catch (error) {
      console.error("Erro ao excluir arquivo:", error);
      alert('Erro ao excluir arquivo.');
    }
  };

  const filteredArquivos = arquivosList.filter(a => {
    if (filterCategoria !== 'Todas' && a.categoria !== filterCategoria) return false;
    if (searchQuery && !a.titulo.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="painel-layout" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <TopNav 
        currentPage="arquivos" 
        onPageChange={(page) => navigate('/pernambucana')} 
        currentDept="all" 
        onDeptChange={() => {}} 
        isPernambucana={true}
        whiteTheme={whiteTheme}
        setWhiteTheme={setWhiteTheme}
      />

      <main className="main">
        <header className="hero" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--line)' }}>
          <div>
            <div className="badge"><span></span> Gestão Documental</div>
            <h1>Arquivos Cadastrados</h1>
            <p>Cadastre e visualize arquivos de Segurança, Meio Ambiente e Administração.</p>
          </div>
          <div>
            <button className="btn primary" onClick={() => setModalOpen(true)}>+ Novo Arquivo</button>
          </div>
        </header>

        {/* Toolbar de filtros */}
        <section className="toolbar glass" style={{ marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label>
            Categoria
            <select value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)}>
              <option value="Todas">Todas as Categorias</option>
              {Object.keys(CATEGORIES).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </label>

          <label className="search" style={{ flex: 1 }}>
            Busca
            <input 
              type="search" 
              placeholder="Buscar por título do documento..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
        </section>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
            Carregando arquivos do Firebase...
          </div>
        ) : (
          <section className="details glass" style={{ padding: '20px', borderRadius: '16px' }}>
            <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <span>{filterCategoria}</span>
                <h3>Lista de Arquivos ({filteredArquivos.length} registros)</h3>
              </div>
            </div>

            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Categoria</th>
                    <th>Subcategoria</th>
                    <th>Enviado por</th>
                    <th>Data</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredArquivos.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)' }}>
                        Nenhum arquivo encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredArquivos.map(arquivo => (
                      <tr key={arquivo.id}>
                        <td>{arquivo.titulo}</td>
                        <td>{arquivo.categoria}</td>
                        <td>{arquivo.subcategoria}</td>
                        <td>{arquivo.uploadedBy}</td>
                        <td>{arquivo.createdAt?.toDate ? new Date(arquivo.createdAt.toDate()).toLocaleDateString() : 'Recente'}</td>
                        <td>
                          <a href={arquivo.fileUrl} target="_blank" rel="noopener noreferrer" className="btn mini ghost" style={{ marginRight: '6px', textDecoration: 'none', display: 'inline-block' }}>
                            Visualizar
                          </a>
                          {currentUser?.isAdmin && (
                            <button className="btn mini bad" onClick={() => handleDelete(arquivo)}>Excluir</button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {/* Modal Novo Arquivo */}
      {modalOpen && (
        <div className="modal show" id="arquivoModal">
          <div className="modal-backdrop" onClick={() => setModalOpen(false)}></div>
          <form className="login-card modal-form-card glass" onSubmit={handleSubmit} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Novo Arquivo</h2>
              <button className="close" type="button" onClick={() => setModalOpen(false)}>×</button>
            </div>
            
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="form-group">
                <label>Título do Documento</label>
                <input type="text" placeholder="Ex: Treinamento NR-35" required value={titulo} onChange={(e) => setTitulo(e.target.value)} />
              </div>

              <div className="form-group">
                <label>Categoria</label>
                <select required value={categoria} onChange={handleCategoriaChange}>
                  <option value="">Selecione...</option>
                  {Object.keys(CATEGORIES).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {categoria && (
                <div className="form-group">
                  <label>Subcategoria</label>
                  <select required value={subcategoria} onChange={(e) => setSubcategoria(e.target.value)}>
                    <option value="">Selecione...</option>
                    {CATEGORIES[categoria].map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Arquivo</label>
                <input type="file" required onChange={handleFileChange} />
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn ghost" type="button" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="btn primary" type="submit" disabled={isUploading}>
                {isUploading ? 'Enviando...' : 'Salvar Arquivo'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Arquivos;
