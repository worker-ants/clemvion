# Code Review 통합 보고서

## 전체 위험도
**LOW** — 이번 diff(테스트 하드닝 + JSDoc/주석 정정 + 직전 리뷰 산출물 커밋)에 프로덕션 로직 변경은 없으며 Critical 발견 없음. 다만 (1) 이 PR 자신이 표방한 "mutation 커버리지 완결"이 부분적이라는 실측 WARNING 1건과, (2) 함께 커밋된 직전 리뷰(20_06_14) 산출물의 감사 기록 정확성 WARNING 2건이 있어 완전한 NONE 은 아니다. **강제 화이트리스트(router_safety) 7개 reviewer 전원 결과 확보됨 — 누락 없음.**

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `isConversationOutput` OR-체인 중 이번 PR 이 다루지 않은 mutation 무방비 분기가 4곳 더 있음(실측 확인: 각 guard 를 임시 제거해도 기존 35개 테스트가 전부 green). 특히 `isCanonicalWaiting` 의 `hasLegacyMessages` guard 제거는 실무 영향이 가장 큼 — `form`/`buttons`/`ai_form_render` 등 다른 대기 노드도 `waiting_for_input` 상태를 가지므로, 이 guard 가 리팩터링 중 실수로 사라지면 폼/버튼 대기 노드가 대화 미리보기 탭으로 오분류될 수 있다 | `codebase/frontend/src/components/editor/run-results/output-shape.ts` — top-level `conversationConfig` disjunct, 첫 OR-항의 `hasLegacyMessages` guard, `looksLikeConversationEnd` 의 `hasResultMessages` guard, `isCanonicalWaiting` 의 `hasLegacyMessages` guard | testing 리포트에 제시된 4개 fixture(현재 코드 기준 통과 확인됨)를 후속 커밋으로 추가해 4곳 모두 mutation 고립 |
| 2 | requirement | 함께 커밋되는 직전 리뷰 세션 산출물 `review/code/2026/07/17/20_06_14/SUMMARY.md` 가 "testing 리뷰어 재시도 완료/해소됨"이라 주장하지만 근거로 지목한 `## testing 재시도 결과` 절은 실제로 `(재시도 진행 중 — 완료 시 main Claude 가 이 절을 갱신한다.)` 라는 미갱신 placeholder 그대로임(실측 확인). 같은 세션의 `RESOLUTION.md` 는 오히려 "testing 리뷰어 판정 미확보, 6회 재시도 모두 harness 장애로 차단" 이라 정직하게 서술 — SUMMARY.md 의 "해소됨" 주장이 같은 커밋의 RESOLUTION.md 와 모순 | `review/code/2026/07/17/20_06_14/SUMMARY.md` (배너, 에이전트별 위험도 표의 testing 행, `## testing 재시도 결과` 절, 권장조치사항 1번) | SUMMARY.md 의 "해소됨/완료" 서술을 RESOLUTION.md 와 일치하도록 낮추거나(예: "미해소 — 대체 완화로 잔여 리스크 LOW"), forward-reference 한 `## testing 재시도 결과` 절에 실제 결과를 채워 완결시킬 것 |
| 3 | requirement | 같은 세션(20_06_14)의 `RESOLUTION.md` 가 반영한 라인 번호 drift WARNING(결합 prompt 문서 오프셋을 실제 파일 위치로 오기재)은 실은 동일 세션의 다른 리뷰 문서에 최소 3건 더 존재하는 동일 계열 결함 중 1건만 고친 것 — `maintainability.md`("output-shape.ts line 986-994", 실제 140-148 / 신규 테스트 "line 40-96·735-791" 둘 다 실제 위치(633-689) 아님), `side_effect.md`("output-shape.ts L813-L838", 실제 112-149) | `review/code/2026/07/17/20_06_14/maintainability.md`, `review/code/2026/07/17/20_06_14/side_effect.md` | 후속 커밋에서 위 3건도 함수/블록명 기반으로 정정하거나, 최소한 "review 산출물의 line 참조는 결합 prompt 문서 오프셋일 수 있어 신뢰도 낮음" caveat 명시. 근본적으로 리뷰 서브에이전트 프롬프트 조립 방식(diff+전체 파일 컨텍스트 이어붙임)이 오귀속을 구조적으로 유발하므로 "위치 기재 전 대상 파일 재확인" 지침 강화 고려 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement/testing/security | 애플리케이션 코드(`output-shape.ts`, `output-shape.test.ts`, `hydration-coverage.test.ts`) 변경은 로직 diff 0, JSDoc/주석 정확화 + mutation 고립 테스트 3건 추가뿐 — 신규 테스트 3건의 격리 주장(`hasLegacyMessages && outputInteraction`, `hasConvConfig`, `hasLegacyMessages && metaInteraction` 각각 단독 참)을 실측(임시 훼손→재실행→복구)으로 검증, RESOLUTION.md M1~M3 실측과 일치 | `output-shape.test.ts`, `output-shape.ts` | 조치 불필요 |
| 2 | documentation | JSDoc 신규 "no known producer" 근거를 백엔드 소스(`information-extractor.handler.ts:1507`, `ai-turn-executor.ts:3322/3498`, `ai-turn-orchestrator.service.ts`)와 대조해 정확함을 확인 | `output-shape.ts:140-148` | 조치 불필요 |
| 3 | maintainability/documentation | 직전 리뷰 WARNING(하드코딩 라인 번호 `result-timeline.tsx:168` drift)이 함수명 기반 참조(`buildConvConfigFromStructured` call site)로 정확히 해소됨을 실측 확인 | `hydration-coverage.test.ts:54-60` | 조치 불필요 |
| 4 | maintainability/documentation | 이월 항목 2건이 그대로 잔존 — JSDoc 내 영어→한국어 언어 전환, JSDoc↔테스트 주석 이중 SoT. RESOLUTION.md 가 "차단 사유 아님, 다음 분기 편집 시 함께 정리"로 이미 명시적 defer 처리 | `output-shape.ts:108-148`, `output-shape.test.ts:731-734` | 조치 불필요(기존 defer 유지) |
| 5 | testing | 신규 테스트 주석이 소스 내부 지역 변수명(`hasLegacyMessages` 등)에 직접 결합돼 변수명 변경 시 주석만 조용히 stale 해질 수 있음(maintainability 리뷰와 동일 지적) | `output-shape.test.ts:735-791` | 조건을 필드 존재/부재로 서술하고 변수명은 괄호 부기 |
| 6 | maintainability | `_retry_state.json` 이 세션 초기 스냅샷(`routing_status: "pending"`, 빈 배열)을 최종 상태와 불일치한 채 영구 커밋 — harness 상태 파일이라 이번 PR 범위 밖 | `review/code/2026/07/17/20_06_14/_retry_state.json` | 조치 불요(차단 사유 아님). 후속: 오케스트레이션 스크립트가 최종 상태 반영 후 재기록하도록 개선 여지 |
| 7 | scope | 두 성격이 다른 커밋(테스트/코드 하드닝 vs 리뷰 산출물+RESOLUTION)이 하나의 diff 로 묶임 — 각각 commit 메시지로 명확히 구분되고 프로젝트 컨벤션(`review/code/**` 커밋)에 부합, 스코프 위반 아님 | 전체 diff | 조치 불필요 |
| 8 | security | `isConversationOutput` 은 표시 형태 분류만 담당하고 권한/가시성 판단에 관여하지 않아 현재 스코프에서 공격 표면 아님 — 단, 향후 이 함수가 권한 판단에 재사용될 경우 관대한 분기 재검토 필요 | `output-shape.ts` | 향후 재사용 시에만 재검토 |
| 9 | documentation | CHANGELOG/README/설정 문서 갱신 불요 판단이 타당함(사용자 가시 동작 변경 없음, export 인터페이스 무변경) | — | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션 표면·시크릿·인증/인가 변경 없음. `isConversationOutput` 은 신뢰 경계를 넘지 않는 순수 view-model 헬퍼 |
| requirement | LOW | 애플리케이션 코드는 결함 없음(실측 검증 완료). 함께 커밋된 20_06_14 리뷰 산출물에서 SUMMARY 자기모순 1건 + 라인번호 오귀속 잔존 3건(WARNING 2·3) |
| scope | NONE | 코드 3파일은 선언된 목적에 정확히 스코프. 나머지 9파일은 프로젝트 컨벤션에 부합하는 리뷰 산출물 커밋 |
| side_effect | NONE | 전역상태/시그니처/공개API/환경변수/네트워크/파일시스템 부작용 표면 없음. 신규 테스트는 순수 함수 호출 + 로컬 fixture만 사용 |
| maintainability | NONE | 직전 WARNING(라인 drift) 정상 반영 확인. 이월 INFO 3건은 이미 defer 처리된 상태 유지 |
| testing | LOW | 신규 테스트 3건의 격리 주장은 정확. 단, 동일 방법론을 나머지 4개 guard 에 적용한 결과 전부 무방비 확인(WARNING 1) |
| documentation | NONE | JSDoc 근거·라인 drift 해소 모두 실측 검증됨. 이월 INFO 2건(언어혼용·이중SoT)만 잔존 |

