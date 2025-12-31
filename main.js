import {Datos, sistemaStorage} from './servicios.js';
import {Categorias} from "./datos/categorias.js";
import * as plantillas from "./plantillas.js";
import { sistemaVideo } from './reproductor.js';
import { motorBusqueda, sistemaBusqueda } from './busqueda.js';
import { sistemaModal } from './yopModal.js';

export const UI = {
 // Referencias estáticas (se buscan una sola vez al cargar)
 header: document.querySelector("header"),
 nav: document.getElementById("navegacion"),
 paginacionContenedor: document.getElementById("paginacion"),
 scrollPrincipal: document.querySelector("section.contenido"),
 
 // Funciones dinámicas (buscan por ID cuando se necesita)
 obtenerContenedor: (id) => document.getElementById(`contenido-${id}`),
 obtenerReal: (id) => document.getElementById(`real-${id}`),
 obtenerSkeleton: (id) => document.getElementById(`skeleton-total-${id}`),
 obtenerLoader: (id) => document.getElementById(`loader-${id}`),
 obtenerPagina: (id) => document.getElementById(id),
 carruselFlex: (id) => document.querySelector(`#carrusel-${id} .carrusel-flex`),
 obtenerFiltro: (id) => document.getElementById(`filtro-${id}`),
 obtenerContador: (id) => document.getElementById(`cantidad-${id}`)
};

export const estado = { // Estado global
 categorias: {},
 paginacion: {},
 carruseles: {},
};

const utils = { // Utilidades (Helpers para limpiar código)
 
 render: (el, html, pos = 'beforeend')=> el?.insertAdjacentHTML(pos, html),
 limpiar: (el)=> {
  if (el) el.innerHTML = "";
 },
 mostrar: (el)=> {
  if (el) el.style.display = 'flex';
 },
 ocultar: (el)=> {
  if (el) el.style.display = 'none';
 },
 scrollArriba: ()=> {
  UI.scrollPrincipal?.scrollTo({ top: 0, behavior: 'smooth' });
 }
};

// Auxiliar para no repetir código de stats
const obtenerStats = (vId) => ({
 videoId: vId,
 esVisto: sistemaStorage.obtenerInfoVisto(vId)?.visto || false,
 esFavorito: sistemaStorage.esFavorito(vId),
 likes: sistemaStorage.obtenerLikes(vId)
});

//
window.actualizarSeccion = (catId)=> {
 
 // Resetear datos de filtros
 if (estado.categorias[catId]) estado.categorias[catId].itemsFiltrados = null;
 
 // Resetear estado de categoría principal
 const pag = estado.paginacion[catId];
 pag.indice = 0;
 pag.completo = false;
 pag.cargando = false;
 
 // Resetear estado del carrusel (sin limpiar todavía)
 const car = estado.carruseles[catId];
 if (car) {
  car.indice = 0;
  car.completo = false;
  car.cargando = false;
 }
 
 // Limpiar categoría y mostrar skeletons
 utils.limpiar(UI.obtenerContenedor(catId));
 const selector = UI.obtenerFiltro(catId);
 if (selector) selector.value = "todas";
 utils.scrollArriba();
 
 // Disparar recargas
 window.cargarMasTarjetas(catId, true); // True muestra skeletons
 window.cargarMasCarrusel(catId); // Recargar carrusel
};

// Acciones de header y nav con scrol
function inicializarEfectosHeader() {
 
 const observer = new IntersectionObserver( ([e])=> {
  const esScroll = e.intersectionRatio < 0.8;
  UI.header.classList.toggle("scrol", !esScroll);
  UI.nav.classList.toggle("min", !esScroll);
 },{threshold: 0.8});
 
 if (UI.scrollPrincipal) observer.observe(UI.scrollPrincipal);
 
};

