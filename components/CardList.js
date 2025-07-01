import React from 'react';
import { StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list'; // Ganti FlatList dengan FlashList
import Card from './Card';
import { widthPercentageToDP as wp } from 'react-native-responsive-screen'; // Impor untuk responsivitas

const CardList = ({ data, selectedId, onCardPress, onDetailPress, onCommentSubmit, isStarted }) => { 
  return (
    <FlashList
      data={data} 
      renderItem={({ item }) => (
        <Card 
          leaseNo={item.LeaseNo}
          name={item.CustName} 
          address={item.CustAddress} 
          phone={item.PhoneNo}  
          onPress={() => onCardPress(item.LeaseNo)} 
          isSelected={selectedId === item.LeaseNo} 
          onDetailPress={() => onDetailPress(item)} 
          onCommentSubmit={(newComment) => onCommentSubmit(item.LeaseNo, newComment)} 
          isStarted={isStarted} 
          comment={item.comment} 
          isCheckedIn={item.isCheckedIn}
        />
      )}
      keyExtractor={item => item.LeaseNo.toString()}
      estimatedItemSize={100}
    />
  );
};


const styles = StyleSheet.create({

});

export default CardList;