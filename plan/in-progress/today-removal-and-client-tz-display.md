# `$today` 제거 + 프론트엔드 datetime 클라이언트 TZ 표기 통일

## 배경

`$today`(`expression-resolver.service.ts:91`)는 `now.toISOString().split('T')[0]`로 산출되어 **항상 UTC 기준 날짜**가 박힌다. KST 자정 직전(UTC 15:00 이전)에는 전날로 찍히는 잠재 버그가 있다. ISO 8601에는 date-only(`YYYY-MM-DD`)에 타임존을 붙이는 표준 포맷이 없으므로 "표준 + TZ 명시"를 동시에 만족하는 변수 디자인은 비표준을 끌어들여야 한다.

→ 사용자 결정: `$today` 자체를 **제거**하고, ISO datetime 표시는 **프론트엔드에서 클라이언트 TZ로 변환**한다. 백엔드 `$now`/`$execution.startedAt`은 시스템/감사 성격으로 UTC ISO(`...Z`)를 유지한다.

## 결정사항

| 변수/필드 | 결정 |
| --------- | ---- |
| `$now` | UTC ISO 유지 (변경 없음) |
| `$today` | **삭제** |
| `$timezone`, `$todayStart` | 추가하지 않음 |
| `$execution.startedAt` 등 ISO 필드 | 백엔드는 UTC ISO 유지, 프론트에서 클라이언트 TZ로 표시 |

## 작업 체크리스트

### 1. 문서 갱신 (DOCUMENTATION 단계)

- [ ] `spec/5-system/5-expression-language.md:164` — `$today` 행 제거
- [ ] `spec/5-system/4-execution-engine.md:455` — `$today` 제거
- [ ] `user_memo/node-specs/README.md:54` — 행 제거
- [ ] `user_memo/technical-report/07-핵심-기술-5-Expression-Language.md:147,222` — 갱신
- [ ] `frontend/src/content/docs/03-expression-language/variables-and-context.{mdx,en.mdx}` — 표/섹션 갱신, 마이그레이션 안내 추가
- [ ] `frontend/src/content/docs/03-expression-language/cheatsheet.{mdx,en.mdx}` — `$today` 예시 → `formatDate($now, "YYYY-MM-DD")`

### 2. 백엔드 — TDD

- [ ] `expression-resolver.service.spec.ts` — `$today` 픽스처 제거 + `buildExpressionContext()`에 `$today` 키 미존재 회귀 테스트
- [ ] `expression-resolver.service.ts:91` — `$today` 라인 삭제
- [ ] `packages/expression-engine/src/evaluator.ts:27` — 인터페이스 `$today` 필드 삭제 + 빌드
- [ ] `backend/src/modules/workflow-assistant/prompts/system-prompt.ts:427` — 변수 목록에서 `$today` 제거 (다른 prompt도 grep)
- [ ] `grep -rn '\$today' backend/src` 결과 0건 확인

### 3. 프론트엔드 — TDD

- [ ] `frontend/src/lib/utils/__tests__/date.test.ts` — `formatDate("time")` 테스트 추가
- [ ] `frontend/src/lib/utils/date.ts:64-89` — `"time"` 포맷 분기 추가
- [ ] `frontend/src/components/editor/expression/expression-constants.ts:32` — `$today` 항목 삭제
- [ ] `frontend/src/components/editor/expression/__tests__/variable-picker.test.tsx` — 단언 갱신
- [ ] 16 callsite를 `formatDate(..., "datetime"|"time")`으로 교체:
  - [ ] `app/(main)/triggers/page.tsx:462`
  - [ ] `app/(main)/schedules/page.tsx:1031`
  - [ ] `app/(main)/integrations/[id]/page.tsx:298,304,312,320,484,770`
  - [ ] `app/(main)/authentication/page.tsx:394,476,521`
  - [ ] `app/(main)/workspace/settings/page.tsx:462`
  - [ ] `components/triggers/trigger-detail-drawer.tsx:165,196`
  - [ ] `components/editor/run-results/button-bar.tsx:97`
  - [ ] `components/editor/run-results/conversation-inspector.tsx:412`
- [ ] `version-history-panel.tsx`의 인라인 `formatTimestamp()` → `formatDate("datetime")`
- [ ] `integrations/[id]/page.tsx`의 인라인 `formatRel()` → `timeAgo()`
- [ ] `frontend/AGENTS.md`(또는 CLAUDE.md)에 datetime 표시 규약 한 줄 추가
- [ ] `grep -rn '\$today' frontend/src` 0건, `grep 'new Date(.*).toLocale.*String' frontend/src`는 `lib/utils/date.ts` 외 0건

### 4. TEST WORKFLOW

- [ ] 백엔드: lint → unit → build
- [ ] 프론트엔드: lint → unit → build
- [ ] `@workflow/expression-engine` 패키지 빌드

### 5. REVIEW WORKFLOW

- [ ] `ai-review` 실행
- [ ] 이슈 조치 + `review/<timestamp>/RESOLUTION.md` 작성
- [ ] TEST WORKFLOW 재수행

## 비목표

- `today()` 표현식 함수의 TZ 모호성 해결 (별도 follow-up)
- 워크플로 DB의 `$today` 자동 마이그레이션
- ESLint custom rule 도입
- 알림(이메일/Slack)의 datetime 포맷 통일
- `$now`/`$execution.startedAt`의 로컬 TZ 변환

## 마이그레이션 안내 (사용자/문서용)

`{{ $today }}` → `{{ formatDate($now, "YYYY-MM-DD") }}` (UTC 기준) 또는 `{{ today() }}` (서버 로컬 TZ).
