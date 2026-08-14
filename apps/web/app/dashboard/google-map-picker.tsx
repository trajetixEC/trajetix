"use client";

import { useEffect, useRef, useState } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { Map, Marker } from "pigeon-maps";
import { MapPin } from "lucide-react";

type LocationPickerProps = {
  city?: string;
  address?: string;
  initialLat?: number;
  initialLng?: number;
};

const CITY_COORDINATES: Record<string, [number, number]> = {
  quito: [-0.1807, -78.4678],
  guayaquil: [-2.1894, -79.8891],
  cuenca: [-2.9001, -79.0059],
  ambato: [-1.2491, -78.6168],
  machala: [-3.2581, -79.9554],
  manta: [-0.9677, -80.7089],
  portoviejo: [-1.0545, -80.4544],
  loja: [-3.9931, -79.2042],
  ibarra: [0.3517, -78.1223],
  "santo domingo": [-0.2530, -79.1754],
  riobamba: [-1.6635, -78.6546],
  esmeraldas: [0.9592, -79.6569],
  quevedo: [-1.0225, -79.4604],
};

let googleOptionsConfigured = false;

export function GoogleMapPicker({
  city = "Quito",
  address = "",
  initialLat = -0.1807,
  initialLng = -78.4678,
}: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [lat, setLat] = useState<number>(initialLat);
  const [lng, setLng] = useState<number>(initialLng);
  const [center, setCenter] = useState<[number, number]>([initialLat, initialLng]);
  const [zoom, setZoom] = useState<number>(14);
  const [googleLoaded, setGoogleLoaded] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  // Auto-center map when user selects or types a city
  useEffect(() => {
    if (!city) return;
    const cleanCity = city.trim().toLowerCase();
    for (const [cityName, coords] of Object.entries(CITY_COORDINATES)) {
      if (cleanCity.includes(cityName)) {
        setCenter(coords);
        setLat(coords[0]);
        setLng(coords[1]);
        break;
      }
    }
  }, [city]);

  // Load Official Google Maps JS SDK when API key is provided
  useEffect(() => {
    if (!apiKey || !mapRef.current) return;

    let isMounted = true;
    try {
      if (!googleOptionsConfigured) {
        setOptions({ key: apiKey, v: "weekly" });
        googleOptionsConfigured = true;
      }

      importLibrary("maps")
        .then(() => {
          if (!isMounted || !mapRef.current) return;

          const defaultCenter = { lat: lat, lng: lng };
          const map = new google.maps.Map(mapRef.current, {
            center: defaultCenter,
            zoom: 14,
            mapTypeControl: false,
            streetViewControl: false,
          });

          const marker = new google.maps.Marker({
            position: defaultCenter,
            map: map,
            draggable: true,
            title: "Ubicación de la Bodega",
          });

          marker.addListener("dragend", () => {
            const pos = marker.getPosition();
            if (pos) {
              const newLat = Number(pos.lat().toFixed(6));
              const newLng = Number(pos.lng().toFixed(6));
              setLat(newLat);
              setLng(newLng);
              setCenter([newLat, newLng]);
            }
          });

          map.addListener("click", (e: google.maps.MapMouseEvent) => {
            if (e.latLng) {
              marker.setPosition(e.latLng);
              const newLat = Number(e.latLng.lat().toFixed(6));
              const newLng = Number(e.latLng.lng().toFixed(6));
              setLat(newLat);
              setLng(newLng);
              setCenter([newLat, newLng]);
            }
          });

          setGoogleLoaded(true);
        })
        .catch((err: unknown) => {
          console.warn("Notice: Google Maps API loading fallback:", err);
          if (isMounted) setGoogleLoaded(false);
        });
    } catch (err: unknown) {
      console.warn("Notice: Google Maps options notice:", err);
      if (isMounted) setGoogleLoaded(false);
    }

    return () => {
      isMounted = false;
    };
  }, [apiKey]);

  function handleMapClick({ latLng }: { latLng: [number, number] }) {
    const [newLat, newLng] = latLng;
    const formattedLat = Number(newLat.toFixed(6));
    const formattedLng = Number(newLng.toFixed(6));
    setLat(formattedLat);
    setLng(formattedLng);
  }

  function handleMarkerClick({ anchor }: { anchor: [number, number] }) {
    if (!anchor) return;
    setLat(Number(anchor[0].toFixed(6)));
    setLng(Number(anchor[1].toFixed(6)));
  }

  return (
    <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-red-500 flex-shrink-0" />
          Mapa Oficial de Google Maps (Haz clic o arrastra el pin) <span className="text-red-500">*</span>
        </span>
        <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded uppercase flex items-center gap-1">
          {googleLoaded ? "✓ Google Maps SDK Activo" : "Coordenadas Requeridas"}
        </span>
      </div>

      <p className="text-[11px] text-slate-500 flex items-center gap-1 flex-wrap">
        <span>Haz clic sobre cualquier calle o arrastra el pin rojo</span>
        <MapPin className="w-3.5 h-3.5 text-red-500 inline flex-shrink-0" />
        <span>para fijar la ubicación exacta de la bodega:</span>
      </p>

      {/* MAP CANVAS CONTAINER */}
      <div className="w-full h-60 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 relative shadow-inner cursor-crosshair">
        {apiKey ? (
          <div ref={mapRef} className="w-full h-full" />
        ) : (
          <Map
            height={240}
            center={center}
            zoom={zoom}
            onBoundsChanged={({ center, zoom }) => {
              setCenter(center);
              setZoom(zoom);
            }}
            onClick={handleMapClick}
          >
            <Marker
              width={44}
              anchor={[lat, lng]}
              color="#ed1822"
              onClick={handleMarkerClick}
            />
          </Map>
        )}
      </div>

      {/* HIDDEN FORM INPUTS FOR LATITUDE & LONGITUDE */}
      <input type="hidden" name="latitude" value={lat} />
      <input type="hidden" name="longitude" value={lng} />
    </div>
  );
}
