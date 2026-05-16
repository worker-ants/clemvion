# RESOLUTION — Cafe24 PUT/POST `request` envelope fix

리뷰 세션: `review/code/2026/05/16/15_12_52/`
적용 커밋: `97d02fb4` (초기 fix) + 후속 fixup 커밋 (본 RESOLUTION 과 함께)
SUMMARY: Critical 0, Warning 5, INFO 13

전체 위험도 MEDIUM 으로 평가됨. 본 단계에서 Warning 5건 전부와 INFO 중 본 PR 범위에 자연스럽게 결속되는 항목을 함께 조치했다. 나머지 INFO 는 기존 코드 부채·미래 시나리오 영역으로 이월.

## 조치 — Warning (전부 해결)

| # | 항목 | 조치 | 위치 |
|---|------|------|------|
| W#1 | spec 미반영 | 본 PR 범위 밖 — `plan/in-progress/spec-update-cafe24-request-envelope.md` 에 인계 노트 작성 완료. `project-planner` 가 본 PR 머지 직후 spec 본문에 반영하도록 위임. | `plan/in-progress/spec-update-cafe24-request-envelope.md` |
| W#2 | DELETE 누락 + 조건 단순화 | envelope 적용 조건을 `opts.method !== 'GET'` 에서 `WRITE_METHODS_WITH_ENVELOPE = {'POST','PUT'}` allowlist 로 변경. DELETE 가 body 를 받아도 envelope 미적용. 미래 PATCH 등 추가 시 명시적 검토 강제. DELETE wire body 가 wrap 되지 않음을 단언하는 테스트 추가. | `cafe24-api.client.ts:178-186` (상수), `:716-728` (callsite), `cafe24-api.client.spec.ts` 'DELETE — envelope NOT applied …' |
| W#3 | 이중 래핑 가드 | `wrapInCafe24Envelope` 진입부에 `Object.prototype.hasOwnProperty.call(body, 'request')` 검사 → `Error` throw. JSDoc 에 "caller must not pre-wrap" 명시. 직접 단위 테스트 'throws when caller pre-wraps with a `request` key' 로 회귀 고정. | `cafe24-api.client.ts:wrapInCafe24Envelope`, `cafe24-api.client.spec.ts` 신규 describe `'wrapInCafe24Envelope (direct unit tests)'` |
| W#4 | 재귀 재시도 안전성 (계약 미명시) | `wrapInCafe24Envelope` 의 **Purity** 절을 JSDoc 에 추가: "returns a new object; never mutates the input. Safe to call repeatedly on the same `Cafe24CallOptions` across 429 retry attempts." 비파괴성을 단위 테스트 'does not mutate the input object' 로 고정. | `cafe24-api.client.ts:wrapInCafe24Envelope` JSDoc, `cafe24-api.client.spec.ts` 직접 단위 테스트 |
| W#5 | falsy shop_no + 직접 단위 테스트 부재 | `shop_no === undefined` 만 hoist 제외, `null`/`0` 은 top-level 로 hoist (Cafe24 단일 mall 흐름에서 `0` 이 의미 있음). 직접 단위 테스트 'hoists falsy shop_no values (0, null)' / 'omits shop_no key when value is undefined' 로 계약 고정. JSDoc 의 **`shop_no` handling** 절에 의도 명시. | `cafe24-api.client.ts:wrapInCafe24Envelope`, `cafe24-api.client.spec.ts` 직접 단위 테스트 |

## 조치 — INFO

| # | 항목 | 처리 |
|---|------|------|
| #5 | shop_no null/0 처리 | W#5 와 함께 해결 |
| #6 | wrapInCafe24Envelope 반환 타입 강화 | 반환 타입을 `{ shop_no?: unknown; request: Record<string, unknown> }` 로 명시 |
| #7 | 함수 본문 단순화 | 중간 변수 `envelope` 제거. 삼항으로 단일 return 식. |
| #8 | 테스트 boilerplate | `captureWireBody` helper + `it.each` 테이블로 4 케이스 (PUT w/ shop_no, PUT w/o shop_no, POST, PUT shop_no-only) 통합 |
| #9 | Content-Type 단언 일관성 | `it.each` 안에서 Content-Type 도 매 케이스 단언 |
| #10 | plan frontmatter `owner` 정규화 | `developer (→ project-planner 위임 필요)` → `developer` + 위임 의도는 본문 인용에 분리 |
| #13 | top-level 예외 필드 근거 | JSDoc 에 "Source: every `https://developers.cafe24.com/docs/ko/api/admin/` "Request body" sample follows this exact shape; no other top-level keys are documented across the catalog we use." 명시 |

## 이월 — INFO (본 PR 범위 밖, 별도 작업 추천)

| # | 항목 | 이월 사유 |
|---|------|----------|
| #1 (security) | `Cafe24AuthFailedError.responseBody` / `summarizeCafe24ErrorBody` sanitize 미적용 | 기존 코드의 사전 결함. envelope fix 와 결속되지 않음. SEC-C2 작업 라인 (`sanitizeLastErrorMessage` 도입 PR) 의 후속으로 별도 PR 권장 |
| #2 (security/test) | `process.env.CAFE24_CLIENT_ID/SECRET` 직접 mutate 패턴 | 기존 token refresh 테스트의 격리 이슈. 본 PR 의 신규 테스트는 env 를 건드리지 않음 |
| #3 (architecture) | `Cafe24ApiClient` 의 5 관심사 분리 | 기존 부채. 본 PR 이 악화시키지 않음 (오히려 envelope 책임을 `Cafe24ApiClient` 내부의 단일 helper 로 분리해 응집도 약간 개선) |
| #4 (requirement) | PATCH 추가 시 경로 | W#2 의 allowlist 화로 자동 차단됨 (PATCH 가 추가되면 명시적으로 set 에 등록해야 envelope 적용 — 의도된 강제 검토) |
| #11 (performance) | `detectInsufficientScope` 정규식 중복 | 오류 경로 전용, 핫패스 영향 없음. 본 PR 영역 외 |
| #12 (testing) | PR 노트의 CI pass 기록 | 본 RESOLUTION.md 와 plan 문서가 그 기능을 한다. RESOLUTION 의 본 절이 곧 CI pass 증거 (lint 0 error, 3702 unit pass, build OK) |

## TEST WORKFLOW 재실행 결과

- `cd backend && npm run lint` — 0 errors, 17 warnings 모두 `src/scripts/migrate-node-output-refs.ts` (무관 마이그레이션 스크립트). 본 PR 변경 파일 0 warning.
- `cd backend && npm test` — **3702 passed / 0 failed** (이전 3697 + 신규 5: DELETE 1 + wrapInCafe24Envelope 직접 단위 테스트 4).
- `cd backend && npm run build` — success (nest build).
- `make e2e-test` — 본 변경은 Cafe24 wire format 만 바꾸며 외부 mall 의존이라 e2e 인프라가 부재. 회귀는 `Cafe24ApiClient` 의 `fetchImpl` mock 단위 테스트로 정확히 보호됨. `[skip-e2e]` 적용.

## 자동 후속 흐름 — 단계 차단 여부

- consistency-check: BLOCK: NO (사전 점검은 단계 2 에서 lightweight 직접 확인으로 대체 — 본 PR 은 새 spec 충돌·naming collision 없음)
- e2e: 인프라 외 의존으로 본 PR 의 회귀 보호는 단위 테스트가 담당.
- 자동 진행 중단 사유 없음.
