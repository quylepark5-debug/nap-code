## Lần đầu sử dụng
1. Cắm nguồn USB cho mạch. Màn hình hiện logo rồi hiện **thông tin WiFi**.
2. Trên điện thoại, vào **Cài đặt WiFi**, kết nối mạng **ESP32-GIF**, mật khẩu **12345678**.
3. Mở trình duyệt (Chrome, Safari…), vào địa chỉ **192.168.4.1**.
4. Bấm **Chọn ảnh / GIF / video**, chọn file. Video được tự đổi thành GIF (chọn số hình/giây và độ dài tối đa ngay trên trang).
5. Bấm **Gửi sang ESP32**. Màn hình phát lặp lại liên tục, tắt máy mở lại vẫn còn.

## Nút bấm (3 nút)
- **Nhấn B2**: màn sau, **nhấn B1**: màn trước: **GIF → Đồng hồ + thời tiết → Lịch** (chuyển ngay, không chờ)
- Ở màn **Lịch**: **giữ B1** = tháng trước, **giữ B2** = tháng sau
- **Nhấn B3 hai lần liền**: xem thông tin WiFi (bấm nút bất kỳ để tắt)
- **Giữ B3** (khoảng 1 giây): vào **Cài đặt**
- Trong Cài đặt: **B1** tăng, **B2** giảm (giữ để chạy nhanh), **B3** xuống mục dưới
- **Giữ B3**: lưu và thoát

## Cài đặt
- **Màu có sẵn**, **Đèn nền**, **Lạnh – Ấm**, **Bão hoà**, **Tương phản**, **Gamma**
- **Đảo màu** / **Đổi đỏ-xanh**: bật nếu màn hiện sai màu
- **Logo bật máy**: Mặc định, Của bạn, hoặc Tắt
- **Màn chính**: GIF hoặc Đồng hồ (màn hiện khi bật máy)
- **Thời tiết**: bao lâu lấy thời tiết mới 1 lần (1, 2, 3, 4, 5, 6, 12, 24 giờ)
- **Nền đồng hồ**: Ảnh theo ngày, Ảnh của bạn, Đêm sao, Hoàng hôn, Rừng sương, Đại dương, Tối giản
- **Thông tin WiFi**: xem tên WiFi, mật khẩu, địa chỉ IP ở khung bên trái
- **So sánh**: chia đôi ảnh mẫu, trái màu gốc, phải màu đã chỉnh

## Đồng hồ + thời tiết
1. Cài **WiFi nhà** trước (mục bên dưới). Đồng hồ tự lấy giờ chuẩn qua mạng.
2. Trên trang 192.168.4.1, mở mục **Đồng hồ & thời tiết**, chọn **tỉnh / thành phố** (hoặc tự nhập vĩ độ, kinh độ).
3. Chọn **Lấy thời tiết mỗi** 1–24 giờ, bấm **Lưu**.
4. Màn hình hiện giờ, thứ, ngày, nhiệt độ, trời nắng/mưa, độ ẩm, gió, khả năng mưa và dự báo ngày mai.

## Nền màn đồng hồ
- **Ảnh theo ngày** (mặc định): có WiFi nhà, máy **tự tải ảnh mới mỗi ngày** làm nền.
- **Ảnh của bạn**: trên trang 192.168.4.1 mở mục **Nền đồng hồ**, chọn ảnh, bấm **Lưu ảnh nền vào ESP32**.
- Hoặc chọn 1 trong 5 **nền có sẵn** ngay trong mục đó hoặc trong Cài đặt trên máy.

## Logo khởi động riêng
1. Vào trang 192.168.4.1, mở mục **Logo khởi động của bạn**.
2. Chọn ảnh, chọn kiểu **Vừa khung** hoặc **Lấp đầy**, chọn màu nền.
3. Bấm **Lưu logo vào ESP32**. Màn hình hiện thử logo 3 giây.

## WiFi nhà
1. Mở mục **WiFi nhà**, nhập tên và mật khẩu WiFi nhà bạn, bấm **Lưu WiFi**.
2. Khi điện thoại dùng WiFi nhà, mở địa chỉ IP hiện trên máy hoặc **gifplayer.local**, không cần đổi WiFi.
3. Có WiFi nhà, máy tự cập nhật **logo khởi động mới** (trừ khi bạn đã đặt logo riêng).

## Lịch dương + âm
- Màn lịch tháng: ngày dương to, ngày âm nhỏ ở góc. Mùng 1 và rằm tô vàng, ngày nghỉ lễ và Chủ nhật tô đỏ
- Màn đồng hồ có thêm dòng **âm lịch hôm nay**, gặp ngày lễ thì hiện tên ngày lễ
- Âm lịch tính ngay trong máy, dùng được mọi năm, không cần mạng (chỉ cần WiFi nhà để máy biết hôm nay là ngày nào)
- Ngày lễ Việt Nam có sẵn: Tết Nguyên đán, Giỗ Tổ, Trung thu, Vu Lan, 30/4, 2/9…
- **Sự kiện của bạn**: vào trang **192.168.4.1** → mục **Lịch & sự kiện của bạn** → thêm sinh nhật, kỷ niệm (dương hoặc âm lịch, lặp lại mỗi năm) → **Lưu vào ESP32**. Ngày có sự kiện riêng có chấm vàng trên lịch

