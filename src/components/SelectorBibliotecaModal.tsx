import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colores, fuentes, noir } from '../constants/colores';
import { useLayout } from '../hooks/useLayout';
import { vibrarBoton } from '../utils/haptics';
import { confirmarAccion } from '../utils/errores';
import EjercicioGif from './entrenamiento/EjercicioGif';
import SpotlightSegmentedTabs, {
  SpotlightTabItem,
} from './SpotlightSegmentedTabs';
import {
  EjercicioBiblioteca,
  GRUPOS_MUSCULARES,
  MAPA_GRUPOS,
  ORDENES_BIBLIOTECA,
  cargarBibliotecaEjercicios,
  colorDeGrupo,
  filtrarEjerciciosBiblioteca,
  normalizarTextoBiblioteca,
} from '../services/bibliotecaEjercicios';
import {
  ListaFavoritosBiblioteca,
  agregarListaFavoritos,
  alternarEjercicioEnLista,
  alternarFavorito,
  cargarEstadoFavoritosBiblioteca,
  crearListaFavoritos,
  eliminarListaFavoritos,
  guardarEstadoFavoritosBiblioteca,
  registrarEjercicioReciente,
} from '../services/favoritosBiblioteca';
import SmartTextKeyboard, {
  SugerenciaTeclado,
} from './biblioteca/SmartTextKeyboard';
import FiltrosBibliotecaSheet, {
  FILTROS_BIBLIOTECA_INICIALES,
  FiltrosBibliotecaState,
} from './biblioteca/FiltrosBibliotecaSheet';
import CrearListaSheet from './biblioteca/CrearListaSheet';
import TarjetaEjercicioBiblioteca from './biblioteca/TarjetaEjercicioBiblioteca';
import TarjetaListaFavoritos from './biblioteca/TarjetaListaFavoritos';

export interface EjercicioSeleccionadoBiblioteca {
  nombre: string;
  grupoMuscular?: string;
  equipo?: string;
  gifUrl?: string;
  instrucciones?: string[];
  esUnilateral?: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSeleccionar: (ejercicio: EjercicioSeleccionadoBiblioteca) => void;
  grupoMuscularInicial?: string;
  titulo?: string;
  subtitulo?: string;
}

type VistaBiblioteca = 'explorar' | 'favoritos' | 'listas';

const TABS: SpotlightTabItem<VistaBiblioteca>[] = [
  {
    id: 'explorar',
    label: 'Explorar',
    iconFocused: 'compass',
    iconOutline: 'compass-outline',
  },
  {
    id: 'favoritos',
    label: 'Favoritos',
    iconFocused: 'heart',
    iconOutline: 'heart-outline',
  },
  {
    id: 'listas',
    label: 'Listas',
    iconFocused: 'bookmarks',
    iconOutline: 'bookmarks-outline',
  },
];

const ORDEN_POR_ID = new Map(ORDENES_BIBLIOTECA.map((orden) => [orden.id, orden]));

function grupoInfo(grupoId: string) {
  return (
    GRUPOS_MUSCULARES.find((grupo) => grupo.id === grupoId) || {
      id: grupoId,
      nombre: 'Sin grupo',
      icono: 'layers-outline',
      subtitulo: '',
    }
  );
}

export default function SelectorBibliotecaModal(props: Props) {
  if (!props.visible) return null;
  return <SelectorBibliotecaContenido {...props} />;
}

