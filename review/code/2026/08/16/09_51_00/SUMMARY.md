# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 핵심 로직(egress 초크포인트 `redactTerminalError` 도입)은 정확하고 테스트로 잘 뒷받침되나, PR 이 스스로 내세운 위협 모델(연결 문자열/내부 호스트명 마스킹) 을 실제로는 부분적으로만 달성하고, 앞선 리뷰 라운드가 명시적으로 제기한 "내부 신뢰 채널(워크플로우 에디터) 도 마스킹된 값을 받는다" 질문이 이번 PR 기록에도 여전히 미해결로 남아 있다. 강제(router_safety) 화이트리스트 7개 전원 결과 확보(누락 없음) — 이 부분은 clean.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | 새 egress 마스킹(`redactTerminalError`)이 PR 자신이 명시한 위협 범위(연결 문자열/내부 호스트명)를 못 잡는다 — `SECRET_LEAK_PATTERNS` 는 자격증명 임베드 URI만 잡고 순수 연결 문자열·호스트명은 무변화로 통과. 자매 유틸 `sanitizeErrorMessage`(execution-engine) 는 `CONNECTION_STRING_PATTERN` 으로 이를 잡지만 이번 egress 경로는 이 패턴을 재사용하지 않음. 신규 테스트도 이 케이스 0건 | `codebase/backend/src/shared/utils/terminal-error-payload.ts:81-89` (`redactTerminalError`), 대조: `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` (`CONNECTION_STRING_PATTERN`) | `SECRET_LEAK_PATTERNS` 에 연결 문자열 패턴을 추가하거나 `CONNECTION_STRING_PATTERN` 을 shared SoT 로 승격해 재사용. 범위를 의도적으로 좁힌 것이라면 plan/docstring 에 잔여 갭으로 명시 |
| 2 | requirement / documentation | `sanitize-error-message.ts` 의 "과장된 첫 줄 정정"이 불완전 — 새 2번째 줄은 적용 범위를 in-app/email 2채널로 좁혔지만, 손대지 않은 13-16번째 줄은 여전히 "webhook 알림"을 3번째 채널로 언급. 실측(3개 호출부 전부 `channel: 'in_app'|'email'|'both'` 만 사용, webhook 채널 0건)과 불일치 | `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts:2` vs `:13-16` | 13-16번째 줄에서 "webhook 알림" 제거, 또는 향후 도입 전제라면 그 의도를 명시 |
| 3 | side_effect / documentation | `toTerminalErrorPayload` 마스킹이 WS 단일 채널을 통해 외부(SSE/webhook)뿐 아니라 **내부 신뢰 채널(워크플로우 에디터)**에도 동일하게 적용되는데, 이 영향이 검증·문서화되지 않았다. 앞선 `09_25_29` consistency 라운드(rationale_continuity WARNING #1)가 이미 "워크플로우 에디터가 마스킹값을 받아도 되는지" 를 명시적으로 제기했고 plan 체크리스트는 "WARNING 2건 반영"이라 주장하지만 실제로는 egress 위치 선택만 반영, 이 질문 자체엔 답이 없음. R17(`execution.ai_message`)의 "수용된 trade-off" 선례를 인용하지도, 다르다고 구분하지도 않음 | `codebase/backend/src/shared/utils/terminal-error-payload.ts:81-129`, `plan/in-progress/eia-terminal-error-sanitize.md` "조치"/"범위 밖" 섹션, `spec/3-workflow-editor/3-execution.md §3.5` | 워크플로우 에디터가 `error.message` 를 신뢰 채널로 그대로 렌더링하는지 확인 후 (a) 마스킹 허용을 문서화하거나 (b) 내부 전용 표면에 raw 값 노출 경로 검토. plan/JSDoc 에 R17 선례 대비 결정 근거 기록 |
| 4 | scope | 신규 함수(`redactTerminalError`) JSDoc 삽입으로 기존 `toTerminalErrorPayload` 의 `@param`/`@returns` 블록이 궤도 이탈(dangling) — 원래 선언 바로 위였던 47-51행이 이제 91행 선언과 2블록 떨어져 IDE hover 귀속이 깨짐 | `codebase/backend/src/shared/utils/terminal-error-payload.ts:47-91` | `redactTerminalError`(신규 함수+JSDoc)를 그 블록보다 앞으로 옮기거나, 47-51행을 91행 직전으로 재배치 |
| 5 | maintainability | 신규 `describe` 블록이 기존 블록과 완전히 동일한 단언(null/undefined 처리, details 생략)을 반복 — 한쪽만 갱신되고 다른 쪽이 stale 로 남는 drift 위험 | `terminal-error-payload.spec.ts:184-187`(신규) vs `:83-87`(기존); `:189-191` vs `:32-38` | 의도를 명시하는 주석 추가, 또는 완전 동일 단언은 신규 블록에서 제거하고 상단 스위트 참조 |
| 6 | maintainability | 동일 파일 안에서 "optional 키 생략" 패턴이 명령형 `if`(기존)와 조건부 spread(신규) 두 관용구로 혼재 | `terminal-error-payload.ts:128`(기존) vs `:85-87`(신규) | 두 관용구 중 하나로 통일 (강한 요구 아님) |
| 7 | testing | `code`/`nodeId` 비-마스킹 단언이 판별력 없는(vacuous) 테스트 — 두 입력값 모두 `SECRET_LEAK_PATTERNS` 어디에도 매칭 안 돼 마스킹이 실수로 걸려도 no-op 이라 GREEN 유지. "그 필드를 안 건드린다"를 증명 못 함 | `terminal-error-payload.spec.ts:159`, 구현: `terminal-error-payload.ts:81-89` | `code`/`nodeId` 에 `SECRET_LEAK_PATTERNS` 가 실제 매칭되는 adversarial 값(예: `Bearer sk-...`)을 넣어 마스킹이 걸리지 **않음**을 직접 검증 |
| 8 | testing | JSON 형태로 보이는 `message` 는 마스킹과 함께 재직렬화(포맷 변경) 부수효과가 생기는데(`{`/`[` 시작 시 JSON.parse→마스킹→stringify, 공백 등 정규화) 이 경로가 테스트로 잠겨있지 않음 | `terminal-error-payload.ts:84` (`deepRedactSecrets` 의 JSON 분기 상속) | JSON 형태 `message` 케이스 1개 추가해 "시크릿은 지워지되 포맷이 바뀔 수 있다" 동작 명시적으로 고정 |
| 9 | documentation | 같은 PR 안에서 "리뷰가 미룬 라운드 수"가 파일마다 다름(4 vs 5) — plan 헤더는 "4라운드"라 하지만 바로 아래 나열은 5개 ID, 신규 테스트 docstring 은 "5라운드"로 나열과 일치. 헤더가 자기 본문 증거와도 모순 | `plan/in-progress/eia-terminal-error-sanitize.md:11` vs `:13` vs `terminal-error-payload.spec.ts:135` | plan 헤더를 "5라운드"로 정정(나열 근거 5개에 맞춤), 두 파일 숫자 통일 |
| 10 | documentation | 외부로 나가는 종결 payload 의 실제 바이트가 바뀌는 변경(raw → 마스킹)인데 `CHANGELOG.md` 에 항목 없음 — 이 저장소는 유사 규모의 wire 변화를 매번 고지해 온 관행 | `CHANGELOG.md` (`## Unreleased`, 이번 diff 미포함) | "종결 이벤트 error.message/details 가 이제 secret 패턴을 마스킹해 나간다" 한 줄 항목 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | `toTerminalErrorPayload`/`redactTerminalError` 에 길이/크기 상한이 없음 — 마스킹 후에도 대형 payload 가 그대로 나가 크기 증폭 가능. 자매 유틸(`sanitizeErrorMessage`)은 500자 절단 정책이 있으나 이 경로는 무제한(선존 상태, 이 PR 신규 결함 아님) | `terminal-error-payload.ts` `redactTerminalError`(81-89), `toTerminalErrorPayload`(91-130) | 후속 항목으로 길이/크기 상한 검토 등재 (차단 아님) |
| 2 | security | 마스킹 적용이 `EXECUTION_FAILED` 4곳 + `chat-channel.dispatcher` 로 좁혀져 있고 `execution.cancelled`(5곳)는 여전히 `toTerminalErrorPayload` 를 안 거침. 현재는 고정 문자열만 써서 안전하나 향후 취소 사유가 raw 예외를 담게 되면 우회 표면이 조용히 생김 | `terminal-error-payload.ts` docstring(8-9행) | `emitCancellationEvent` 관련 5곳에 "raw 예외 메시지 넣지 말 것" 주석 캐너리 또는 향후 통일 시 자동 상속되도록 설계 |
| 3 | requirement | 종결 3종 밖 — `execution.node.failed` 의 `NodeExecution.error.message` 도 SSE 로 외부 노출되지만 `toTerminalErrorPayload`/`redactTerminalError` 를 거치지 않음. plan 이 "별개 표면"으로 명시적으로 스코프 아웃했으므로 이 PR 자체의 결함은 아님 | `plan/in-progress/eia-terminal-error-sanitize.md` "범위 밖" 섹션, spec `spec/5-system/14-external-interaction-api.md §11` | 후속 백로그로 `spec-sync-external-interaction-api-gaps.md` 에 등재 검토 |
| 4 | maintainability | `deepRedactSecrets` 반환값을 `unknown`→`string` 무검증 캐스트 — 현재 런타임은 안전하나 타입 시스템은 미보장, 향후 함수 확장 시 조용히 깨질 수 있음 | `terminal-error-payload.ts:84` | 캐스트 옆에 불변식 설명 주석 (강한 조치 불요) |
| 5 | testing | `details` 가 명시적 `null` 인 경로 미테스트 (`undefined` 체크는 `null` 을 안 걸러 `details: null` 키가 남음, 크래시 위험은 없음) | `terminal-error-payload.ts:85-87` | 낮은 우선순위로 케이스 1개 추가 |
| 6 | documentation | 같은 파일 안 인접 두 docstring 이 호출부 수를 다른 숫자(4 vs 5)로 인용 — 실측상 모순은 아니나(스코프가 다름) 명시 없어 오독 소지 | `terminal-error-payload.ts:8` vs `:68` | "5곳(직접 조립 4 + 재정규화 1)" 형태로 스코프 명시 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 5개 반환 경로 전부 마스킹 확인(전수 배선 정상). 길이 상한 부재·취소 경로 비대칭은 INFO |
| requirement | MEDIUM | 연결 문자열/호스트명 마스킹 미적용(PR 이 스스로 세운 목표 대비 완전성 부족), docstring 자기모순(webhook 알림 문구 잔존) |
| scope | LOW | plan 조치 목록과 diff 1:1 대응, 스코프 확장 없음. JSDoc 궤도 이탈 부수효과 1건 |
| side_effect | LOW | 입력 mutate 없음·시그니처 불변·안전한 캐시 재사용. 내부 신뢰 채널 영향 미검증 1건(consistency 라운드와 동일 지적) |
| maintainability | LOW | 함수 설계 명확, 네이밍 일관. 테스트 중복·관용구 혼재는 경미 |
| testing | LOW | 23/23 통과, 구조적 배선 검증됨. vacuous 단언 1건 + JSON 재직렬화 미고정 1건 |
| documentation | LOW | JSDoc 상세·정확(호출부 수 실측 일치). 라운드 수 불일치, 내부 채널 영향 미기록, CHANGELOG 누락 |

## 발견 없는 에이전트

없음 (7개 전원 발견사항 보고, 단 security/scope/side_effect/maintainability/testing/documentation 는 Critical 없이 WARNING/INFO 수준).

## 권장 조치사항

1. (requirement WARNING #1) `redactTerminalError` 에 연결 문자열/내부 호스트명 마스킹 패턴을 추가하거나, 의도적 범위 축소라면 plan/docstring 에 잔여 갭으로 명시.
2. (side_effect/documentation WARNING #3) 워크플로우 에디터(내부 신뢰 채널)가 마스킹된 `error.message` 를 받는 것이 허용 가능한지 확인하고 결정 근거를 plan/JSDoc 에 기록 — 앞선 consistency 라운드가 이미 제기한 미해결 질문.
3. (requirement/documentation WARNING #2) `sanitize-error-message.ts` 13-16행의 "webhook 알림" 언급을 실측(3개 호출부 모두 in_app/email)에 맞게 정정.
4. (scope WARNING #4) `toTerminalErrorPayload` JSDoc 궤도 이탈 복구 — `@param`/`@returns` 블록을 원래 선언 인접 위치로 재배치.
5. (testing WARNING #7, #8) `code`/`nodeId` 비-마스킹 테스트를 adversarial 값으로 교체하고, JSON 형태 `message` 재직렬화 케이스 1개 추가.
6. (documentation WARNING #9) plan 문서의 "리뷰 라운드 수" 숫자를 실제 나열(5개)에 맞게 정정.
7. (documentation WARNING #10) CHANGELOG.md 에 egress payload 마스킹 변경 항목 추가.
8. (maintainability WARNING #5, #6) 테스트 중복 정리 및 optional-키-생략 관용구 통일 — 우선순위 낮음.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명, 전원 forced)
  - **제외**: 표 (reviewer · 이유, 7명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` — **전원 결과 확보됨** (누락 없음, whitelist 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 변경(문자열 마스킹 유틸 확장)과 무관 |
  | architecture | 구조적 재설계 없음, 기존 함수 내부 확장 |
  | dependency | 신규 외부 의존성 도입 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 관련 로직 변경 없음 |
  | api_contract | 함수 시그니처/API 계약 불변 |
  | user_guide_sync | 사용자 대상 가이드 문서 영향 없음 |