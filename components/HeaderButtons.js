import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import StartEndButton from './StartEndButton';

export const HeaderButtons = ({ 
  isStarted, 
  onStartStopPress, 
  onMapPress, 
  onThemeToggle, 
  theme, 
  colors,
  checkinLocations,
  navigation
}) => (
  <View style={{
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: '5%',
  }}>
    <StartEndButton 
      isStarted={isStarted} 
      onPress={onStartStopPress}
      checkinLocations={checkinLocations}
    />
    
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <TouchableOpacity
        style={[{
          padding: 8,
          borderRadius: 8,
          backgroundColor: 'transparent',
          marginRight: 10
        }]}
        onPress={onMapPress}
      >
        <Icon name="my-location" size={24} color={colors.textblue} />
      </TouchableOpacity>

      <TouchableOpacity 
        style={{ marginLeft: '2%' }}
        onPress={onThemeToggle}
      >
        <Icon 
          name={theme === 'light' ? 'light-mode' : 'dark-mode'} 
          size={24} 
          color={colors.text} 
        />
      </TouchableOpacity>
    </View>
  </View>
);