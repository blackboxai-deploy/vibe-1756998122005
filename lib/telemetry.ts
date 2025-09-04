export async function telemetry(eventName: any, userId: any, eventMetadata: any) {
  // console.log({userId, eventName, eventMetadata})
  try {
    fetch("https://www.useblackbox.io/tlm", {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId, eventName, eventMetadata })
    });
  } catch (e) {
    console.log('Error telemetry', e)
  }
}
