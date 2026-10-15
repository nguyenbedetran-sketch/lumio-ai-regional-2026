# Dữ liệu hỗ trợ chọn quốc gia và địa phương

Ngày kiểm tra: 15/10/2026. Dữ liệu có phiên bản để hỗ trợ nhập hồ sơ giáo viên, **không xác minh** danh tính, công tác, quốc tịch hoặc quyền giáo viên.

## Việt Nam

Tệp local `/data/vietnam-locations-v5.2.0.json`: schema 1, datasetVersion `v5.2.0`, metadata và `provinces:[{code,name,wards:[{code,name,provinceCode}]}]`. Có 34 mã cấp tỉnh và 3.321 mã cấp xã không trùng; tất cả mã là chuỗi để giữ số 0 đầu. `name` giữ loại đơn vị trong tên đầy đủ. Chỉ giữ tên/mã/quan hệ cha; không tọa độ, GIS, mã bưu chính hoặc dữ liệu người dùng.

Snapshot lấy từ [repository tác giả](https://github.com/thanglequoc/vietnamese-provinces-database) ở commit `62b1abdfe39625289c37a58ef6678e9db3d37f84`, tag `v5.2.0`; chuyển đổi **JSON data-only**, không chạy script/package upstream. MIT kèm tại `/data/licenses/vietnamese-provinces-database-MIT.txt`. Metadata ghi URL, hash nguồn và hash payload; sidecar `.sha256` ghi hash toàn tệp. Đây là dữ liệu cộng đồng, không quan hệ đại diện cơ quan nhà nước.

Nguồn chính thức để đối chiếu:

- [Danh mục thay đổi của Cục Thống kê](https://danhmuchanhchinh.nso.gov.vn/NghiDinh.aspx), đã mở ngày trên; có thay đổi Đồng Nai hiệu lực 30/04/2026, Quảng Ninh 01/09/2026 và Bắc Ninh 20/09/2026. Vì vậy không gọi một snapshot năm 2025 là đầy đủ hiện hành 2026.
- [Web service danh mục](https://danhmuchanhchinh.nso.gov.vn/DMDVHC.asmx) công bố `DanhMucTinh` và `DanhMucPhuongXa`; không gọi trực tiếp trong form để tránh phụ thuộc mạng/khả dụng bên ngoài.
- [Quyết định 19/2025/QĐ-TTg](https://vanban.chinhphu.vn/?classid=1&docid=214409&pageid=27160), ban hành 30/06/2025, hiệu lực 01/07/2025, làm mốc lịch sử; không tự dùng làm chứng cứ rằng không có thay đổi sau đó.

UI chỉ tải JSON khi chọn `countryCode==='VN'`. Lọc xã theo tỉnh; đổi tỉnh bỏ xã cũ. Dataset không đủ/mạng lỗi phải giải thích và cho nhập khai tay phù hợp. Không bắt buộc cấp huyện cũ hoặc tự suy từ IP/GPS. Giá trị lưu là bản khai tại thời điểm gửi, không tự đổi hồ sơ cũ khi dữ liệu tên hành chính cập nhật.

## Quốc gia/vùng lãnh thổ

`lib/teachers/country-options.ts` xuất `countryOptions` gồm 249 bản ghi `{code,vi,en}` tĩnh. Nguồn là JSON / code/language data của [i18n-iso-countries](https://github.com/michaelwittig/node-i18n-iso-countries) ở archive `7.14.0`, SHA512 integrity được kiểm tra trước đọc; không cài dependency hoặc thực thi mã. Bỏ phần mở rộng `XK` không thuộc tập mã ISO alpha2 được gán. Nhãn có cả lãnh thổ; form nên gọi “Quốc gia/vùng lãnh thổ”.

Không dùng `Intl.DisplayNames` khác môi trường lúc SSR; không tự lấy locale máy làm quốc gia người dùng. Metadata/archive hash trong `/data/country-options-v7.14.0.metadata.json`; MIT kèm `/data/licenses/i18n-iso-countries-MIT.txt`. Các quốc gia khác Việt Nam dùng trường hành chính khai tay có giới hạn, không giả rằng đã có danh mục xã/phường toàn cầu.

## Kiểm tra và cập nhật

Chín kiểm tra snapshot: phiên bản/commit, số lượng, mã duy nhất đúng định dạng, parent, tên không rỗng, thay đổi Bắc Ninh 2026 và license/phạm vi. Sáu kiểm tra country constants: archive integrity, read-only JSON/license, 249 mã duy nhất, đủ vi/en, nhãn Việt Nam và license/hash. Log JSON trong work/regional-20261015/location-data; root thực hiện thêm kiểm tra form/API và build của toàn feature.

Khi cập nhật: đối chiếu nguồn chính thức, pin bản/commit mới, chuyển đổi và kiểm tra lại, giữ license/hash, thay URL có phiên bản. Không tự update `/master` mỗi lần người dùng mở trang và không cam kết danh mục đúng mãi mãi.
