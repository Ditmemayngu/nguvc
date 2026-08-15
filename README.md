# Gmail OTP Private

Web app cá nhân để thuê Gmail OTP qua AccStack, tạo hai biến thể `+ducsieudz1` và `+ducsieudz2`, theo dõi thời hạn, đọc OTP và thuê lại Gmail.

## Bảo mật

- API key chỉ được đọc ở API route phía máy chủ, không gửi xuống trình duyệt.
- Giao diện được khóa bằng mật khẩu và cookie phiên ký HMAC.
- OTP chỉ nằm trong state của trình duyệt, không lưu vào database.
- Repository có thể public miễn là không commit bất kỳ file `.env` nào.

## Biến môi trường bắt buộc

Sao chép `.env.example` thành `.env.local` khi chạy local, hoặc thêm các biến sau vào Vercel:

- `ACCSTACK_API_KEY`: API key mới của AccStack.
- `APP_PASSWORD`: mật khẩu để mở web app.
- `SESSION_SECRET`: chuỗi bí mật dài, ngẫu nhiên để ký cookie.

Biến tùy chọn:

- `ACCSTACK_BASE_URL`: mặc định `https://accstack.io/api/v1`.
- `ACCSTACK_PRODUCT_NAME`: mặc định `Gmail ChatGPT`.
- `ACCSTACK_PRODUCT_ID`: đặt ID cụ thể nếu tên sản phẩm khác.

## Chạy local

```bash
npm ci
npm run dev
```

## Deploy Vercel

Import repository vào Vercel, thêm các biến môi trường trên rồi deploy. `vercel.json` đã cấu hình dự án Next.js.

> Nút **Thuê Gmail mới** và **Thuê lại Gmail này** đều gọi API có tính phí.
