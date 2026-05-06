# Resolution — 2026-05-06_10-59-33

리뷰 대상 변경(`f59499ed..HEAD`):
- `$today` 제거 + 프론트엔드 datetime 클라이언트 TZ 표기 통일

본 리뷰는 변경된 26개 파일 + 호출 콘텍스트 전반을 스캔하여 22개 WARNING + 14개 INFO를 보고했다. 본 PR의 직접 범위(= `$today` 제거 + datetime 표시 일원화)에 직접 묶이는 항목과 그렇지 않은 사전 결함을 분리해 조치 여부를 결정한다.

---

## 조치한 항목 (이번 PR에서 해결)

### WARNING #1 — `$today` Breaking change 명시화 (API Contract / Side Effect / Dependency)

`{{ $today }}` 표현식은 evaluator에서 `EXPR_REFERENCE_ERROR`(`Undefined variable: $today`)로 명확히 실패한다 (`packages/expression-engine/src/evaluator.ts:169,182`). 사일런트 undefined가 아니므로 사용자가 마이그레이션 필요성을 즉시 인지한다. fallback alias(예: `$today` → `formatDate($now, "YYYY-MM-DD")`)는 추가하지 않는다 — 기존 UTC 기준 산출이 KST 자정 직전 전날로 표시되는 정확히 그 버그를 다시 노출시키므로 의도와 어긋난다.

- 추가: `packages/expression-engine/src/__tests__/expression.spec.ts` — `{{ $today }}`가 `Undefined variable: $today`를 throw 하는 회귀 테스트.
- 마이그레이션 안내: `frontend/src/content/docs/03-expression-language/variables-and-context.{mdx,en.mdx}` 의 Callout 노트로 노출 (`formatDate($now, "YYYY-MM-DD")` 또는 `today()`).
- DB에 저장된 워크플로 일괄 마이그레이션 스크립트는 본 PR 범위 외 — 별도 운영 작업으로 분리.

### WARNING #6 — CalendarView `toLocaleString("default", ...)` AGENTS.md 규약 위반

`schedules/page.tsx:368`의 `viewDate.toLocaleString("default", {...})` 직접 호출을 제거하고 `formatDate(viewDate, "month-year")`로 교체했다. `formatDate`에 `"month-year"` 포맷 분기를 추가했다 (`frontend/src/lib/utils/date.ts`).

### WARNING #10 — `$today` 제거 회귀 테스트 누락 (Testing)

- 추가: `frontend/src/components/editor/expression/__tests__/variable-picker.test.tsx` — picker가 `$today`를 노출하지 않음을 명시적으로 단언.
- 추가: `backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts` — `buildExpressionContext()` 결과에 `$today` 키가 없음을 단언.
- 추가: `packages/expression-engine/src/__tests__/expression.spec.ts` — `{{ $today }}` 평가 시 `EXPR_REFERENCE_ERROR` 회귀 테스트.

### WARNING #13 — 스토어 로케일 폴백 테스트 누락 (Testing)

- 추가: `frontend/src/lib/utils/__tests__/date.test.ts` — `useLocaleStore`에 `"ko"` 설정 후 `formatDate(..., "date")` (locale 인수 생략) 결과가 영문 포맷이 아님을 검증.

### WARNING #18 — `formatDate` 유효하지 않은 입력 처리 부재 (Requirement)

- `frontend/src/lib/utils/date.ts` — `Number.isNaN(d.getTime())` 가드 추가, 실패 시 `"—"` 반환.
- 테스트: `formatDate("not-a-date", "datetime")` / `formatDate("", "date")`가 `"—"`를 반환하는 케이스 추가.

### WARNING #19 — `"datetime"` 포맷 시간 컴포넌트 미검증 (Requirement)

