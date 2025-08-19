"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeTgAccountPath = makeTgAccountPath;
// MyRedis.js
function makeTgAccountPath(registerId) {
    return "tg:register:".concat(registerId);
}
