import React, { useState, useEffect, useCallback } from 'react';
import useModalScrollLock from '../../hooks/useModalScrollLock.jsx';
import AdminLayout from '../../components/adminLayout.jsx';
import * as adminService from '../../services/adminService';
import { getPlaceCategories, sortCategoriesBeachLast, humanizeCategoryLabel } from '../../services/placesService';
import { resolveMediaUrl, ApiError, bumpMediaCacheVersion } from '../../services/apiClient';

const PAGE_SIZE = 10;

const EMPTY_FORM = {
  name: '',
  category: '',
  description: '',
  address: '',
  municipality: 'Xicotepec',
  lat: '',
  lng: '',
  tags: '',
  priceLevel: 1,
  isActive: true,
};

const PRICE_LABELS = { 1: 'Económico', 2: 'Moderado', 3: 'Alto', 4: 'Premium' };

function AdminInventario({ onNavigate }) {
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('todo');
  
  // Optimizando la búsqueda con un Debounce local
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [places, setPlaces] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('loading'); 
  const [loadError, setLoadError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); 
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingImages, setEditingImages] = useState([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState(null);

  useModalScrollLock(modalOpen || Boolean(deleteTarget));
  
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast((c) => (c === msg ? null : c)), 3000);
  };

  useEffect(() => {
    getPlaceCategories().then((cats) => setCategories(sortCategoriesBeachLast(cats)));
  }, []);

  // Debounce para no saturar el backend al escribir
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const loadPlaces = useCallback(() => {
    let cancelled = false;
    setStatus('loading');
    adminService
      .listPlaces({ page, pageSize: PAGE_SIZE, category: categoryFilter, search })
      .then(({ places: list, total: count }) => {
        if (cancelled) return;
        setPlaces(list);
        setTotal(count);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err.message : 'No pudimos cargar el inventario.');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [page, categoryFilter, search]);

  useEffect(() => {
    const cleanup = loadPlaces();
    return cleanup;
  }, [loadPlaces]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setEditingImages([]);
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (place) => {
    setEditingId(place._id || place.id);
    setForm({
      name: place.name || '',
      category: place.category || '',
      description: place.description || '',
      address: place.address || '',
      municipality: place.municipality || 'Xicotepec',
      lat: place.location?.coordinates?.[1] ?? '',
      lng: place.location?.coordinates?.[0] ?? '',
      tags: Array.isArray(place.tags) ? place.tags.join(', ') : '',
      priceLevel: place.priceLevel || 1,
      isActive: place.isActive !== false,
    });
    setEditingImages(Array.isArray(place.images) ? place.images : []);
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving || uploadingImages) return;
    setModalOpen(false);
  };

  const handleFormChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setFormError('El nombre es obligatorio.');
    if (!form.category) return setFormError('Elige una categoría.');
    if (!form.address && (form.lat === '' || form.lng === '')) {
      return setFormError('Proporciona una dirección o coordenadas (latitud/longitud).');
    }

    const payload = {
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim() || undefined,
      address: form.address.trim() || undefined,
      municipality: form.municipality.trim() || undefined,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      priceLevel: Number(form.priceLevel) || 1,
    };
    if (form.lat !== '' && form.lng !== '') {
      payload.lat = Number(form.lat);
      payload.lng = Number(form.lng);
    }
    if (editingId) payload.isActive = form.isActive;

    setSaving(true);
    setFormError('');
    try {
      if (editingId) {
        await adminService.updatePlace(editingId, payload);
        showToast(`"${payload.name}" se actualizó correctamente.`);
      } else {
        await adminService.createPlace(payload);
        showToast(`"${payload.name}" se agregó al catálogo.`);
      }
      setModalOpen(false);
      loadPlaces();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Error al guardar. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length || !editingId) return;
    setUploadingImages(true);
    setFormError('');
    try {
      const updated = await adminService.uploadPlaceImages(editingId, files);
      setEditingImages(Array.isArray(updated?.images) ? updated.images : editingImages);
      bumpMediaCacheVersion();
      showToast('Imagen(es) subida(s) correctamente.');
      loadPlaces();
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : 'Error al subir la imagen. Verifica tu conexión.'
      );
    } finally {
      setUploadingImages(false);
    }
  };

  const handleRemoveImage = async (imageUrl) => {
    if (!editingId) return;
    const prev = editingImages;
    setEditingImages((imgs) => imgs.filter((i) => i !== imageUrl));
    try {
      await adminService.removePlaceImage(editingId, imageUrl);
      loadPlaces();
    } catch (err) {
      setEditingImages(prev); 
      setFormError(err instanceof ApiError ? err.message : 'No pudimos quitar esa imagen.');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminService.deletePlace(deleteTarget._id || deleteTarget.id);
      showToast(`"${deleteTarget.name}" se eliminó del catálogo.`);
      setDeleteTarget(null);
      loadPlaces();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Error al eliminar el lugar.');
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminLayout activePage="admin-inventario" onNavigate={onNavigate}>
      
      {/* Hero Header */}
      <div className="flex flex-col lg:flex-row gap-6 mb-8">
        <div className="flex-1 bg-surface-container-low border border-solid border-outline-variant/30 rounded-3xl p-8 flex flex-col justify-center relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="relative z-10">
            <h1 className="text-3xl font-black text-on-surface mb-3 flex items-center gap-3">
              <span className="material-symbols-outlined text-4xl text-yellow-500">travel_explore</span>
              Catálogo de Lugares
            </h1>
            <p className="text-sm text-on-surface-variant leading-relaxed max-w-2xl font-medium">
              Administra y organiza los atractivos turísticos, restaurantes y puntos de interés. Añade nuevos descubrimientos o actualiza la información existente para los viajeros.
            </p>
          </div>
        </div>
        
        <div className="w-full lg:w-72 flex flex-col gap-4">
          <div className="bg-surface border border-solid border-outline-variant/40 rounded-3xl p-6 flex-1 flex flex-col justify-center shadow-sm">
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">database</span>
              Total Registrados
            </p>
            <div className="text-5xl font-black text-on-surface">
              {total} <span className="text-base font-semibold text-on-surface-variant">lugares</span>
            </div>
          </div>
          <button
            onClick={openCreateModal}
            className="h-14 bg-yellow-500 text-black font-bold rounded-2xl px-6 flex items-center justify-between hover:bg-yellow-400 active:scale-[0.98] transition-all border-none cursor-pointer shadow-md shadow-yellow-500/20"
          >
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined">add_circle</span>
              Crear Nuevo Lugar
            </span>
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>
      </div>

      {/* Toolbar: Filtros y Búsqueda */}
      <div className="bg-surface-container-lowest border border-solid border-outline-variant/40 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-center gap-4 shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1 relative">
          <span className="material-symbols-outlined absolute left-4 text-on-surface-variant pointer-events-none">search</span>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar lugares por nombre o palabra clave..."
            className="w-full bg-surface border border-solid border-outline-variant/60 rounded-xl pl-12 pr-4 py-3 text-sm font-medium text-on-surface outline-none focus:border-yellow-500 transition-colors"
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto relative shrink-0">
          <span className="material-symbols-outlined absolute left-4 text-on-surface-variant pointer-events-none z-10">filter_alt</span>
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="w-full sm:w-56 bg-surface border border-solid border-outline-variant/60 rounded-xl pl-12 pr-10 py-3 text-sm font-bold text-on-surface outline-none focus:border-yellow-500 transition-colors appearance-none cursor-pointer"
          >
            <option value="todo">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <span className="material-symbols-outlined absolute right-4 text-on-surface-variant pointer-events-none">expand_more</span>
        </div>
      </div>

      {/* Tabla de Resultados */}
      <div className="bg-surface border border-solid border-outline-variant/40 rounded-2xl overflow-hidden shadow-sm">
        {status === 'error' && (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl">cloud_off</span>
            </div>
            <p className="text-base font-bold text-error mb-1">{loadError}</p>
            <p className="text-sm text-on-surface-variant max-w-sm">
              Verifica tu conexión a internet o asegúrate de que el backend esté respondiendo correctamente.
            </p>
          </div>
        )}

        {status !== 'error' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-solid border-outline-variant/40">
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Lugar</th>
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Categoría</th>
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-center">Estado</th>
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Rango Precio</th>
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Rating</th>
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                
                {status === 'loading' &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-5"><div className="h-12 bg-surface-container-high rounded-xl w-3/4" /></td>
                      <td className="px-6 py-5"><div className="h-6 bg-surface-container-high rounded-full w-24" /></td>
                      <td className="px-6 py-5"><div className="h-6 bg-surface-container-high rounded-full w-20 mx-auto" /></td>
                      <td className="px-6 py-5"><div className="h-4 bg-surface-container-high rounded w-16" /></td>
                      <td className="px-6 py-5"><div className="h-4 bg-surface-container-high rounded w-12" /></td>
                      <td className="px-6 py-5"><div className="h-8 bg-surface-container-high rounded-lg w-20 ml-auto" /></td>
                    </tr>
                  ))}

                {status === 'ready' && places.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center mx-auto mb-3 text-on-surface-variant">
                        <span className="material-symbols-outlined text-3xl">search_off</span>
                      </div>
                      <p className="text-sm font-bold text-on-surface mb-1">No hay resultados</p>
                      <p className="text-xs text-on-surface-variant">Intenta ajustar los filtros o los términos de búsqueda.</p>
                    </td>
                  </tr>
                )}

                {status === 'ready' &&
                  places.map((p, index) => {
                    const id = p._id || p.id;
                    const thumb = Array.isArray(p.images) && p.images[0] ? resolveMediaUrl(p.images[0]) : null;
                    return (
                      <tr
                        key={id}
                        className="hover:bg-surface-container-lowest/80 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            {thumb ? (
                              <img src={thumb} alt={p.name} className="w-12 h-12 rounded-xl object-cover shadow-sm shrink-0" />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center shrink-0 text-on-surface-variant border border-solid border-outline-variant/30">
                                <span className="material-symbols-outlined text-[20px]">landscape</span>
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-bold text-on-surface leading-tight mb-0.5 group-hover:text-yellow-500 transition-colors">{p.name}</p>
                              <p className="text-xs font-medium text-on-surface-variant flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px]">location_on</span>
                                <span className="truncate max-w-[180px]">{p.municipality || p.address || 'Ubicación no definida'}</span>
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 bg-surface-container border border-solid border-outline-variant/40 px-3 py-1.5 rounded-lg text-xs font-bold text-on-surface">
                            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                            {humanizeCategoryLabel(p.category)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                            p.isActive !== false ? 'bg-green-500/10 text-green-500 border border-solid border-green-500/20' : 'bg-on-surface-variant/10 text-on-surface-variant border border-solid border-on-surface-variant/20'
                          }`}>
                            {p.isActive !== false ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-on-surface bg-surface-container px-2.5 py-1 rounded-md">
                            {PRICE_LABELS[p.priceLevel] || 'Económico'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-yellow-500 text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                            <span className="text-sm font-bold text-on-surface">{p.ratingAvg ? p.ratingAvg.toFixed(1) : '—'}</span>
                            <span className="text-xs font-medium text-on-surface-variant">({p.ratingCount || 0})</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(p)}
                              title="Editar"
                              className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant bg-surface-container hover:bg-yellow-500 hover:text-black transition-colors cursor-pointer border-none"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button
                              onClick={() => setDeleteTarget(p)}
                              title="Eliminar"
                              className="w-9 h-9 rounded-lg flex items-center justify-center text-error/80 bg-error/10 hover:bg-error hover:text-white transition-colors cursor-pointer border-none"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {status === 'ready' && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-6 py-4 border-0 border-t border-solid border-outline-variant/40 bg-surface-container-lowest/50">
            <p className="text-xs text-on-surface-variant font-medium">
              Mostrando <span className="font-bold text-on-surface">{(page - 1) * PAGE_SIZE + 1}</span> – <span className="font-bold text-on-surface">{Math.min(page * PAGE_SIZE, total)}</span> de <span className="font-bold text-on-surface">{total}</span> lugares
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-solid border-outline-variant text-on-surface hover:bg-surface-container hover:border-on-surface transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <div className="px-3 py-1.5 text-xs font-bold text-on-surface bg-surface-container rounded-lg">
                {page} / {totalPages}
              </div>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-solid border-outline-variant text-on-surface hover:bg-surface-container hover:border-on-surface transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- Modal Principal (Crear / Editar) --- */}
      {modalOpen && (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-start justify-center px-4 pt-12 pb-6 overflow-y-auto no-scrollbar animate-fade-in">
          <div className="bg-surface w-full max-w-3xl rounded-3xl shadow-2xl p-6 sm:p-8 my-auto animate-scale-in border border-solid border-outline-variant/30">
            
            <div className="flex items-center justify-between mb-6 pb-4 border-0 border-b border-solid border-outline-variant/40">
              <h3 className="text-2xl font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-yellow-500">{editingId ? 'edit_square' : 'add_location_alt'}</span>
                {editingId ? 'Editar Información' : 'Registrar Nuevo Lugar'}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer border-none"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {formError && (
              <div className="bg-error/10 border border-solid border-error/30 text-error px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <p className="text-sm font-bold">{formError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">Nombre Oficial *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    placeholder="Ej. Cascada de Barandillas"
                    className="w-full px-4 py-3 bg-surface-container-lowest border border-solid border-outline-variant/60 rounded-xl text-sm font-bold text-on-surface outline-none focus:border-yellow-500 transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">Categoría Principal *</label>
                  <select
                    required
                    value={form.category}
                    onChange={(e) => handleFormChange('category', e.target.value)}
                    className="w-full px-4 py-3 bg-surface-container-lowest border border-solid border-outline-variant/60 rounded-xl text-sm font-bold text-on-surface outline-none focus:border-yellow-500 transition-colors appearance-none"
                  >
                    <option value="" disabled>Selecciona una clasificación...</option>
                    {categories.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">Descripción Atractiva</label>
                <textarea
                  rows={3}
                  maxLength={800}
                  value={form.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  placeholder="Escribe algo que motive a los turistas a visitarlo..."
                  className="w-full px-4 py-3 bg-surface-container-lowest border border-solid border-outline-variant/60 rounded-xl text-sm font-medium text-on-surface outline-none focus:border-yellow-500 transition-colors resize-none leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">Dirección Física</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">location_on</span>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => handleFormChange('address', e.target.value)}
                      placeholder="Calle, colonia, CP..."
                      className="w-full pl-10 pr-4 py-3 bg-surface-container-lowest border border-solid border-outline-variant/60 rounded-xl text-sm font-medium text-on-surface outline-none focus:border-yellow-500 transition-colors"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">Municipio / Zona</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">map</span>
                    <input
                      type="text"
                      value={form.municipality}
                      onChange={(e) => handleFormChange('municipality', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-surface-container-lowest border border-solid border-outline-variant/60 rounded-xl text-sm font-medium text-on-surface outline-none focus:border-yellow-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 bg-surface-container border border-solid border-outline-variant/30 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3" />
                <div className="col-span-1 md:col-span-2 flex items-center gap-1.5 mb-1">
                  <span className="material-symbols-outlined text-[16px] text-yellow-500">my_location</span>
                  <p className="text-xs font-bold text-on-surface">Coordenadas Exactas (Opcional)</p>
                </div>
                <div className="flex flex-col gap-1.5 z-10">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">Latitud</label>
                  <input
                    type="number"
                    step="any"
                    value={form.lat}
                    onChange={(e) => handleFormChange('lat', e.target.value)}
                    placeholder="Ej. 20.2831"
                    className="w-full px-4 py-2.5 bg-surface-container-lowest border border-solid border-outline-variant/60 rounded-xl text-sm font-medium text-on-surface outline-none focus:border-yellow-500 transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1.5 z-10">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">Longitud</label>
                  <input
                    type="number"
                    step="any"
                    value={form.lng}
                    onChange={(e) => handleFormChange('lng', e.target.value)}
                    placeholder="Ej. -97.9542"
                    className="w-full px-4 py-2.5 bg-surface-container-lowest border border-solid border-outline-variant/60 rounded-xl text-sm font-medium text-on-surface outline-none focus:border-yellow-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">Etiquetas (Separadas por coma)</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">sell</span>
                    <input
                      type="text"
                      value={form.tags}
                      onChange={(e) => handleFormChange('tags', e.target.value)}
                      placeholder="Naturaleza, Familiar, Aventura..."
                      className="w-full pl-10 pr-4 py-3 bg-surface-container-lowest border border-solid border-outline-variant/60 rounded-xl text-sm font-medium text-on-surface outline-none focus:border-yellow-500 transition-colors"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">Nivel de precio</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">payments</span>
                    <select
                      value={form.priceLevel}
                      onChange={(e) => handleFormChange('priceLevel', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-surface-container-lowest border border-solid border-outline-variant/60 rounded-xl text-sm font-bold text-on-surface outline-none focus:border-yellow-500 transition-colors appearance-none"
                    >
                      {Object.entries(PRICE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {editingId && (
                <label className="flex items-center gap-3 cursor-pointer w-fit p-3 bg-surface-container border border-solid border-outline-variant/30 rounded-xl hover:bg-surface-container-high transition-colors">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => handleFormChange('isActive', e.target.checked)}
                      className="w-5 h-5 accent-yellow-500 cursor-pointer"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface">Visibilidad Pública</p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">Si se desmarca, el lugar se ocultará de la app.</p>
                  </div>
                </label>
              )}

              {/* Área de Imágenes Re-diseñada */}
              <div className="flex flex-col gap-2 mt-4 pt-4 border-0 border-t border-solid border-outline-variant/30">
                <label className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-yellow-500">photo_library</span>
                  Galería de Imágenes
                </label>
                
                {!editingId ? (
                  <div className="bg-surface-container border border-dashed border-outline-variant rounded-2xl p-6 text-center">
                    <span className="material-symbols-outlined text-3xl text-on-surface-variant/50 mb-2">save</span>
                    <p className="text-sm font-bold text-on-surface mb-1">Guarda el lugar primero</p>
                    <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
                      Necesitamos crear el registro base antes de poder adjuntar y procesar fotografías de alta calidad.
                    </p>
                  </div>
                ) : (
                  <div className="bg-surface-container-lowest border border-solid border-outline-variant/40 rounded-2xl p-4">
                    <div className="flex flex-wrap gap-3 mb-4">
                      {editingImages.map((img) => (
                        <div key={img} className="relative w-24 h-24 rounded-xl overflow-hidden shadow-sm group border border-solid border-outline-variant/20">
                          <img src={resolveMediaUrl(img)} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(img)}
                              className="w-8 h-8 rounded-full bg-error/90 text-white flex items-center justify-center hover:bg-error cursor-pointer border-none shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all"
                              title="Eliminar foto"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                      {editingImages.length === 0 && (
                        <p className="text-xs text-on-surface-variant italic py-4 w-full text-center">Aún no hay imágenes en la galería.</p>
                      )}
                    </div>
                    
                    <label className={`w-full py-6 border-2 border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-yellow-500 hover:bg-yellow-500/5 transition-all group ${
                      uploadingImages ? 'opacity-50 pointer-events-none' : ''
                    }`}>
                      <div className="w-12 h-12 bg-surface-container rounded-full flex items-center justify-center mb-2 group-hover:bg-yellow-500 group-hover:text-black transition-colors">
                        <span className="material-symbols-outlined text-2xl">
                          {uploadingImages ? 'progress_activity' : 'cloud_upload'}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-on-surface">
                        {uploadingImages ? 'Subiendo archivos...' : 'Haz clic para subir fotos'}
                      </p>
                      <p className="text-xs text-on-surface-variant mt-1">Soporta JPG, PNG o WebP</p>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                    </label>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-6 mt-2 border-0 border-t border-solid border-outline-variant/30">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3.5 rounded-xl text-sm font-bold text-on-surface bg-surface border border-solid border-outline-variant hover:bg-surface-container transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-yellow-500 text-black py-3.5 rounded-xl text-sm font-bold hover:bg-yellow-400 active:scale-[0.98] transition-all border-none cursor-pointer disabled:opacity-50 shadow-md shadow-yellow-500/20 flex items-center justify-center gap-2"
                >
                  {saving && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
                  {saving ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Finalizar Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Modal: Confirmar Eliminación --- */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-start justify-center px-4 pt-20 pb-6 overflow-y-auto no-scrollbar animate-fade-in">
          <div className="bg-surface w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center animate-scale-in border border-solid border-outline-variant/30">
            <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
              <span className="material-symbols-outlined text-[32px]">delete_forever</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-2">¿Borrar registro?</h3>
            <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
              Estás a punto de eliminar <strong>"{deleteTarget.name}"</strong> de forma permanente. Toda la información e imágenes vinculadas se perderán.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-on-surface bg-surface border border-solid border-outline-variant hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 bg-error text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-error/90 active:scale-[0.98] transition-all border-none cursor-pointer disabled:opacity-50 shadow-md shadow-error/20"
              >
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Notificaciones Toast --- */}
      <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 bg-surface-container-highest text-on-surface px-6 py-4 rounded-full shadow-2xl flex items-center gap-3 z-[100] transition-all duration-500 ease-out border border-solid border-outline-variant/50 ${
        toast ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'
      }`}>
        <span className="material-symbols-outlined text-green-500 text-2xl">check_circle</span>
        <span className="text-sm font-bold">{toast}</span>
      </div>
    </AdminLayout>
  );
}

export default AdminInventario;