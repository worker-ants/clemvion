# Code Review 통합 보고서

> 대상 커밋: e904c5c — M-1 2단계 AiMemoryManager 단위 테스트 + 주석
> 리뷰 세션: 2026/06/21 21_43_55

## 전체 위험도
**LOW** — production 코드 변경은 주석 4줄 추가뿐이며 신규 결함 없음. 단위 테스트 신설로 회귀 격리 목적 달성. 일부 테스트 커버리지 갭(WARNING 3건)과 spec frontmatter 미등재(WARNING 1건, defer 확정)가 잔존.

---

## Critical 발견사항

_없음_

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `recall` 호출 인자 검증에서 `scopeKey` 불일치 가능성 — `resolveScopeKey` 반환값이 아닌 입력 `memoryKey` 원시값(`'k1'`)을 직접 기대해, 서비스가 키 변환을 적용하는 케이스를 감지하지 못함 | `ai-memory-manager.spec.ts` line 241–248 | `memoryKey=null/undefined` 케이스 추가 후 `recall` 두 번째 인자가 `resolveScopeKey` 반환값(`exec:exec-1`)임을 검증 |
| 2 | Testing | `system_text` contextInjectionMode 분기 미커버 — `ai-memory-manager.ts` line 321–334 의 `mode === 'system_text'` 경로에 전용 단위 케이스 없음 | `ai-memory-manager.spec.ts` — `injectMemoryContext` describe 블록 | `config: { contextInjectionMode: 'system_text' }` 케이스 추가, `finalSystemPrompt` append + `messages` 길이 불변 검증 |
| 3 | Testing | `summaryModelConfigId` 분기 미커버 — `ai-memory-manager.ts` line 220–226 의 `resolveConfig` 호출 경로가 단위 수준에서 고정되지 않음 | `ai-memory-manager.spec.ts` — `injectMemoryContext` describe 블록 | `summaryModelConfigId: 'sum-cfg'` 케이스 추가 후 `llmFake().resolveConfig` 1회 호출 검증 |
| 4 | Documentation | `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 에 `ai-memory-manager.ts` 미등재 — spec-coverage audit 시 갭 검출 가능. planner 위임 defer 확정이나 잔존 상태 | `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter | M-1 완료 후 planner 가 `ai-condition-evaluator.ts` + `ai-memory-manager.ts` 일괄 등재 + `§6.1` 구현 참조 갱신 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `config` 객체에서 `as number`/`as string` 강제 캐스팅 — 런타임 검증 부재. verbatim 이동된 기존 패턴으로 신규 위험 아님 | `ai-memory-manager.ts` — `injectMemoryContext` 내 다수 캐스팅 | Zod 스키마 또는 검증 헬퍼 추가 (중장기 개선 후보) |
| 2 | Security | `catch` 블록 에러 로그에 `workspaceId` 미포함 — 운영 장애 추적 컨텍스트 부족. 민감 정보 미노출은 올바름 | `ai-memory-manager.ts` line 200–207 | `{ workspaceId: args.workspaceId }` 를 구조화 필드로 추가 |
| 3 | Security | in-memory thread 직접 mutation — NestJS 단일 이벤트 루프 + Redis 직렬화로 실질 경쟁 없으나 "무상태 collaborator" 선언과 의미 충돌 | `ai-memory-manager.ts` line 241–246 | 주석에 근거 명시; 장기적으로 반환값에 `updatedSummaryState?` 포함해 호출부 위임 |
| 4 | Security | `_retry_state.json` 에 개발 머신 절대 경로 포함 — git 이력에 파일시스템 구조 노출 | `review/code/2026/06/21/21_26_26/_retry_state.json` | `review/**/_retry_state.json` 을 `.gitignore` 에 추가 (이번 PR 범위 밖, 별도 위생 작업) |
| 5 | Requirement | `injectMemoryContext` `queryText=''` 빈 문자열 폴백 케이스 있으나 `null`/`undefined` 케이스 미커버 (타입상 `string`이므로 런타임 유입 가능성 낮음) | `ai-memory-manager.spec.ts` `baseInject` 픽스처 | `queryText: ''` 케이스 추가 또는 string-only 의도 주석 명시 (비차단) |
| 6 | Requirement | `recall` 호출 인자 검증에서 `resolveScopeKey` 반환값을 암묵적 가정 — mock 상 동작은 정확하나 구현 변환 감지 불가 | `ai-memory-manager.spec.ts` line 242–248 | `resolveScopeKey` 호출 확인 + `recall` 두 번째 인자가 반환값인지 분리 검증 (비차단) |
| 7 | Maintainability | 픽스처 팩토리(`agentMemFake`) 반환값 타입 캐스팅이 5곳 이상 반복 — 시그니처 변경 시 누락 위험 | `ai-memory-manager.spec.ts` line 168–170, 183–184, 213–214, 292–295, 317 | 전용 타입 별칭 도입 또는 describe 블록 최상단 지역 변수로 단일 캐스팅 |
| 8 | Maintainability | `threadFake(turns, fullTurns)` 파라미터명이 역할 차이를 설명하지 않음 | `ai-memory-manager.spec.ts` line 82–86 | `excludingNodeTurns`/`fullThreadTurns` 로 변경 또는 JSDoc 1줄 추가 |
| 9 | Maintainability | `baseSched` 의 `target.turns: []` 가 `threadFake` 에 의해 override 되는 이중 데이터 경로 — 혼동 여지 | `ai-memory-manager.spec.ts` line 121 | 주석으로 "target.turns 는 baseSched 에서 무시됨 — 실제 turns 는 threadFake 주입" 명시 |
| 10 | Maintainability | 신규 섹션 주석 스타일(`[keepUserExchanges 도출]`)이 기존 `[5a]` 번호 포함 스타일과 미세 비일관성 | `ai-memory-manager.ts` line 262 | 향후 정리 시 `// ── [keepUserExchanges 도출] ──` 한 줄 헤더 + 블록 주석 패턴으로 통일 |
| 11 | Testing | `resolveMemoryStrategy` describe 에서 `mgr` 인스턴스 공유 — 현재 무상태 함수라 문제 없으나 상태 있는 케이스 추가 시 격리 깨질 수 있음 | `ai-memory-manager.spec.ts` line 76 | `beforeEach` 이동 또는 각 케이스 로컬 인스턴스 생성 (비차단) |

