import { Platform } from 'react-native';

export interface MapLinkOption {
  id: string;
  label: string;
  url: string;
}

interface BuildMapLinkOptionsParams {
  address?: string;
  latitude?: number;
  longitude?: number;
  label?: string;
}

const formatCoordinate = (value: number) => value.toFixed(6);

const hasCoordinates = (latitude?: number, longitude?: number) =>
  Number.isFinite(latitude) && Number.isFinite(longitude);

const buildGeoQuery = (params: BuildMapLinkOptionsParams) => {
  if (hasCoordinates(params.latitude, params.longitude)) {
    const lat = formatCoordinate(params.latitude as number);
    const lng = formatCoordinate(params.longitude as number);
    return `${lat},${lng}`;
  }

  return params.address?.trim() ?? '';
};

const buildDeviceMapsUrl = (params: BuildMapLinkOptionsParams) => {
  const pinLabel = params.label?.trim() || 'Pinned Location';
  const query = buildGeoQuery(params);
  if (!query) return '';

  if (hasCoordinates(params.latitude, params.longitude)) {
    const lat = formatCoordinate(params.latitude as number);
    const lng = formatCoordinate(params.longitude as number);

    if (Platform.OS === 'ios') {
      return `http://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(pinLabel)}`;
    }

    if (Platform.OS === 'android') {
      return `geo:0,0?q=${encodeURIComponent(`${lat},${lng}`)}`;
    }

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
  }

  if (Platform.OS === 'ios') {
    return `http://maps.apple.com/?q=${encodeURIComponent(query)}`;
  }

  if (Platform.OS === 'android') {
    return `geo:0,0?q=${encodeURIComponent(query)}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

export const buildMapLinkOptions = (params: BuildMapLinkOptionsParams): MapLinkOption[] => {
  const query = buildGeoQuery(params);
  if (!query) return [];

  const options: MapLinkOption[] = [];
  const coordinatesAvailable = hasCoordinates(params.latitude, params.longitude);
  const lat = coordinatesAvailable ? formatCoordinate(params.latitude as number) : '';
  const lng = coordinatesAvailable ? formatCoordinate(params.longitude as number) : '';
  const encodedQuery = encodeURIComponent(query);
  const googleUrl = coordinatesAvailable
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
  const wazeUrl = coordinatesAvailable
    ? `https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`
    : `https://www.waze.com/ul?q=${encodedQuery}&navigate=yes`;
  const openStreetMapUrl = coordinatesAvailable
    ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`
    : `https://www.openstreetmap.org/search?query=${encodedQuery}`;

  if (Platform.OS === 'ios') {
    options.push({
      id: 'apple',
      label: 'Apple Maps',
      url: buildDeviceMapsUrl(params),
    });
  } else if (Platform.OS === 'android') {
    options.push({
      id: 'device',
      label: 'Device Maps',
      url: buildDeviceMapsUrl(params),
    });
  }

  options.push(
    {
      id: 'google',
      label: 'Google Maps',
      url: googleUrl,
    },
    {
      id: 'waze',
      label: 'Waze',
      url: wazeUrl,
    },
    {
      id: 'osm',
      label: 'OpenStreetMap',
      url: openStreetMapUrl,
    }
  );

  return options;
};

export const formatMapPreview = (params: BuildMapLinkOptionsParams) => {
  if (hasCoordinates(params.latitude, params.longitude)) {
    return `${formatCoordinate(params.latitude as number)}, ${formatCoordinate(params.longitude as number)}`;
  }

  return params.address?.trim() ?? '';
};
