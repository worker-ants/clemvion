# 신규 식별자 충돌 검토 결과

검토 대상: `03-maintainability M-2` — `codebase/frontend/src/lib/api/constants.ts` 신규 도입 및 API_BASE_URL/WS_BASE_URL 분산 정의 통합

---

## 발견사항

발견된 CRITICAL/WARNING 급 충돌 없음. 하기 INFO 항목 1건을 기록한다.

---

- **[INFO]** `WS_BASE_URL` 명칭 — 기존 `WS_URL` 로컬 변수와의 전환 완전성 확인
  - target 신규 식별자: `WS_BASE_URL` (export, `codebase/frontend/src/lib/api/constants.ts:23`)
  - 기존 사용처: `codebase/frontend/src/lib/websocket/ws-client.ts` 에서 이전에 `const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001"` 로 파일-로컬 상수를 사용했으나, 변경 diff 에서 `WS_BASE_URL` import 로 교체 완료됨. 현재 코드베이스에서 `WS_URL` 이라는 이름의 잔류 정의나 import 는 존재하지 않음.
  - 상세: `WS_URL`(구)와 `WS_BASE_URL`(신)은 `_URL` suffix 공유로 혼동 여지가 있으나, 구 식별자는 파일-로컬 `const` 였고 이미 삭제됐으므로 실제 충돌 없음. 신규 export 이름 `WS_BASE_URL` 은 `API_BASE_URL` 과 대칭 구조를 가져 명명 일관성이 높음.
  - 제안: 변경 완료 상태이므로 추가 조치 불필요. 향후 다른 파일에서 WebSocket URL 을 참조할 때 `WS_URL` 이 아닌 `WS_BASE_URL` 을 import 하도록 주석/JSDoc 에 명시하면 충분.

---

## 검토 항목별 결과

| 항목 | 결과 |
|------|------|
| 요구사항 ID 충돌 | 해당 없음 — 본 변경은 요구사항 ID 를 새로 부여하지 않음 |
| 엔티티/타입명 충돌 | 없음 — 신규 export 는 `API_BASE_URL`, `WS_BASE_URL`, `getServerApiBaseUrl`, `LOCAL_API_FALLBACK`(모듈 내부 비공개). 기존 코드베이스 전체에서 동일 이름이 다른 의미로 export 된 사례 없음 |
| API endpoint 충돌 | 해당 없음 — endpoint 변경 없음 |
| 이벤트/메시지명 충돌 | 해당 없음 — 이벤트명 변경 없음 |
| 환경변수·설정키 충돌 | 없음 — `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, `INTERNAL_API_URL` 세 변수는 `.env.example` 및 spec 에 이미 정의된 기존 키를 그대로 참조. 신규 ENV var 도입 없음 |
| 파일 경로 충돌 | 없음 — `codebase/frontend/src/lib/api/constants.ts` 는 origin/main 에 존재하지 않던 신규 파일. `lib/constants/a11y.ts` 와 경로·역할이 구분되며(lib/api/ vs lib/constants/), 파일 헤더에 명시적 scope 분리 주석 포함 |

---

## 요약

M-2 변경이 도입하는 식별자(`API_BASE_URL`, `WS_BASE_URL`, `getServerApiBaseUrl`)는 기존 코드베이스에서 동일 이름으로 다른 의미·다른 scope 로 사용된 사례가 없다. 분산됐던 파일-로컬 `const API_BASE_URL`/`const WS_URL` 정의들은 모두 신규 `constants.ts` import 로 교체 완료됐으므로 이중 정의 충돌도 없다. 환경변수는 기존 키(`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, `INTERNAL_API_URL`)를 재사용하며 신규 키를 도입하지 않는다. 신규 파일 경로(`lib/api/constants.ts`)는 기존 `lib/constants/a11y.ts` 와 경로·역할이 명확히 분리된다. 신규 식별자 충돌 관점의 위험 요소는 발견되지 않았다.

---

## 위험도

NONE
