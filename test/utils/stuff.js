export const iteratorToArray = (iterator) => {
    return new Promise((resolve, reject) => {
        const arr = [];
        iterator.on('data', (item) => {
            arr.push(item);
        });
        iterator.on('end', () => {
            resolve(arr);
        });
    });
};
export const delayIterator = (iterator, maxDelay = 5) => {
    return iterator.transform({ transform: (item, done, push) => {
            setTimeout(() => {
                push(item);
                done();
            }, Math.round(Math.random() * maxDelay));
        } });
};
export const equalsUint8Array = (a, b) => {
    if (a.byteLength !== b.byteLength) {
        return false;
    }
    for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
};
