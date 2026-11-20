import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import { LocateFixed, MapPin, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { city, gridScale, tileAttribution, tileUrl, type Area } from './config'
import { position, statusStyle, styles, type Listing } from './domain'
import { Badge, Notice, Price, Specs } from './ui'

function pinHtml(key: keyof typeof styles) {
  return '<span class="house-pin ' + key + '"><svg viewBox="0 0 44 46" aria-hidden="true"><path d="M22 2 42 18v19a3 3 0 0 1-3 3H27l-5 5-5-5H5a3 3 0 0 1-3-3V18Z"/></svg><b>' + styles[key].sign + '</b></span>'
}
export function Legend() {
  return <div className="legend" aria-label="Legenda do mapa"><span className="legend-title">LEGENDA</span>
    {Object.entries(styles).map(([key, style]) => <span key={key}><b className={'legend-key ' + key}>{style.sign}</b>{style.name}</span>)}
  </div>
}
type MapProps = {
  items?: Listing[]
  selected?: Listing
  onSelect?: (item?: Listing) => void
  onArea?: (area: Area) => void
  point?: [number, number]
  onPoint?: (point: [number, number]) => void
  small?: boolean
}
export function PropertyMap({ items, selected, onSelect, onArea, point, onPoint, small }: MapProps) {
  const node = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const markers = useRef<L.MarkerClusterGroup | null>(null)
  const pointLayer = useRef<L.CircleMarker | null>(null)
  const pointHandler = useRef(onPoint)
  const selectHandler = useRef(onSelect)
  pointHandler.current = onPoint
  selectHandler.current = onSelect
  const [tileError, setTileError] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [focusItem, setFocusItem] = useState('')
  const pick = !!onPoint
  const origin = useRef(point)
  useEffect(() => {
    if (!node.current) return
    const instance = L.map(node.current, { zoomControl: false, scrollWheelZoom: false, maxBounds: [[-85, -179.9], [85, 179.9]], maxBoundsViscosity: 1 })
      .setView(origin.current ?? city.center, city.zoom)
    map.current = instance
    L.control.zoom({ position: 'topright' }).addTo(instance)
    const tiles = L.tileLayer(tileUrl, { attribution: tileAttribution, maxZoom: 19, noWrap: true, keepBuffer: 0 })
    let failures = 0
    tiles.on('loading', () => { failures = 0 })
    tiles.on('tileerror', () => { failures++ })
    tiles.on('load', () => setTileError(failures > 0))
    tiles.addTo(instance)
    const cluster = L.markerClusterGroup({
      maxClusterRadius: 34, showCoverageOnHover: false,
      iconCreateFunction: group => L.divIcon({ className: 'cluster-pin', html: '<span>' + group.getChildCount() + '</span>', iconSize: [42, 42] }),
    }).addTo(instance)
    markers.current = cluster
    instance.on('dragend zoomend', () => setDirty(true))
    instance.on('click', event => {
      if (pick) {
        const { lat, lng } = event.latlng
        pointHandler.current?.([Math.round(lat * gridScale) / gridScale, Math.round(lng * gridScale) / gridScale])
      } else selectHandler.current?.()
    })
    const observer = new ResizeObserver(() => {
      if (node.current?.offsetWidth) instance.invalidateSize({ pan: false })
    })
    observer.observe(node.current)
    return () => { observer.disconnect(); instance.remove(); map.current = null; pointLayer.current = null; markers.current = null }
  }, [pick])

  useEffect(() => {
    const cluster = markers.current
    if (!cluster) return
    cluster.clearLayers()
    for (const item of items || []) {
      const key = statusStyle(item)
      const label = styles[key].name + ' · ' + item.title
      const marker = L.marker(position(item), {
        icon: L.divIcon({ className: 'property-pin', html: pinHtml(key), iconSize: [44, 46], iconAnchor: [22, 45] }),
        title: label, alt: label, riseOnHover: true,
      }).on('click', () => {
        setFocusItem(item.id)
        selectHandler.current?.(item)
      }).on('add', () => marker.getElement()?.setAttribute('aria-label', label))
      cluster.addLayer(marker)
    }
  }, [items, pick])

  useEffect(() => {
    if (selected && selected.id !== focusItem && map.current) {
      map.current.panInside(position(selected), { padding: [48, 48] })
      setFocusItem(selected.id)
    } else if (!selected && focusItem) setFocusItem('')
  }, [selected, focusItem])

  useEffect(() => {
    if (!point || !map.current) return
    if (pointLayer.current) pointLayer.current.setLatLng(point)
    else pointLayer.current = L.circleMarker(point, { radius: 12, color: '#fff', weight: 4, fillColor: '#174c39', fillOpacity: 1 }).addTo(map.current)
  }, [point, pick])

  function searchArea() {
    const bounds = map.current?.getBounds()
    if (!bounds) return
    onArea?.({ south: bounds.getSouth(), west: bounds.getWest(), north: bounds.getNorth(), east: bounds.getEast() })
    setDirty(false)
  }
  function locate() {
    if (!navigator.geolocation) { setLocationError('Localização indisponível neste navegador.'); return }
    setLocating(true)
    setLocationError('')
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      map.current?.setView([coords.latitude, coords.longitude], 15)
      setLocating(false)
      setDirty(true)
    }, () => {
      setLocationError('Não foi possível usar sua localização. Você pode continuar movendo o mapa.')
      setLocating(false)
    }, { timeout: 10000, maximumAge: 30000 })
  }
  return <div className={'map-shell ' + (small ? 'compact' : '')}>
    <div ref={node} className="leaflet-view" aria-label={pick ? 'Mapa para selecionar região aproximada' : 'Mapa de imóveis'} />
    {onArea && <><div className="map-place"><MapPin size={15} />{city.name}, {city.state}</div>
      <div className="map-buttons"><button className="button light" onClick={locate} disabled={locating}><LocateFixed size={17} />{locating ? 'Localizando…' : 'Minha localização'}</button>
        <button className={'button ' + (dirty ? 'primary' : 'light')} onClick={searchArea}><Search size={16} />Buscar nesta área</button>
      </div></>}
    {(tileError || locationError) && <div className="map-notice"><Notice>{locationError || (onArea ? 'Mapa base indisponível. Você pode continuar pela Lista.' : 'Mapa base indisponível.')}</Notice></div>}
    {selected && <section className="map-preview" aria-label="Prévia do imóvel">
      <button className="icon-button close-preview" aria-label="Fechar prévia" onClick={() => onSelect?.()}><X size={18} /></button>
      <Badge item={selected} /><h3>{selected.title}</h3><p className="location muted"><MapPin size={14} />{selected.neighborhood}</p>
      <Price item={selected} /><Specs item={selected} /><Link className="button primary" to={'/imovel/' + selected.id} state={{ fromExplore: true }}>Ver detalhes</Link>
    </section>}
  </div>
}
