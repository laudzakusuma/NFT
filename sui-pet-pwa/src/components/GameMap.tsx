'use client';

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Navigation } from "lucide-react";

interface GameMapProps {
  userPos: { lat: number; lng: number } | null;
  targetPos: { lat: number; lng: number } | null;
  distance: number | null;
}

export default function GameMap({ userPos, targetPos, distance }: GameMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const targetMarkerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);
  const [isFollowing, setIsFollowing] = useState(true);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [0, 0],
      zoom: 18,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: true,
      doubleClickZoom: false,
    });

    L.tileLayer(
      "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 20,
        attribution: "© OpenStreetMap contributors",
      }
    ).addTo(map);

    L.control.scale({ imperial: false }).addTo(map);
    L.control.zoom({ position: "topright" }).addTo(map);

    map.on("dragstart", () => setIsFollowing(false));

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);
  const createUserIcon = () =>
    L.divIcon({
      className: "user-icon-container",
      html: `
        <div style="position:relative;width:30px;height:30px;">
          <div style="
            position:absolute;inset:0;border-radius:999px;
            background:#22c55e;border:3px solid #fff;
            box-shadow:0 6px 18px rgba(34,197,94,0.3);
          "></div>
          <div class="user-pulse" style="
            position:absolute;left:-50%;top:-50%;
            width:200%;height:200%;border-radius:999px;
            background:#22c55e;opacity:0.15;
          "></div>
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userPos) return;

    const latlng: L.LatLngExpression = [userPos.lat, userPos.lng];

    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker(latlng, {
        icon: createUserIcon(),
        interactive: false,
      }).addTo(map);
    } else {
      userMarkerRef.current.setLatLng(latlng);
    }

    if (!circleRef.current) {
      circleRef.current = L.circle(latlng, {
        radius: 15,
        color: "#22c55e",
        fillColor: "#22c55e",
        fillOpacity: 0.08,
        weight: 1,
      }).addTo(map);
    } else {
      circleRef.current.setLatLng(latlng);
    }

    if (isFollowing) {
      if (map.getZoom() < 16) {
        map.setView(latlng, 18, { animate: true });
      } else {
        map.panTo(latlng, { animate: true, duration: 0.6 as any });
      }
    }
  }, [userPos, isFollowing]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (targetPos && userPos) {
      const tLatLng: L.LatLngExpression = [targetPos.lat, targetPos.lng];

      const targetIcon = L.divIcon({
        className: "target-icon",
        html: `<div class="target-gift" style="font-size:30px;transform:translateY(-4px);">🎁</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      if (!targetMarkerRef.current) {
        targetMarkerRef.current = L.marker(tLatLng, { icon: targetIcon }).addTo(
          map
        );
      } else {
        targetMarkerRef.current.setLatLng(tLatLng);
      }

      const pts: L.LatLngExpression[] = [
        [userPos.lat, userPos.lng],
        [targetPos.lat, targetPos.lng],
      ];

      if (!lineRef.current) {
        lineRef.current = L.polyline(pts, {
          color: "#f97316",
          dashArray: "6,8",
          weight: 3,
          opacity: 0.9,
        }).addTo(map);
      } else {
        lineRef.current.setLatLngs(pts);
      }

      const popupHtml = `<div style="text-align:center;">
        <strong>TARGET</strong>
        <div style="font-size:16px;margin-top:4px;">
          ${distance ? distance.toFixed(0) : "---"} m
        </div>
      </div>`;

      targetMarkerRef.current.bindPopup(popupHtml, {
        closeButton: false,
        className: "target-popup",
      });
    } else {
      if (targetMarkerRef.current) {
        targetMarkerRef.current.remove();
        targetMarkerRef.current = null;
      }
      if (lineRef.current) {
        lineRef.current.remove();
        lineRef.current = null;
      }
    }
  }, [targetPos, userPos, distance]);

  const handleRecenter = () => {
    if (!mapRef.current || !userPos) return;
    setIsFollowing(true);
    mapRef.current.flyTo([userPos.lat, userPos.lng], 18, { animate: true });
  };

  const extraStyle = `
    .user-pulse { animation: ping 1.8s infinite; }
    @keyframes ping {
      0% { transform: scale(0.6); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }
    .target-gift {
      filter: drop-shadow(0 6px 12px rgba(0,0,0,0.35));
      animation: bob 1.8s infinite;
    }
    @keyframes bob {
      0% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
      100% { transform: translateY(0); }
    }
  `;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <style>{extraStyle}</style>

      <div
        ref={mapContainerRef}
        style={{ width: "100%", height: "100%", zIndex: 0 }}
      />
      <div className="absolute right-4 top-4 z-[1000] flex flex-col gap-3 pointer-events-auto">
        <button
          onClick={handleRecenter}
          title="Recenter ke posisi saya"
          className="bg-white/95 text-slate-800 p-3 rounded-full border-2 border-slate-200 shadow-lg active:scale-95"
        >
          <Navigation size={18} />
        </button>
      </div>
      {!isFollowing && (
        <button
          onClick={() => setIsFollowing(true)}
          className="absolute left-4 bottom-6 z-[1000] bg-white text-slate-800 px-4 py-2 rounded-full border-2 border-slate-200 shadow-lg text-xs"
        >
          Ikuti Lokasi
        </button>
      )}
    </div>
  );
}