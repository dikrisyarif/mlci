import Constants from 'expo-constants';

export const GOOGLE_MAPS_APIKEY = Constants.expoConfig?.extra?.GOOGLE_MAPS_APIKEY || process.env.GOOGLE_MAPS_APIKEY;
