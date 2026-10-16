## Máy làm được gì
- **Máy hiện sóng mini**: xem dạng sóng điện áp và dòng điện của tải theo thời gian thực
- **Đồng hồ đo công suất**: V, A, W, mAh, Wh, thời gian chạy, điện trở tải, đồ thị 60 giây
- **Đo tần số / độ rộng xung** trên chân GPIO7 (khoảng 0,2 Hz đến 100 kHz)
- **Cảnh báo bất thường**: dòng tăng vọt, sụt áp / quá áp, cắm / rút tải, chip nóng
- **Phát GIF / ảnh qua WiFi** khi không đo

## Lần đầu sử dụng
1. Nối mạch theo **Sơ đồ chân**, cấp nguồn USB cho ESP32-S3.
2. Màn hình hiện logo rồi vào chế độ **Máy hiện sóng**.
3. Nối tải cần đo qua 2 chân **VIN+ / VIN−** của module INA219 (đo phía dương nguồn).
4. **Giữ B2** để chuyển vòng: Máy hiện sóng → Đồng hồ đo → Cài đặt → GIF.

## Máy hiện sóng
- **Nhấn B1 / B2**: giảm / tăng giá trị đang chọn
- **Giữ B1**: chọn thông số kế tiếp (V/div, I/div, T/div, lệch V, lệch I, MEAS, RUN/HOLD)
- **Giữ B2**: sang Đồng hồ đo
- Ô **M:** chọn nguồn đo: **V** (sóng điện áp), **I** (sóng dòng điện), **PIN** (xung số trên GPIO7)

## Đồng hồ đo công suất
- **Nhấn B1**: đổi đồ thị 60 giây (điện áp / dòng điện / công suất)
- **Nhấn B2**: tạm dừng / tiếp tục đếm mAh, Wh, thời gian
- **Giữ B1**: xoá bộ đếm
- **Giữ B2**: sang Cài đặt

## Cài đặt
- **Nhấn B1**: mục kế tiếp, **nhấn B2**: tăng / đổi giá trị, **giữ B1**: giảm giá trị
- **Giữ B2**: lưu và sang chế độ GIF
- Có: độ sáng, tự giảm sáng / tắt màn khi rảnh, xoay màn 180°, chế độ khi mở máy, hiệu chỉnh V / I, đặt 0 dòng, màu màn hình, khôi phục mặc định

## Gửi GIF / ảnh
1. Ở chế độ GIF, điện thoại vào WiFi **ESP32-GIF** (không mật khẩu).
2. Mở **192.168.4.1**, chọn GIF / video / ảnh rồi bấm gửi. Trang tự thu nhỏ về 320×240.
3. Có WiFi nhà (cài trên trang web): mở bằng IP hiện trên màn hoặc **maydo.local**.
4. **Giữ B2** để quay lại máy hiện sóng.

## Lưu ý an toàn
- Chân **GPIO7** chỉ nhận tín hiệu **0 – 3,3V**, không đưa 5V trực tiếp vào
- INA219 đo được điện áp tới khoảng **26V**; không đo điện lưới 220V
- Nối chung **GND** giữa mạch cần đo và máy đo
