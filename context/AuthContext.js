import React, { createContext, useReducer, useContext } from 'react';
import * as SecureStore from 'expo-secure-store';

const AuthContext = createContext();

const authReducer = (prevState, action) => {
  switch (action.type) {
    case 'SIGN_IN':
      return {
        ...prevState,
        isSignout: false,
        userToken: action.token,
        userInfo: action.userInfo,
      };
    case 'SIGN_OUT':
      return {
        ...prevState,
        isSignout: true,
        userToken: null,
        userInfo: null,
      };
    default:
      return prevState;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, {
    isLoading: true,
    userToken: null,
    userInfo: null,
  });

  const signIn = async (token, userInfo) => {
    await SecureStore.setItemAsync('userToken', token);
    await SecureStore.setItemAsync('userInfo', JSON.stringify(userInfo));
    dispatch({ type: 'SIGN_IN', token, userInfo });
  };

  const signOut = async () => {
    await SecureStore.deleteItemAsync('userToken');
    await SecureStore.deleteItemAsync('userInfo');
    dispatch({ type: 'SIGN_OUT' });
  };

  return (
    <AuthContext.Provider value={{ state, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
