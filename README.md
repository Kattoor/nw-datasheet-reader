# 📄 nw-datasheet-reader 📄

1. `npm install` - you'll need to have a [Python installation](https://www.python.org/downloads/) since I use [ffi-napi](https://www.npmjs.com/package/ffi-napi) (which uses [node-gyp](https://github.com/nodejs/node-gyp)) to automatically create bindings to the Oodle compression DLL.
2. `node nw-datasheet-reader.mjs OUTPUT_FORMAT "PATH_TO_ASSETS"` (currently supported output formats: csv, json)

Example: `node nw-datasheet-reader.mjs csv "C:/Program Files (x86)/Steam/steamapps/common/New World Closed Beta"`