// Mezclador de tarjetas normales y cortos
const organizarContenido = (segmento, catId)=> {
 
 const cortos = segmento.filter( (item)=> item.tipo.clase === "corto");
 const normales = segmento.filter( (item)=> item.tipo.clase === "normal");
 const patron = [2, 4, 7]; // Orden de intercalado
 let normalesParaSiguienteBloque = patron[Math.floor(Math.random() * patron.length)];
 let htmlResult = '';
 
 // Si hay un filtro de fecha/año activo, podemos "inventar" un ID temporal
 const contextId = (estado.categorias[catId]?.itemsFiltrados) ? 'filtro' : catId;
 
 while (normales.length > 0 || cortos.length > 0) {
  
  // Insertar normales según el patrón 
  while (normalesParaSiguienteBloque > 0 && normales.length > 0) {
   const item = normales.shift();
   htmlResult += plantillas.tarjeta(item, catId, obtenerStats(item.tipo.id), "normal");
   normalesParaSiguienteBloque--;
  }
  
  // Insertar bloque de cortos
  if (cortos.length > 0) {
   
   htmlResult += `
    <div class="grupo-tj-corto">
    <div class="titulo-seccion-cortos bi-lightning-fill"> Lienzo de cortos</div>
   `;
   
   for (let j = 0; j < 2; j++) {
    
    if (cortos.length > 0) {
     const itemCorto = cortos.shift();
     htmlResult += plantillas.tarjeta(itemCorto, catId, obtenerStats(itemCorto.tipo.id), "corto");
    } else if (j === 1) {
     htmlResult += plantillas.tjUltimoCorto(contextId);
    }
    
   }
   
   htmlResult += `</div>`;
   normalesParaSiguienteBloque = patron[Math.floor(Math.random() * patron.length)];
   
  }
  
  // Vaciar normales restantes si no hay más cortos
  if (cortos.length === 0 && normales.length > 0) {
   const item = normales.shift();
   htmlResult += plantillas.tarjeta(item, catId, obtenerStats(item.tipo.id), "normal");
  }
  
 }
 
 return htmlResult;
};

//
window.cargarMasTarjetas = (catId, esCargaInicial = false) => {
    const pag = estado.paginacion[catId];
    const cat = estado.categorias[catId];
    const contenedor = UI.obtenerContenedor(catId);
    const loader = UI.obtenerLoader(catId);
    const real = UI.obtenerReal(catId);
    const grid = real?.querySelector(".grid-contenido");

    if (!contenedor || pag.cargando || pag.completo) return;

    pag.cargando = true;

    // Solo mostrar skeleton en la carga real de la página, no al filtrar
    if (esCargaInicial) {
        UI.obtenerSkeleton(catId).style.display = 'flex';
        UI.obtenerReal(catId).style.display = 'none';
        utils.scrollArriba();
    } else {
        if (loader) loader.style.display = 'flex';
    }

    setTimeout(() => {
        try {
            let pool = [];
            if (cat.itemsFiltrados) {
                pool = cat.itemsFiltrados;
            } else {
                pool = (catId === 'favoritos') 
                    ? Datos.filter(d => sistemaStorage.esFavorito(d.tipo.id)) 
                    : Datos.filter(d => d.categoria.pagina === catId || catId === 'yopVideos');
            }

            const segment = pool.slice(pag.indice, pag.indice + pag.porPagina);

            if (segment.length > 0) {
                const html = organizarContenido(segment, catId);
                utils.render(contenedor, html);
                pag.indice += segment.length;
            }

            if (pag.indice >= pool.length) {
                pag.completo = true;
                if (loader) loader.style.display = 'none';

                if (pool.length === 0) {
                    utils.limpiar(contenedor);
                    // IMPORTANTE: Aquí pasamos cat.filtroActivo si existe para reiniciar correctamente
                    utils.render(contenedor, plantillas.sinResultados(catId, cat.filtroActivo || 'todos'));
                } else if (!contenedor.querySelector('.tj-ultimo')) {
                    utils.render(contenedor, plantillas.tjUltimo(catId));
                }
            }

            actualizarContador(catId);
            
            // Actualizar botones de favoritos si estamos en esa sección
            if (catId === 'favoritos') window.actualizarSoloFiltrosFavoritos();

        } catch (error) {
            console.error("Error en carga: ", error);
        } finally {
            if (esCargaInicial) {
                UI.obtenerSkeleton(catId).style.display = 'none';
                UI.obtenerReal(catId).style.display = 'block';
            }
            pag.cargando = false;
        }
    }, esCargaInicial ? 800 : 300);
};

