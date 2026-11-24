# KhoFCO — GitHub + Vercel

Shop FC Online dùng tên miền riêng, tài khoản đăng nhập riêng, trang chủ và trang sản phẩm có nội dung HTML để công cụ tìm kiếm đọc được.

- GitHub: giữ mã nguồn trong tài khoản của bạn.
- Vercel: chạy giao diện và máy chủ Node.js 24.
- PostgreSQL (đề xuất Neon từ Vercel Marketplace): lưu tài khoản shop, sản phẩm, đơn hàng và phiên đăng nhập.
- Vercel Blob Public: lưu ảnh sản phẩm và ảnh QR công khai. Thông tin đăng nhập acc game được mã hóa trong PostgreSQL, không đưa lên Blob.
- Chủ shop xác nhận tiền chuyển khoản và bàn giao acc tại `/admin`.

**Đây là bản cho Vercel. Không dùng SQLite hoặc ổ đĩa máy chủ để lưu dữ liệu.** Bộ mã nguồn không chứa acc thật, mật khẩu thật, thông tin ngân hàng hoặc khóa dịch vụ của bạn. Bộ này không tự sao chép dữ liệu từ bản shop trên nền tảng khác.

## 1. Tạo kho mã nguồn trên GitHub

Nếu đã kết nối GitHub trong cuộc trò chuyện, có thể để trợ lý thực hiện việc tạo và đưa mã nguồn lên. Nếu tự làm:

