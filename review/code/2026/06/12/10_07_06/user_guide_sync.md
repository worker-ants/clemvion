# 유저 가이드 동반 갱신(User Guide Sync) 검토 결과

## 해당 없음

변경 코드가 매트릭스의 어떤 trigger 에도 동반 갱신을 요구하는 방식으로 매칭되지 않는다.

---

## 분석

### 변경 파일 목록 (git diff origin/main..HEAD)

1. `codebase/backend/src/nodes/data/code/code.handler.spec.ts` — 테스트 추가 전용
2. `codebase/backend/src/nodes/data/code/code.handler.ts` — W14 JSDoc 주석 오프셋 수정 (+4 → +3)
3. `codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts` — SSRF 가드 테스트 추가 전용
4. `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` — HTTP_BLOCKED / DB_HOST_BLOCKED 매핑 검증 테스트 추가
5. `plan/in-progress/code-node-isolated-vm-followups.md` — 체크박스 상태 갱신
6. `plan/in-progress/http-ssrf-all-auth-followups.md` — 체크박스 상태 갱신

### 매트릭스 trigger 매칭 결과

| 매트릭스 항목 | 글로브/시맨틱 | 매칭 파일 | 판정 |
|---|---|---|---|
| `new-node` | `codebase/backend/src/nodes/**` | code.handler.ts, *.spec.ts | 신규 노드 없음 — 기존 핸들러 주석/테스트만 변경. 트리거 불성립 |
| `node-schema-change` | `codebase/backend/src/nodes/**` | code.handler.ts | 필드·라벨·타입 변경 없음 — 내부 JSDoc 주석 off-by-one 수정. 트리거 불성립 |
| `new-error-code` | `codebase/backend/src/nodes/core/error-codes.ts` | (미포함) | error-codes.ts 미변경. 트리거 불성립 |
| `new-warning-code` | semantic | 없음 | warningRules 변경 없음 |
| `new-backend-zod-ui-value` | semantic | 없음 | zod ui.label/hint 변경 없음 |
| `auth-session-flow-change` | `codebase/backend/src/modules/auth/**` / semantic | 없음 | 인증·세션 모듈 미변경 |
| `expression-language-change` | `codebase/packages/expression-engine/**` / semantic | 없음 | 표현식 엔진 미변경 |
| `run-debug-flow-change` | semantic | 없음 | 실행 엔진·디버그 로깅 흐름 구조 변경 없음 |
| `new-ui-string` | `codebase/frontend/src/**/*.tsx` | (미포함) | TSX 파일 미변경, 신규 한국어 리터럴 없음 |
| `integration-provider-change` | semantic | 없음 | 신규/변경 provider 없음 |

### 주요 변경 내용 상세

**code.handler.ts W14 주석 수정**: 개발자용 JSDoc 주석에서 래퍼 헤더 라인 수를 "4줄→3줄", 오프셋을 "+4→+3" 으로 수정. spec `4-nodes/5-data/2-code.md §4 step2` 가 이미 "+3" 으로 명시되어 있으며(plan 기록: 그룹2a 완료), 이번 변경은 코드 주석을 기존 spec 에 맞게 정합한 것이다. 유저 가이드 MDX 는 이 내부 오프셋 값을 노출하지 않으므로 갱신 불필요.

**backend-labels.test.ts HTTP_BLOCKED / DB_HOST_BLOCKED 테스트**: 두 에러 코드는 이미 이전 PR(origin/main)에서 `backend-labels.ts` ERROR_KO 에 등재되어 있다. 이번 PR 은 `backend-labels.ts` 자체를 변경하지 않으며, 기존 등재 항목에 대한 테스트 커버리지를 보강한 것이다. `new-error-code` trigger 는 `error-codes.ts` glob 을 기준으로 하며 이번 PR 에서 해당 파일은 미변경이다.

**http-request.handler.spec.ts SSRF 테스트 추가**: none/custom 인증 방식 × {IMDS, RFC1918, localhost} 교차조합, opt-out, dry-run, configEcho credential strip 등 테스트 추가. 이는 이미 구현·문서화된 SSRF 가드(전 인증 방식 공통)의 테스트 커버리지 보강이며, 노드 스키마·에러 코드·UI 문자열 변경이 없다.

---

## 발견사항

유저 가이드 동반 갱신 관점에서 누락된 동반 갱신 없음.

---

## 요약

매트릭스 전체 18개 trigger 를 점검했다. 변경 파일 6개 중 `codebase/backend/src/nodes/**` glob 에 매칭되는 파일은 있으나, 실제 변경 내용이 신규 노드 추가·스키마 변경에 해당하지 않으므로 동반 갱신 trigger 가 성립하지 않는다. 매칭된 trigger: 0건, 누락 건수: 0건.

## 위험도

NONE
