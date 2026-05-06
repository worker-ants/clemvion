<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Datetime 표기 규약

서버에서 받은 ISO 8601 datetime 문자열(`startedAt`, `finishedAt`, `createdAt`, `updatedAt`, `nextRunAt` 등)을 화면에 표시할 때는 반드시 `@/lib/utils/date`의 `formatDate(value, "datetime" | "date" | "time")` 또는 `timeAgo(value)`를 사용한다.

- 백엔드는 ISO 8601 + UTC(`...Z`)로만 응답하며, 클라이언트 TZ 변환은 표시 계층에서만 수행한다.
- `new Date(iso).toLocaleString()` / `toLocaleDateString()` / `toLocaleTimeString()`을 직접 호출하지 않는다 (앱 로케일 설정을 우회해 포맷 일관성이 깨진다).
