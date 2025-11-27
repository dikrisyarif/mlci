import { getLocalTrackings } from "../../utils/map/trackingDB";

export async function loadTrackingData(employeeName) {
  console.log(`[trackingService] Fetching tracking for: ${employeeName}`);

  try {
    const rows = await getLocalTrackings(employeeName);

    if (!rows.length) {
      const result = {
        Status: 0,
        Message: "Get Record By EmployeeName data not found.",
        Data: null,
      };
      console.log("[trackingService] Final result:", result);
      return result;
    }

    const mapped = rows.map(r => ({
      EmployeeName: r.employee_name,
      LeaseNo: r.lease_no || "",
      CustName: r.cust_name || "",
      LabelMap: r.label_map,
      Lattitude: String(r.latitude),
      Longtitude: String(r.longitude),
      CheckinDate: r.checkin_date,
    }));

    const result = {
      Status: 1,
      Message: "Success",
      Data: mapped,
    };
    console.log("[trackingService] Final result:", result);
    return result;
  } catch (err) {
    const result = {
      Status: 0,
      Message: err.message,
      Data: null,
    };
    console.log("[trackingService] Final result:", result);
    return result;
  }
}
