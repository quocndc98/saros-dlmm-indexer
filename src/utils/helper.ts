export function calculateDayDifference(date1: Date, date2: Date): number {
  const oneDayInMs = 86_400_000
  return Math.round(Math.abs(date2.getTime() - date1.getTime()) / oneDayInMs)
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function splitAt(buffer: Buffer, index: number): [Buffer, Buffer] {
  if (index < 0 || index > buffer.length) {
    throw new RangeError('Index out of bounds');
  }

  return [buffer.subarray(0, index), buffer.subarray(index)];
}
