import { CATEGORY_META, DHAKA_CENTER } from './mapConstants';

export const LEAFLET_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #E9E2D9;
    }
    body.night-mode, body.night-mode #map {
      background: #0B1120;
    }
    body.light-mode .leaflet-tile-pane {
      filter: saturate(65%) brightness(92%) contrast(105%);
    }
    body.light-mode.high-contrast .leaflet-tile-pane {
      filter: saturate(85%) brightness(90%) contrast(120%);
    }
    body.night-mode .leaflet-tile-pane {
      filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
    }
    body.night-mode.high-contrast .leaflet-tile-pane {
      filter: invert(100%) hue-rotate(180deg) brightness(88%) contrast(115%) saturate(1.15);
    }
    .leaflet-control-attribution {
      background: rgba(255, 255, 255, 0.85) !important;
      color: #64748B !important;
      font-size: 9px !important;
      margin-bottom: 76px !important;
      border-top-left-radius: 6px;
    }
    body.night-mode .leaflet-control-attribution {
      background: rgba(19, 28, 49, 0.85) !important;
      color: #94A3B8 !important;
    }
    .leaflet-control-attribution a {
      color: #2563EB !important;
    }
    body.night-mode .leaflet-control-attribution a {
      color: #60A5FA !important;
    }
    .figma-marker-wrap {
      position: relative;
      width: 48px;
      height: 54px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .figma-marker-geofence {
      position: absolute;
      top: 2px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 1.5px dashed var(--pin-color);
      background: color-mix(in srgb, var(--pin-color) 16%, transparent);
      pointer-events: none;
    }
    .figma-marker-teardrop {
      position: relative;
      width: 34px;
      height: 34px;
      border-radius: 50% 50% 50% 6px;
      background: var(--pin-color);
      transform: rotate(-45deg);
      box-shadow: 0 5px 10px rgba(15, 23, 42, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .figma-marker-core {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #FFFFFF;
      transform: rotate(45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--pin-color);
    }
    body.night-mode .figma-marker-core {
      background: #0F172A;
      border: 1.5px solid rgba(255, 255, 255, 0.88);
    }
    .figma-marker-verified {
      position: absolute;
      top: 0;
      right: 2px;
      z-index: 3;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #15803D;
      border: 1.5px solid #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
    }
    .figma-marker-yellow-ring {
      position: absolute;
      top: 0;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: 2px solid #FACC15;
      pointer-events: none;
    }
    .tapped-pin-wrap {
      position: relative;
      width: 44px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .tapped-pin-pulse {
      position: absolute;
      bottom: 2px;
      width: 26px;
      height: 12px;
      border-radius: 50%;
      background: rgba(59, 130, 246, 0.28);
      border: 1.5px solid #3B82F6;
    }
    .tapped-pin-head {
      position: relative;
      z-index: 2;
      width: 34px;
      height: 34px;
      border-radius: 50% 50% 50% 6px;
      background: #3B82F6;
      border: 2px solid #FFFFFF;
      transform: rotate(-45deg);
      box-shadow: 0 6px 14px rgba(37, 99, 235, 0.42);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .tapped-pin-core {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #FFFFFF;
      transform: rotate(45deg);
    }
    .current-loc-dot {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #2563EB;
      border: 3px solid #FFFFFF;
      box-shadow: 0 0 0 8px rgba(37, 99, 235, 0.25);
    }
    @keyframes dangerPulse {
      0% { stroke-opacity: 0.9; fill-opacity: 0.22; }
      50% { stroke-opacity: 0.45; fill-opacity: 0.08; }
      100% { stroke-opacity: 0.9; fill-opacity: 0.22; }
    }
    .danger-radius-ring {
      animation: dangerPulse 2.1s ease-in-out infinite;
    }
  </style>
</head>
<body class="night-mode">
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const CATEGORY_META = ${JSON.stringify(CATEGORY_META)};

    const map = L.map('map', {
      center: [${DHAKA_CENTER.latitude}, ${DHAKA_CENTER.longitude}],
      zoom: 13,
      zoomControl: false,
      attributionControl: true
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    const userDotIcon = L.divIcon({
      className: '',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      html: '<div class="current-loc-dot"></div>'
    });
    const userMarker = L.marker([${DHAKA_CENTER.latitude}, ${DHAKA_CENTER.longitude}], {
      icon: userDotIcon,
      interactive: false
    }).addTo(map);

    const hazardLayer = L.layerGroup().addTo(map);
    const dangerRingsLayer = L.layerGroup().addTo(map);
    const routeLayer = L.layerGroup().addTo(map);
    let tappedPinMarker = null;

    window.renderDangerRings = function(enabled, hazards) {
      dangerRingsLayer.clearLayers();
      if (!enabled || !Array.isArray(hazards)) return;
      hazards.forEach(function(h) {
        if (
          h.severity === 'Critical' &&
          h.status !== 'resolved' &&
          typeof h.latitude === 'number' &&
          typeof h.longitude === 'number'
        ) {
          L.circle([h.latitude, h.longitude], {
            radius: 250,
            color: '#EF4444',
            weight: 2,
            dashArray: '6 5',
            fillColor: '#EF4444',
            fillOpacity: 0.18,
            className: 'danger-radius-ring',
            interactive: false
          }).addTo(dangerRingsLayer);
        }
      });
    };

    const tappedPinIcon = L.divIcon({
      className: '',
      iconSize: [44, 48],
      iconAnchor: [22, 42],
      html:
        '<div class="tapped-pin-wrap">' +
          '<span class="tapped-pin-pulse"></span>' +
          '<div class="tapped-pin-head">' +
            '<div class="tapped-pin-core"></div>' +
          '</div>' +
        '</div>'
    });

    window.clearTappedPin = function() {
      if (tappedPinMarker) {
        map.removeLayer(tappedPinMarker);
        tappedPinMarker = null;
      }
    };

    window.placeTappedPin = function(lat, lng) {
      window.clearTappedPin();
      tappedPinMarker = L.marker([lat, lng], {
        icon: tappedPinIcon,
        interactive: false
      }).addTo(map);
    };

    window.clearSafeRoute = function() {
      routeLayer.clearLayers();
    };

    window.renderSafeRoute = function(coords) {
      routeLayer.clearLayers();
      if (!Array.isArray(coords) || coords.length < 2) return;

      L.polyline(coords, {
        color: '#34D399',
        weight: 11,
        opacity: 0.28,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(routeLayer);

      const mainLine = L.polyline(coords, {
        color: '#10B981',
        weight: 6,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(routeLayer);

      try {
        map.fitBounds(mainLine.getBounds(), {
          paddingTopLeft: [48, 175],
          paddingBottomRight: [48, 250],
          maxZoom: 16,
          animate: true
        });
      } catch (e) {}
    };

    window.renderRouteOptions = function(routes, selectedId, shouldFitBounds) {
      routeLayer.clearLayers();
      if (!Array.isArray(routes) || routes.length === 0) return;

      const allLatLngs = [];

      // First pass: draw unselected alternative routes underneath
      routes.forEach(function(route) {
        if (!Array.isArray(route.coordinates) || route.coordinates.length < 2) return;
        route.coordinates.forEach(function(pt) {
          allLatLngs.push(pt);
        });
        if (route.id === selectedId) return;

        const isSafest = route.id === 'safest' || route.label === 'Safest Route';
        const altColor = isSafest
          ? '#10B981'
          : (route.riskScore > 0 ? '#F59E0B' : '#3B82F6');

        L.polyline(route.coordinates, {
          color: altColor,
          weight: 4,
          opacity: 0.45,
          dashArray: '8 6',
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(routeLayer);
      });

      // Second pass: draw active selected route on top with glow
      const selectedRoute =
        routes.find(function(r) { return r.id === selectedId; }) || routes[0];

      if (selectedRoute && Array.isArray(selectedRoute.coordinates) && selectedRoute.coordinates.length >= 2) {
        const isSafest =
          selectedRoute.id === 'safest' || selectedRoute.label === 'Safest Route';
        const mainColor = isSafest
          ? '#10B981'
          : (selectedRoute.riskScore > 0 ? '#F59E0B' : '#3B82F6');
        const glowColor = isSafest
          ? '#34D399'
          : (selectedRoute.riskScore > 0 ? '#FBBF24' : '#60A5FA');

        L.polyline(selectedRoute.coordinates, {
          color: glowColor,
          weight: 12,
          opacity: 0.28,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(routeLayer);

        L.polyline(selectedRoute.coordinates, {
          color: mainColor,
          weight: 6,
          opacity: 0.96,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(routeLayer);
      }

      if (shouldFitBounds && allLatLngs.length >= 2) {
        try {
          const bounds = L.latLngBounds(allLatLngs);
          map.fitBounds(bounds, {
            paddingTopLeft: [48, 185],
            paddingBottomRight: [48, 275],
            maxZoom: 16,
            animate: true
          });
        } catch (e) {}
      }
    };

    window.updateUserLocation = function(lat, lng) {
      if (typeof lat === 'number' && typeof lng === 'number') {
        userMarker.setLatLng([lat, lng]);
      }
    };

    window.setMapTheme = function(isNight, isHighContrast) {
      document.body.classList.toggle('night-mode', !!isNight);
      document.body.classList.toggle('light-mode', !isNight);
      document.body.classList.toggle('high-contrast', !!isHighContrast);
    };

    window.recenterDhaka = function() {
      map.setView([${DHAKA_CENTER.latitude}, ${DHAKA_CENTER.longitude}], 13, { animate: true });
      userMarker.setLatLng([${DHAKA_CENTER.latitude}, ${DHAKA_CENTER.longitude}]);
    };

    window.focusHazard = function(lat, lng) {
      map.setView([lat, lng], 15, { animate: true });
    };

    window.renderHazards = function(hazards) {
      hazardLayer.clearLayers();
      if (!Array.isArray(hazards)) return;

      hazards.forEach(function(h) {
        if (typeof h.latitude !== 'number' || typeof h.longitude !== 'number') return;
        const meta = CATEGORY_META[h.category] || CATEGORY_META.pothole_manhole;
        const color = meta.color;
        const isVerified = h.status === 'crowd_verified' || (typeof h.confirmations === 'number' && h.confirmations >= 3);
        const showYellowRing = h.category === 'pothole_manhole' || isVerified;
        const yellowRingHtml = showYellowRing
          ? '<div class="figma-marker-yellow-ring"></div>'
          : '';
        const verifiedHtml = isVerified
          ? '<div class="figma-marker-verified"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>'
          : '';

        const icon = L.divIcon({
          className: '',
          iconSize: [48, 54],
          iconAnchor: [24, 48],
          html:
            '<div class="figma-marker-wrap" style="--pin-color:' + color + ';">' +
              '<div class="figma-marker-geofence"></div>' +
              yellowRingHtml +
              '<div class="figma-marker-teardrop">' +
                '<div class="figma-marker-core">' +
                  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                    meta.svgPath +
                  '</svg>' +
                '</div>' +
              '</div>' +
              verifiedHtml +
            '</div>'
        });

        const marker = L.marker([h.latitude, h.longitude], { icon: icon }).addTo(hazardLayer);

        marker.on('click', function(ev) {
          if (ev && ev.originalEvent) {
            ev.originalEvent.stopPropagation();
          }
          window.clearTappedPin();
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'select',
              id: h.id
            }));
          }
        });
      });
    };

    map.on('moveend', function() {
      const c = map.getCenter();
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'region',
          latitude: c.lat,
          longitude: c.lng
        }));
      }
    });

    function postMapTap(latlng) {
      window.placeTappedPin(latlng.lat, latlng.lng);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'mapTap',
          latitude: latlng.lat,
          longitude: latlng.lng
        }));
      }
    }

    map.on('contextmenu', function(e) {
      postMapTap(e.latlng);
    });

    map.on('click', function(e) {
      postMapTap(e.latlng);
    });
  </script>
</body>
</html>`;
