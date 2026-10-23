import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from 'expo-router';
import Head from 'expo-router/head';
import { Ionicons } from '@expo/vector-icons';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { fuentes, noir } from '../../constants/colores';
import { CATEGORIAS, obtenerConfigCategoria } from '../../constants/notas';
import EditorialHeader from '../../components/EditorialHeader';
import GlowPanel from '../../components/GlowPanel';
import ScreenBackground from '../../components/ScreenBackground';
import NotesCategoryRail from '../../components/NotesCategoryRail';
import NotaBibliotecaCard from '../../components/NotaBibliotecaCard';
import { LiquidMetalButton } from '../../components/LiquidMetalButton';
import YoungNewtButton from '../../components/YoungNewtButton';
import ShinyText from '../../components/ShinyText';
import {
  CategoriaNota,
  eliminarNotaEstandar,
  guardarNotaEstandar,
  NotaEstandar,
  obtenerNotasEstandar,
} from '../../services/notas';
import { agregarActividad } from '../../services/registros';
import { aISO, diasDeSemana } from '../../utils/fechas';
import { seguro, confirmarAccion, mostrarMensaje } from '../../utils/errores';
import { useLayout } from '../../hooks/useLayout';

function capitalizar(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function fechaDiaLarga(dia: Date) {
  return capitalizar(format(dia, "EEEE d 'de' MMMM", { locale: es }));
}

export default function Notas() {
  const {
    gutter,
    contentMaxWidth,
    isLandscape,
    isCompact,
    bottomInset,
    safeBottom,
  } = useLayout();
  const isFocused = useIsFocused();

  // La barra flota sobre el contenido. Reservamos su alto + un respiro corto,
  // igual que en el home, para que la última tarjeta nunca quede debajo.
  const tabBottomPadding = isLandscape
    ? 56 + Math.max(bottomInset, 8) + 6
    : 64 + safeBottom;

  const [notas, setNotas] = useState<NotaEstandar[]>([]);
  const [cargando, setCargando] = useState(true);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('Todas');

  // Modal Crear / Editar
  const [modalEditarVisible, setModalEditarVisible] = useState(false);
  const [notaEditando, setNotaEditando] = useState<NotaEstandar | null>(null);
  const [tituloInput, setTituloInput] = useState('');
  const [catInput, setCatInput] = useState<CategoriaNota>('General');
  const [contenidoInput, setContenidoInput] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [tituloFocused, setTituloFocused] = useState(false);
  const [contenidoFocused, setContenidoFocused] = useState(false);

  // Modal Asignar a Día
  const [modalAsignarVisible, setModalAsignarVisible] = useState(false);
  const [notaParaAsignar, setNotaParaAsignar] = useState<NotaEstandar | null>(
    null
  );
  const [semanaAsignar, setSemanaAsignar] = useState<Date[]>(() =>
    diasDeSemana(new Date())
  );
  const [asignandoAISO, setAsignandoAISO] = useState<string | null>(null);

  const cargarNotas = useCallback(async () => {
    await seguro(async () => {
      const data = await obtenerNotasEstandar();
      setNotas(data);
    });
    setCargando(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarNotas();
    }, [cargarNotas])
  );

  const conteos = useMemo(() => {
    const mapa: Record<string, number> = { Todas: notas.length };
    CATEGORIAS.forEach((categoria) => {
      mapa[categoria] = notas.filter((n) => n.categoria === categoria).length;
    });
    return mapa;
  }, [notas]);

  const notasFiltradas = useMemo(
    () =>
      categoriaFiltro === 'Todas'
        ? notas
        : notas.filter((n) => n.categoria === categoriaFiltro),
    [notas, categoriaFiltro]
  );

  const categoriasEnUso = useMemo(
    () => new Set(notas.map((n) => n.categoria)).size,
    [notas]
  );

  const filtroConfig = obtenerConfigCategoria(categoriaFiltro);
  const configAsignar = obtenerConfigCategoria(
    notaParaAsignar?.categoria ?? 'General'
  );

  const abrirCrear = () => {
    setNotaEditando(null);
    setTituloInput('');
    setCatInput(
      categoriaFiltro === 'Todas'
        ? 'General'
        : (categoriaFiltro as CategoriaNota)
    );
    setContenidoInput('');
    setTituloFocused(false);
    setContenidoFocused(false);
    setModalEditarVisible(true);
  };

  const abrirEditar = (nota: NotaEstandar) => {
    setNotaEditando(nota);
    setTituloInput(nota.titulo);
    setCatInput(nota.categoria);
    setContenidoInput(nota.contenido);
    setTituloFocused(false);
    setContenidoFocused(false);
    setModalEditarVisible(true);
  };

  const cerrarEditor = () => {
    if (guardando) return;
    setModalEditarVisible(false);
    setTituloFocused(false);
    setContenidoFocused(false);
  };

  const guardar = () => {
    if (guardando) return;

    setGuardando(true);
    seguro(async () => {
      if (!tituloInput.trim()) {
        throw new Error('Ingresa un título para la nota.');
      }

      await guardarNotaEstandar({
        id: notaEditando?.id,
        titulo: tituloInput.trim(),
        categoria: catInput,
        contenido: contenidoInput.trim(),
      });

      setModalEditarVisible(false);
      setTituloFocused(false);
      setContenidoFocused(false);
      await cargarNotas();
      mostrarMensaje(
        notaEditando ? 'Nota actualizada' : 'Nota creada',
        notaEditando
          ? 'Los cambios ya están en tu biblioteca.'
          : 'La nota ya forma parte de tu biblioteca.'
      );
    }).finally(() => setGuardando(false));
  };

  const borrar = (nota: NotaEstandar) => {
    confirmarAccion(
      'Eliminar nota',
      `¿Deseas eliminar "${nota.titulo}" de tu biblioteca?`,
      async () => {
        await eliminarNotaEstandar(nota.id);
        await cargarNotas();
      }
    );
  };

  const abrirAsignar = (nota: NotaEstandar) => {
    setNotaParaAsignar(nota);
    setSemanaAsignar(diasDeSemana(new Date()));
    setAsignandoAISO(null);
    setModalAsignarVisible(true);
  };

  const cerrarAsignar = () => {
    if (asignandoAISO) return;
    setModalAsignarVisible(false);
    setNotaParaAsignar(null);
  };

  const asignarADia = (dia: Date) => {
    if (!notaParaAsignar || asignandoAISO) return;

    const nota = notaParaAsignar;
    const fechaISO = aISO(dia);
    setAsignandoAISO(fechaISO);

    seguro(async () => {
      const textoFormateado = `📌 [${nota.categoria.toUpperCase()}] ${nota.titulo}: ${nota.contenido}`;
      await agregarActividad(fechaISO, textoFormateado, null, null, null);

      setModalAsignarVisible(false);
      setNotaParaAsignar(null);
      mostrarMensaje(
        'Nota asignada',
        `"${nota.titulo}" se añadió al ${fechaDiaLarga(dia)}.`
      );
    }).finally(() => setAsignandoAISO(null));
  };

  const tituloTamano = isLandscape ? 22 : isCompact ? 24 : 28;
  const shinyWebStyle =
    Platform.OS === 'web'
      ? ({
          width: '100%',
          display: 'block',
          fontSize: tituloTamano,
          fontFamily: fuentes.extraBold,
          fontWeight: 800,
          lineHeight: `${Math.round(tituloTamano * 1.18)}px`,
          letterSpacing: '-0.9px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        } as any)
      : undefined;

  const resumenBiblioteca =
    notas.length === 0
      ? 'Tu archivo personal de ideas, protocolos y recordatorios'
      : `${notas.length} ${notas.length === 1 ? 'nota' : 'notas'} · ${categoriasEnUso} ${
          categoriasEnUso === 1 ? 'categoría en uso' : 'categorías en uso'
        }`;

  return (
    <ScreenBackground>
      <Head>
        <title>Notas · Rutinia</title>
      </Head>

      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            width: '100%',
            maxWidth: contentMaxWidth,
            alignSelf: 'center',
            paddingHorizontal: gutter,
            paddingBottom: tabBottomPadding,
          }}
        >
          <EditorialHeader
            title="Notas"
            style={{
              paddingTop: isLandscape ? 2 : 4,
              marginBottom: isLandscape ? 4 : 12,
            }}
          />

          {/* SALUDO EDITORIAL: LA BIBLIOTECA COMO PARTE DE LA MARCA */}
          <View
            style={[
              styles.hero,
              { marginBottom: isLandscape ? 6 : 12 },
            ]}
          >
            <View style={styles.eyebrowRow}>
              <View style={styles.eyebrowDot} />
              <Text style={styles.eyebrowText}>BIBLIOTECA PERSONAL</Text>
            </View>

            <View
              style={[
                styles.shinyTitleWrap,
                { height: tituloTamano * 1.4 },
              ]}
            >
              <ShinyText
                text="Biblioteca de Notas"
                color={noir.platinum}
                shineColor="#FFFFFF"
                speed={3.2}
                fontSize={tituloTamano}
                fontFamily={fuentes.extraBold}
                align="left"
                width="100%"
                height={tituloTamano * 1.4}
                style={shinyWebStyle}
              />
            </View>

            <Text style={styles.heroStats} numberOfLines={1}>
              {notas.length > 0 ? (
                <>
                  <Text style={styles.heroStatsStrong}>
                    {notas.length} {notas.length === 1 ? 'nota' : 'notas'}
                  </Text>
                  <Text style={styles.heroStatsSep}> · </Text>
                  {categoriasEnUso}{' '}
                  {categoriasEnUso === 1 ? 'categoría en uso' : 'categorías en uso'}
                </>
              ) : (
                resumenBiblioteca
              )}
            </Text>
          </View>

          <NotesCategoryRail
            value={categoriaFiltro}
            onChange={setCategoriaFiltro}
            counts={conteos}
            style={{ marginBottom: isLandscape ? 6 : 10 }}
          />

          {/* PANEL PRINCIPAL CON EL GLOW PERLA DEL HOME */}
          <GlowPanel style={styles.libraryPanel} radius={20}>
            <View style={styles.panelHeader}>
              <View style={styles.panelHeaderLeft}>
                <View
                  style={[
                    styles.panelDot,
                    {
                      backgroundColor: filtroConfig.color,
                      shadowColor: filtroConfig.color,
                    },
                  ]}
                />
                <Text style={styles.panelLabel}>
                  {categoriaFiltro === 'Todas'
                    ? 'TODAS LAS NOTAS'
                    : categoriaFiltro.toUpperCase()}
                </Text>
              </View>

              <Text style={styles.panelCount}>
                {notasFiltradas.length}{' '}
                {notasFiltradas.length === 1 ? 'nota' : 'notas'}
              </Text>
            </View>

            {cargando ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="small" color={noir.platinum} />
                <Text style={styles.loadingText}>Cargando biblioteca...</Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                  styles.listContent,
                  notasFiltradas.length === 0 && styles.listContentEmpty,
                ]}
              >
                {notasFiltradas.length === 0 ? (
                  <View style={styles.emptyState}>
                    <View
                      style={[
                        styles.emptyIconBox,
                        {
                          backgroundColor: filtroConfig.bg,
                          borderColor: filtroConfig.borderColor,
                        },
                      ]}
                    >
                      <Ionicons
                        name={filtroConfig.icon}
                        size={25}
                        color={filtroConfig.color}
                      />
                    </View>

                    <Text style={styles.emptyTitle}>
                      {categoriaFiltro === 'Todas'
                        ? 'Tu biblioteca está lista para crecer'
                        : `Sin notas en ${categoriaFiltro}`}
                    </Text>

                    <Text style={styles.emptyText}>
                      {categoriaFiltro === 'Todas'
                        ? 'Guarda protocolos, recordatorios y aprendizajes. Después podrás asignarlos a cualquier día de tu semana.'
                        : 'Cambia el filtro para ver tu archivo completo o crea la primera nota de esta categoría.'}
                    </Text>

                    <View style={styles.emptyActions}>
                      <YoungNewtButton
                        title={
                          categoriaFiltro === 'Todas'
                            ? 'Crear primera nota'
                            : 'Crear nota aquí'
                        }
                        onPress={abrirCrear}
                      />

                      {categoriaFiltro !== 'Todas' && (
                        <Pressable
                          onPress={() => setCategoriaFiltro('Todas')}
                          style={({ pressed }) => [
                            styles.emptyLink,
                            pressed && { opacity: 0.64 },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel="Ver todas las notas"
                        >
                          <Text style={styles.emptyLinkText}>
                            Ver todas las notas
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ) : (
                  notasFiltradas.map((nota, index) => (
                    <NotaBibliotecaCard
                      key={nota.id}
                      nota={nota}
                      index={index}
                      onEditar={abrirEditar}
                      onEliminar={borrar}
                      onAsignar={abrirAsignar}
                    />
                  ))
                )}
              </ScrollView>
            )}
          </GlowPanel>

          {/* ACCIÓN PRINCIPAL: METAL LÍQUIDO COMO EN EL HOME */}
          <View style={styles.ctaWrap}>
            <LiquidMetalButton
              titulo="+ Nueva Nota"
              onPress={abrirCrear}
              activo={
                isFocused && !modalEditarVisible && !modalAsignarVisible
              }
              height={54}
              borderWidth={4}
              tamano="lg"
              style={{ alignSelf: 'stretch' }}
            />
          </View>
        </View>

        {/* MODAL CREAR / EDITAR NOTA */}
        <Modal
          visible={modalEditarVisible}
          animationType="slide"
          transparent
          statusBarTranslucent
          onRequestClose={cerrarEditor}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalKeyboard}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={cerrarEditor}
              accessibilityLabel="Cerrar editor de nota"
            />

            <View
              style={[
                styles.modalFrame,
                {
                  paddingHorizontal: gutter,
                  paddingBottom: Math.max(10, bottomInset + 6),
                  maxWidth: contentMaxWidth,
                },
              ]}
            >
              <GlowPanel style={styles.sheet} radius={26}>
                <View style={styles.grabberWrap}>
                  <View style={styles.grabber} />
                </View>

                <View style={styles.sheetHeader}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.sheetKicker}>
                      {notaEditando ? 'EDITAR NOTA' : 'NUEVA NOTA'}
                    </Text>
                    <Text numberOfLines={2} style={styles.sheetTitle}>
                      {notaEditando ? notaEditando.titulo : 'Captura una idea'}
                    </Text>
                  </View>

                  <Pressable
                    onPress={cerrarEditor}
                    style={({ pressed }) => [
                      styles.closeButton,
                      pressed && { opacity: 0.62, transform: [{ scale: 0.93 }] },
                    ]}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Cerrar"
                  >
                    <Ionicons name="close" size={17} color={noir.platinum} />
                  </Pressable>
                </View>

                <ScrollView
                  style={styles.sheetForm}
                  contentContainerStyle={styles.formContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.field}>
                    <View style={styles.fieldLabelRow}>
                      <Text style={styles.fieldLabel}>Título</Text>
                      <Text style={styles.charCount}>
                        {tituloInput.length}/60
                      </Text>
                    </View>
                    <TextInput
                      placeholder="Ej. Protocolo de hidratación"
                      placeholderTextColor={noir.muted2}
                      value={tituloInput}
                      onChangeText={setTituloInput}
                      onFocus={() => setTituloFocused(true)}
                      onBlur={() => setTituloFocused(false)}
                      maxLength={60}
                      inputMode="text"
                      keyboardType="default"
                      autoCapitalize="sentences"
                      autoCorrect={false}
                      returnKeyType="next"
                      enterKeyHint="next"
                      style={[
                        styles.input,
                        tituloFocused && styles.inputFocused,
                      ]}
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Categoría</Text>
                    <NotesCategoryRail
                      value={catInput}
                      onChange={(valor) => setCatInput(valor as CategoriaNota)}
                      showAll={false}
                      showCounts={false}
                      compact
                    />
                  </View>

                  <View style={styles.field}>
                    <View style={styles.fieldLabelRow}>
                      <Text style={styles.fieldLabel}>Cuerpo</Text>
                      <Text style={styles.charCount}>
                        {contenidoInput.length}/600
                      </Text>
                    </View>
                    <TextInput
                      placeholder="Escribe el detalle, la dosis, el recordatorio o la idea completa..."
                      placeholderTextColor={noir.muted2}
                      multiline
                      value={contenidoInput}
                      onChangeText={setContenidoInput}
                      onFocus={() => setContenidoFocused(true)}
                      onBlur={() => setContenidoFocused(false)}
                      maxLength={600}
                      inputMode="text"
                      keyboardType="default"
                      autoCapitalize="sentences"
                      autoCorrect
                      textAlignVertical="top"
                      style={[
                        styles.input,
                        styles.bodyInput,
                        contenidoFocused && styles.inputFocused,
                      ]}
                    />
                  </View>

                  <View style={styles.saveWrap}>
                    <YoungNewtButton
                      title="Guardar Nota"
                      loadingTitle="Guardando..."
                      loading={guardando}
                      disabled={!tituloInput.trim() || guardando}
                      onPress={guardar}
                      fullWidth
                    />
                  </View>
                </ScrollView>
              </GlowPanel>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* MODAL ASIGNAR A UN DÍA */}
        <Modal
          visible={modalAsignarVisible}
          animationType="slide"
          transparent
          statusBarTranslucent
          onRequestClose={cerrarAsignar}
        >
          <View style={styles.modalKeyboard}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={cerrarAsignar}
              accessibilityLabel="Cerrar asignación"
            />

            <View
              style={[
                styles.modalFrame,
                {
                  paddingHorizontal: gutter,
                  paddingBottom: Math.max(10, bottomInset + 6),
                  maxWidth: contentMaxWidth,
                },
              ]}
            >
              <GlowPanel style={styles.sheet} radius={26}>
                <View style={styles.grabberWrap}>
                  <View style={styles.grabber} />
                </View>

                <View style={styles.sheetHeader}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.sheetKicker}>ASIGNAR AL DÍA</Text>
                    <Text numberOfLines={2} style={styles.sheetTitle}>
                      ¿Cuándo quieres recordarla?
                    </Text>
                  </View>

                  <Pressable
                    onPress={cerrarAsignar}
                    style={({ pressed }) => [
                      styles.closeButton,
                      pressed && { opacity: 0.62, transform: [{ scale: 0.93 }] },
                    ]}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Cerrar"
                  >
                    <Ionicons name="close" size={17} color={noir.platinum} />
                  </Pressable>
                </View>

                {notaParaAsignar && (
                  <View
                    style={[
                      styles.assignNote,
                      { borderColor: configAsignar.borderColor },
                    ]}
                  >
                    <View
                      style={[
                        styles.assignNoteBadge,
                        {
                          backgroundColor: configAsignar.bg,
                          borderColor: configAsignar.borderColor,
                        },
                      ]}
                    >
                      <Ionicons
                        name={configAsignar.icon}
                        size={11}
                        color={configAsignar.color}
                      />
                      <Text
                        style={[
                          styles.assignNoteBadgeText,
                          { color: configAsignar.color },
                        ]}
                      >
                        {notaParaAsignar.categoria.toUpperCase()}
                      </Text>
                    </View>
                    <Text numberOfLines={2} style={styles.assignNoteTitle}>
                      {notaParaAsignar.titulo}
                    </Text>
                  </View>
                )}

                <ScrollView
                  style={styles.sheetForm}
                  contentContainerStyle={styles.dayList}
                  showsVerticalScrollIndicator={false}
                >
                  {semanaAsignar.map((dia) => {
                    const hoy = isSameDay(dia, new Date());
                    const asignando = asignandoAISO === aISO(dia);

                    return (
                      <Pressable
                        key={aISO(dia)}
                        onPress={() => asignarADia(dia)}
                        disabled={Boolean(asignandoAISO)}
                        style={({ pressed }) => [
                          styles.dayRow,
                          hoy && styles.dayRowToday,
                          pressed && !asignandoAISO && { opacity: 0.76 },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Asignar al ${fechaDiaLarga(dia)}`}
                      >
                        <View
                          style={[
                            styles.dayChip,
                            hoy && {
                              backgroundColor: 'rgba(92, 200, 255, 0.12)',
                              borderColor: 'rgba(92, 200, 255, 0.28)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayInitial,
                              hoy && { color: noir.info },
                            ]}
                          >
                            {capitalizar(
                              format(dia, 'EEEE', { locale: es }).substring(0, 3)
                            )}
                          </Text>
                        </View>

                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={styles.dayNameRow}>
                            <Text style={styles.dayName}>
                              {capitalizar(
                                format(dia, 'EEEE', { locale: es })
                              )}
                            </Text>
                            {hoy && (
                              <View style={styles.todayBadge}>
                                <Text style={styles.todayBadgeText}>HOY</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.dayDate}>
                            {capitalizar(format(dia, 'd MMMM', { locale: es }))}
                          </Text>
                        </View>

                        {asignando ? (
                          <ActivityIndicator size="small" color={configAsignar.color} />
                        ) : (
                          <Ionicons
                            name="add-circle-outline"
                            size={20}
                            color={configAsignar.color}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Pressable
                  onPress={cerrarAsignar}
                  style={({ pressed }) => [
                    styles.cancelLink,
                    pressed && { opacity: 0.62 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Cancelar"
                >
                  <Text style={styles.cancelLinkText}>Cancelar</Text>
                </Pressable>
              </GlowPanel>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: 1,
    flexShrink: 0,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  eyebrowDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: noir.pearl,
    shadowColor: '#E2EFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 4,
    elevation: 2,
  },
  eyebrowText: {
    color: noir.muted,
    fontFamily: fuentes.semiBold,
    fontSize: 9,
    letterSpacing: 1.3,
  },
  shinyTitleWrap: {
    width: '100%',
    marginTop: 5,
    justifyContent: 'center',
  },
  heroStats: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 4,
  },
  heroStatsStrong: {
    color: '#DCE3EC',
    fontFamily: fuentes.semiBold,
  },
  heroStatsSep: {
    color: 'rgba(255, 255, 255, 0.18)',
  },
  libraryPanel: {
    flex: 1,
    padding: 13,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 2,
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.055)',
    marginBottom: 9,
  },
  panelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexShrink: 1,
  },
  panelDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 5,
    elevation: 2,
  },
  panelLabel: {
    color: noir.muted,
    fontFamily: fuentes.bold,
    fontSize: 9.5,
    letterSpacing: 1.05,
  },
  panelCount: {
    color: noir.muted2,
    fontFamily: fuentes.medium,
    fontSize: 10,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 24,
  },
  loadingText: {
    color: noir.muted2,
    fontFamily: fuentes.medium,
    fontSize: 11.5,
  },
  listContent: {
    gap: 9,
    paddingBottom: 2,
    paddingTop: 1,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  emptyIconBox: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E2EFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontFamily: fuentes.bold,
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  emptyText: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyActions: {
    alignItems: 'center',
    gap: 8,
    marginTop: 5,
  },
  emptyLink: {
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  emptyLinkText: {
    color: noir.muted,
    fontFamily: fuentes.semiBold,
    fontSize: 11,
  },
  ctaWrap: {
    width: '100%',
    paddingTop: 10,
    flexShrink: 0,
  },
  modalKeyboard: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(2, 3, 6, 0.8)',
  },
  modalFrame: {
    width: '100%',
    alignSelf: 'center',
  },
  sheet: {
    padding: 18,
    gap: 12,
    maxHeight: '88%',
  },
  grabberWrap: {
    alignItems: 'center',
    marginTop: -4,
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  sheetKicker: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 8.5,
    letterSpacing: 1.25,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontFamily: fuentes.bold,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.4,
    marginTop: 4,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 1,
  },
  sheetForm: {
    flexShrink: 1,
  },
  formContent: {
    gap: 14,
    paddingTop: 2,
    paddingBottom: 2,
  },
  field: {
    gap: 6,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  fieldLabel: {
    color: noir.muted,
    fontFamily: fuentes.bold,
    fontSize: 10,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  charCount: {
    color: noir.muted2,
    fontFamily: fuentes.medium,
    fontSize: 9,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 11,
    color: '#F2F6FC',
    fontSize: 14,
    fontFamily: fuentes.regular,
  },
  inputFocused: {
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  bodyInput: {
    minHeight: 108,
    textAlignVertical: 'top',
    lineHeight: 20,
  },
  saveWrap: {
    marginTop: 2,
  },
  assignNote: {
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: noir.line,
    borderRadius: 14,
    padding: 12,
    gap: 7,
  },
  assignNoteBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  assignNoteBadgeText: {
    fontFamily: fuentes.bold,
    fontSize: 8.5,
    letterSpacing: 0.6,
  },
  assignNoteTitle: {
    color: '#FFFFFF',
    fontFamily: fuentes.semiBold,
    fontSize: 14.5,
    lineHeight: 19,
    letterSpacing: -0.2,
  },
  dayList: {
    gap: 7,
    paddingTop: 1,
    paddingBottom: 2,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: noir.line,
  },
  dayRowToday: {
    backgroundColor: 'rgba(92, 200, 255, 0.07)',
    borderColor: 'rgba(92, 200, 255, 0.3)',
  },
  dayChip: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: noir.line,
  },
  dayInitial: {
    color: noir.platinum,
    fontFamily: fuentes.bold,
    fontSize: 9,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  dayNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayName: {
    color: '#FFFFFF',
    fontFamily: fuentes.semiBold,
    fontSize: 13.5,
    letterSpacing: -0.1,
  },
  todayBadge: {
    backgroundColor: 'rgba(92, 200, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.3)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
  },
  todayBadgeText: {
    color: noir.info,
    fontFamily: fuentes.bold,
    fontSize: 7,
    letterSpacing: 0.7,
  },
  dayDate: {
    color: noir.muted2,
    fontFamily: fuentes.regular,
    fontSize: 10.5,
    marginTop: 1,
  },
  cancelLink: {
    alignSelf: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  cancelLinkText: {
    color: noir.muted,
    fontFamily: fuentes.semiBold,
    fontSize: 11.5,
  },
});