function SelectorBibliotecaContenido({
  visible,
  onClose,
  onSeleccionar,
  grupoMuscularInicial = 'todos',
  titulo = 'Biblioteca de Ejercicios',
  subtitulo = 'Selecciona un movimiento con técnica y animación GIF',
}: Props) {
  const { isTablet, contentMaxWidth, bottomInset } = useLayout();

  const [catalogo, setCatalogo] = useState<EjercicioBiblioteca[]>([]);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<VistaBiblioteca>('explorar');
  const [busqueda, setBusqueda] = useState('');
  const [filtros, setFiltros] = useState<FiltrosBibliotecaState>({
    ...FILTROS_BIBLIOTECA_INICIALES,
    grupos:
      grupoMuscularInicial && grupoMuscularInicial !== 'todos'
        ? [grupoMuscularInicial]
        : [],
  });
  const [tecladoVisible, setTecladoVisible] = useState(false);
  const [filtrosVisible, setFiltrosVisible] = useState(false);
  const [ejercicioTutorial, setEjercicioTutorial] =
    useState<EjercicioBiblioteca | null>(null);

  // Favoritos, colecciones y memoria de uso
  const [favoritos, setFavoritos] = useState<string[]>([]);
  const [listas, setListas] = useState<ListaFavoritosBiblioteca[]>([]);
  const [recientes, setRecientes] = useState<string[]>([]);
  const [favoritosCargados, setFavoritosCargados] = useState(false);

  // Colecciones
  const [listaAbiertaId, setListaAbiertaId] = useState<string | null>(null);
  const [modoAgregarLista, setModoAgregarLista] = useState(false);
  const [crearListaVisible, setCrearListaVisible] = useState(false);
  const [ejercicioParaLista, setEjercicioParaLista] =
    useState<EjercicioBiblioteca | null>(null);
  const [listaPendienteEjercicioId, setListaPendienteEjercicioId] =
    useState<string | null>(null);
  const [nombreEjercicioPendiente, setNombreEjercicioPendiente] =
    useState<string | null>(null);

  // Cargar catálogo al abrir el modal
  useEffect(() => {
    if (!visible) return;
    let cancelado = false;

    const iniciar = async () => {
      setCargando(true);
      try {
        const items = await cargarBibliotecaEjercicios();
        if (!cancelado) setCatalogo(items);
      } finally {
        if (!cancelado) setCargando(false);
      }
    };

    iniciar();
    return () => {
      cancelado = true;
    };
  }, [visible]);

  // Cargar favoritos al abrir
  useEffect(() => {
    if (!visible) return;
    let activo = true;

    cargarEstadoFavoritosBiblioteca()
      .then((estado) => {
        if (!activo) return;
        setFavoritos(estado.favoritos);
        setListas(estado.listas);
        setRecientes(estado.recientes);
        setFavoritosCargados(true);
      })
      .catch(() => {
        if (activo) setFavoritosCargados(true);
      });

    return () => {
      activo = false;
    };
  }, [visible]);

  // Persistir cualquier cambio de favoritos/listas/recencias
  useEffect(() => {
    if (!favoritosCargados) return;
    guardarEstadoFavoritosBiblioteca({ favoritos, listas, recientes });
  }, [favoritos, listas, recientes, favoritosCargados]);

  const mapaCatalogo = useMemo(
    () => new Map(catalogo.map((item) => [item.id, item])),
    [catalogo]
  );

  const favoritosSet = useMemo(() => new Set(favoritos), [favoritos]);

  const catalogoFavoritos = useMemo(
    () =>
      favoritos
        .map((id) => mapaCatalogo.get(id))
        .filter((item): item is EjercicioBiblioteca => Boolean(item)),
    [favoritos, mapaCatalogo]
  );

  const listaAbierta = useMemo(
    () => listas.find((lista) => lista.id === listaAbiertaId) || null,
    [listas, listaAbiertaId]
  );

  const ejerciciosDeLista = useMemo(() => {
    if (!listaAbierta) return [] as EjercicioBiblioteca[];
    return listaAbierta.ejercicioIds
      .map((id) => mapaCatalogo.get(id))
      .filter((item): item is EjercicioBiblioteca => Boolean(item));
  }, [listaAbierta, mapaCatalogo]);

  const baseEjercicios = useMemo(() => {
    if (vista === 'favoritos') return catalogoFavoritos;
    if (vista === 'listas' && listaAbierta) {
      return modoAgregarLista ? catalogo : ejerciciosDeLista;
    }
    return catalogo;
  }, [vista, catalogo, catalogoFavoritos, listaAbierta, modoAgregarLista, ejerciciosDeLista]);

  const ejerciciosFiltrados = useMemo(() => {
    if (vista === 'listas' && !listaAbierta) return [] as EjercicioBiblioteca[];

    return filtrarEjerciciosBiblioteca({
      catalogo: baseEjercicios,
      busqueda,
      gruposMusculares: filtros.grupos,
      equipamientos: filtros.equipos,
      soloFavoritos: vista === 'explorar' && filtros.soloFavoritos,
      favoritos,
      recientes,
      orden: filtros.orden,
    });
  }, [
    vista,
    listaAbierta,
    baseEjercicios,
    busqueda,
    filtros.grupos,
    filtros.equipos,
    filtros.soloFavoritos,
    filtros.orden,
    favoritos,
    recientes,
  ]);

  const conteosGrupos = useMemo(() => {
    const conteos: Record<string, number> = {};
    for (const item of baseEjercicios) {
      conteos[item.muscle] = (conteos[item.muscle] || 0) + 1;
    }
    return conteos;
  }, [baseEjercicios]);

  const conteosEquipos = useMemo(() => {
    const conteos: Record<string, number> = {};
    for (const item of baseEjercicios) {
      if (item.equipment === 'lever' || item.equipment === 'machine') {
        conteos.lever = (conteos.lever || 0) + 1;
      } else {
        conteos[item.equipment] = (conteos[item.equipment] || 0) + 1;
      }
    }
    return conteos;
  }, [baseEjercicios]);

  const listasFiltradas = useMemo(() => {
    const q = normalizarTextoBiblioteca(busqueda);
    if (!q) return listas;

    return listas.filter((lista) => {
      const grupo = grupoInfo(lista.grupoMuscular);
      const nombresEjercicios = lista.ejercicioIds
        .map((id) => mapaCatalogo.get(id)?.name || '')
        .join(' ');

      return normalizarTextoBiblioteca(
        `${lista.nombre} ${grupo.nombre} ${nombresEjercicios}`
      ).includes(q);
    });
  }, [listas, busqueda, mapaCatalogo]);

  const gruposListas = useMemo(() => {
    const porGrupo = new Map<string, ListaFavoritosBiblioteca[]>();
    for (const lista of listasFiltradas) {
      const key = lista.grupoMuscular || 'todos';
      const grupo = porGrupo.get(key) || [];
      grupo.push(lista);
      porGrupo.set(key, grupo);
    }

    const ordenGrupos = GRUPOS_MUSCULARES.filter(
      (grupo) => grupo.id !== 'todos'
    ).map((grupo) => grupo.id);

    return [
      ...ordenGrupos
        .filter((id) => porGrupo.has(id))
        .map((id) => ({
          ...grupoInfo(id),
          listas: porGrupo.get(id) || [],
        })),
      ...(porGrupo.has('todos')
        ? [{ ...grupoInfo('todos'), listas: porGrupo.get('todos') || [] }]
        : []),
    ];
  }, [listasFiltradas]);

  const ordenActual = ORDEN_POR_ID.get(filtros.orden) || ORDENES_BIBLIOTECA[0];

  const filtrosActivos =
    filtros.grupos.length +
    filtros.equipos.length +
    (filtros.soloFavoritos ? 1 : 0) +
    (filtros.orden !== 'inteligente' ? 1 : 0);

  const placeholderBusqueda =
    vista === 'listas' && !listaAbierta
      ? 'Buscar en tus listas…'
      : vista === 'favoritos'
        ? 'Buscar en tus favoritos…'
        : vista === 'listas' && listaAbierta && modoAgregarLista
          ? 'Buscar ejercicio para añadir…'
          : vista === 'listas' && listaAbierta
            ? 'Buscar en esta lista…'
            : 'Buscar ejercicio, músculo o equipo…';

  const tituloTeclado =
    vista === 'listas' && !listaAbierta
      ? 'BUSCAR EN MIS LISTAS'
      : vista === 'favoritos'
        ? 'BUSCAR EN FAVORITOS'
        : vista === 'listas' && listaAbierta
          ? 'BUSCAR EN ESTA LISTA'
          : 'BUSCAR EN EL CATÁLOGO';

  const sugerenciasTeclado = useMemo<SugerenciaTeclado[]>(() => {
    if (vista === 'listas' && !listaAbierta) {
      return listasFiltradas.slice(0, 4).map((lista) => ({
        etiqueta: lista.nombre,
        valor: lista.nombre,
      }));
    }

    if (busqueda.trim().length >= 2) {
      const nombres = Array.from(
        new Set(ejerciciosFiltrados.slice(0, 8).map((item) => item.name))
      ).slice(0, 4);
      return nombres.map((nombre) => ({ etiqueta: nombre, valor: nombre }));
    }

    const idsBase = new Set(baseEjercicios.map((item) => item.id));
    const recientesEnVista = recientes
      .map((id) => mapaCatalogo.get(id))
      .filter(
        (item): item is EjercicioBiblioteca =>
          Boolean(item) && idsBase.has(item!.id)
      );

    const fuente = recientesEnVista.length > 0 ? recientesEnVista : baseEjercicios;
    const nombres = Array.from(new Set(fuente.map((item) => item.name))).slice(0, 3);

    if (nombres.length > 0) {
      return nombres.map((nombre) => ({ etiqueta: nombre, valor: nombre }));
    }

    if (vista === 'explorar') {
      return ['Press banca', 'Sentadilla', 'Polea', 'Glúteo'].map((nombre) => ({
        etiqueta: nombre,
        valor: nombre,
      }));
    }

    return [];
  }, [
    vista,
    listaAbierta,
    listasFiltradas,
    busqueda,
    ejerciciosFiltrados,
    baseEjercicios,
    recientes,
    mapaCatalogo,
  ]);

  const cerrarTeclado = useCallback(() => setTecladoVisible(false), []);

  const cerrarCrearLista = useCallback(() => {
    setCrearListaVisible(false);
    setListaPendienteEjercicioId(null);
    setNombreEjercicioPendiente(null);
  }, []);

  const cerrarSelectorLista = useCallback(() => setEjercicioParaLista(null), []);

  const cerrarModal = useCallback(() => {
    setTecladoVisible(false);
    setFiltrosVisible(false);
    setCrearListaVisible(false);
    setEjercicioParaLista(null);
    onClose();
  }, [onClose]);

  const handleSeleccionar = useCallback(
    (item: EjercicioBiblioteca) => {
      vibrarBoton(15);
      if (favoritosCargados) {
        const siguientesRecientes = registrarEjercicioReciente(recientes, item.id);
        setRecientes(siguientesRecientes);
        // El modal se cierra justo después: persistimos antes de desmontar.
        guardarEstadoFavoritosBiblioteca({
          favoritos,
          listas,
          recientes: siguientesRecientes,
        });
      } else {
        setRecientes((prev) => registrarEjercicioReciente(prev, item.id));
      }
      onSeleccionar({
        nombre: item.name,
        grupoMuscular: item.muscleLabel,
        equipo: item.equipmentLabel,
        gifUrl: item.gifUrl,
        instrucciones: item.instructions,
      });
      onClose();
    },
    [
      favoritos,
      favoritosCargados,
      listas,
      onClose,
      onSeleccionar,
      recientes,
    ]
  );

  const handleCrearPersonalizado = useCallback(() => {
    const nombreLimpio = busqueda.trim();
    if (!nombreLimpio) return;
    vibrarBoton(15);
    onSeleccionar({
      nombre: nombreLimpio,
      grupoMuscular:
        filtros.grupos.length === 1 ? filtros.grupos[0] : undefined,
      equipo: filtros.equipos.length === 1 ? filtros.equipos[0] : undefined,
    });
    onClose();
  }, [busqueda, filtros.grupos, filtros.equipos, onSeleccionar, onClose]);

  const handleVerTecnica = useCallback((item: EjercicioBiblioteca) => {
    vibrarBoton(10);
    setRecientes((prev) => registrarEjercicioReciente(prev, item.id));
    setTecladoVisible(false);
    setEjercicioTutorial(item);
  }, []);

  const alternarFavoritoEjercicio = useCallback((ejercicioId: string) => {
    setFavoritos((prev) => alternarFavorito(prev, ejercicioId));
  }, []);

  const cambiarVista = useCallback((nuevaVista: VistaBiblioteca) => {
    vibrarBoton(10);
    if (vista === 'listas') {
      setFiltros((prev) => ({ ...prev, grupos: [], equipos: [] }));
    }
    setVista(nuevaVista);
    setListaAbiertaId(null);
    setModoAgregarLista(false);
    setBusqueda('');
    setTecladoVisible(false);
    setFiltrosVisible(false);
    setEjercicioParaLista(null);
  }, [vista]);

  const alternarGrupo = useCallback((grupoId: string) => {
    vibrarBoton(8);
    setFiltros((prev) => {
      if (grupoId === 'todos') return { ...prev, grupos: [] };
      return {
        ...prev,
        grupos: prev.grupos.includes(grupoId)
          ? prev.grupos.filter((id) => id !== grupoId)
          : [...prev.grupos, grupoId],
      };
    });
  }, []);

  const limpiarFiltros = useCallback(() => {
    vibrarBoton(10);
    setFiltros({ ...FILTROS_BIBLIOTECA_INICIALES });
  }, []);

  const toggleEnLista = useCallback((ejercicioId: string, listaId: string) => {
    vibrarBoton(12);
    setListas((prev) =>
      alternarEjercicioEnLista(prev, listaId, ejercicioId)
    );
  }, []);

  const abrirLista = useCallback((lista: ListaFavoritosBiblioteca) => {
    vibrarBoton(10);
    setListaAbiertaId(lista.id);
    setModoAgregarLista(false);
    setBusqueda('');
    setTecladoVisible(false);
    setFiltros((prev) => ({ ...prev, grupos: [], equipos: [] }));
  }, []);

  const volverAListas = useCallback(() => {
    vibrarBoton(9);
    setListaAbiertaId(null);
    setModoAgregarLista(false);
    setBusqueda('');
    setFiltros((prev) => ({ ...prev, grupos: [], equipos: [] }));
  }, []);

  const abrirCrearLista = useCallback(() => {
    vibrarBoton(10);
    setTecladoVisible(false);
    setListaPendienteEjercicioId(null);
    setNombreEjercicioPendiente(null);
    setCrearListaVisible(true);
  }, []);

  const abrirCrearListaDesdeSelector = useCallback(() => {
    if (!ejercicioParaLista) return;
    vibrarBoton(12);
    setListaPendienteEjercicioId(ejercicioParaLista.id);
    setNombreEjercicioPendiente(ejercicioParaLista.name);
    setEjercicioParaLista(null);
    setCrearListaVisible(true);
  }, [ejercicioParaLista]);

  const setFiltrosDeGrupo = useCallback((grupoMuscular: string) => {
    setFiltros((prev) => ({
      ...prev,
      grupos: grupoMuscular && grupoMuscular !== 'todos' ? [grupoMuscular] : [],
      equipos: [],
      soloFavoritos: false,
    }));
  }, []);

  const handleCrearLista = useCallback(
    (nombre: string, grupoMuscular: string) => {
      const nueva = crearListaFavoritos({
        nombre,
        grupoMuscular,
        ejercicioIds: listaPendienteEjercicioId
          ? [listaPendienteEjercicioId]
          : [],
      });

      setListas((prev) => agregarListaFavoritos(prev, nueva));
      setCrearListaVisible(false);
      setVista('listas');
      setListaAbiertaId(nueva.id);
      setBusqueda('');
      const abrirEnModoAgregar = !listaPendienteEjercicioId;
      if (abrirEnModoAgregar) {
        setFiltrosDeGrupo(grupoMuscular);
      } else {
        setFiltros((prev) => ({ ...prev, grupos: [], equipos: [] }));
      }
      setModoAgregarLista(abrirEnModoAgregar);
      setListaPendienteEjercicioId(null);
      setNombreEjercicioPendiente(null);
    },
    [listaPendienteEjercicioId, setFiltrosDeGrupo]
  );

  const iniciarAgregarALista = useCallback(() => {
    if (!listaAbierta) return;
    vibrarBoton(12);
    setModoAgregarLista(true);
    setBusqueda('');
    if (listaAbierta.grupoMuscular && listaAbierta.grupoMuscular !== 'todos') {
      setFiltros((prev) => ({ ...prev, grupos: [listaAbierta.grupoMuscular] }));
    }
  }, [listaAbierta]);

  const terminarAgregarALista = useCallback(() => {
    vibrarBoton(12);
    setModoAgregarLista(false);
    setBusqueda('');
    setFiltros((prev) => ({ ...prev, grupos: [], equipos: [] }));
  }, []);

  const eliminarLista = useCallback(
    (lista: ListaFavoritosBiblioteca) => {
      vibrarBoton(14);
      confirmarAccion(
        'Eliminar lista',
        `Se eliminará «${lista.nombre}» y sus ${lista.ejercicioIds.length} ejercicios guardados. Esta acción no se puede deshacer.`,
        () => {
          setListas((prev) => eliminarListaFavoritos(prev, lista.id));
          setListaAbiertaId(null);
          setModoAgregarLista(false);
          setBusqueda('');
        },
        'Eliminar'
      );
    },
    []
  );

  const verSimilares = useCallback(() => {
    if (!ejercicioTutorial) return;
    vibrarBoton(10);
    setFiltros((prev) => ({
      ...prev,
      grupos:
        ejercicioTutorial.muscle && ejercicioTutorial.muscle !== 'todos'
          ? [ejercicioTutorial.muscle]
          : [],
      equipos: ejercicioTutorial.equipment
        ? [ejercicioTutorial.equipment]
        : [],
    }));
    setBusqueda('');
    setEjercicioTutorial(null);
    setVista('explorar');
    setTecladoVisible(false);
  }, [ejercicioTutorial]);

  const guardarEnListaDesdeTutorial = useCallback(() => {
    if (!ejercicioTutorial) return;
    const item = ejercicioTutorial;
    setEjercicioTutorial(null);
    setEjercicioParaLista(item);
  }, [ejercicioTutorial]);

  const manejarAtras = useCallback(() => {
    if (crearListaVisible) {
      cerrarCrearLista();
      return;
    }
    if (ejercicioParaLista) {
      cerrarSelectorLista();
      return;
    }
    if (filtrosVisible) {
      setFiltrosVisible(false);
      return;
    }
    if (tecladoVisible) {
      cerrarTeclado();
      return;
    }
    if (listaAbiertaId) {
      volverAListas();
      return;
    }
    cerrarModal();
  }, [
    cerrarCrearLista,
    cerrarModal,
    cerrarSelectorLista,
    cerrarTeclado,
    crearListaVisible,
    ejercicioParaLista,
    filtrosVisible,
    listaAbiertaId,
    tecladoVisible,
    volverAListas,
  ]);

  if (!visible) return null;

  const grupoAbierto = listaAbierta ? grupoInfo(listaAbierta.grupoMuscular) : null;
  const colorListaAbierta = listaAbierta
    ? colorDeGrupo(listaAbierta.grupoMuscular)
    : noir.info;

  const renderVacio = () => {
    if (vista === 'favoritos' && favoritos.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyOrb}>
            <Ionicons name="heart-outline" size={30} color="#FF6B8A" />
          </View>
          <Text style={styles.emptyTitle}>Aún no tienes favoritos</Text>
          <Text style={styles.emptySubtitle}>
            Toca el corazón de cualquier ejercicio para guardarlo y crear tus
            listas por grupo muscular.
          </Text>
          <Pressable
            onPress={() => cambiarVista('explorar')}
            style={({ pressed }) => [
              styles.emptyPrimaryBtn,
              pressed && { opacity: 0.82 },
            ]}
          >
            <Ionicons name="compass-outline" size={16} color="#FFFFFF" />
            <Text style={styles.emptyPrimaryText}>Explorar catálogo</Text>
          </Pressable>
        </View>
      );
    }

    if (
      vista === 'listas' &&
      listaAbierta &&
      !modoAgregarLista &&
      listaAbierta.ejercicioIds.length === 0
    ) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyOrb}>
            <Ionicons name="bookmarks-outline" size={30} color={noir.info} />
          </View>
          <Text style={styles.emptyTitle}>Esta lista está vacía</Text>
          <Text style={styles.emptySubtitle}>
            Añade ejercicios desde el catálogo y organízalos por tu grupo
            muscular favorito.
          </Text>
          <Pressable
            onPress={iniciarAgregarALista}
            style={({ pressed }) => [
              styles.emptyPrimaryBtn,
              pressed && { opacity: 0.82 },
            ]}
          >
            <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" />
            <Text style={styles.emptyPrimaryText}>Añadir ejercicios</Text>
          </Pressable>
        </View>
      );
    }

    const esBusqueda = busqueda.trim().length > 0;
    const hayFiltros =
      filtros.grupos.length > 0 ||
      filtros.equipos.length > 0 ||
      filtros.soloFavoritos ||
      filtros.orden !== 'inteligente';

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyOrb}>
          <Ionicons
            name={esBusqueda ? 'search-outline' : 'fitness-outline'}
            size={30}
            color={noir.muted}
          />
        </View>
        <Text style={styles.emptyTitle}>
          {esBusqueda ? 'No encontramos coincidencias' : 'No hay ejercicios'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {esBusqueda
            ? `Prueba con otra palabra o quita algún filtro para ampliar los resultados de «${busqueda.trim()}».`
            : 'Prueba cambiando el grupo muscular o el equipamiento.'}
        </Text>

        {hayFiltros ? (
          <Pressable
            onPress={limpiarFiltros}
            style={({ pressed }) => [
              styles.emptySecondaryBtn,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Ionicons name="refresh" size={14} color={noir.info} />
            <Text style={styles.emptySecondaryText}>Limpiar filtros</Text>
          </Pressable>
        ) : null}

        {esBusqueda && vista === 'favoritos' ? (
          <Pressable
            onPress={() => cambiarVista('explorar')}
            style={({ pressed }) => [
              styles.emptyPrimaryBtn,
              pressed && { opacity: 0.82 },
            ]}
          >
            <Ionicons name="search" size={15} color="#FFFFFF" />
            <Text style={styles.emptyPrimaryText}>Buscar en todo el catálogo</Text>
          </Pressable>
        ) : null}

        {esBusqueda && vista === 'explorar' && busqueda.trim().length > 1 ? (
          <Pressable
            onPress={handleCrearPersonalizado}
            style={({ pressed }) => [
              styles.emptyPrimaryBtn,
              pressed && { opacity: 0.82 },
            ]}
          >
            <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" />
            <Text style={styles.emptyPrimaryText}>
              Usar «{busqueda.trim()}» como personalizado
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={manejarAtras}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={cerrarModal} />

        <View
          style={[
            styles.modalSheet,
            isTablet && { maxWidth: contentMaxWidth || 680, alignSelf: 'center' },
            { paddingBottom: Math.max(bottomInset, 16) },
          ]}
        >
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(194, 36, 61, 0.12)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.topGlow}
          />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerOrb}>
              <Ionicons name="barbell" size={17} color={colores.primarioHover} />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.badgeRow}>
                <View style={styles.badgeDot} />
                <Text style={styles.headerBadge}>CATÁLOGO INTELIGENTE</Text>
                <View style={styles.badgeDivider} />
                <Ionicons name="sparkles" size={9} color={noir.champagne} />
              </View>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {titulo}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={2}>
                {subtitulo}
                {catalogo.length > 0 ? ` · ${catalogo.length} movimientos` : ''}
              </Text>
            </View>

            <Pressable
              onPress={cerrarModal}
              style={({ pressed }) => [
                styles.closeBtn,
                pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
              ]}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Cerrar biblioteca"
            >
              <Ionicons name="close" size={21} color={noir.text} />
            </Pressable>
          </View>

          {/* Tabs principales */}
          <View style={styles.tabsWrap}>
            <SpotlightSegmentedTabs
              tabs={TABS}
              activeTab={vista}
              onChangeTab={cambiarVista}
            />
          </View>

          {/* Barra de retroceso en una lista */}
          {vista === 'listas' && listaAbierta ? (
            <View style={styles.listBackBar}>
              <Pressable
                onPress={volverAListas}
                style={({ pressed }) => [
                  styles.listBackBtn,
                  pressed && { opacity: 0.7 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Volver a mis listas"
              >
                <Ionicons name="chevron-back" size={15} color={noir.info} />
                <Text style={styles.listBackText}>Listas</Text>
              </Pressable>

              <View style={styles.listBackActions}>
                <Pressable
                  onPress={() => eliminarLista(listaAbierta)}
                  style={({ pressed }) => [
                    styles.listIconBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Eliminar lista"
                >
                  <Ionicons name="trash-outline" size={15} color="#F08A9B" />
                </Pressable>

                {modoAgregarLista ? (
                  <Pressable
                    onPress={terminarAgregarALista}
                    style={({ pressed }) => [
                      styles.listAddModeBtn,
                      styles.listAddModeBtnActiva,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Ionicons name="checkmark" size={13} color={noir.mint} />
                    <Text style={styles.listAddModeTextActiva}>Listo</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={iniciarAgregarALista}
                    style={({ pressed }) => [
                      styles.listAddModeBtn,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Ionicons name="add" size={13} color={noir.info} />
                    <Text style={styles.listAddModeText}>Añadir</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ) : null}

          {/* Buscador con teclado propio */}
          <View style={styles.searchWrap}>
            <View
              style={[
                styles.searchContainer,
                tecladoVisible && styles.searchContainerActiva,
              ]}
            >
              <Ionicons name="search" size={17} color={noir.muted} />

              <Pressable
                onPress={() => {
                  vibrarBoton(8);
                  setFiltrosVisible(false);
                  setTecladoVisible(true);
                }}
                style={styles.searchField}
                accessibilityRole="button"
                accessibilityLabel={placeholderBusqueda}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.searchText,
                    !busqueda && styles.searchPlaceholder,
                  ]}
                >
                  {busqueda || placeholderBusqueda}
                </Text>
              </Pressable>

              {busqueda.length > 0 ? (
                <Pressable
                  onPress={() => {
                    vibrarBoton(8);
                    setBusqueda('');
                  }}
                  hitSlop={8}
                  style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Limpiar búsqueda"
                >
                  <Ionicons name="close-circle" size={18} color={noir.muted} />
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => {
                    vibrarBoton(8);
                    setTecladoVisible(true);
                  }}
                  hitSlop={8}
                  style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Abrir teclado"
                >
                  <Ionicons
                    name="keypad-outline"
                    size={17}
                    color={noir.muted2}
                  />
                </Pressable>
              )}
            </View>
          </View>

          {vista === 'listas' && !listaAbierta ? (
            <View style={styles.listasWrap}>
              <View style={styles.listasHeader}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.listasKicker}>COLECCIONES</Text>
                  <Text style={styles.listasTitle}>Tus listas</Text>
                  <Text style={styles.listasSubtitle}>
                    Organiza tus favoritos por grupo muscular.
                  </Text>
                </View>

                <Pressable
                  onPress={abrirCrearLista}
                  style={({ pressed }) => [
                    styles.newListBtn,
                    pressed && { opacity: 0.82, transform: [{ scale: 0.97 }] },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Crear nueva lista"
                >
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                  <Text style={styles.newListText}>Nueva</Text>
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.listasScroll}
                contentContainerStyle={styles.listasContent}
              >
                {!favoritosCargados ? (
                  <View style={styles.listasLoading}>
                    <ActivityIndicator size="small" color={noir.info} />
                    <Text style={styles.listasLoadingText}>
                      Cargando tus colecciones…
                    </Text>
                  </View>
                ) : listasFiltradas.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <View style={styles.emptyOrb}>
                      <Ionicons
                        name={busqueda ? 'search-outline' : 'bookmarks-outline'}
                        size={30}
                        color={noir.info}
                      />
                    </View>
                    <Text style={styles.emptyTitle}>
                      {busqueda
                        ? 'Ninguna lista coincide'
                        : 'Crea tu primera lista'}
                    </Text>
                    <Text style={styles.emptySubtitle}>
                      {busqueda
                        ? `No encontramos listas para «${busqueda.trim()}».`
                        : 'Por ejemplo: «Empuje pesado» para pecho y hombro, o «Pierna A» para cuádriceps.'}
                    </Text>

                    {!busqueda ? (
                      <Pressable
                        onPress={abrirCrearLista}
                        style={({ pressed }) => [
                          styles.emptyPrimaryBtn,
                          pressed && { opacity: 0.82 },
                        ]}
                      >
                        <Ionicons
                          name="add-circle-outline"
                          size={16}
                          color="#FFFFFF"
                        />
                        <Text style={styles.emptyPrimaryText}>
                          Crear lista
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : (
                  gruposListas.map((seccion) => (
                    <View key={seccion.id} style={styles.listGroupSection}>
                      <View style={styles.listGroupHeader}>
                        <View
                          style={[
                            styles.listGroupIcon,
                            {
                              backgroundColor: `${colorDeGrupo(seccion.id)}14`,
                              borderColor: `${colorDeGrupo(seccion.id)}33`,
                            },
                          ]}
                        >
                          <Ionicons
                            name={seccion.icono as any}
                            size={12}
                            color={colorDeGrupo(seccion.id)}
                          />
                        </View>
                        <Text
                          style={[
                            styles.listGroupTitle,
                            { color: colorDeGrupo(seccion.id) },
                          ]}
                        >
                          {seccion.id === 'todos' ? 'Sin grupo' : seccion.nombre}
                        </Text>
                        <View style={styles.listGroupLine} />
                        <Text style={styles.listGroupCount}>
                          {seccion.listas.length}
                        </Text>
                      </View>

                      <View style={styles.listGroupItems}>
                        {seccion.listas.map((lista) => {
                          const previews = lista.ejercicioIds
                            .slice(0, 3)
                            .map((id) => mapaCatalogo.get(id))
                            .filter(
                              (item): item is EjercicioBiblioteca =>
                                Boolean(item)
                            );

                          return (
                            <TarjetaListaFavoritos
                              key={lista.id}
                              lista={lista}
                              grupoLabel={
                                seccion.id === 'todos'
                                  ? 'Sin grupo'
                                  : seccion.nombre
                              }
                              grupoIcono={seccion.icono}
                              previews={previews}
                              onPress={() => abrirLista(lista)}
                            />
                          );
                        })}
                      </View>
                    </View>
                  ))
                )}

                {listas.length > 0 ? (
                  <View style={styles.listasFooterNote}>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={13}
                      color={noir.muted2}
                    />
                    <Text style={styles.listasFooterText}>
                      Tus listas se guardan en el dispositivo y se actualizan al
                      instante.
                    </Text>
                  </View>
                ) : null}
              </ScrollView>
            </View>
          ) : (
            <>
              {/* Ficha de la lista abierta */}
              {vista === 'listas' && listaAbierta ? (
                <View
                  style={[
                    styles.listHero,
                    {
                      borderColor: `${colorListaAbierta}30`,
                      backgroundColor: `${colorListaAbierta}0A`,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.listHeroIcon,
                      {
                        backgroundColor: `${colorListaAbierta}14`,
                        borderColor: `${colorListaAbierta}44`,
                      },
                    ]}
                  >
                    <Ionicons
                      name={(grupoAbierto?.icono || 'bookmarks') as any}
                      size={18}
                      color={colorListaAbierta}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.listHeroName} numberOfLines={1}>
                      {listaAbierta.nombre}
                    </Text>
                    <View style={styles.listHeroMetaRow}>
                      <Text
                        style={[styles.listHeroGroup, { color: colorListaAbierta }]}
                      >
                        {listaAbierta.grupoMuscular === 'todos'
                          ? 'Sin grupo'
                          : grupoAbierto?.nombre}
                      </Text>
                      <View style={styles.listHeroDot} />
                      <Text style={styles.listHeroMeta}>
                        {listaAbierta.ejercicioIds.length}{' '}
                        {listaAbierta.ejercicioIds.length === 1
                          ? 'ejercicio'
                          : 'ejercicios'}
                      </Text>
                      {modoAgregarLista ? (
                        <>
                          <View style={styles.listHeroDot} />
                          <Text style={styles.listHeroAddHint}>
                            Modo añadir
                          </Text>
                        </>
                      ) : null}
                    </View>
                  </View>
                  {modoAgregarLista ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={17}
                      color={noir.mint}
                    />
                  ) : null}
                </View>
              ) : null}

              {/* Barra de filtros */}
              <View style={styles.toolbar}>
                <Pressable
                  onPress={() => {
                    vibrarBoton(8);
                    setTecladoVisible(false);
                    setFiltrosVisible(true);
                  }}
                  style={({ pressed }) => [
                    styles.filterBtn,
                    filtrosActivos > 0 && styles.filterBtnActiva,
                    pressed && { opacity: 0.8 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Abrir filtros"
                >
                  <Ionicons
                    name="options-outline"
                    size={14}
                    color={filtrosActivos > 0 ? noir.info : noir.muted}
                  />
                  <Text
                    style={[
                      styles.filterBtnText,
                      filtrosActivos > 0 && styles.filterBtnTextActiva,
                    ]}
                  >
                    Filtros
                  </Text>
                  {filtrosActivos > 0 ? (
                    <View style={styles.filterCount}>
                      <Text style={styles.filterCountText}>{filtrosActivos}</Text>
                    </View>
                  ) : null}
                </Pressable>

                <Pressable
                  onPress={() => {
                    vibrarBoton(8);
                    setTecladoVisible(false);
                    setFiltrosVisible(true);
                  }}
                  style={({ pressed }) => [
                    styles.sortBtn,
                    pressed && { opacity: 0.8 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Orden actual: ${ordenActual.nombre}`}
                >
                  <Ionicons
                    name={ordenActual.icono as any}
                    size={13}
                    color={
                      filtros.orden !== 'inteligente' ? noir.info : noir.muted
                    }
                  />
                  <Text
                    style={[
                      styles.sortBtnText,
                      filtros.orden !== 'inteligente' &&
                        styles.sortBtnTextActiva,
                    ]}
                    numberOfLines={1}
                  >
                    {ordenActual.nombre}
                  </Text>
                </Pressable>

                {vista === 'explorar' ? (
                  <Pressable
                    onPress={() => {
                      vibrarBoton(9);
                      setFiltros((prev) => ({
                        ...prev,
                        soloFavoritos: !prev.soloFavoritos,
                      }));
                    }}
                    style={({ pressed }) => [
                      styles.quickFavBtn,
                      filtros.soloFavoritos && styles.quickFavBtnActiva,
                      pressed && { opacity: 0.8 },
                    ]}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: filtros.soloFavoritos }}
                    accessibilityLabel="Mostrar solo favoritos"
                  >
                    <Ionicons
                      name={filtros.soloFavoritos ? 'heart' : 'heart-outline'}
                      size={14}
                      color={filtros.soloFavoritos ? '#FF6B8A' : noir.muted}
                    />
                  </Pressable>
                ) : null}

                {filtrosActivos > 0 ? (
                  <Pressable
                    onPress={limpiarFiltros}
                    style={({ pressed }) => [
                      styles.clearBtn,
                      pressed && { opacity: 0.7 },
                    ]}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="Limpiar filtros"
                  >
                    <Ionicons name="close" size={14} color={noir.muted2} />
                  </Pressable>
                ) : null}
              </View>

              {/* Grupos musculares con selección múltiple */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.gruposScroll}
                style={styles.gruposWrapper}
              >
                <Pressable
                  onPress={() => alternarGrupo('todos')}
                  style={({ pressed }) => [
                    styles.chipGrupo,
                    filtros.grupos.length === 0 && {
                      backgroundColor: `${noir.info}1F`,
                      borderColor: `${noir.info}66`,
                    },
                    pressed && { opacity: 0.8 },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={
                    filtros.grupos.length === 0 ? { selected: true } : {}
                  }
                >
                  <Ionicons
                    name="grid-outline"
                    size={12}
                    color={
                      filtros.grupos.length === 0 ? noir.info : noir.muted
                    }
                  />
                  <Text
                    style={[
                      styles.chipGrupoText,
                      filtros.grupos.length === 0 && {
                        color: noir.info,
                        fontFamily: fuentes.bold,
                      },
                    ]}
                  >
                    Todos
                  </Text>
                </Pressable>

                {GRUPOS_MUSCULARES.filter((grupo) => grupo.id !== 'todos').map(
                  (grupo) => {
                    const activo = filtros.grupos.includes(grupo.id);
                    const color = colorDeGrupo(grupo.id);
                    return (
                      <Pressable
                        key={grupo.id}
                        onPress={() => alternarGrupo(grupo.id)}
                        style={({ pressed }) => [
                          styles.chipGrupo,
                          activo && {
                            backgroundColor: `${color}1A`,
                            borderColor: `${color}5C`,
                          },
                          pressed && { opacity: 0.8 },
                        ]}
                        accessibilityRole="button"
                        accessibilityState={activo ? { selected: true } : {}}
                      >
                        <Ionicons
                          name={grupo.icono as any}
                          size={12}
                          color={activo ? color : noir.muted}
                        />
                        <Text
                          style={[
                            styles.chipGrupoText,
                            activo && {
                              color,
                              fontFamily: fuentes.bold,
                            },
                          ]}
                        >
                          {grupo.nombre}
                        </Text>
                      </Pressable>
                    );
                  }
                )}
              </ScrollView>

              {/* Contador y modo actual */}
              <View style={styles.resultsRow}>
                <Text style={styles.resultsText}>
                  {vista === 'listas' && listaAbierta
                    ? modoAgregarLista
                      ? `${ejerciciosFiltrados.length} resultados · toca para añadir`
                      : `${ejerciciosFiltrados.length} ${
                          ejerciciosFiltrados.length === 1
                            ? 'ejercicio'
                            : 'ejercicios'
                        } en esta lista`
                    : vista === 'favoritos'
                      ? `${ejerciciosFiltrados.length} ${
                          ejerciciosFiltrados.length === 1
                            ? 'favorito'
                            : 'favoritos'
                        }`
                      : `${ejerciciosFiltrados.length} ${
                          ejerciciosFiltrados.length === 1
                            ? 'ejercicio disponible'
                            : 'ejercicios disponibles'
                        }`}
                </Text>

                {filtros.grupos.length > 1 ? (
                  <View style={styles.multiGroupBadge}>
                    <Ionicons name="layers-outline" size={10} color={noir.info} />
                    <Text style={styles.multiGroupText}>
                      {filtros.grupos.length} grupos
                    </Text>
                  </View>
                ) : null}

                {vista === 'listas' && listaAbierta && !modoAgregarLista ? (
                  <Pressable
                    onPress={iniciarAgregarALista}
                    style={({ pressed }) => [
                      styles.inlineAddBtn,
                      pressed && { opacity: 0.8 },
                    ]}
                    accessibilityRole="button"
                  >
                    <Ionicons name="add" size={12} color={noir.info} />
                    <Text style={styles.inlineAddText}>Añadir</Text>
                  </Pressable>
                ) : null}
              </View>

              {cargando ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={noir.info} />
                  <Text style={styles.loadingText}>
                    Cargando catálogo anatómico…
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={ejerciciosFiltrados}
                  keyExtractor={(item) => item.id}
                  style={styles.listaLista}
                  contentContainerStyle={[
                    styles.listaEjercicios,
                    tecladoVisible && {
                      paddingBottom: 330 + Math.max(bottomInset, 8),
                    },
                  ]}
                  keyboardShouldPersistTaps="handled"
                  initialNumToRender={12}
                  maxToRenderPerBatch={16}
                  windowSize={5}
                  removeClippedSubviews={Platform.OS !== 'web'}
                  extraData={{ favoritosSet, listaAbierta }}
                  renderItem={({ item }) => {
                    const enLista = Boolean(
                      listaAbierta?.ejercicioIds.includes(item.id)
                    );
                    const modoLista = Boolean(listaAbierta);

                    return (
                      <TarjetaEjercicioBiblioteca
                        item={item}
                        esFavorito={favoritosSet.has(item.id)}
                        enLista={enLista}
                        modoLista={modoLista}
                        onPress={() => {
                          if (modoAgregarLista && listaAbierta) {
                            toggleEnLista(item.id, listaAbierta.id);
                            return;
                          }
                          handleSeleccionar(item);
                        }}
                        onToggleFavorito={() =>
                          alternarFavoritoEjercicio(item.id)
                        }
                        onInfo={() => handleVerTecnica(item)}
                        onAccionLista={() => {
                          if (listaAbierta) {
                            toggleEnLista(item.id, listaAbierta.id);
                            return;
                          }
                          setEjercicioParaLista(item);
                        }}
                      />
                    );
                  }}
                  ListEmptyComponent={renderVacio()}
                  ListFooterComponent={
                    vista === 'explorar' &&
                    busqueda.trim().length > 1 &&
                    ejerciciosFiltrados.length > 0 ? (
                      <Pressable
                        onPress={handleCrearPersonalizado}
                        style={({ pressed }) => [
                          styles.footerCrearBtn,
                          pressed && { opacity: 0.8 },
                        ]}
                      >
                        <Ionicons
                          name="add-circle-outline"
                          size={16}
                          color={noir.champagne}
                        />
                        <Text style={styles.footerCrearText}>
                          ¿No está? Usar «{busqueda.trim()}» como personalizado
                        </Text>
                      </Pressable>
                    ) : null
                  }
                />
              )}
            </>
          )}

          {/* Teclado personalizado de búsqueda */}
          {tecladoVisible ? (
            <View style={styles.keyboardOverlay}>
              <SmartTextKeyboard
                valor={busqueda}
                titulo={tituloTeclado}
                placeholder={placeholderBusqueda}
                sugerencias={sugerenciasTeclado}
                maxLength={64}
                textoListo="Listo"
                onCambiar={setBusqueda}
                onCerrar={cerrarTeclado}
                onSubmit={cerrarTeclado}
              />
            </View>
          ) : null}

          {/* Filtros avanzados */}
          <FiltrosBibliotecaSheet
            visible={filtrosVisible}
            filtros={filtros}
            conteosGrupos={conteosGrupos}
            conteosEquipos={conteosEquipos}
            onClose={() => setFiltrosVisible(false)}
            onAplicar={(nuevosFiltros) => {
              setFiltros(nuevosFiltros);
              setFiltrosVisible(false);
              setTecladoVisible(false);
            }}
          />

          {/* Crear lista */}
          <CrearListaSheet
            visible={crearListaVisible}
            grupoInicial={
              listaAbierta?.grupoMuscular ||
              (filtros.grupos.length === 1 ? filtros.grupos[0] : 'todos')
            }
            ejercicioNombre={nombreEjercicioPendiente || undefined}
            onClose={cerrarCrearLista}
            onCrear={handleCrearLista}
          />

          {/* Selector de lista para un ejercicio */}
          {ejercicioParaLista ? (
            <View style={styles.sheetOverlay}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={cerrarSelectorLista}
                accessibilityRole="button"
                accessibilityLabel="Cerrar selector de listas"
              />

              <View
                style={[
                  styles.addListSheet,
                  isTablet && {
                    maxWidth: contentMaxWidth || 620,
                    alignSelf: 'center',
                  },
                  { paddingBottom: Math.max(bottomInset, 14) },
                ]}
              >
                <View style={styles.handle} />

                <View style={styles.addListHeader}>
                  <View style={styles.addListHeaderIcon}>
                    <Ionicons
                      name="bookmark-outline"
                      size={16}
                      color={noir.info}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.addListKicker}>AÑADIR A LISTA</Text>
                    <Text style={styles.addListTitle} numberOfLines={1}>
                      {ejercicioParaLista.name}
                    </Text>
                    <Text style={styles.addListSubtitle}>
                      Toca una lista para guardarlo o quitarlo.
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setEjercicioParaLista(null)}
                    style={({ pressed }) => [
                      styles.closeBtn,
                      pressed && { opacity: 0.7 },
                    ]}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Cerrar"
                  >
                    <Ionicons name="close" size={19} color={noir.platinum} />
                  </Pressable>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  style={styles.addListScroll}
                  contentContainerStyle={styles.addListContent}
                >
                  {listas.length === 0 ? (
                    <View style={styles.addListEmpty}>
                      <Ionicons
                        name="bookmarks-outline"
                        size={26}
                        color={noir.muted}
                      />
                      <Text style={styles.addListEmptyTitle}>
                        Todavía no tienes listas
                      </Text>
                      <Text style={styles.addListEmptyText}>
                        Crea una lista por grupo muscular y guarda este ejercicio
                        directamente en ella.
                      </Text>
                    </View>
                  ) : (
                    listas.map((lista) => {
                      const info = grupoInfo(lista.grupoMuscular);
                      const color = colorDeGrupo(lista.grupoMuscular);
                      const contiene = lista.ejercicioIds.includes(
                        ejercicioParaLista.id
                      );

                      return (
                        <Pressable
                          key={lista.id}
                          onPress={() =>
                            toggleEnLista(ejercicioParaLista.id, lista.id)
                          }
                          style={({ pressed }) => [
                            styles.addListRow,
                            contiene && {
                              borderColor: `${color}55`,
                              backgroundColor: `${color}0F`,
                            },
                            pressed && { opacity: 0.82 },
                          ]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: contiene }}
                          accessibilityLabel={`${contiene ? 'Quitar de' : 'Añadir a'} ${lista.nombre}`}
                        >
                          <View
                            style={[
                              styles.addListRowIcon,
                              {
                                backgroundColor: `${color}14`,
                                borderColor: `${color}33`,
                              },
                            ]}
                          >
                            <Ionicons
                              name={info.icono as any}
                              size={14}
                              color={color}
                            />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.addListRowName} numberOfLines={1}>
                              {lista.nombre}
                            </Text>
                            <Text style={styles.addListRowMeta}>
                              {info.id === 'todos' ? 'Sin grupo' : info.nombre}
                              {' · '}
                              {lista.ejercicioIds.length}{' '}
                              {lista.ejercicioIds.length === 1
                                ? 'ejercicio'
                                : 'ejercicios'}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.addListCheck,
                              contiene && {
                                backgroundColor: `${color}22`,
                                borderColor: `${color}77`,
                              },
                            ]}
                          >
                            <Ionicons
                              name={contiene ? 'checkmark' : 'add'}
                              size={14}
                              color={contiene ? color : noir.muted2}
                            />
                          </View>
                        </Pressable>
                      );
                    })
                  )}

                  <Pressable
                    onPress={abrirCrearListaDesdeSelector}
                    style={({ pressed }) => [
                      styles.addListNewRow,
                      pressed && { opacity: 0.82 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Crear nueva lista"
                  >
                    <View style={styles.addListNewIcon}>
                      <Ionicons name="add" size={16} color={noir.champagne} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.addListNewTitle}>Nueva lista</Text>
                      <Text style={styles.addListNewText}>
                        Créala y guarda este ejercicio dentro.
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color={noir.muted2}
                    />
                  </Pressable>
                </ScrollView>

                <Pressable
                  onPress={() => setEjercicioParaLista(null)}
                  style={({ pressed }) => [
                    styles.addListDoneBtn,
                    pressed && { opacity: 0.82 },
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={styles.addListDoneText}>Hecho</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        {/* Modal de tutorial / técnica paso a paso */}
        {ejercicioTutorial ? (
          <Modal
            visible={Boolean(ejercicioTutorial)}
            transparent
            animationType="fade"
            onRequestClose={() => setEjercicioTutorial(null)}
          >
            <View style={styles.tutorialOverlay}>
              <Pressable
                style={styles.tutorialBackdrop}
                onPress={() => setEjercicioTutorial(null)}
              />

              <View style={styles.tutorialCard}>
                <LinearGradient
                  pointerEvents="none"
                  colors={[
                    `${colorDeGrupo(ejercicioTutorial.muscle)}12`,
                    'transparent',
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />

                <View style={styles.tutorialHeader}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.tutorialTag}>TÉCNICA & ANATOMÍA</Text>
                    <Text style={styles.tutorialTitle} numberOfLines={2}>
                      {ejercicioTutorial.name}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() =>
                      alternarFavoritoEjercicio(ejercicioTutorial.id)
                    }
                    style={({ pressed }) => [
                      styles.tutorialFavBtn,
                      favoritosSet.has(ejercicioTutorial.id) &&
                        styles.tutorialFavBtnActiva,
                      pressed && { opacity: 0.7 },
                    ]}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={
                      favoritosSet.has(ejercicioTutorial.id)
                        ? 'Quitar de favoritos'
                        : 'Añadir a favoritos'
                    }
                  >
                    <Ionicons
                      name={
                        favoritosSet.has(ejercicioTutorial.id)
                          ? 'heart'
                          : 'heart-outline'
                      }
                      size={17}
                      color={
                        favoritosSet.has(ejercicioTutorial.id)
                          ? '#FF6B8A'
                          : noir.muted
                      }
                    />
                  </Pressable>

                  <Pressable
                    onPress={() => setEjercicioTutorial(null)}
                    style={({ pressed }) => [
                      styles.tutorialCloseBtn,
                      pressed && { opacity: 0.7 },
                    ]}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Cerrar técnica"
                  >
                    <Ionicons name="close" size={19} color={noir.text} />
                  </Pressable>
                </View>

                <ScrollView
                  style={{ maxHeight: 470 }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 14 }}
                >
                  <View style={styles.tutorialGifContainer}>
                    <EjercicioGif
                      uri={ejercicioTutorial.gifUrl}
                      style={styles.tutorialGif}
                      contentFit="contain"
                      accessibilityLabel={ejercicioTutorial.name}
                    />
                  </View>

                  <View style={styles.tutorialMetaRow}>
                    <View style={styles.tutorialMetaBox}>
                      <Text style={styles.tutorialMetaLabel}>GRUPO OBJETIVO</Text>
                      <Text
                        style={[
                          styles.tutorialMetaVal,
                          { color: colorDeGrupo(ejercicioTutorial.muscle) },
                        ]}
                      >
                        {ejercicioTutorial.muscleLabel}
                      </Text>
                    </View>
                    <View style={styles.tutorialMetaBox}>
                      <Text style={styles.tutorialMetaLabel}>EQUIPAMIENTO</Text>
                      <Text style={styles.tutorialMetaVal}>
                        {ejercicioTutorial.equipmentLabel}
                      </Text>
                    </View>
                  </View>

                  {ejercicioTutorial.secondaryMuscles.length > 0 ? (
                    <View style={styles.secundariosBox}>
                      <Text style={styles.secundariosLabel}>TAMBIÉN TRABAJA</Text>
                      <View style={styles.secundariosRow}>
                        {ejercicioTutorial.secondaryMuscles.map((musculo) => (
                          <View key={musculo} style={styles.secundarioChip}>
                            <Text style={styles.secundarioText}>
                              {MAPA_GRUPOS[musculo] || musculo}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  {ejercicioTutorial.instructions.length > 0 ? (
                    <View style={styles.instruccionesBox}>
                      <Text style={styles.instruccionesTitulo}>
                        Ejecución correcta
                      </Text>
                      {ejercicioTutorial.instructions.map((instruccion, idx) => (
                        <View key={idx} style={styles.instruccionRow}>
                          <Text style={styles.instruccionNum}>{idx + 1}</Text>
                          <Text style={styles.instruccionText}>{instruccion}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </ScrollView>

                <View style={styles.tutorialSecondaryRow}>
                  <Pressable
                    onPress={verSimilares}
                    style={({ pressed }) => [
                      styles.tutorialSecondaryBtn,
                      pressed && { opacity: 0.8 },
                    ]}
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name="options-outline"
                      size={14}
                      color={noir.info}
                    />
                    <Text style={styles.tutorialSecondaryText}>Similares</Text>
                  </Pressable>

                  <Pressable
                    onPress={guardarEnListaDesdeTutorial}
                    style={({ pressed }) => [
                      styles.tutorialSecondaryBtn,
                      pressed && { opacity: 0.8 },
                    ]}
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name="bookmark-outline"
                      size={14}
                      color={noir.champagne}
                    />
                    <Text style={styles.tutorialSecondaryText}>
                      Guardar en lista
                    </Text>
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => {
                    const seleccionado = ejercicioTutorial;
                    setEjercicioTutorial(null);
                    handleSeleccionar(seleccionado);
                  }}
                  style={({ pressed }) => [
                    styles.tutorialSelectBtn,
                    pressed && { opacity: 0.84 },
                  ]}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.tutorialSelectBtnText}>
                    Seleccionar este ejercicio
                  </Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  modalSheet: {
    backgroundColor: '#0A0C11',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    maxHeight: '94%',
    height: '94%',
    width: '100%',
    overflow: 'hidden',
  },
  topGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 180,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
  },
  headerOrb: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(194, 36, 61, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(194, 36, 61, 0.3)',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  badgeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colores.primarioHover,
  },
  headerBadge: {
    color: colores.primarioHover,
    fontSize: 8.5,
    fontFamily: fuentes.bold,
    letterSpacing: 1,
  },
  badgeDivider: {
    width: 1,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginHorizontal: 1,
  },
  headerTitle: {
    color: noir.text,
    fontSize: 19,
    fontFamily: fuentes.black,
    letterSpacing: -0.45,
    marginTop: 1,
  },
  headerSubtitle: {
    color: noir.muted,
    fontSize: 10,
    lineHeight: 14,
    fontFamily: fuentes.regular,
    marginTop: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
  },
  tabsWrap: {
    paddingHorizontal: 16,
  },
  listBackBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  listBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 3,
    paddingRight: 8,
  },
  listBackText: {
    color: noir.info,
    fontSize: 10.5,
    fontFamily: fuentes.bold,
  },
  listBackActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(240, 138, 155, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(240, 138, 155, 0.14)',
  },
  listAddModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 28,
    paddingHorizontal: 9,
    borderRadius: 9,
    backgroundColor: 'rgba(92, 200, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.28)',
  },
  listAddModeBtnActiva: {
    backgroundColor: 'rgba(63, 242, 176, 0.08)',
    borderColor: 'rgba(63, 242, 176, 0.3)',
  },
  listAddModeText: {
    color: noir.info,
    fontSize: 9.5,
    fontFamily: fuentes.bold,
  },
  listAddModeTextActiva: {
    color: noir.mint,
    fontSize: 9.5,
    fontFamily: fuentes.bold,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 9,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchContainerActiva: {
    borderColor: 'rgba(92, 200, 255, 0.42)',
    backgroundColor: 'rgba(92, 200, 255, 0.045)',
  },
  searchField: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
  },
  searchText: {
    color: noir.text,
    fontSize: 12,
    fontFamily: fuentes.medium,
  },
  searchPlaceholder: {
    color: noir.muted2,
    fontFamily: fuentes.regular,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  filterBtnActiva: {
    backgroundColor: 'rgba(92, 200, 255, 0.08)',
    borderColor: 'rgba(92, 200, 255, 0.3)',
  },
  filterBtnText: {
    color: noir.muted,
    fontSize: 9.5,
    fontFamily: fuentes.bold,
  },
  filterBtnTextActiva: {
    color: noir.info,
  },
  filterCount: {
    minWidth: 15,
    height: 15,
    paddingHorizontal: 3,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(92, 200, 255, 0.2)',
  },
  filterCountText: {
    color: '#CDEEFF',
    fontSize: 7.5,
    fontFamily: fuentes.black,
    fontVariant: ['tabular-nums'],
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
    paddingHorizontal: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    maxWidth: 124,
  },
  sortBtnText: {
    color: noir.muted,
    fontSize: 9,
    fontFamily: fuentes.medium,
    flexShrink: 1,
  },
  sortBtnTextActiva: {
    color: noir.info,
    fontFamily: fuentes.bold,
  },
  quickFavBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  quickFavBtnActiva: {
    backgroundColor: 'rgba(255, 107, 138, 0.08)',
    borderColor: 'rgba(255, 107, 138, 0.3)',
  },
  clearBtn: {
    width: 26,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gruposWrapper: {
    marginTop: 8,
  },
  gruposScroll: {
    paddingHorizontal: 16,
    gap: 5,
  },
  chipGrupo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipGrupoText: {
    color: noir.muted,
    fontSize: 10.5,
    fontFamily: fuentes.medium,
  },
  resultsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 18,
    paddingTop: 9,
    paddingBottom: 3,
    minHeight: 27,
  },
  resultsText: {
    color: noir.muted2,
    fontSize: 9.5,
    fontFamily: fuentes.medium,
    flexShrink: 1,
  },
  multiGroupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(92, 200, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.16)',
  },
  multiGroupText: {
    color: noir.info,
    fontSize: 8,
    fontFamily: fuentes.bold,
  },
  inlineAddBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: 'rgba(92, 200, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.2)',
  },
  inlineAddText: {
    color: noir.info,
    fontSize: 8.5,
    fontFamily: fuentes.bold,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: noir.muted,
    fontSize: 12,
    fontFamily: fuentes.medium,
  },
  listaEjercicios: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 26,
    gap: 8,
  },
  listaLista: {
    flex: 1,
    minHeight: 0,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 44,
    paddingHorizontal: 26,
    gap: 7,
  },
  emptyOrb: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 4,
  },
  emptyTitle: {
    color: noir.text,
    fontSize: 15,
    fontFamily: fuentes.bold,
  },
  emptySubtitle: {
    color: noir.muted,
    fontSize: 11,
    fontFamily: fuentes.regular,
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 330,
  },
  emptyPrimaryBtn: {
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#9E1C30',
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  emptyPrimaryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: fuentes.bold,
  },
  emptySecondaryBtn: {
    marginTop: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: 'rgba(92, 200, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.2)',
  },
  emptySecondaryText: {
    color: noir.info,
    fontSize: 10,
    fontFamily: fuentes.bold,
  },
  footerCrearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 209, 102, 0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255, 209, 102, 0.16)',
    borderRadius: 11,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  footerCrearText: {
    color: noir.champagne,
    fontSize: 10,
    fontFamily: fuentes.bold,
    textAlign: 'center',
    flexShrink: 1,
  },
  listasWrap: {
    flex: 1,
    minHeight: 0,
  },
  listasHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  listasKicker: {
    color: noir.muted2,
    fontSize: 7.5,
    fontFamily: fuentes.bold,
    letterSpacing: 1,
  },
  listasTitle: {
    color: noir.text,
    fontSize: 17,
    fontFamily: fuentes.black,
    letterSpacing: -0.35,
    marginTop: 1,
  },
  listasSubtitle: {
    color: noir.muted,
    fontSize: 9.5,
    fontFamily: fuentes.regular,
    marginTop: 1,
  },
  newListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#9E1C30',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  newListText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontFamily: fuentes.bold,
  },
  listasContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 15,
  },
  listasScroll: {
    flex: 1,
    minHeight: 0,
  },
  listasLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 42,
  },
  listasLoadingText: {
    color: noir.muted,
    fontSize: 10,
    fontFamily: fuentes.medium,
  },
  listGroupSection: {
    gap: 7,
  },
  listGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listGroupIcon: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  listGroupTitle: {
    fontSize: 9.5,
    fontFamily: fuentes.bold,
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  listGroupLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginHorizontal: 2,
  },
  listGroupCount: {
    color: noir.muted2,
    fontSize: 8.5,
    fontFamily: fuentes.bold,
    fontVariant: ['tabular-nums'],
  },
  listGroupItems: {
    gap: 6,
  },
  listasFooterNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 2,
  },
  listasFooterText: {
    flex: 1,
    color: noir.muted2,
    fontSize: 8.5,
    lineHeight: 12.5,
    fontFamily: fuentes.regular,
  },
  listHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginHorizontal: 16,
    marginTop: 9,
    padding: 10,
    borderRadius: 13,
    borderWidth: 1,
  },
  listHeroIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  listHeroName: {
    color: noir.text,
    fontSize: 13,
    fontFamily: fuentes.bold,
  },
  listHeroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  listHeroGroup: {
    fontSize: 9,
    fontFamily: fuentes.bold,
  },
  listHeroDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: noir.muted2,
  },
  listHeroMeta: {
    color: noir.muted2,
    fontSize: 8.5,
    fontFamily: fuentes.medium,
  },
  listHeroAddHint: {
    color: noir.mint,
    fontSize: 8,
    fontFamily: fuentes.bold,
  },
  keyboardOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 60,
  },
  sheetOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(2, 3, 6, 0.8)',
    justifyContent: 'flex-end',
    zIndex: 80,
  },
  handle: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignSelf: 'center',
    marginTop: 7,
    marginBottom: 8,
  },
  addListSheet: {
    width: '100%',
    maxHeight: '82%',
    backgroundColor: '#0B0D13',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  addListHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  addListHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(92, 200, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.2)',
  },
  addListKicker: {
    color: noir.info,
    fontSize: 8,
    fontFamily: fuentes.bold,
    letterSpacing: 0.9,
  },
  addListTitle: {
    color: noir.text,
    fontSize: 15,
    fontFamily: fuentes.black,
    letterSpacing: -0.25,
    marginTop: 1,
  },
  addListSubtitle: {
    color: noir.muted,
    fontSize: 9.5,
    fontFamily: fuentes.regular,
    marginTop: 1,
  },
  addListContent: {
    paddingTop: 10,
    paddingBottom: 10,
    gap: 6,
  },
  addListScroll: {
    flexShrink: 1,
  },
  addListEmpty: {
    alignItems: 'center',
    paddingVertical: 22,
    paddingHorizontal: 16,
    gap: 6,
  },
  addListEmptyTitle: {
    color: noir.text,
    fontSize: 13,
    fontFamily: fuentes.bold,
  },
  addListEmptyText: {
    color: noir.muted,
    fontSize: 10,
    fontFamily: fuentes.regular,
    textAlign: 'center',
    lineHeight: 15,
  },
  addListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 9,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.028)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  addListRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  addListRowName: {
    color: noir.text,
    fontSize: 11.5,
    fontFamily: fuentes.bold,
  },
  addListRowMeta: {
    color: noir.muted2,
    fontSize: 8.5,
    fontFamily: fuentes.regular,
    marginTop: 1,
  },
  addListCheck: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  addListNewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 10,
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 209, 102, 0.3)',
    backgroundColor: 'rgba(255, 209, 102, 0.04)',
    marginTop: 2,
  },
  addListNewIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 209, 102, 0.09)',
  },
  addListNewTitle: {
    color: noir.champagne,
    fontSize: 11,
    fontFamily: fuentes.bold,
  },
  addListNewText: {
    color: noir.muted,
    fontSize: 8.5,
    fontFamily: fuentes.regular,
    marginTop: 1,
  },
  addListDoneBtn: {
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    marginTop: 2,
  },
  addListDoneText: {
    color: noir.platinum,
    fontSize: 11,
    fontFamily: fuentes.bold,
  },
  tutorialOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.86)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  tutorialBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  tutorialCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#0D1016',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 16,
    overflow: 'hidden',
  },
  tutorialHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    marginBottom: 10,
  },
  tutorialTag: {
    color: colores.primarioHover,
    fontSize: 8.5,
    fontFamily: fuentes.bold,
    letterSpacing: 1,
  },
  tutorialTitle: {
    color: noir.text,
    fontSize: 16,
    fontFamily: fuentes.black,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  tutorialFavBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tutorialFavBtnActiva: {
    backgroundColor: 'rgba(255, 107, 138, 0.09)',
    borderColor: 'rgba(255, 107, 138, 0.28)',
  },
  tutorialCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tutorialGifContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#06070B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tutorialGif: {
    width: '100%',
    height: '100%',
  },
  tutorialMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  tutorialMetaBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    padding: 9,
  },
  tutorialMetaLabel: {
    color: noir.muted2,
    fontSize: 7,
    fontFamily: fuentes.bold,
    letterSpacing: 0.6,
  },
  tutorialMetaVal: {
    color: noir.text,
    fontSize: 11.5,
    fontFamily: fuentes.bold,
    marginTop: 2,
  },
  secundariosBox: {
    marginTop: 10,
    gap: 5,
  },
  secundariosLabel: {
    color: noir.muted2,
    fontSize: 7,
    fontFamily: fuentes.bold,
    letterSpacing: 0.6,
  },
  secundariosRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  secundarioChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  secundarioText: {
    color: noir.muted,
    fontSize: 9,
    fontFamily: fuentes.medium,
  },
  instruccionesBox: {
    marginTop: 12,
    gap: 7,
  },
  instruccionesTitulo: {
    color: noir.text,
    fontSize: 12.5,
    fontFamily: fuentes.bold,
  },
  instruccionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  instruccionNum: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: 'rgba(194, 36, 61, 0.2)',
    color: colores.primarioHover,
    fontSize: 10,
    fontFamily: fuentes.bold,
    textAlign: 'center',
    lineHeight: 19,
  },
  instruccionText: {
    flex: 1,
    color: noir.muted,
    fontSize: 11,
    fontFamily: fuentes.regular,
    lineHeight: 17,
  },
  tutorialSecondaryRow: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 8,
  },
  tutorialSecondaryBtn: {
    flex: 1,
    height: 37,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tutorialSecondaryText: {
    color: noir.platinum,
    fontSize: 9.5,
    fontFamily: fuentes.bold,
  },
  tutorialSelectBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#9E1C30',
    borderRadius: 13,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tutorialSelectBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontFamily: fuentes.bold,
  },
});
