# RESOLUTION — webhook 1MB 게이트 최종 review (16_05_14)

원 SUMMARY: ai-review RISK=LOW, CRITICAL=0, WARNING=6 (전 14 reviewer 완주).
동반 `--impl-done`(review/consistency/2026/06/28/16_05_14, BLOCK:NO).

연속 4회 review 모두 LOW / 0 Critical. 본 RESOLUTION 으로 수렴 — 잔여는 비차단 hardening/defer.

## 조치 항목

| # | 카테고리 | 발견 | 조치 |
|---|---|---|---|
| W6 | Documentation | api-convention·error-handling Rationale 에 `PAYLOAD_TOO_LARGE`(전역)·`PUBLIC_WEBHOOK_BODY_TOO_LARGE`(도메인) 413 공존 근거 미기재 | **FIXED**: `3-error-handling.md ## Rationale` + `2-api-convention.md ## Rationale` 에 두 코드의 레이어·임계 구분 및 "전역 우선, 도메인 한도 시 별도 신설" 원칙 기재. |
| W5 | Documentation | 12-webhook Rationale 옵션 C 근거 미기재 (주장) | **오탐**: Rationale `### WH-NF-02 본문 크기 — 분리 임계(옵션 C) 결정 근거`(옵션 A/B 기각·`bodyParser:false` 순서·OOM 클램프·표준 413) 가 이미 존재(57f6987cd, grep 3건). impl-done INFO 4 도 "적절히 추가됨" 으로 확인. |
| (impl-done) W1 | Convention | `PAYLOAD_TOO_LARGE` §1.3 섹션 의미 레이어 nit | **defer**: invariant 미위반. 동일 checker 의 INFO 1 이 "§1.3 = 요청-수준 클라이언트 에러 카탈로그로 현행 유지 가능" 으로 인정. 차후 spec 편집 시 통합 가능. |

## 보류·후속 항목 (비차단 — 리뷰어가 future/중기/defer 로 명시)

- **W1 (security, 4xx 메시지 노출, CWE-209)**: 현재 도달 오류는 body-parser `PayloadTooLargeError`(message "request entity too large", 무해) 하나뿐. http-errors 기반 미들웨어(multer·passport 등) 추가 시 allowlist 클래스 검사 또는 generic 메시지 도입을 **그 시점에** 검토. `mapHttpErrorLike` 가 단일 진입점이라 후속 hardening 용이.
- **W2 (security, fail-open 탐지)**: `PublicWebhookThrottleGuard` 의 DB 장애 fail-open 은 **pre-existing**(본 PR 무관). `logger.error` 격상/메트릭 연동은 모니터링 작업으로 분리 권장.
- **W3 (side effect, `req.__publicWebhookTrigger` 변이)**: 현행 단일 라우트(@UseGuards) 에서 안전. Guard 확대 시 소비처 확인 관행 — 후속.
- **W4 (maintainability, `extractClientIp` Guard export)**: plan 기술부채 항목으로 이미 추적(`plan/complete/spec-sync-webhook-gaps.md` — Guard SRP·extractClientIp 이동).
- **impl-done W2** (`document:graph_error`): 본 PR 무관(graph-rag), `plan/in-progress/spec-sync-structural-followups.md` 추적 중.
- **오탐 정정**: ai-review INFO 8(e2e requestId 단언 이미 존재)·INFO 14(.env.example·triggers.mdx 이미 완료) — 직전 라운드에서 반영 완료.
- INFO(captureRawBody 전역 적용·factory limit 단위·endpoint_path 인덱스·GraphTraversal disambiguation 등): 비차단 현행/후속.

## TEST 결과

- 본 RESOLUTION 의 조치(W6)는 **spec-only**(api-convention·error-handling Rationale) — codebase 무변경. 직전 commit(57f6987cd)의 TEST WORKFLOW(lint·unit·build·e2e 225) 가 codebase 상태를 그대로 커버한다.
- spec-link-integrity 가드: 신규 Rationale 앵커(`#비기능-요구사항`·`#rationale`) 정합 — 통과 확인.
