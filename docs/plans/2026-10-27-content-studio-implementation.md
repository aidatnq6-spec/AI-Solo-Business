# Sổ Nội Dung Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Xây ứng dụng cá nhân tạo, duyệt và tải nội dung cho Facebook, TikTok, Zalo, YouTube để giới thiệu giải pháp cho kế toán.

**Architecture:** Next.js cung cấp giao diện và API được bảo vệ bằng Firebase Auth; Firestore giữ sản phẩm, nguồn, phiên bản nội dung và trạng thái công việc, Storage giữ tệp. Cloud Tasks chuyển từng bước sang worker Node dùng eve/AI SDK; worker Remotion dựng video riêng. Duyệt của con người và checkpoint được lưu ngoài phiên AI.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Lucide React, Firebase Auth/Firestore/Storage/App Hosting; Node, eve, AI SDK, Zod; Cloud Tasks, Cloud Run, Firebase Functions cho dispatcher; Sharp, Remotion; Vitest và Firebase Emulator Suite.

---

Trạng thái: **kế hoạch dự thảo để duyệt, chưa thực thi**. Ngày: 27/10/2026.

Nguồn yêu cầu: [Thiết kế phiên bản đầu tiên](../superpowers/specs/2026-10-27-content-studio-design.md). Phạm vi gồm mốc A (nội dung + ảnh) và B (MP4). Không tự động đăng mạng xã hội.

## Cách thực hiện và điều kiện bắt đầu

- Hiện repo chưa có ứng dụng hoặc commit nền; chỉ có `.gitignore` và bản mẫu HTML bị ignore. Không di chuyển/xóa bản mẫu. Lưu bản tham khảo sạch tại `docs/reference/content-studio.html` khi bắt đầu triển khai.
- Chưa scaffold, cài dependency, tạo Firebase project hoặc gọi AI trong giai đoạn tài liệu. Chỉ bắt đầu code sau khi thiết kế được duyệt hoặc người dùng yêu cầu triển khai theo thiết kế này.
- Ưu tiên triển khai trực tiếp trong phiên hiện tại theo skill `executing-plans`; không mặc định chia nhiều agent lập trình. Mỗi tác vụ dưới đây chia thành bước ngắn; chạy kiểm tra liên quan trước khi chuyển tác vụ.
- Khóa phiên bản Node/package tương thích sau khi kiểm tra tài liệu và runtime thực tế. Không tự nâng cấp hệ thống hoặc dùng `@latest` mà không lưu lockfile.
- Commit theo từng tác vụ khi repository cho phép; chỉ stage đường dẫn đã thực hiện, không `git add .`. Nếu quyền ghi `.git` bị giới hạn, bàn giao file và ghi rõ chưa commit, không coi commit là điều kiện để đọc tài liệu.

## Các hợp đồng dùng chung

Các đoạn TypeScript sau là hợp đồng đề xuất, không phải thư viện đã cài hoặc code đã chạy.

```ts
type Channel = 'facebook' | 'tiktok' | 'zalo' | 'youtube';
type JobStatus =
  | 'queued' | 'running' | 'succeeded' | 'failed'
  | 'needs_reconciliation' | 'cancelled';
type ReviewStatus = 'draft' | 'needs_verification' | 'approved';

interface StartJobRequest {
  campaignRevision: number;
  operation: 'draft' | 'image' | 'video';
  channel?: Channel; // draft có thể chạy nhiều kênh theo campaign
  contentId?: string;
  approvedVersion?: number; // bắt buộc cho media
}

interface AcceptedJob {
  jobId: string;
  status: 'queued';
}

// Server phải kiểm tra token + owner + quyền tài nguyên, không nhận uid từ body.
// POST dùng header Idempotency-Key; PATCH dùng expectedRevision chống ghi đè.
```

### Các API cần có