## 발견 없는 에이전트

- side_effect, scope, security, maintainability, documentation — Critical/Warning 없음 (NONE, INFO만 기재)

## 권장 조치사항

1. **(WARNING 1, testing)** `isConversationOutput` 의 나머지 4개 무방비 guard(top-level `conversationConfig` disjunct, 첫 OR-항 `hasLegacyMessages`, `looksLikeConversationEnd` 의 `hasResultMessages`, `isCanonicalWaiting` 의 `hasLegacyMessages`)에 대해 testing 리포트가 제시한 4개 fixture 를 후속 커밋으로 추가 — 특히 `isCanonicalWaiting` guard 는 form/buttons 대기 노드 오분류로 이어질 수 있어 우선순위가 높음.
2. **(WARNING 2, requirement)** `review/code/2026/07/17/20_06_14/SUMMARY.md` 의 "testing 재시도 완료/해소됨" 서술을 실제 상태(RESOLUTION.md 의 "미확보")와 일치하도록 정정하거나 forward-reference 한 절을 채울 것.
3. **(WARNING 3, requirement)** `maintainability.md`/`side_effect.md`(20_06_14 세션)에 남은 라인 번호 오귀속 3건을 함수/블록명 기반으로 정정하거나 caveat 명시.
4. (선택, 이월) `output-shape.ts` JSDoc 의 언어 혼용·JSDoc↔테스트 이중 SoT 는 다음 `isConversationOutput` 편집 시 함께 정리(이미 defer 결정됨, 재차 요구 아님).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 누락 없음)
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(테스트/주석 전용)와 무관 |
  | architecture | router 판단상 이번 diff와 무관 |
  | dependency | 의존성 변경 없음 |
  | database | DB 관련 변경 없음 |
  | concurrency | 동시성 관련 변경 없음 |
  | api_contract | API 계약 변경 없음 |
  | user_guide_sync | 사용자 가이드 영향 없는 내부 테스트/문서 변경 |