// Carga automática de tarjetas en carrusel
window.cargarMasCarrusel = (catId)=> {
 
 const car = estado.carruseles[catId];
 const contenedor = UI.carruselFlex(catId);
 
 if (!contenedor || car.cargando || car.completo) return;
 
 if (car.indice === 0) { // Mejora para reinicio
  contenedor.innerHTML = "";
  contenedor.scrollLeft = 0;
 }
 
 const poolRecomendados = Datos.filter( (item)=> 
  item.categoria.pagina.toLowerCase() === catId.toLowerCase() && item.tipo.estado === 'recomendado'
 );
 
 if (poolRecomendados.length === 0) return;
 car.cargando = true;
 
 setTimeout( ()=> { // Simular delay para coincidir con skeletons 
  
  const segment = poolRecomendados.slice(car.indice, car.indice + car.porPagina);
  
  if (segment.length > 0) {
   
   const html = segment.map( (item)=> {
    
    const stats = obtenerStats(item.tipo.id);
    return plantillas.tjCarrusel(item, stats);
    
   }).join('');
   
   utils.render(contenedor, html);
   car.indice += segment.length;
   
  }
  
  if (car.indice >= poolRecomendados.length) {
   car.completo = true;
   utils.render(contenedor, plantillas.tjUltimoCarrusel(catId));
  }
  
  car.cargando = false;
  
 }, 100); 
 
};

// Scrol en carrusel
window.verificarScrollCarrusel = (catId, el)=> {
 
 // Disparar carga
 const margenDiferencia = 50; // Antes del final
 const finalAlcanzado = el.scrollLeft + el.clientWidth >= el.scrollWidth - margenDiferencia;
 const car = estado.carruseles[catId];

 // Carga si llega al final, no está cargando ya y no ha terminado
 if (finalAlcanzado && !car.cargando && !car.completo) {
  window.cargarMasCarrusel(catId);
 }
 
};

// Función híbrida de vinculación de scroll
function vincularEventosScroll(catId) {
 
 const seccion = UI.obtenerPagina(catId);
 const cabecera = seccion?.querySelector(".paginaCabecera");
 const portada = seccion?.querySelector(".img-portada");
 const cabeceraBarra = cabecera?.querySelector(".paginaCabecera-barra");
 
 const alturaMaxBase = 222;
 const alturaMinBase = UI.header.getBoundingClientRect().height;
 const distanciaScrol = alturaMaxBase - alturaMinBase;
 
 const interpolar = (scrollActual, inicio, fin)=> {
  const progreso = Math.max(0, Math.min(1, scrollActual / distanciaScrol));
  return inicio + (fin - inicio) * progreso;
 };
 
 // Decisión: ¿quién .pagina (sección) es el dueño del scroll?
 //const scroller = (catId === 'yopVideos') ? UI.scrollPrincipal : seccion;
 const scroller = UI.obtenerPagina(catId);
 if (!seccion || !scroller) return;
 
 let escrolPosicion = 0;
 
 scroller.addEventListener('scroll', ()=> {
  
  if (!seccion.classList.contains('activo')) return;
  
  const escrolear = scroller.scrollTop;
  const opacidad = Math.max(0.5, 1 - (escrolear / alturaMaxBase));
  const factor = Math.min(escrolear / 1, 400); 
  const haciaAbajo = escrolear > escrolPosicion;
  
  if (escrolear > 175) {
   
   UI.header.classList.toggle("oculto", escrolear > escrolPosicion);
   UI.nav.classList.toggle('toptal', haciaAbajo);
   seccion.classList.toggle('scrol', haciaAbajo);
   cabecera.classList.toggle("scrol", haciaAbajo);
   
  } else {
   
   UI.header.classList.remove('oculto');
   UI.nav.classList.remove("toptal");
   seccion.classList.remove('scrol');
   
  }
  
  cabecera.style.height = `${interpolar(escrolear, alturaMaxBase, alturaMinBase)}px`;
  cabecera.style.backgroundColor = `rgba(0, 0, 0, ${factor})`;
  portada.style.opacity = opacidad;
  
  const pos = interpolar(escrolear, 0.5, 0);
  cabeceraBarra.style.cssText = `bottom: ${pos}rem; left: ${pos}rem; width: ${interpolar(escrolear, 95, 100)}%; border-radius: ${pos}rem`;
  
  escrolPosicion = escrolear;
  
 },{passive: true});
 
};