1. Đăng nhập [GitHub](https://github.com), chọn **New repository**.
2. Đặt tên `khofco-shop`, chọn **Private** rồi **Create repository**.
3. Giải nén bộ mã nguồn này trên máy tính.
4. Trong kho mới, chọn **uploading an existing file** hoặc **Add file → Upload files**.
5. Kéo toàn bộ nội dung bên trong thư mục `khofco-github-vercel` vào. Giữ nguyên các thư mục `api`, `core`, `lib`, `public`, `scripts`, `tests`.
6. Chọn **Commit changes**. Ở trang gốc kho phải thấy `package.json`, `package-lock.json`, `vercel.json` và `schema.sql` cùng cấp. Không chỉ tải một file ZIP lên kho.
7. Không tải `.env.local`, `.vercel`, `node_modules` hay thông tin acc thật lên GitHub.

Dùng điện thoại thì việc tải cả cấu trúc thư mục qua GitHub sẽ khó hơn. Có thể dùng GitHub Codespaces trên trình duyệt máy tính để giải nén và commit, hoặc kết nối GitHub trong cuộc trò chuyện để đưa mã lên trực tiếp.

## 2. Nhập dự án vào Vercel

1. Đăng nhập [Vercel](https://vercel.com) bằng tài khoản của bạn.
2. Chọn đúng nhóm → **Add New → Project** → kết nối GitHub.
3. Cho phép Vercel truy cập riêng kho `khofco-shop`, rồi chọn **Import**.
4. **Framework Preset:** `Other`. **Root Directory:** thư mục đang chứa `package.json` (mặc định gốc kho nếu tải đúng bước 1).
5. `vercel.json` đã đặt **Build Command:** `npm run build` và **Output Directory:** `public`. Node.js là `24.x` theo `package.json`.
6. Chọn **Deploy**. Lần đầu chưa kết nối dữ liệu nên website có thể báo “Shop đang thiết lập”; đây là bước chờ cấu hình bên dưới.

Vercel Hobby dành cho cá nhân, phi thương mại. Shop bán acc cần gói cho phép kinh doanh, chẳng hạn Pro. Kiểm tra mức giá và hạn mức hiện tại trước khi xác nhận bất kỳ khoản trả phí nào. PostgreSQL, Blob và tên miền có thể tính phí riêng theo gói và mức sử dụng.

## 3. Kết nối PostgreSQL

1. Mở dự án Vercel → **Storage** / Marketplace → chọn **Neon Postgres**.
2. Tạo cơ sở dữ liệu dành riêng cho shop này, chọn vùng gần nơi chạy Function. Nếu dùng vùng khác nhau, chỉnh vùng Function cho gần cơ sở dữ liệu.
3. Kết nối cơ sở dữ liệu với dự án, trước tiên chỉ chọn môi trường **Production**. Không chia sẻ dữ liệu kinh doanh với các bản Preview thử nghiệm.
4. Mở **Settings → Environment Variables**, kiểm tra đã có `DATABASE_URL`. Dùng URL kết nối pooled có TLS do Neon cung cấp. Nếu tích hợp tạo tên biến khác, thêm `DATABASE_URL` với đúng URL kết nối của cơ sở dữ liệu này.
5. Không gửi URL này vào chat hoặc ghi vào GitHub. Ứng dụng tự tạo bảng trong cơ sở dữ liệu riêng ở lần chạy đầu, không phải dán SQL bằng tay.

Có thể dùng PostgreSQL khác, nhưng phải cung cấp `DATABASE_URL` với kết nối TLS phù hợp. Bản này dùng trình điều khiển `pg`, không dùng khóa Supabase phía trình duyệt.

## 4. Kết nối kho ảnh

1. Trong **Storage**, tạo **Vercel Blob** với chế độ **Public**.
2. Kết nối kho ảnh với dự án, chọn **Production**.
3. Kiểm tra có `BLOB_READ_WRITE_TOKEN` trong Environment Variables. Nếu Vercel cấp tên có tiền tố, thêm biến đúng tên trên cho ứng dụng.
4. Ảnh đăng lên chỉ chứa thông tin sản phẩm công khai hoặc QR nhận tiền. Mỗi ảnh JPG/PNG/WebP tối đa **3 MB**.

## 5. Thêm khóa bảo vệ và mã thiết lập

Trong thư mục mã nguồn trên máy tính có Node.js 24:

```bash
npm ci
npm run secrets
```

Lệnh trên tạo hai giá trị ngẫu nhiên mới để bạn tự dán vào **Vercel → Settings → Environment Variables → Production**:

| Tên biến | Giá trị |
| --- | --- |
| `ACCOUNT_CIPHER_KEY` | Giá trị Base64 từ lệnh trên; dùng để mã hóa thông tin bàn giao acc |
| `SETUP_TOKEN` | Giá trị ngẫu nhiên từ lệnh trên; dùng khi tạo chủ shop lần đầu |
| `PUBLIC_ORIGIN` | Địa chỉ gốc HTTPS chính thức của shop, không có đường dẫn hoặc dấu `/` cuối; có thể bổ sung sau |

Nếu thao tác qua GitHub Codespaces, mở Terminal trong Codespaces và chạy các lệnh trên; không dán kết quả vào file rồi commit. Nếu trợ lý được quyền cấu hình dự án thì có thể tạo và đặt các khóa trực tiếp thay cho bước thủ công.

Giữ bản sao riêng, an toàn của `ACCOUNT_CIPHER_KEY`; giữ nguyên khóa này qua mọi lần cập nhật. Thay khóa tùy ý sẽ làm dữ liệu bàn giao cũ không giải mã được. Sao lưu PostgreSQL, Blob và khóa bảo vệ theo hướng dẫn của từng nhà cung cấp.

Sau khi thêm biến, mở **Deployments → chọn bản mới nhất → Redeploy**. Việc thay Environment Variables chỉ áp dụng cho lần triển khai mới.

## 6. Tạo chủ shop và đăng bán

1. Mở địa chỉ website Vercel đã trả về, thêm `/setup` ở cuối.
2. Nhập `SETUP_TOKEN`, tên hiển thị, email và mật khẩu chủ shop (12–128 ký tự).
3. Sau khi tạo thành công, website chuyển đến `/admin`. Chỉ tạo chủ shop một lần; người đăng ký sau là khách hàng.
4. Trong **Cài đặt shop**, điền tên shop, Zalo, ngân hàng, số tài khoản và tên người nhận, rồi lưu.
5. Trong **Tài khoản**, chọn **Thêm acc mới** → điền tên, BP/FC, MNF, giá bằng đồng và ảnh.
6. Điền tài khoản/mật khẩu bàn giao. Chọn **Mở bán** để sản phẩm xuất hiện cho khách; chọn **Bản nháp** nếu chưa muốn bán.
7. Thử bằng tài khoản khách riêng: đặt mua → xem nội dung chuyển khoản. Đơn giữ acc 30 phút.
8. Khi đã kiểm tra tiền vào ngân hàng thật, chủ shop chọn **Xác nhận & giao acc** trong Đơn hàng. Người mua mới xem được thông tin đăng nhập.
9. Sau khi thiết lập xong, có thể xóa `SETUP_TOKEN` khỏi Vercel rồi Redeploy; chủ shop hiện có vẫn đăng nhập bình thường.

Không có kết nối ngân hàng để tự xác nhận thanh toán. Đơn hết hạn nhưng khách đã chuyển tiền cần chủ shop đối soát trực tiếp, không xác nhận đơn cũ đã giải phóng acc. Bản hiện tại chưa có chức năng gửi email khôi phục mật khẩu; hãy giữ thông tin quản trị an toàn.

## 7. Gắn tên miền riêng

1. Đăng ký tên miền trong tài khoản do bạn quản lý.
2. Mở **Vercel → dự án → Settings → Domains → Add Domain**.
3. Nhập tên miền đã mua. Nếu thêm cả tên miền gốc và `www`, chọn một địa chỉ chính và cấu hình chuyển hướng địa chỉ còn lại trong Vercel.
4. Trong nơi quản lý DNS của tên miền, thêm chính xác bản ghi mà Vercel hiển thị. Không dùng địa chỉ IP hay CNAME đoán từ hướng dẫn cũ.
5. Chờ Vercel báo cấu hình hợp lệ và HTTPS hoạt động.
6. Đặt `PUBLIC_ORIGIN=https://TEN-MIEN-DA-MUA` theo tên miền thực, rồi Redeploy. Không giữ nguyên phần chữ ví dụ này.
7. Kiểm tra lại đăng nhập, đặt mua, ảnh và `/sitemap.xml` bằng tên miền chính.

Địa chỉ Vercel tự cấp vẫn có thể truy cập trước khi mua tên miền. Khi đã đặt `PUBLIC_ORIGIN`, các trang động ở địa chỉ phụ sẽ chuyển về địa chỉ chính.

## 8. Để Google tìm thấy website

1. Mở trang chủ và một trang sản phẩm khi chưa đăng nhập, đảm bảo truy cập được.
2. Kiểm tra Production không yêu cầu đăng nhập Vercel đối với khách bên ngoài; giữ bảo vệ cho các bản Preview.
3. Vào [Google Search Console](https://search.google.com/search-console), thêm tên miền và xác minh quyền sở hữu bằng DNS.
4. Gửi sitemap tại `https://TEN-MIEN-THUC/sitemap.xml`.
5. Dùng **Kiểm tra URL** với trang chủ và trang acc đang bán, rồi yêu cầu lập chỉ mục.
6. Điền tên shop và mô tả acc rõ ràng, cập nhật nội dung thật. Google tự quyết định việc lập chỉ mục và thứ hạng; mua tên miền hoặc yêu cầu lập chỉ mục không bảo đảm xuất hiện ngay hay được đề xuất.

`/admin`, `/setup`, API và trang đăng nhập được đánh dấu không lập chỉ mục. Đây chỉ là hướng dẫn cho công cụ tìm kiếm; phân quyền quản trị vẫn được kiểm tra trên máy chủ.

## 9. Cập nhật sau này

- Sửa mã trong GitHub, commit vào nhánh Production (thường là `main`). Vercel tự build và triển khai khi Git integration đã kết nối.
- Đăng acc, đổi giá và cài đặt thanh toán ngay trong `/admin`; không sửa mã nguồn cho từng acc.
- Dữ liệu và ảnh nằm trong PostgreSQL/Blob, không mất khi triển khai lại mã nguồn.
- Preview muốn chạy đầy đủ cần cơ sở dữ liệu, kho ảnh và khóa riêng. Không cấp bí mật Production cho nhánh thử nghiệm không tin cậy.
- Bản VPS/SQLite cũ là một hệ thống khác. Muốn chuyển dữ liệu đã nhập ở đó cần quy trình chuyển dữ liệu riêng; bộ này không nhập dữ liệu cũ tự động.

## Phát triển và kiểm tra

```bash
npm ci
npm run build
npm test
```

Sau khi liên kết Vercel và kéo các biến **Development** riêng về `.env.local`:

```bash
npm run dev
```

Mặc định chạy tại `http://localhost:3000`; khi thử tại máy phải đặt `PUBLIC_ORIGIN=http://localhost:3000` trong `.env.local`. Không dùng URL Production khi chạy localhost. Không dùng cơ sở dữ liệu đang bán hàng để thử nghiệm.

Các bài kiểm tra dùng PostgreSQL nhúng PGlite, dữ liệu người dùng giả và kho ảnh giả/SDK giả. Chúng kiểm tra SQL PostgreSQL, thiết lập chủ shop, phiên đăng nhập, phân quyền, mã hóa bàn giao, đơn hàng, tranh mua, hủy/hết hạn đơn, giao dịch rollback, sitemap và chống sửa từ nguồn khác. Chưa thay thế được kiểm tra kết nối Neon/Blob thật và build trên tài khoản Vercel.

## Tài liệu chính thức

- [Kết nối GitHub với Vercel](https://vercel.com/docs/git/vercel-for-github)
- [Marketplace Storage](https://vercel.com/docs/marketplace-storage)
- [Vercel Blob](https://vercel.com/docs/vercel-blob)
- [Vercel Functions Node.js](https://vercel.com/docs/functions/runtimes/node-js)
- [Giá và mục đích sử dụng các gói Vercel](https://vercel.com/pricing)
- [Yêu cầu lập chỉ mục Google](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)
