import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import type { Servico } from '../types'
import { ApiError } from '../lib/http'

export function ServicosPage() {
  const { request } = useApi()
  const [items, setItems] = useState<Servico[]>([])
  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    tags: '',
    ferramentas: '',
    github_repo: '',
  })
  const [imagemBase64, setImagemBase64] = useState<string>('')
  const [fileKey, setFileKey] = useState(0)
  const [tagFilter, setTagFilter] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const servicosData = await request<Servico[]>('/servicos/')
      setItems(servicosData)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar serviços')
    }
  }, [request])

  useEffect(() => {
    void load()
  }, [load])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setImagemBase64('')
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagemBase64(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await request('/servicos/', {
        method: 'POST',
        body: {
          nome: form.nome,
          descricao: form.descricao,
          tags: form.tags,
          ferramentas: form.ferramentas,
          github_repo: form.github_repo || undefined,
          imagem_base64: imagemBase64 || undefined,
        },
      })
      setForm({ nome: '', descricao: '', tags: '', ferramentas: '', github_repo: '' })
      setImagemBase64('')
      setFileKey((k) => k + 1)
      setShowAddModal(false)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar serviço')
    } finally {
      setLoading(false)
    }
  }

  const onDelete = async (id: number) => {
    if (!window.confirm('Excluir este serviço? Todos os contratos associados podem ser afetados.')) return
    const snapshot = items
    setItems((prev) => prev.filter((item) => item.id !== id))
    setError('')
    try {
      await request(`/servicos/${id}`, { method: 'DELETE' })
    } catch (err) {
      setItems(snapshot)
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir serviço')
    }
  }

  const filteredItems = items.filter((item) => {
    if (!tagFilter.trim()) return true
    const search = tagFilter.trim().toLowerCase()
    
    const tagsMatch = (item.tags || '')
      .toLowerCase()
      .split(',')
      .some((t) => t.trim().includes(search))
      
    const nameMatch = (item.nome || '').toLowerCase().includes(search)
    const ferramentasMatch = (item.ferramentas || '')
      .toLowerCase()
      .split(',')
      .some((f) => f.trim().includes(search))

    return tagsMatch || nameMatch || ferramentasMatch
  })

  return (
    <div className="font-body-md text-body-md">
      {/* Header Section */}
      <section className="mb-xl flex flex-col md:flex-row md:items-end justify-between gap-lg">
        <div>
          <h2 className="font-headline-md text-display-lg text-primary mb-xs font-bold text-2xl">Catálogo de Serviços</h2>
          <p className="text-secondary font-body-lg">
            Crie, customize e divulgue suas especialidades e portfólio comercial.
          </p>
        </div>
        <div className="flex gap-md no-print">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-primary text-on-primary py-sm px-md rounded-xl font-bold flex items-center justify-center gap-sm shadow-md active:scale-95 transition-transform hover:brightness-110"
          >
            <span className="material-symbols-outlined">add_circle</span>
            Novo Serviço
          </button>
        </div>
      </section>

      {error && <p className="error mb-md text-error bg-error-container/40 p-sm rounded-lg border border-error-container">{error}</p>}

      {/* Directory Filter Search */}
      <div className="mb-lg flex items-center justify-between flex-wrap gap-md">
        <h3 className="font-display-lg text-lg font-bold text-primary">Meus Serviços Cadastrados</h3>
        <div className="relative w-80">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline/60 text-[18px]">search</span>
          <input
            className="bg-white border border-outline/20 rounded-xl py-sm pl-10 pr-md w-full focus:outline-none focus:border-primary text-xs transition-all text-on-surface"
            type="text"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Table Section */}
      <article className="organic-card rounded-xl overflow-hidden bg-white shadow-sm border border-outline-variant/30">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-high text-label-sm text-secondary uppercase tracking-widest font-bold border-b border-outline/10 text-xs">
                <th className="px-lg py-md font-semibold w-16">Capa</th>
                <th className="px-lg py-md font-semibold">Serviço / Tags</th>
                <th className="px-lg py-md font-semibold">Tecnologias</th>
                <th className="px-lg py-md font-semibold">Repositório</th>
                <th className="px-lg py-md text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="text-body-md divide-y divide-outline-variant/20">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-primary-fixed/5 transition-all text-sm">
                  <td className="px-lg py-lg">
                    {item.imagem_base64 ? (
                      <img 
                        src={item.imagem_base64} 
                        alt={item.nome} 
                        className="w-12 h-9 object-cover rounded-lg border border-outline/10 shadow-sm"
                      />
                    ) : (
                      <div className="w-12 h-9 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-[18px]">design_services</span>
                      </div>
                    )}
                  </td>
                  <td className="px-lg py-lg">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-on-surface text-base">
                        {item.nome}
                      </span>
                      {item.tags && (
                        <div className="flex flex-wrap gap-xs">
                          {item.tags.split(',').map((tag) => (
                            <span 
                              key={tag.trim()} 
                              className="px-sm py-[2px] rounded-lg border border-primary/20 bg-primary/10 text-primary font-semibold text-[10px]"
                            >
                              {tag.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-lg py-lg">
                    {item.ferramentas ? (
                      <div className="flex flex-wrap gap-xs max-w-xs">
                        {item.ferramentas.split(',').map((tech) => (
                          <span 
                            key={tech.trim()} 
                            className="px-sm py-[2px] rounded bg-secondary-container text-on-secondary-container font-semibold text-[10px]"
                          >
                            {tech.trim()}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="opacity-30 italic text-xs">Nenhuma</span>
                    )}
                  </td>
                  <td className="px-lg py-lg">
                    {item.github_repo ? (
                      <a 
                        href={item.github_repo} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-xs text-primary font-semibold hover:underline text-xs"
                      >
                        <span className="material-symbols-outlined text-sm">link</span>
                        Repositório
                      </a>
                    ) : (
                      <span className="opacity-30 italic text-xs">Nenhum</span>
                    )}
                  </td>
                  <td className="px-lg py-lg text-right">
                    <div className="flex gap-md justify-end items-center">
                      <Link
                        to={`/servicos/${item.id}`}
                        state={{ servicoNome: item.nome }}
                        className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-all text-[20px]"
                        title="Visualizar ficha comercial"
                      >
                        visibility
                      </Link>
                      <button
                        type="button"
                        onClick={() => void onDelete(item.id)}
                        className="material-symbols-outlined text-outline hover:text-error transition-all text-[20px]"
                        title="Excluir serviço"
                      >
                        delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-lg text-secondary">
                    Nenhum serviço oferecido cadastrado ou correspondente aos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      {/* Modal Novo Serviço */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(28, 38, 30, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 99999,
          }}
        >
          <div className="card bg-white p-lg rounded-xl shadow-2xl border border-outline-variant/30" style={{ width: 'min(500px, 94vw)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', fontFamily: 'var(--font-heading)' }} className="text-primary">
              Cadastrar Novo Serviço
            </h3>

            <form onSubmit={onSubmit} className="space-y-md">
              <label className="block text-sm font-semibold text-outline">
                Nome do Serviço *
                <input
                  required
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                  value={form.nome}
                  onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
                />
              </label>

              <label className="block text-sm font-semibold text-outline">
                URL do GitHub (Repositório)
                <input
                  type="url"
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                  value={form.github_repo}
                  onChange={(e) => setForm((prev) => ({ ...prev, github_repo: e.target.value }))}
                />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                <label className="flex flex-col justify-between h-full text-sm font-semibold text-outline">
                  <span>Tags (Separadas por vírgula)</span>
                  <input
                    className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                    value={form.tags}
                    onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
                  />
                </label>

                <label className="flex flex-col justify-between h-full text-sm font-semibold text-outline">
                  <span>Ferramentas (Separadas por vírgula)</span>
                  <input
                    className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                    value={form.ferramentas}
                    onChange={(e) => setForm((prev) => ({ ...prev, ferramentas: e.target.value }))}
                  />
                </label>
              </div>

              <div className="flex items-center justify-between gap-md border border-outline/10 p-sm rounded-xl">
                <label className="block text-xs font-semibold text-outline cursor-pointer flex-1">
                  Capa do Serviço (Imagem)
                  <input
                    key={fileKey}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="mt-1 w-full text-xs text-on-surface file:mr-md file:py-xs file:px-sm file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                  />
                </label>
                {imagemBase64 && (
                  <img
                    src={imagemBase64}
                    alt="Preview"
                    className="w-12 h-9 object-cover rounded-lg border border-outline/10 shadow-sm"
                  />
                )}
              </div>

              <label className="block text-sm font-semibold text-outline">
                Descrição Detalhada
                <textarea
                  rows={3}
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface resize-none"
                  value={form.descricao}
                  onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))}
                />
              </label>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  type="button"
                  className="px-md py-sm bg-surface-container-high rounded-xl text-outline font-bold text-sm"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancelar
                </button>
                <button
                  className="px-md py-sm bg-primary text-on-primary rounded-xl font-bold text-sm shadow-md"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Salvando...' : 'Cadastrar Serviço'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
