"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
exports.addTodo = addTodo;
exports.getUserTodos = getUserTodos;
exports.isUpdateProcessed = isUpdateProcessed;
exports.markUpdateProcessed = markUpdateProcessed;
exports.incrementProUsage = incrementProUsage;
var supabase_js_1 = require("@supabase/supabase-js");
exports.supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
function addTodo(task, dueDate, userId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, exports.supabase.from('todos').insert([{ title: task, due_date: dueDate, user_id: userId, status: 'open' }])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function getUserTodos(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error, e_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, exports.supabase
                            .from('todos')
                            .select('*')
                            .eq('user_id', userId)
                            .eq('status', 'open')
                            .order('due_date', { ascending: true })
                            .limit(30)];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    return [2 /*return*/, data || []];
                case 2:
                    e_1 = _b.sent();
                    console.error("Error fetching todos", e_1);
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function isUpdateProcessed(updateId) {
    return __awaiter(this, void 0, void 0, function () {
        var data, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, exports.supabase.from('processed_updates').select('update_id').eq('update_id', updateId).single()];
                case 1:
                    data = (_b.sent()).data;
                    return [2 /*return*/, !!data];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function markUpdateProcessed(updateId) {
    return __awaiter(this, void 0, void 0, function () {
        var e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, exports.supabase.from('processed_updates').insert([{ update_id: updateId }])];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    e_2 = _a.sent();
                    console.error("Failed to mark update", e_2);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// 🚀 [جديد] عداد الباقة الذكي لموديل Pro
function incrementProUsage() {
    return __awaiter(this, void 0, void 0, function () {
        var today, _a, data, error, newCount, e_3;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 6, , 7]);
                    today = new Date().toISOString().split('T')[0];
                    return [4 /*yield*/, exports.supabase
                            .from('api_usage')
                            .select('pro_requests')
                            .eq('date', today)
                            .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (!!data) return [3 /*break*/, 3];
                    // أول رسالة اليوم
                    return [4 /*yield*/, exports.supabase.from('api_usage').insert([{ date: today, pro_requests: 1 }])];
                case 2:
                    // أول رسالة اليوم
                    _b.sent();
                    return [2 /*return*/, 1];
                case 3:
                    newCount = data.pro_requests + 1;
                    return [4 /*yield*/, exports.supabase.from('api_usage').update({ pro_requests: newCount }).eq('date', today)];
                case 4:
                    _b.sent();
                    return [2 /*return*/, newCount];
                case 5: return [3 /*break*/, 7];
                case 6:
                    e_3 = _b.sent();
                    console.error("Usage Tracking Error:", e_3);
                    return [2 /*return*/, 0]; // في حالة الخطأ، نمررها برقم 0 لكي لا يتعطل البوت
                case 7: return [2 /*return*/];
            }
        });
    });
}
