import _ from 'lodash';

export function humanReadableDuration(ms: number): string {
    const sec = Math.ceil(ms / 1000);
    const leftoverMs = ms % 1000;
    const min = Math.ceil(sec / 60);
    const leftoverSec = sec % 60;
    if (min > 1) {
        return `${min}m ${leftoverSec}s`;
    }
    return `${sec}s`;
}

export class Stopwatch {
    private startTime = Date.now();
    private splitTimes: number[] = [];

    splitTime(): number {
        const now = Date.now();
        const lastSplit = this.previousSplit();
        this.splitTimes.push(now);
        return now - lastSplit;
    }

    totalDuration(): number {
        const now = Date.now();
        return now - this.startTime;
    }

    private previousSplit(): number | undefined {
        return _.last(this.splitTimes) || this.startTime;
    }
}