// Iniciar scroll infinito
function inicializarScrollInfinito(catId) {
 
 const loader = UI.obtenerLoader(catId);
 const rootElement = /*(catId === 'yopVideos') ? null : */UI.obtenerPagina(catId);
 
 if (!loader) return;
 
 const observer = new IntersectionObserver( (entries)=> {
  
  const entry = entries[0];
  const pag = estado.paginacion[catId];
  
  if (entry.isIntersecting && !pag.cargando && !pag.completo) {
   window.cargarMasTarjetas(catId);
  }
  
 },{root: rootElement, rootMargin: '400px'});
 
 observer.observe(loader);
};

//
function renderizarInterfazBase() {
 
 let htmlNav = '';
 let htmlPaginas = '';
 
 if (UI.nav) UI.nav.innerHTML = `<ul>${htmlNav}</ul>`;
 if (UI.paginacionContenedor) UI.paginacionContenedor.innerHTML = htmlPaginas;
 
 Categorias.forEach( (cat, idx)=> {
  
  const activo = idx === 0 ? 'activo' : '';
  
  htmlNav += plantillas.botonNavegacion(cat, activo);
  htmlPaginas += plantillas.estructuraPagina(cat, idx, estado.categorias[cat.id]);
  
 });
 
 if (UI.nav) UI.nav.innerHTML = `<ul>${htmlNav}</ul>`;
 if (UI.paginacionContenedor) UI.paginacionContenedor.innerHTML = htmlPaginas;
 
 Categorias.forEach( (cat, idx)=> { // Carga de datos
  
  const wrapper = document.getElementById(`wrapper-carrusel-${cat.id}`);
  
  if (cat.id === 'favoritos') {
   
   window.actualizarSoloFiltrosFavoritos();
   
  } else {
   
   if(idx !== 0) {
    wrapper.innerHTML = plantillas.carruselRecomendado(cat.id, cat.nombre);
   }
   
  }
  
  if (idx === 0) { // Carga en yopVideos
   
   window.cargarMasTarjetas(cat.id, true);
   //window.cargarMasCarrusel(cat.id, false);
   
  } else {
   window.cargarMasTarjetas(cat.id, true);
   window.cargarMasCarrusel(cat.id);
  }
  
  // Eventos (scrol e infinito) para todas las categorías
  setTimeout( ()=> {
   inicializarScrollInfinito(cat.id);
   vincularEventosScroll(cat.id);
  }, 300);
  
 });
 
};

// Contador general de vídeos en cada categoría 
function actualizarContador(catId) {
 
 const el = UI.obtenerContador(catId);
 
 if (!el) return;
 
 // Cálculos sobre el total base, sin importar los filtros activos
 const totalGlobal = (catId === 'favoritos')
  ? Datos.filter(d => sistemaStorage.esFavorito(d.tipo.id)).length
  : Datos.filter(d => d.categoria.pagina === catId || catId === 'yopVideos').length;
 
 if (catId === "favoritos") {
  el.textContent = ` ${totalGlobal} favorito${totalGlobal !== 1 ? 's' : ''}`;
 } else {
  el.textContent = `${totalGlobal !== 0 ? totalGlobal : 'No hay'} video${totalGlobal !== 1 ? 's' : ''}`;
 }
 
};

//
window.cambiarPagina = (btn)=> {
 
 if (btn.classList.contains("activo")) return;
 
 const catId = btn.getAttribute("data-pagina");
 const paginaNueva = UI.obtenerPagina(catId);
 const paginaVieja = document.querySelector(".pagina.activo");
 
 if (!paginaNueva) return;
 
 document.querySelectorAll(".NAV").forEach( (el)=> el.classList.remove("activo"));
 btn.classList.add("activo");
 
 // Si hay una página activa, marcar como "saliendo"
 if (paginaVieja) {
  paginaVieja.classList.remove("activo");
  paginaVieja.classList.add("saliendo");
  setTimeout( ()=> paginaVieja.classList.remove("saliendo"), 400);
 }
 
 paginaNueva.classList.add("activo");
 
 const contenedor = UI.obtenerContenedor(catId);
 
 if (contenedor && contenedor.children.length === 0) {
  window.cargarMasCarrusel(catId); 
  window.cargarMasTarjetas(catId, true); 
 }
 
 UI.header.classList.remove('oculto');
 
};