| Endpoint | Hợp đồng chính |
| --- | --- |
| `GET /api/me` | Xác nhận chủ sở hữu; 401 thiếu/token lỗi, 403 UID không được phép |
| `GET/POST /api/products` | Danh sách/tạo sản phẩm |
| `GET/PATCH /api/products/[id]` | Đọc/sửa với revision |
| `GET/POST /api/sources` | Đọc/tạo nguồn văn bản hoặc URL kèm ghi chú |
| `PATCH /api/sources/[id]` | Sửa, xác nhận nguồn và tăng revision |
| `GET/PATCH /api/settings` | Thương hiệu và giới hạn tác vụ; không nhận API key |
| `POST /api/logo` | Upload logo đã kiểm tra, tối đa 5 MB |
| `GET/POST /api/campaigns` | Danh sách phân trang/tạo bản nháp |
| `GET/PATCH /api/campaigns/[id]` | Đọc/sửa đề bài, lưu trữ hoặc nhân bản qua action rõ ràng |
| `POST /api/campaigns/[id]/jobs` | Lưu snapshot và outbox, trả 202; 409 revision/duyệt không còn hợp lệ |
| `PATCH /api/campaigns/[id]/contents/[contentId]` | Tạo phiên bản mới từ chỉnh sửa; expectedVersion bắt buộc |
| `POST /api/campaigns/[id]/contents/[contentId]/approve` | Duyệt đúng version, từ chối nếu còn vấn đề chưa xử lý |
| `POST /api/campaigns/[id]/jobs/[jobId]/retry` | Chỉ retry bước lỗi được phép, không chạy lại kết quả đã hoàn tất |
| `POST /api/campaigns/[id]/jobs/[jobId]/cancel` | Hủy phần chưa thực hiện, không hứa dừng/hoàn phí tác vụ provider đã nhận |
| `GET /api/campaigns/[id]/export` | TXT theo phiên bản, có metadata cần thiết |
| `GET /api/campaigns/[id]/assets/[assetId]/download` | Xác thực owner; tải/redirect URL ngắn hạn của tệp thành công |

Mọi API thay đổi có kiểm tra Origin, validate schema, hạn mức và lỗi có mã dùng được trên giao diện. Đầu ra AI/tệp không được ghi trạng thái thành công trước khi dữ liệu/tệp được xác nhận tồn tại.

## Task 1 — Dựng nền dự án và chuyển giao diện tham khảo

