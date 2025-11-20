export async function syncTrackingBatch(list, config) {
  const {
    save,
    batchSize,
    retry,
    delay,
    markUploaded,
  } = config;

  let successIds = [];

  for (let i = 0; i < list.length; i += batchSize) {
    const batch = list.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (track) => {
        let attempts = 0;

        while (attempts < retry) {
          try {
            await save({
              EmployeeName: track.employee_name,
              Lattitude: track.latitude,
              Longtitude: track.longitude,
              CreatedDate: track.timestamp,
              tipechekin: 'background',
            });

            successIds.push(track.id);
            break;
          } catch {
            attempts++;
            if (attempts < retry) await new Promise(r => setTimeout(r, delay));
          }
        }
      })
    );

    if (successIds.length > 0) {
      await markUploaded(successIds);
      successIds = [];
    }
  }
}