---

## SPEC-DRIFT 발견사항

| # | 태그 | 발견사항 | 갱신 대상 | 조치 |
|---|------|----------|-----------|------|
| 1 | [SPEC-DRIFT] | `tailMode`/`keepUserExchanges`/`insertAt` 파라미터가 `injectMemoryContext` 시그니처에 포함되어 있으나 `spec/4-nodes/3-ai/1-ai-agent.md` §6.2 d.5 본문에 명시되지 않음 — 구현이 spec 보다 구체화된 것 | `spec/4-nodes/3-ai/1-ai-agent.md` §6.2 d.5 | planner 위임: `tailMode: 'system-only'`/`'prepend'` 분기 + `keepUserExchanges` 도출 메커니즘 기술 |
| 2 | [SPEC-DRIFT] | `injectMemoryContext` 의 `queryText` 빈 값 → `finalSystemPrompt` 폴백 동작이 spec 에 미명시 — `ai-memory-manager.ts:175-181` 주석(M2 라벨)에 근거 있으며 코드 합리적 | `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 단계 1.3 또는 §12 Rationale | planner 위임: queryText 공백 시 finalSystemPrompt 폴백 정책 명시 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | config 강제 캐스팅·thread mutation·`_retry_state.json` 경로 노출 (모두 verbatim 이동된 기존 패턴, 신규 위험 없음) |
| requirement | LOW | SPEC-DRIFT 2건 (planner 위임), WARNING 2건 (테스트 커버리지 미세 갭, 비차단) |
| scope | NONE | 변경 범위 명확히 한정, 의도 이상 변경 없음 |
| side_effect | NONE | production 코드 변경 0 (주석만), 테스트는 순수 단위, 부작용 없음 |
| maintainability | NONE | 픽스처 팩토리 타입 캐스팅 반복·파라미터명 일부 불명확성·주석 스타일 미세 비일관성 (모두 INFO) |
| testing | LOW | `system_text` 분기·`summaryModelConfigId` 분기·scopeKey 전달 경로 단위 커버리지 미흡 (WARNING 3건) |
| documentation | LOW | spec frontmatter `code:` 미등재 (planner 위임 defer 확정, 현 PR 처리 불가) |

---

## 발견 없는 에이전트

- **scope**: 변경 범위가 RESOLUTION.md 지시사항과 1:1 대응, 이탈 없음
- **side_effect**: production 로직 변경 0, 순수 단위 테스트 신설, 부작용 없음
- **maintainability**: 발견된 사항 전원 INFO (차단 없음)

---

## 권장 조치사항

1. **(WARNING #1)** `recall` 검증 케이스에 `memoryKey=null/undefined` (exec-scope fallback) 케이스 추가 — `resolveScopeKey` 반환값이 `recall` 두 번째 인자와 일치하는지 직접 검증.
2. **(WARNING #2)** `contextInjectionMode: 'system_text'` 전용 케이스 1개 추가 — `finalSystemPrompt` append + `messages.length` 불변 검증.
3. **(WARNING #3)** `summaryModelConfigId: 'sum-cfg'` 케이스 추가 — `llmFake().resolveConfig` 1회 호출 검증.
4. **(WARNING #4 / SPEC-DRIFT #1·#2)** M-1 전체 완료 후 planner 위임: `1-ai-agent.md` §6.2 d.5에 `tailMode`/`keepUserExchanges` 메커니즘 기술, §6.1에 queryText 폴백 정책 명시, frontmatter `code:` 에 `ai-condition-evaluator.ts` + `ai-memory-manager.ts` 일괄 등재.
5. **(INFO #4)** `review/**/_retry_state.json` 을 `.gitignore` 에 추가 — 개발 환경 절대 경로 git 이력 노출 방지 (별도 위생 작업).
6. **(INFO 장기)** config 런타임 검증 헬퍼(Zod 또는 isFinite 체크) 추가, catch 블록 로그에 `workspaceId` 구조화 필드 포함.

---

## 라우터 결정

라우터가 선별 실행 (`routing_status=done`):

- **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명) — 전원 router_safety 강제 포함
- **제외**: `performance`, `architecture`, `dependency`, `database`, `concurrency`, `api_contract`, `user_guide_sync` (7명)

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 테스트 파일 신설 + 주석 추가 변경 — 성능 영향 없음 |
| architecture | production 로직 무변경, 구조 변경 없음 |
| dependency | 신규 의존성 추가 없음 |
| database | DB 접근 변경 없음 |
| concurrency | 동시성 관련 변경 없음 |
| api_contract | 공개 API 변경 없음 |
| user_guide_sync | 사용자 가이드 관련 변경 없음 |

- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (전체 실행 목록과 동일)