**Files:**
- Create: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `components.json`, `vitest.config.ts`.
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`.
- Create: `src/components/app-shell.tsx`, `src/components/ui/*`, `docs/reference/content-studio.html`, `README.md`, `.env.example`.
- Modify: `.gitignore` để bỏ build/cache/emulator artifacts và cho phép `.env.example` chứa placeholder.

**Steps:**
1. Kiểm tra Node hiện có; chọn runtime tương thích Next.js/eve/App Hosting, scaffold Next.js TypeScript và lưu lockfile. Chỉ cài các package mốc A cần dùng; package video thêm ở Task 10.
2. Chép bản mẫu thành tài liệu tham khảo; xây shell/sidebar/header bằng shadcn/ui và Lucide, dùng token màu và spacing. Không bê nguyên script HTML hoặc tự phát lại hiệu ứng AI mẫu.
3. Tạo `/studio`, `/campaigns`, `/products`, `/settings` với trạng thái trống hữu ích; đánh dấu demo khi dùng fixture. Chưa giả chức năng AI thật.
4. Đặt script `dev`, `build`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `emulators:test`, `test:rules`; ghi hướng dẫn Windows vào README.
5. Chạy `npm run typecheck` và `npm run build`; mong đợi exit 0. Xem shell bằng trình duyệt khi công cụ cho phép; không viết test chỉ để kiểm tra tên class hoặc màu.

**Done:** Shell bốn màn hình chạy được, giao diện thích ứng, build không cần secret production.

## Task 2 — Firebase local, đăng nhập và giới hạn chủ sở hữu

**Files:**
- Create: `firebase.json`, `.firebaserc.example`, `firestore.rules`, `storage.rules`, `firestore.indexes.json`.
- Create: `src/lib/firebase/client.ts`, `src/lib/firebase/admin.ts`, `src/lib/auth/require-owner.ts`, `src/lib/auth/api-client.ts`.
- Create: `src/app/login/page.tsx`, `src/app/(workspace)/layout.tsx`, `src/app/api/me/route.ts`.
- Test: `tests/auth/require-owner.test.ts`, `tests/rules/firestore.test.ts`, `tests/rules/storage.test.ts`.

**Steps:**
1. Viết kiểm tra owner, token hết hạn, không token, UID khác; Rules chặn đọc/ghi chéo người dùng và ghi trực tiếp từ client. Chạy `npm run test -- tests/auth/require-owner.test.ts` để quan sát lỗi trước khi có implementation.
2. Cấu hình Auth/Firestore/Storage Emulator; `OWNER_UID` bắt buộc cho API. Đồng bộ owner với cấu hình Rules như thiết kế; không biến tài khoản đăng nhập đầu tiên thành owner tự động.
3. Làm đăng nhập Google cho production và đăng nhập emulator cho local, token refresh/logout; API client gắn ID token. Server xác minh token và owner trên mỗi request, không chỉ bảo vệ layout.
4. Thêm SDK Admin dạng server-only, Rules mặc định từ chối và test chống cập nhật trường hệ thống. Chọn quy tắc owner nhất quán cho cả Firestore/Storage/API.
5. Chạy `npm run emulators:test` (script wrapper `firebase emulators:exec --project demo-content-studio --only auth,firestore,storage "npm run test:rules"`) và test auth; mong đợi mọi kịch bản cho phép/từ chối đúng.

**Done:** AC01; không cần Firebase cloud để phát triển local. UID thực và login Google được kiểm chứng riêng trước production.

## Task 3 — Sản phẩm, nguồn và thiết lập thương hiệu

**Files:**
- Create: `src/lib/domain/schemas.ts`, `src/lib/repositories/products.ts`, `sources.ts`, `settings.ts`.
- Create: `src/app/(workspace)/products/page.tsx`, `settings/page.tsx`.
- Create: `src/components/products/product-form.tsx`, `src/components/sources/source-editor.tsx`.
- Create: `src/app/api/products/**/route.ts`, `src/app/api/sources/**/route.ts`, `src/app/api/settings/route.ts`, `src/app/api/logo/route.ts`.
- Test: `tests/domain/product-source.test.ts`, `tests/uploads/logo.test.ts`.

**Steps:**
1. Viết test giới hạn độ dài, giá tùy chọn, timestamp nguồn, loại URL, revision conflict; logo sai MIME/nội dung, quá dung lượng phải bị từ chối.
2. Dùng schema có enum ba nhóm sản phẩm và tiền tệ rõ ràng; tạo repository dưới `users/{ownerUid}`. URL nguồn chỉ lưu, không tự fetch.
3. Xây form CRUD, lưu trữ sản phẩm; thêm nguồn bằng văn bản/ghi chú URL, ngày kiểm tra và dấu xác nhận của owner. Tạo fixture không khẳng định giá hoặc tính năng nhà cung cấp.
4. Upload logo server-side, kiểm tra bằng bộ giải mã ảnh, lưu Storage và metadata; cập nhật thương hiệu/CTA. Không nhận service-account JSON hoặc khóa AI từ màn hình.
5. Chạy hai file test, typecheck; kiểm tra thêm/sửa, tải lại trang và dữ liệu còn nguyên trong emulator.

**Done:** AC02 và phần đầu vào AC04; thiếu dữ liệu có thông báo rõ, không thay bằng số liệu bịa.

## Task 4 — Chiến dịch, version và hợp đồng duyệt

**Files:**
- Create: `src/lib/repositories/campaigns.ts`, `contents.ts`, `src/lib/domain/review.ts`.
- Create: `src/app/api/campaigns/**/route.ts` cho CRUD, phiên bản, approve.
- Create: `src/app/(workspace)/campaigns/page.tsx`, `campaigns/[id]/page.tsx`, `studio/page.tsx`.
- Test: `tests/domain/review.test.ts`, `tests/integration/campaigns.test.ts`.

**Steps:**
1. Viết test duyệt đúng version, edit làm mất duyệt, PATCH stale trả 409, snapshot sản phẩm không đổi khi danh mục cập nhật.
2. Làm transaction versioning, lưu snapshot sản phẩm/nguồn, trường archive; nhân bản tạo ID mới và bỏ trạng thái duyệt/assets cũ.
3. Form chiến dịch chọn 1–4 kênh, mục tiêu, giọng văn, CTA, đầu ra; mặc định YouTube Shorts, video 30–60 giây. Lỗi đặt cạnh trường.
4. Làm danh sách phân trang và tìm kiếm trong tập đã tải, ghi rõ giới hạn; chi tiết và editor có lưu/duyệt riêng. Listener tiến trình không làm mất nội dung đang nhập.
5. Chạy test liên quan với emulator; kiểm tra luồng lưu draft → mở lại → sửa → duyệt → sửa tiếp.

**Done:** AC05 ở mức dữ liệu; chưa có AI vẫn quản lý chiến dịch thật.

## Task 5 — Hàng đợi, phục hồi và kiểm chứng runtime AI

**Files:**
- Create: `packages/contracts/src/jobs.ts`, `packages/contracts/src/content.ts`.
- Create: `src/lib/jobs/create-job.ts`, `src/lib/jobs/budget.ts`, `src/lib/jobs/publish-outbox.ts`.
- Create: `functions/src/dispatch-outbox.ts`, `functions/src/reconcile-outbox.ts`.
- Create: `services/agent-worker/package.json`, `services/agent-worker/agent/agent.ts`, `agent/instructions.md`, `agent/channels/eve.ts`, `src/handler.ts`, `src/checkpoints.ts`, `Dockerfile`.
- Create: `docs/decisions/0001-agent-runtime.md`, `docs/decisions/0002-model-selection.md`.
- Test: `tests/jobs/idempotency.test.ts`, `tests/jobs/recovery.test.ts`, `tests/jobs/budget.test.ts`.

**Steps:**
1. Viết test double-click cùng khóa, hai worker cùng nhận, crash trước/sau enqueue, lease hết hạn, output đã có, provider timeout mơ hồ. Test từ chối tác vụ vượt giới hạn và hoàn trả reservation khi chưa phát sinh gọi provider.
2. Làm transaction tạo job + outbox; dispatcher enqueue bằng tên ổn định; trigger và lịch reconciliation chỉ gửi phần còn treo. Cloud không cần thiết cho unit test, dùng fake queue; kiểm chứng Cloud Tasks thật trước triển khai.
3. Kiểm chứng eve Node server trong worker: gửi một đề bài ngắn qua SDK đúng phiên bản, chờ hoàn tất, validate/save đầu ra; dừng worker giữa bước và thử phục hồi từ snapshot Firestore. Không phụ thuộc phiên tạm eve từ lần chạy trước. Ghi kết quả và đường gọi thực tế vào quyết định 0001. Không tự thay bằng framework khác khi gặp lỗi; báo rõ trở ngại kỹ thuật.
4. Thêm giới hạn số model calls/đầu ra/retry; cấu hình provider/model phía server. Benchmark nhỏ bằng nội dung chung không chứa dữ liệu riêng; chỉ gọi provider có phí khi đã có credential và hạn mức do owner cấu hình. Ghi cách chọn model, chất lượng tiếng Việt, latency và usage vào quyết định 0002; chưa đủ điều kiện thì test adapter bằng fixture và ghi live check còn thiếu.
5. Thử job với provider mock, kill/restart worker rồi theo dõi lại; chạy ba file test. Cấu hình cloud được chuẩn bị ở mốc triển khai, không cấp IAM công khai cho worker.

**Done:** AC08–AC10 ở mức hợp đồng; runtime có bằng chứng trước khi nối nghiệp vụ. Nếu runtime không qua kiểm chứng thì chưa được tuyên bố chức năng agent hoàn thành.

## Task 6 — AI tạo nội dung theo nguồn và bốn kênh

**Files:**
- Create: `services/agent-worker/agent/tools/read-context.ts`, `draft-content.ts`, `check-content.ts`, `save-output.ts`.
- Create: `services/agent-worker/agent/skills/accounting-content/SKILL.md`.
- Create: `services/agent-worker/src/providers/text.ts`, `src/stages/draft.ts`.
- Create: `src/app/api/campaigns/[id]/jobs/route.ts`.
- Test: `tests/ai/draft-contract.test.ts`, `tests/ai/source-integrity.test.ts`, `tests/fixtures/products/*`.

**Steps:**
1. Viết fixture có/không có giá, ưu đãi, nguồn quy định; test schema, tham chiếu chỉ vào nguồn tồn tại, không chấp nhận claim chưa xử lý để duyệt.
2. Công cụ đọc chỉ truy cập snapshot thuộc owner/campaign; output gồm bài viết hoặc script/caption theo kênh, nguồn và phần cần xác minh. Agent không thể gọi API đăng bài hoặc ghi lại giá sản phẩm.
3. Validate đầu ra, lưu từng kênh riêng; thông báo lỗi từng kênh. Chỉ retry kênh chưa hoàn tất; prompt/model/schema version được lưu cùng kết quả.
4. Chạy kiểm tra nội dung sau generation; cấm khẳng định giá/ưu đãi không có trong input, gắn phần cần xác minh. Test tự động chỉ chứng minh guard/schema, không chứng minh mọi câu AI đều đúng; dùng bộ rubric đọc thủ công cho live sample.
5. Chạy test; khi có provider thật, thử ít nhất một chủ đề mỗi nhóm sản phẩm, mỗi chủ đề đủ bốn kênh. Kiểm tra khác biệt định dạng, CTA và nguồn; ghi lỗi và chỉnh prompt rồi chỉ lặp trường hợp liên quan.

**Done:** AC03–AC04; đủ bài thật cho bốn kênh, không dùng template cố định giả làm AI.

## Task 7 — Kết nối xưởng nội dung, editor và xuất văn bản

**Files:**
- Create: `src/components/campaigns/brief-form.tsx`, `channel-tabs.tsx`, `content-editor.tsx`, `job-progress.tsx`, `asset-preview.tsx`.
- Create: `src/hooks/use-campaign-jobs.ts`.
- Create: `src/app/api/campaigns/[id]/export/route.ts`, `src/lib/export/text.ts`.
- Test: `tests/export/text.test.ts` cho đúng version và ký tự tiếng Việt.

**Steps:**
1. Gắn form vào API thật; disable double submit nhưng vẫn chống trùng tại server. Không dùng timer để giả phần trăm tiến độ.
2. Listener Firestore hiển thị queued/running/review/failed, lỗi theo kênh, thử lại/hủy; unsubscribe khi chuyển trang và tránh nghe toàn bộ collection không giới hạn.
3. Editor ghi version, nêu nguồn/thông tin thiếu, duyệt đúng snapshot. Trạng thái đang sửa giữ tại client, chỉ cập nhật khi lưu hoặc người dùng chấp nhận tải bản mới.
4. Xuất TXT UTF-8 theo version, gồm bài/caption/script và nhãn chưa duyệt khi áp dụng. Nút tải phải trỏ đúng kết quả.
5. Chạy test export và build. Kiểm tra bằng trình duyệt: tạo đề bài bốn kênh → nhận nội dung → sửa → duyệt → tải TXT. Dùng công cụ browser/computer được phép; nếu không truy cập được thì ghi rõ chưa QA giao diện, không tuyên bố đã kiểm tra.

**Done:** Xưởng nội dung mốc A dùng được từ đầu đến cuối ở phần văn bản.

## Task 8 — Tạo ảnh PNG và metadata thành phẩm

**Files:**
- Create: `services/agent-worker/src/providers/image.ts`, `src/stages/image.ts`.
- Create: `packages/media/src/poster-template.ts`, `poster-renderer.ts`, `font-assets/*`.
- Create: `src/app/api/campaigns/[id]/assets/[assetId]/download/route.ts`.
- Test: `tests/media/poster.test.ts`, `tests/jobs/media-version.test.ts`.

**Steps:**
1. Viết test chặn media từ nội dung chưa duyệt, lệch version, PNG sai kích thước và quá dài tiêu đề. Trường hợp người dùng sửa trong lúc render phải trả thành phẩm của snapshot cũ, không ghi đè mới.
2. Tạo một template vuông 1080×1080, dùng font có giấy phép phù hợp và đủ dấu tiếng Việt. Render chữ/logo bằng mã; AI chỉ tạo phần minh họa. Có nền hình học thay thế do người dùng chọn rõ ràng.
3. Xử lý provider ảnh trong job riêng, xác minh ảnh trả về, lưu Storage rồi metadata; lưu model/request ID/usage. Không chấp nhận URL tải tùy ý từ output mô hình.
4. Gắn preview và download có xác thực; sửa content làm asset cũ hiện nhãn phiên bản cũ. Không tạo lại ảnh khi chỉ tải lại trang.
5. Chạy test; tạo một ảnh thật cho mỗi nhóm sản phẩm, xem trực tiếp PNG để kiểm tra dấu, ngắt dòng, logo và khoảng trống; đọc được ở mobile.

**Done:** AC06; chốt nghiệm thu mốc A với AC01–AC06, AC08–AC11 tương ứng chức năng đã làm.

## Task 9 — Voiceover, storyboard và phụ đề

**Files:**
- Create: `services/agent-worker/src/providers/tts.ts`, `src/stages/storyboard.ts`, `src/stages/audio.ts`.
- Create: `packages/media/src/storyboard-schema.ts`, `captions.ts`.
- Create: `src/components/campaigns/video-review.tsx`.
- Test: `tests/media/storyboard.test.ts`, `tests/media/captions.test.ts`.

**Steps:**
1. Viết test scene count, timestamp tăng dần, phụ đề không vượt thời lượng audio, thiếu ảnh/audio và script chưa duyệt.
2. Chuyển script đã duyệt thành tối đa sáu cảnh; không cho nội dung provider thêm claim mới. Nếu phải sửa lời thoại đáng kể để đủ thời lượng, tạo version chờ duyệt lại thay vì âm thầm sửa.
3. TTS một giọng tiếng Việt có sẵn; cache theo hash script/voice/settings. Tạo alignment từ timestamp provider hoặc bước align riêng, không ước lượng cố định cho mọi từ.
4. Lưu audio, storyboard và SRT vào Storage/metadata; hiển thị preview trước render. Không gọi TTS lại khi chỉ preview.
5. Chạy test; nghe thử một mẫu có từ “hóa đơn điện tử”, “chữ ký số”, “BHXH”; kiểm tra phụ đề với audio thực tế.

**Done:** Đầu vào render có âm thanh và timing thực; chưa gọi là MP4 hoàn thành.

## Task 10 — Render MP4 bằng Remotion

**Files:**
- Create: `services/render-worker/package.json`, `Dockerfile`, `src/server.ts`, `src/render.ts`.
- Create: `packages/video/src/Root.tsx`, `ShortVideo.tsx`, `Scene.tsx`, `schema.ts`.
- Create: `tests/media/render-smoke.test.ts`, `tests/media/render-recovery.test.ts`.

**Steps:**
1. Thêm Remotion và dependencies đúng phiên bản sau kiểm tra license/runtime; làm smoke test render fixture ngắn kiểm tra container, codec, audio track và duration bằng công cụ probe.
2. Template dọc 1080×1920, một tỷ lệ khung hình cho video ngắn cả bốn kênh; phụ đề không bị cắt, chữ không lấn vùng quan trọng. Một video chỉ dùng nguồn được owner duyệt/cung cấp.
3. Worker nhận payload nội bộ đã xác thực IAM, đọc đúng snapshot, render MP4, upload rồi đánh dấu thành công. Giới hạn concurrency một và deadline phù hợp queue; tách render khỏi request giao diện.
4. Thử timeout/crash, đối chiếu output theo job ID trước render lại. Công việc cũ không ghi đè asset phiên bản mới. Không chạy lại TTS/ảnh đã thành công.
5. Render và xem/nghe một MP4 hoàn chỉnh 30–60 giây; xác minh TXT/SRT/MP4 thuộc cùng version. Chạy smoke/recovery test và kiểm tra tải về.

**Done:** AC07 và toàn bộ mốc B; file thật phát được và có âm thanh, phụ đề.

## Task 11 — Hardening, giới hạn và kiểm tra luồng hoàn chỉnh

**Files:**
- Modify: `src/lib/jobs/budget.ts`, Rules, worker checkpoints, các màn hình lỗi.
- Create: `tests/integration/full-flow.test.ts`, `tests/integration/access-and-budget.test.ts`.
- Create: `docs/qa/acceptance-checklist.md`, `docs/qa/live-results.md`.

**Steps:**
1. Integration test ở emulator: tạo campaign → mock AI → edit/approve → media metadata → export; token lạ, stale version và vượt hạn mức đều bị từ chối. Mock không thay thế live provider check.
2. Thử từng lỗi quan trọng: 429 provider, mất mạng, secret thiếu, output không đúng schema, upload lỗi, job treo, timeout trả phí mơ hồ; giao diện có cách xử lý và không báo thành công sai.
3. Kiểm tra ngân sách atomic khi hai job cùng gửi; usage phân biệt thực tế/ước tính/không rõ. Thêm giới hạn model calls, retry, bytes, instances; billing alert chỉ là cảnh báo.
4. Dùng checklist AC01–AC12, kiểm tra giao diện 390/768/1440 px, keyboard/focus/dialog, modal đóng/mở, edit chưa lưu, danh sách rỗng và listener khi quay lại trang.
5. Chạy `npm run typecheck`, `npm run test`, `npm run emulators:test`, `npm run build`; mong đợi exit 0. Ghi test nào mock/live, môi trường và giới hạn QA còn lại, không đưa secret vào kết quả.

**Done:** Có bằng chứng nghiệm thu theo AC, không chỉ ảnh chụp giao diện.

## Task 12 — Cấu hình production và bàn giao

**Files:**
- Create: `apphosting.yaml`, `docs/deployment/firebase.md`, `docs/operations.md`.
- Modify: `README.md`, `.env.example`, `firestore.indexes.json`, cấu hình dispatcher/worker.

**Steps:**
1. Chuẩn bị danh sách đầu vào còn thiếu: Firebase project/billing, owner UID, credentials model/image/TTS và hạn mức. Hướng dẫn nhập secret vào môi trường an toàn. Không gửi secret trong chat hoặc commit.
2. Chọn region tương thích App Hosting/Firestore/Storage/worker trước khi tạo dữ liệu. Thiết lập IAM cho web, dispatcher và worker; Cloud Run worker không mở anonymous; deploy Rules/indexes trước khi dùng dữ liệu thật.
3. Cấu hình App Hosting, Cloud Tasks, dispatcher/reconciliation, worker AI và worker render. Chỉ tạo/tính phí tài nguyên và triển khai khi người dùng cho phép giai đoạn đó; không bật auto-deploy từ một branch thử nghiệm ngoài ý muốn.
4. Smoke production bằng owner và người không có quyền; chạy một chiến dịch giới hạn ngân sách qua provider thật, đóng/mở lại trang, kiểm tra tải tệp và phục hồi. Kiểm tra không dựa vào filesystem tạm để giữ trạng thái agent.
5. Bàn giao URL, hướng dẫn dùng, sao lưu/xuất dữ liệu, dừng hàng đợi, khóa gọi AI, xử lý job `needs_reconciliation`, cập nhật nguồn sản phẩm và theo dõi chi phí. Ghi rõ mốc A/B đã hoàn thành tới đâu.

**Done:** AC12; chỉ gọi hoàn thành toàn bộ sau khi các live check bắt buộc qua, không còn chức năng chính chỉ chạy fixture.

## Ma trận kiểm tra yêu cầu

| Tiêu chí | Task chính | Bằng chứng |
| --- | --- | --- |
| AC01 truy cập | 2, 12 | Auth test, Rules emulator, smoke owner/UID khác |
| AC02 dữ liệu | 3, 4 | CRUD, tải lại, trình duyệt khác cùng owner |
| AC03 nội dung AI | 5–7 | Live output ba nhóm × bốn kênh và rubric |
| AC04 nguồn/số liệu | 3, 6 | Fixture thiếu giá/nguồn + đọc live sample |
| AC05 phiên bản | 4, 8–10 | Conflict, duyệt lại, media snapshot test |
| AC06 ảnh | 8 | PNG thật và kiểm tra trực quan |
| AC07 video | 9, 10 | MP4 probe + xem/nghe + SRT |
| AC08 phục hồi | 5, 7, 10 | Kill/restart, đóng/mở trang, checkpoint |
| AC09 chống trùng | 5, 10 | Concurrent dispatch, reconciliation |
| AC10 hạn mức | 5, 11 | Budget transaction + usage provenance |
| AC11 giao diện | 1, 7, 11 | Browser checklist desktop/mobile |
| AC12 bàn giao | 12 | URL được bảo vệ + tài liệu + smoke production |

## Điểm cần nhớ khi triển khai

- Thiết kế của người dùng đã chốt bộ UI/Firebase, chưa chốt model, nhà cung cấp TTS, tên thương hiệu hoặc mức chi phí. Người triển khai chọn phương án kỹ thuật và ghi quyết định; không tự gán những lựa chọn này thành ý kiến của người dùng.
- Thiếu cloud credential không ngăn xây giao diện, schema, emulator và adapter. Nó ngăn live test/production, và phải ghi đúng giới hạn đó.
- Tham khảo `@frontend-design`, `@ui-ux-pro-max`, `@vercel-react-best-practices` cho UI; `@vercel:build-agents`/`@vercel:eve` cho runtime, `@executing-plans` cho thực thi. Không dùng workflow Sites để ép chuyển dự án Firebase sang host khác.
- Không biến nhiệm vụ viết tài liệu thành cài dependency, tạo cloud project hoặc triển khai. Kế hoạch này chỉ được thực hiện ở bước tiếp theo sau khi phạm vi được duyệt.