// Filtrar tarjetas por fecha
window.aplicarFiltro = (catId, criterio) => {
 const pag = estado.paginacion[catId];
 const cat = estado.categorias[catId];
 if (!cat || !pag) return;
 
 pag.indice = 0;
 pag.completo = false;
 pag.cargando = false;
 
 let fuenteBase = (catId === 'favoritos') ?
  Datos.filter(d => sistemaStorage.esFavorito(d.tipo.id)) :
  (catId === 'yopVideos' ? Datos : Datos.filter(d => d.categoria.pagina === catId));
 
 if (criterio === 'todas') {
  cat.itemsFiltrados = null;
 } else {
  const ahora = new Date();
  cat.itemsFiltrados = fuenteBase.filter(item => {
   const fechaVideo = new Date(item.media.fecha);
   if (isNaN(fechaVideo)) return false; // Por si no hay fecha
   
   if (criterio === 'mes') {
    const unMesAtras = new Date();
    unMesAtras.setMonth(ahora.getMonth() - 1);
    return fechaVideo >= unMesAtras;
   }
   if (criterio === '3meses') {
    const tresMesesAtras = new Date();
    tresMesesAtras.setMonth(ahora.getMonth() - 3);
    return fechaVideo >= tresMesesAtras;
   }
   if (criterio === '2025' || criterio === '2024' || criterio === '2023') {
    return item.media.fecha.startsWith(criterio);
   }
   return true;
  });
  
  // Ordenar por fecha si es "recientes" o "antiguas"
  if (criterio === 'recientes') {
   cat.itemsFiltrados = [...fuenteBase].sort((a, b) => new Date(b.media.fecha) - new Date(a.media.fecha));
  }
  if (criterio === 'antiguas') {
   cat.itemsFiltrados = [...fuenteBase].sort((a, b) => new Date(a.media.fecha) - new Date(b.media.fecha));
  }
 }
 
 utils.limpiar(UI.obtenerContenedor(catId));
 window.cargarMasTarjetas(catId, false); // false para no mostrar skeletons molestos
};

//
window.filtrarFavoritosPorCat = (filtroId) => {
    const catId = 'favoritos';
    const cat = estado.categorias[catId];
    const pag = estado.paginacion[catId];

    // Guardamos qué filtro estamos usando para el botón de reiniciar
    cat.filtroActivo = filtroId;

    pag.indice = 0;
    pag.completo = false;
    pag.cargando = false;
    utils.limpiar(UI.obtenerContenedor(catId));

    const todosFavs = Datos.filter(d => sistemaStorage.esFavorito(d.tipo.id));

    if (filtroId === 'todos') {
        cat.itemsFiltrados = null;
    } else if (filtroId === 'cortos') {
        cat.itemsFiltrados = todosFavs.filter(item => item.tipo.clase === "corto");
    } else if (filtroId === 'pendientes') {
        cat.itemsFiltrados = todosFavs.filter(item => {
            const info = sistemaStorage.obtenerInfoVisto(item.tipo.id);
            return !info || info.visto === false;
        });
    } else {
        cat.itemsFiltrados = todosFavs.filter(item => item.categoria.pagina === filtroId);
    }

    // Actualizar UI de botones activos
    document.querySelectorAll('.btn-filtro-fav').forEach(b => {
        const onClickAttr = b.getAttribute('onclick');
        b.classList.toggle('activo', onClickAttr.includes(`'${filtroId}'`));
    });

    window.cargarMasTarjetas(catId, false); 
};

