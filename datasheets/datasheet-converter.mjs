import {promises as fs} from 'fs';
import {globby} from 'globby';

const amountOfColumnsOffset = 0x44;
const amountOfRowsOffset = 0x48;
const headersOffset = 0x5c;
const amountOfBytesInHeader = 12;
const amountOfBytesInCell = 8;

export async function convertDatasheets(path, format) {
    const start = Date.now();

    const filePaths = await globby(path + '**/*.datasheet');

    process.stdout.write('Converting datasheets..\r');

    for (let filePath of filePaths) {
        const data = await fs.readFile(filePath);

        const amountOfColumns = data.readInt32LE(amountOfColumnsOffset);
        const amountOfRows = data.readInt32LE(amountOfRowsOffset);

        const cellsOffset = headersOffset + amountOfColumns * amountOfBytesInHeader;
        const amountOfBytesInRow = amountOfBytesInCell * amountOfColumns;
        const stringsOffset = cellsOffset + amountOfRows * amountOfColumns * amountOfBytesInCell;

        const headers = [];
        for (let i = 0; i < amountOfColumns; i++) {
            const headerOffset = headersOffset + i * amountOfBytesInHeader;
            const stringValue = readStringValue(data, headerOffset);
            const text = readCString(data, stringsOffset, stringValue.stringOffset);
            const type = data.readInt32LE(headerOffset + 8);
            headers.push({text, type});
        }

        const rows = [];
        for (let i = 0; i < amountOfRows; i++) {
            const cells = [];
            for (let j = 0; j < amountOfColumns; j++) {
                const cellOffset = cellsOffset + i * amountOfBytesInRow + j * amountOfBytesInCell;
                const cellValue = readCell(data, cellOffset);
                const columnType = headers[j].type;
                const value = parseCellValueToType(data, stringsOffset, cellValue, columnType);
                cells.push(value);
            }
            rows.push(cells);
        }

        const output = toOutputFormat(format, headers, rows);

        await saveFile(filePath.slice(0, -9) + format, output);
        await fs.unlink(filePath);
    }

    console.log('Converting datasheets.. finished in ' + (Date.now() - start) + 'ms');
}

function readCString(data, stringsOffset, value) {
    const offset = stringsOffset + value.readInt32LE(0);
    let lengthUntilNullTermination = 0;
    let nextByte;
    do {
        nextByte = data.readInt8(offset + lengthUntilNullTermination++);
    } while (nextByte !== 0)
    if (lengthUntilNullTermination === 1) {
        return null;
    }
    return data.slice(offset, offset + lengthUntilNullTermination - 1).toString();
}

function parseCellValueToType(data, stringsOffset, cellValue, type) {
    switch (type) {
        case 1:
            return readCString(data, stringsOffset, cellValue);
        case 2:
            return cellValue.readFloatLE(0);
        case 3:
            return !!cellValue.readInt32LE(0);
    }
}

function readCell(data, offset) {
    const stringOffset = data.readInt32LE(offset);
    const cellValue = data.slice(offset + 4, offset + 8);
    return cellValue;
}

function readStringValue(data, offset) {
    const hash = data.slice(offset, offset + 4);
    const stringOffset = data.slice(offset + 4, offset + 8);
    return {hash, stringOffset};
}

function handleInnerComma(text) {
    if (typeof text !== 'string') {
        return text;
    }

    if (text.includes(',')) {
        return `"${text}"`;
    } else {
        return text;
    }
}

function toOutputFormat(format, headers, rows) {
    switch (format) {
        case 'csv':
            return toCsv(headers, rows);
        case 'json':
            return toJson(headers, rows);
    }
}

function toCsv(headers, rows) {
    return [
        headers.map(header => handleInnerComma(header.text)).join(','),
        ...rows.map(cells => cells.map(handleInnerComma).join(','))
    ].join('\n');
}

function toJson(headers, rows) {
    const records = rows.map(row => {
        const record = {};
        for (let i = 0; i < headers.length; i++) {
            const key = headers[i].text;
            const value = row[i];
            if (value != null) {
                record[key] = value;
            }
        }
        return record;
    });
    return JSON.stringify(records);
}

async function saveFile(path, out) {
    const directory = path.slice(0, path.lastIndexOf('/'));
    await fs.mkdir(directory, {recursive: true});
    await fs.writeFile(path, out);
}