- `frontend/src/lib/utils/__tests__/date.test.ts` — `expect(result).toMatch(/\d{1,2}:\d{2}/)` 단언 추가.
- 부수 수정: 일부 엔진에서 `toLocaleDateString`이 시간 옵션을 무시하는 가능성을 차단하기 위해 `"datetime"` 분기를 `toLocaleString`으로 전환 (INFO #2 동시 해결).

### INFO #1 — `formatDate` `format` 파라미터 타입 정밀화

`format?: string` → `format?: DateFormat`(union: `"iso" | "date" | "datetime" | "time" | "month-year"`)로 좁히고 `DateFormat` 타입을 export 했다. 호출부의 오타 방어가 타입 단계에서 적용된다.

### INFO #2 — `"datetime"` 포맷에서 `toLocaleDateString` → `toLocaleString` 전환

WARNING #19 수정과 함께 처리. 시간 컴포넌트가 표준대로 항상 출력된다.

### INFO #6 — `dayjs` 미사용 의심

검증 결과 `frontend/src/lib/transform/apply-operation.ts`가 dayjs를 사용 중이다 (transform 노드의 날짜 연산). 의존성 유지가 정당하다. **별도 조치 없음.**

### INFO #21 → WARNING 보강 — `today()` 함수 구현 검증

`packages/expression-engine/src/functions/date.ts:92-94`에 정의되어 있고 `functions/index.ts:25`에서 `register(dateFunctions)`으로 등록되며 `evaluator.ts:252`의 `getFunction(fnName)`을 통해 호출 가능하다. 문서(`variables-and-context.{mdx,en.mdx}`)의 마이그레이션 안내가 정확하다. **별도 조치 없음.**

---

## 의도적으로 deferral한 항목 (사전 존재 / 본 PR 범위 외)

다음 항목은 본 PR이 도입한 것이 아니라 사전부터 존재한 결함이다. 단순 통합 보고에 묶여 노출됐을 뿐이며, 본 PR 범위(= `$today` 제거 + datetime 일원화)와 결합도가 낮다. 각각이 독립적인 보안·아키텍처 의사결정을 요구하므로 별도 PR로 처리한다. (developer skill의 "기존 이슈도 해결" 원칙은 변경 영역과 인접한 결함에 대한 가이드로 해석. 별 영역의 보안 디자인 결정까지 본 PR에 누적시키면 리뷰 가능성·리버트 안전성이 모두 무너진다.)

| # | 카테고리 | 항목 | Deferral 사유 |
|---|----------|------|---------------|
| WARN #2 | Security | OAuth 팝업 URL allowlist 검증 (`integrations/[id]/page.tsx`) | 사전 존재. 허용 도메인 정책이 인프라 결정 사항. 별도 보안 PR 권장. |
| WARN #3 | Security | Webhook `endpointPath` 경로 탐색 검사 (`trigger-detail-drawer.tsx`) | 사전 존재. 백엔드의 `endpointPath` 생성 규약과 함께 검토 필요. |
| WARN #4 | Security/Architecture | `window.confirm` → 인앱 다이얼로그 (`integrations/[id]/page.tsx:853`) | 사전 존재. UI/UX 합의 필요. |
| WARN #5 | Security | 타임존 입력 클라이언트 검증 (`schedules/page.tsx:891-898`) | 사전 존재. 백엔드 검증과 일관성 검토 필요. |
| WARN #7,#8 | Architecture/Maintainability | `getWebhookUrl`/`TYPE_BADGE_STYLES` 중복 + 포트 `:3011` 하드코딩 | 사전 존재. 환경변수(`NEXT_PUBLIC_WEBHOOK_BASE_URL`) 도입은 배포 설정 변경 동반. |
| WARN #9 | Architecture/Requirement | `trigger-detail-drawer.tsx` i18n 미적용 | 사전 존재. 번역 키 신규 등록 필요, 별도 i18n PR 적합. |
| WARN #11 | Testing | `filterRootVariablesByScope` 테스트 부재 | 사전 존재. variable-picker 테스트로 일부 커버되지만 정밀화는 별도. |
| WARN #12 | Testing/Security | `isSafeUrl` 보안 함수 테스트 부재 (`button-bar.tsx:33-39`) | 사전 존재. 본 PR은 동일 파일에 import만 추가. 보안 테스트는 별도 PR로 분리해 가시성 확보. |
| WARN #14 | Architecture | `ConversationItem`의 `"rag"` 타입 우회 | 사전 존재. union 확장이 다른 호출부 다수 갱신 동반. |
| WARN #15 | Architecture | `formatRel` → `timeAgo()` 일원화 | 사전 존재. `timeAgo()`와 `formatRel()`은 임계값(초/분 cutoff)이 달라 사용자 노출 텍스트가 변동. UX 합의 필요. |
| WARN #16 | API Contract | `/triggers/{id}/history` / `/workflows` 응답 형식 불일치 | 사전 존재. 백엔드 응답 단일화가 선행. |
| WARN #17 | Performance | `getCronDescription()` 미캐시 | 사전 존재. 본 PR 변경 영역 외(렌더 루프). |
| WARN #20 | Documentation | EN/KO cheatsheet 옵셔널 체이닝 예시 비대칭 | 사전 존재. 옵셔널 체이닝은 본 PR과 무관. |
| WARN #22 | Concurrency | `ButtonBar` 클릭 가드 TOCTOU | 사전 존재. 이론적 위험. |
| INFO #3 | Maintainability | `RawSchedule`/`mapSchedule` 모듈 최상단 이동 | 사전 존재. 본 PR 변경 라인과 멀다. |
| INFO #4,#5 | Performance | 정규식·Intl 포맷터 메모이제이션 | 사전 존재. 측정 후 결정 권장. |
| INFO #7 | Dependency | `"use client"` 전파 | 사전 존재. SSR 경계 디자인 결정 필요. |
| INFO #8,#9 | Testing | `summarizeToolResult`/`getRunDaysInMonth` 테스트 | 사전 존재. 별도 테스트 보강 PR 적합. |
| INFO #10,#11 | Security | toast 메시지 / AI 툴 호출 인자 마스킹 | 사전 존재. 마스킹 정책 결정 필요. |
| INFO #12 | Maintainability | picker 제외 목록 데이터화 | 사전 존재. 작은 리팩토링이지만 본 PR 범위 외. |
| INFO #13,#14 | Requirement/API | 버전 히스토리 정렬 / `/schedules?limit=200` | 사전 존재. 본 PR 변경과 무관. |

---

## 검증

- `cd packages/expression-engine && npm run build && npm test -- --silent` → 123 tests passed
- `cd backend && npm run lint && npx jest --silent` → 2716 tests passed (167 suites)
- `cd frontend && npm run lint && npx vitest run` → 1208 tests passed (103 suites)
- `cd backend && npm run build` → success
- `cd frontend && npm run build` → success

테스트는 모두 통과했고, 빌드는 백/프론트 모두 클린이다.
