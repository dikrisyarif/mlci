export async function syncCheckinBatch(list, config) {
  const {
    save,
    updateStatus,
    contractFlag,
    batchSize,
    retry,
    delay,
    markUploaded,
  } = config;

  let successIds = [];

  for (let i = 0; i < list.length; i += batchSize) {
    const batch = list.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (checkin) => {
        let attempts = 0;

        while (attempts < retry) {
          try {
            const payload = {
              EmployeeName: checkin.employee_name,
              Lattitude: checkin.latitude,
              Longtitude: checkin.longitude,
              CreatedDate: checkin.timestamp,
              tipechekin: checkin.lease_no ? 'kontrak' : 'tracking',
              LeaseNo: checkin.lease_no,
              Comment: checkin.comment,
              Address: checkin.address || '',
            };

            const response = await save(payload);

            if (response?.Status === 1) {
              // update local DB & contract flag
              if (checkin.lease_no) {
                await updateStatus({
                  EmployeeName: checkin.employee_name,
                  LeaseNo: checkin.lease_no,
                  Comment: checkin.comment,
                  Latitude: checkin.latitude,
                  Longitude: checkin.longitude,
                  CheckIn: checkin.timestamp,
                });

                await contractFlag(checkin.lease_no, {
                  isCheckedIn: true,
                  comment: checkin.comment,
                  CheckIn: checkin.timestamp,
                });
              }

              successIds.push(checkin.id);
              console.log(`[SYNC] Checkin uploaded successfully: id=${checkin.id}`);
              break;
            } else {
              throw new Error('Invalid API response');
            }
          } catch (err) {
            attempts++;
            console.warn(`[SYNC] Checkin ${checkin.id} attempt ${attempts} failed, retrying...`);
            if (attempts < retry) await new Promise(r => setTimeout(r, delay));
          }
        }
      })
    );

    // mark uploaded in DB after batch
    if (successIds.length > 0) {
      await markUploaded(successIds);
      console.log(`[SYNC] Marked uploaded ids: ${successIds.join(',')}`);
      successIds = [];
    }
  }
}
