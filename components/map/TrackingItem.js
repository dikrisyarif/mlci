import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function TrackingItem({ item }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{item.LabelMap}</Text>
      <Text style={styles.small}>
        {item.Lattitude}, {item.Longtitude}
      </Text>
      <Text style={styles.small}>{item.CheckinDate}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    padding: 10,
    borderBottomWidth: 1,
    borderColor: "#ccc",
  },
  label: {
    fontWeight: "bold",
    fontSize: 16,
  },
  small: {
    fontSize: 12,
    color: "#666",
  },
});
