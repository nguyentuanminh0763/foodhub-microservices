// ============================================================================
// TODO (YOU CODE THIS) — Mongoose schema
// ----------------------------------------------------------------------------
// Định nghĩa schema cho nhà hàng + menu. MongoDB hợp ở đây vì menu lồng nhau,
// hình dạng linh hoạt. Gợi ý cấu trúc:
//   Restaurant { name, address, isOpen, dishes: [ { name, price, available } ] }
// Dùng new mongoose.Schema({...}) rồi mongoose.model("Restaurant", schema).
//
// Câu hỏi tự kiểm tra: vì sao Order service KHÔNG được đọc thẳng MongoDB này,
// mà phải gọi API của restaurant-service? (gợi ý: database-per-service)
// ============================================================================
const mongoose = require("mongoose");

// const restaurantSchema = new mongoose.Schema({ ... });
// module.exports = mongoose.model("Restaurant", restaurantSchema);
