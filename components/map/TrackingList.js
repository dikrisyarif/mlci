import React from "react";
import { FlatList } from "react-native";
import TrackingItem from "./TrackingItem";

export default function TrackingList({ data }) {
  return (
    <FlatList
      data={data}
      keyExtractor={(item, idx) => idx.toString()}
      renderItem={({ item }) => <TrackingItem item={item} />}
    />
  );
}