//
window.actualizarSoloFiltrosFavoritos = ()=> {
 
 const wrapper = document.getElementById(`wrapper-carrusel-favoritos`);
 
 if (!wrapper) return;
 
 // Obtener datos y calcular conteos
 const todosMisFavs = Datos.filter(d => sistemaStorage.esFavorito(d.tipo.id));
 
 const conteo = {
  todos: todosMisFavs.length,
  cortos: todosMisFavs.filter(i => i.tipo.clase === 'corto').length,
  pendientes: todosMisFavs.filter(i => !sistemaStorage.obtenerInfoVisto(i.tipo.id)?.visto).length
 };
 
 const htmlBotones = `
  <button class="btn-filtro-fav activo" onclick="filtrarFavoritosPorCat('todos')">
            Todos <span>(${conteo.todos})</span>
        </button>
        <button class="btn-filtro-fav" onclick="filtrarFavoritosPorCat('cortos')">
            Cortos <span>(${conteo.cortos})</span>
        </button>
        <button class="btn-filtro-fav" onclick="filtrarFavoritosPorCat('pendientes')">
            Por ver <span>(${conteo.pendientes})</span>
        </button>
 `;
 
 const botonesCategorias = Categorias
  .filter(c => c.id !== 'favoritos' && c.id !== 'yopVideos')
  .map(c => {
   const num = todosMisFavs.filter(i => i.categoria.pagina === c.id).length;
   return `<button class="btn-filtro-fav" onclick="filtrarFavoritosPorCat('${c.id}')">${c.nombre} <span>(${num})</span></button>`;
  }).join('');
  
  wrapper.innerHTML = plantillas.opcionesFavoritos(htmlBotones + botonesCategorias);
};

//
window.actualizarSeccion = (catId)=> {
 
 if (estado.categorias[catId]) { // Limpiar filtros en los datos
  estado.categorias[catId].itemsFiltrados = null; 
 }
 
 // Resetear estado de la paginación yopVideos
 const pag = estado.paginacion[catId];
 pag.indice = 0;
 pag.completo = false;
 pag.cargando = false;
 
 // Resetear carrusel
 const car = estado.carruseles[catId];
 
 if (car) {
  car.indice = 0;
  car.completo = false;
  utils.limpiar(UI.carruselFlex(catId)); // Borrar tarjetas viejas
 }
 
 // Resetear UI de yopVideos
 utils.limpiar(UI.obtenerContenedor(catId));
 
 const filter = UI.obtenerFiltro(catId);
 if (filter) filter.value = "todas";
 
 utils.scrollArriba();
 window.cargarMasTarjetas(catId, true); // Recarga inicial con skeletons
 if (car) window.cargarMasCarrusel(catId);
 
};

// Reiniciar carrusel (botón al final del carrusel)
window.reiniciarCarrusel = (catId)=> {
 
 const car = estado.carruseles[catId];
 const caja = UI.obtenerCarruselCaja(catId);
 
 if (!car || !caja) return;
 
 car.indice = 0;
 car.completo = false;
 car.cargando = false; // Resetea bandera de carga por seguridad
 utils.limpiar(caja);
 
 window.cargarMasCarrusel(catId);
 caja.scrollLeft = 0;
 
};

