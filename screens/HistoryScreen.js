// import React, { useEffect, useState } from 'react';
// import { View, Text, StyleSheet, ScrollView } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import * as Database from '../utils/database';
// import { getLocalTrackings } from '../utils/map/trackingDB';

// const getLast7Days = () => {
//   const days = [];
//   for (let i = 6; i >= 0; i--) {
//     const d = new Date();
//     d.setDate(d.getDate() - i);
//     days.push({
//       date: d,
//       key: d.toISOString().slice(0, 10),
//       label: d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
//     });
//   }
//   return days;
// };

// const HistoryScreen = () => {
//   const [summary, setSummary] = useState([]);
//   const [totalAssigned, setTotalAssigned] = useState(0);
//   const [totalCheckin, setTotalCheckin] = useState(0);
//   const [totalFailed, setTotalFailed] = useState(0);
//   const [percentSuccess, setPercentSuccess] = useState(0);
//   const [fastestCheckin, setFastestCheckin] = useState(null);
//   const [slowestCheckin, setSlowestCheckin] = useState(null);
//   const [uncheckinContracts, setUncheckinContracts] = useState([]);

//   useEffect(() => {
//     const loadHistory = async () => {
//       const employeeName = null; // summary across employees
//       const rows = await getLocalTrackings(employeeName);
//       const checkins = rows.map(r => ({
//         timestamp: r.checkin_date,
//         contractId: r.lease_no,
//         contractName: r.cust_name,
//       }));
//       const contracts = await Database.getContracts(null) || [];
//       const days = getLast7Days();
//       let totalAssigned = 0, totalCheckin = 0, totalFailed = 0;
//       let fastest = null, slowest = null;
//       let uncheckin = [];
//       const summary = days.map(day => {
//         const contractsPerDay = contracts.filter(c => {
//           const due = c.DueDate ? c.DueDate.slice(0, 10) : '';
//           return due === day.key;
//         });
//         const checkinPerDay = checkins.filter(c => {
//           const ts = c.timestamp ? c.timestamp.slice(0, 10) : '';
//           return ts === day.key;
//         });
//         checkinPerDay.forEach(c => {
//           if (!fastest || c.timestamp < fastest.timestamp) fastest = c;
//           if (!slowest || c.timestamp > slowest.timestamp) slowest = c;
//         });
//         const failed = contractsPerDay.filter(c => {
//           return !checkinPerDay.some(ch => ch.contractId === c.LeaseNo);
//         });
//         if (day.key === days[days.length-1].key) uncheckin = failed;
//         totalAssigned += contractsPerDay.length;
//         totalCheckin += checkinPerDay.length;
//         totalFailed += failed.length;
//         return {
//           ...day,
//           assigned: contractsPerDay.length,
//           checkin: checkinPerDay.length,
//           failed: failed.length,
//         };
//       });
//       setSummary(summary);
//       setTotalAssigned(totalAssigned);
//       setTotalCheckin(totalCheckin);
//       setTotalFailed(totalFailed);
//       setPercentSuccess(totalAssigned ? Math.round((totalCheckin/totalAssigned)*100) : 0);
//       setFastestCheckin(fastest);
//       setSlowestCheckin(slowest);
//       setUncheckinContracts(uncheckin);
//     };
//     loadHistory();
//   }, []);