//
// Función Maestra de Sincronización
window.sincronizacionMaestraUI = (vId) => {
    // 1. Obtener datos frescos del storage
    const stats = {
        esVisto: sistemaStorage.obtenerInfoVisto(vId)?.visto || false,
        esFavorito: sistemaStorage.esFavorito(vId),
        likes: sistemaStorage.obtenerLikes(vId),
        progreso: sistemaStorage.obtenerProgreso(vId)
    };

    // 2. Buscar TODAS las tarjetas de este video en cualquier sección
    const tarjetas = document.querySelectorAll(`.tj[data-id="${vId}"], .tj-carrusel[data-id="${vId}"]`);
    
    tarjetas.forEach(tj => {
        // Actualizar clase de visto
        tj.classList.toggle('visto', stats.esVisto);
        
        // Actualizar clase de favorito
        tj.classList.toggle('es-favorito', stats.esFavorito);
        
        // Actualizar icono de ojo
        const iconoVisto = tj.querySelector('.icono-visto');
        if (iconoVisto) {
            iconoVisto.className = `fas ${stats.esVisto ? 'fa-eye visto-por-mi' : 'fa-eye-slash'} icono-visto`;
        }

        // Actualizar barra de progreso
        const barra = tj.querySelector('.barra-roja');
        if (barra) barra.style.width = `${stats.progreso}%`;

        // Actualizar badge de favorito (el de la estrella)
        let badgeFav = tj.querySelector('.badge-favorito');
        if (stats.esFavorito && !badgeFav) {
         
         // Aun no hay
          //tj.querySelector('.miniatura-wrapper').insertAdjacentHTML('afterend', '<span class="badge-favorito">⭐</span>');
            
        } else if (!stats.esFavorito && badgeFav) {
            badgeFav.remove();
        }
    });

    // 3. Si estamos en la página de FAVORITOS, y quitamos un favorito, 
    // lo ideal es ocultar la tarjeta suavemente.
    if (!stats.esFavorito && UI.obtenerPagina('favoritos').classList.contains('activo')) {
        const tjFav = document.querySelector(`#contenido-favoritos .tj[data-id="${vId}"]`);
        if (tjFav) {
            tjFav.style.opacity = '0';
            setTimeout(() => {
                tjFav.remove();
                window.actualizarSoloFiltrosFavoritos();
                actualizarContador('favoritos');
            }, 300);
        }
    }

    // 4. Actualizar el MODAL si está abierto
    const modal = document.getElementById('modal-video');
    
    if (modal && modal.style.display !== 'none' && modal.getAttribute('data-video-id') === vId) {
        
        const btnFav = document.getElementById('btn-favorito');
        
        if (btnFav) {
            btnFav.classList.toggle('activo', stats.esFavorito);
            btnFav.innerHTML = stats.esFavorito ? '⭐ Favorito' : '☆ Agregar a Favoritos';
        }
    }
    
    // 5. Actualizar los numeritos de los botones de la cabecera de favoritos
    window.actualizarSoloFiltrosFavoritos();
};

//
const originalHandleFavorito = window.handleFavorito;

window.handleFavorito = () => {
    const modal = document.getElementById('modal-video');
    const vId = modal.getAttribute('data-video-id');
    if (!vId) return;
    
    const esFav = sistemaStorage.toggleFavorito(vId);
    
    // 1. Actualizar el botón del modal
    const btn = document.getElementById('btn-favorito');
    if (btn) {
        btn.innerHTML = esFav ? '⭐ Favorito' : '☆ Agregar a Favoritos';
        btn.classList.toggle('activo', esFav);
    }
    
    // 2. Si estamos en la sección de favoritos, actualizamos con cuidado
    if (UI.obtenerPagina('favoritos').classList.contains('activo')) {
        window.actualizarSoloFiltrosFavoritos(); // Actualiza solo los números de los botones
        window.actualizarSeccion('favoritos');  // Recarga las tarjetas
    }
    
    window.refrescarUICompletamente();
    window.sincronizacionMaestraUI(vId);
};

// Desde modal
window.refrescarUICompletamente = () => {
    const catActiva = document.querySelector('.pagina.activo')?.id;
    if (!catActiva) return;

    // Actualizar números de la botonera de favoritos
    window.actualizarSoloFiltrosFavoritos();
    
    // Actualizar el contador de la cabecera (0 videos...)
    actualizarContador(catActiva);

    // Si estás en la sección favoritos y quitaste uno, hay que recargar la lista
    if (catActiva === 'favoritos') {
        const pag = estado.paginacion['favoritos'];
        pag.indice = 0;
        pag.completo = false;
        utils.limpiar(UI.obtenerContenedor('favoritos'));
        window.cargarMasTarjetas('favoritos', false);
    }
};

//
function Iniciar() {
 
 // Preparar datos en el estado
 Categorias.forEach( (cat)=> {
  estado.categorias[cat.id] = { ...cat, items: [], itemsFiltrados: null };
  estado.paginacion[cat.id] = { indice: 0, porPagina: 12, cargando: false, completo: false };
  estado.carruseles[cat.id] = { indice: 0, porPagina: 12, cargando: false, completo: false };
 });
 
 // Renderizado y activado
 renderizarInterfazBase();
 inicializarEfectosHeader();
 
};

document.addEventListener('DOMContentLoaded', Iniciar);