//   return (
//     <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f8fa' }}>
//       <View style={styles.container}>
//         <Text style={styles.title}>📊 Summary Mingguan</Text>
//         <View style={styles.summaryBox}>
//           <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Total Kontrak Ditugaskan</Text><Text style={styles.summaryValue}>{totalAssigned}</Text></View>
//           <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Total Berhasil Check-in</Text><Text style={[styles.summaryValue, { color: '#28a745' }]}>{totalCheckin}</Text></View>
//           <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Total Gagal Check-in</Text><Text style={[styles.summaryValue, { color: '#dc3545' }]}>{totalFailed}</Text></View>
//           <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Persentase Sukses</Text><Text style={styles.summaryValue}>{percentSuccess}%</Text></View>
//           {fastestCheckin && (
//             <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Check-in Tercepat</Text><Text style={styles.summaryValue}>{fastestCheckin.timestamp?.slice(0,16)} ({fastestCheckin.contractName})</Text></View>
//           )}
//           {slowestCheckin && (
//             <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Check-in Terlambat</Text><Text style={styles.summaryValue}>{slowestCheckin.timestamp?.slice(0,16)} ({slowestCheckin.contractName})</Text></View>
//           )}
//         </View>
//         <Text style={styles.title}>📅 Summary Per Hari</Text>
//         <ScrollView contentContainerStyle={styles.daySummaryContainer}>
//           {summary.map(day => (
//             <View key={day.key} style={styles.dayBox}>
//               <Text style={styles.dayLabel}>{day.label}</Text>
//               <View style={styles.dayRow}><Text>Ditugaskan</Text><Text>{day.assigned}</Text></View>
//               <View style={styles.dayRow}><Text>Check-in</Text><Text style={{ color: '#28a745' }}>{day.checkin}</Text></View>
//               <View style={styles.dayRow}><Text>Gagal</Text><Text style={{ color: '#dc3545' }}>{day.failed}</Text></View>
//             </View>
//           ))}
//         </ScrollView>
//         {uncheckinContracts.length > 0 && (
//           <View style={styles.uncheckinBox}>
//             <Text style={styles.title}>⚠️ Kontrak Belum Check-in Hari Ini</Text>
//             {uncheckinContracts.map((c, idx) => (
//               <Text key={idx} style={styles.uncheckinText}>{c.CustName} ({c.LeaseNo})</Text>
//             ))}
//           </View>
//         )}
//       </View>
//     </SafeAreaView>
//   );
// };

// const styles = StyleSheet.create({
//   container: { padding: 16 },
//   title: { fontSize: 20, fontWeight: 'bold', marginVertical: 16, color: '#222' },
//   summaryBox: {
//     backgroundColor: '#fff',
//     borderRadius: 16,
//     padding: 18,
//     marginBottom: 20,
//     elevation: 3,
//     shadowColor: '#000',
//     shadowOpacity: 0.08,
//     shadowRadius: 8,
//     shadowOffset: { width: 0, height: 2 },
//   },
//   summaryRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     marginBottom: 8,
//   },
//   summaryLabel: {
//     fontWeight: '600',
//     color: '#555',
//     fontSize: 15,
//   },
//   summaryValue: {
//     fontWeight: 'bold',
//     fontSize: 15,
//     color: '#222',
//   },
//   daySummaryContainer: {
//     flexDirection: 'column',
//     gap: 10,
//   },
//   dayBox: {
//     backgroundColor: '#f8f9fa',
//     borderRadius: 12,
//     padding: 14,
//     marginBottom: 10,
//     elevation: 1,
//     shadowColor: '#000',
//     shadowOpacity: 0.04,
//     shadowRadius: 4,
//     shadowOffset: { width: 0, height: 1 },
//   },
//   dayLabel: { fontWeight: 'bold', marginBottom: 6, fontSize: 15, color: '#007bff' },
//   dayRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     marginBottom: 2,
//   },
//   uncheckinBox: {
//     backgroundColor: '#fff3cd',
//     borderRadius: 12,
//     padding: 14,
//     marginTop: 20,
//     borderWidth: 1,
//     borderColor: '#ffeeba',
//   },
//   uncheckinText: {
//     color: '#d9534f',
//     fontWeight: 'bold',
//     marginTop: 2,
//   },
// });

// export default HistoryScreen;
import { Text, View, StyleSheet, Image } from 'react-native';

const  HistoryScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.paragraph}>
        Soon
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, 
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    paddingTop: 30,
  },
  paragraph: { 
    margin: 24,
    marginTop: 0,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    alignItems: 'center'
  },
  logo: {
    height: 128,
    width: 128,
  }
});
export default HistoryScreen;