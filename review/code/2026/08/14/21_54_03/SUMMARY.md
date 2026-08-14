# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건. WARNING 2건 모두 신규 코드 결함이 아니라 (1) 이미 이전 라운드에서 실측·문서화되어 의도적으로 유예된 성능 트레이드오프, (2) 같은 PR 내 후속 커밋이 이미 해소한 차단 사항을 인계 문서(HANDOFF)가 여전히 미해결로 서술하는 문서 staleness다. forced(router_safety) whitelist(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

이번 라운드(`21_54_03`)의 실질 코드 델타는 직전 라운드(`16_44_37`) 이후 커밋 2개(`85511cafc` 순수 plan 문서, `462455a52` spec 정정+JSDoc 실측치 보강)뿐이며, `interaction.service.ts`/`websocket.service.ts`/`strip-external-only-fields.ts` 및 그 3개 spec 파일은 로직 변경 없이 그대로다. 11개 reviewer 전원이 이를 직접 대조로 재확인했다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | DOCUMENTATION / MAINTAINABILITY | `plan/in-progress/HANDOFF-eia-terminal-payload.md` 가 같은 브랜치의 후속 커밋(`462455a52`)이 이미 해소한 두 차단("waitingNodeType SoT 상충", "REST 경로 이중 순회 미실측")을 여전히 "🚫/⚠️ 진행 중 차단"으로 서술한다. 재개자(다른 에이전트 포함)가 이미 끝난 작업을 다시 하거나 상태를 오판할 위험 | `plan/in-progress/HANDOFF-eia-terminal-payload.md:6,18,30,54,68-79` | HANDOFF 상단 또는 각 차단 항목에 "해소됨 (`462455a52`)" 소급 정정 blockquote 추가, frontmatter `status`/HEAD 갱신. 완전히 종결됐다면 plan lifecycle 규약에 따라 archive 이동 고려 |
| 2 | PERFORMANCE | `emitNodeEvent`(node 실행마다 발생하는 고빈도 이벤트)가 `llmCalls` 를 가질 수 없는 대형 non-AI payload 에도 동일한 depth-무관 재귀 strip(`stripDeep`)을 무조건 적용 — 실측 배율(+2.4~2.6배, 6.5MB 에서 +61ms)이 이미 상한 없는 동기 emit 경로 위에 얹힌다 | `codebase/backend/src/modules/websocket/websocket.service.ts:503,524-527`(`emitNodeEvent`), `codebase/backend/src/shared/utils/strip-external-only-fields.ts:105`(`stripDeep`) | 이미 `plan/in-progress/HANDOFF-eia-terminal-payload.md:95-99`에 "이 PR 밖 별건"으로 tracked. 대형 non-AI node payload 트래픽의 실제 이벤트 루프 지연 여부를 프로덕션 APM 관측으로 확인하는 캐너리 권고. "직렬화 문자열에 `llmCalls` 부재 시 재귀 스킵" 후속안을 다음 PR 우선순위로 반영 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | REQUIREMENT | 브랜치가 표방하는 1차 요구사항(`plan/in-progress/eia-terminal-payload.md` — 종결 payload 정리: `error` 객체화·`durationMs`·`result.outputs`)이 이번 누적 diff(17 commits)로 전혀 진전되지 않음. `HANDOFF`/`spec-draft-eia-62-waiting-payload.md`에 pivot 경위가 투명하게 기록돼 있어 은폐된 스코프 이탈은 아님 | `plan/in-progress/eia-terminal-payload.md:97-101,139-142` | 조치 불요(의도된 보류). 다음 세션에서 실제 착수하거나 브랜치/plan 관계 재정리 |
| 2 | PERFORMANCE | `stripDeep` 에 형제 함수(`sanitizePayloadForWs`/`deepRedactSecrets`) 대비 identity 캐시(WeakMap)가 없어 반복 emit 시 매번 전체 재순회(+20.2 µs/emit, N=3000 실측). "형제 캐시와 무효화 시점이 갈려 sanitize 적중·strip 미적중 조합이 생긴다"는 근거로 의도적 유예 | `codebase/backend/src/shared/utils/strip-external-only-fields.ts:105` vs `websocket.service.ts:237`(`SANITIZE_CACHE`), `sanitize-error-message.ts:135-137`(`DEEP_REDACT_CACHE`) | 조치 불요 — 이미 실측·문서화. 반복-emit 트래픽 유의미해지면 재검토 |
| 3 | MAINTAINABILITY | 프로덕션 JSDoc/주석이 임시 리뷰 라운드 타임스탬프(`14_55_29` 등)를 근거 인용으로 다수 사용 — 날짜 없는 `hh_mm_ss` 6자리만 있어 장기적으로 grep 없이는 추적 어려움 | `strip-external-only-fields.ts:18,35,42,56,67,83`, `interaction.service.ts:85,92,102,104,382,442`, `websocket.service.ts:300` | 핵심 계약은 본문에 이미 서술돼 있어 현재 문제 없음. 향후 각주는 리뷰 라운드 폴더명보다 커밋 SHA 병기 고려 |
| 4 | MAINTAINABILITY | `emitExecutionEvent`/`emitNodeEvent` 두 메서드에서 `stripExternalOnlyFields(wireEnvelope, MAX_SANITIZE_DEPTH)` 호출 블록이 거의 동일하게 반복(사전 존재 중복 위에 이번 diff 가 2-인자 계약을 얹음) | `websocket.service.ts:450-457`,`524-531` | 시급하지 않음(현재 2곳). 세 번째 fanout 호출부 생기면 `private stripForFanout` 헬퍼로 통합 고려 |
| 5 | API_CONTRACT / SIDE_EFFECT | 외부 REST(`GET /api/external/executions/:id`)·WS fanout·webhook·chat-channel 응답 payload 가 버전 신호 없이 조용히 좁아짐(`llmCalls` 계열 필드 완전 제거) — 보안 수정의 목적 자체이며 breaking change 아님(DTO 는 애초에 열린 map 으로 문서화) | `interaction.service.ts:98`(`stripAndRedact`), 호출부 `384,446,450` | 조치 불요. `CHANGELOG.md`가 영향 범위(과거 노출분은 회수 불가)를 이미 공지 |
| 6 | TESTING | REST 경로(strip→redact) 성능 개선을 고정하는 회귀 벤치마크가 커밋되지 않음 — 향후 순서/구현이 바뀌면 "AI 경로가 오히려 빨라진다"는 결론이 조용히 무효화될 수 있으나 자동 테스트 없음 | `review/code/2026/08/14/16_44_37/RESOLUTION.md`(§ai-review W1), `interaction.service.ts:100-109` | 조치 불요(참고). 다음에 이 순서/구현을 만질 때 A/B 벤치마크 스크립트로 남기는 것 권고 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | `llmCalls` depth-무관 strip 방어(REST/WS 양쪽) 및 `__proto__` 오염 방지 코드 재확인, 신규 취약점 없음 |
| performance | LOW | `emitNodeEvent` 무상한 payload 위 strip 오버헤드(WARNING, tracked), identity 캐시 부재(INFO, 유예) |
| architecture | NONE | 이번 라운드 코드 레이어 diff 사실상 0(JSDoc 주석뿐), SOLID·레이어링·순환의존 없음 유지 확인 |
| requirement | NONE | 보안 수정 기능적으로 완전, spec fidelity 확인. 1차 요구사항(terminal payload) 미진전은 의도된 pivot(INFO) |
| scope | NONE | 신규 델타 2커밋 모두 직전 라운드 WARNING/CRITICAL 에 대한 정확한 교정, 스코프 확장 없음 |
| side_effect | LOW | 응답 shape 축소는 의도된 보안 수정(INFO), breaking change 아님, clone-on-write/null 분기 보존 확인 |
| maintainability | LOW | HANDOFF staleness(INFO, documentation 과 중복), 주석 타임스탬프 참조, 경미한 사전 존재 중복 |
| testing | NONE | 5 suites/150 tests 전부 통과 실행 재확인, 코드 델타 없음, `it.each` 타이틀 회귀 재발 없음 |
| documentation | LOW | HANDOFF 문서가 이미 해소된 차단을 미해결로 서술(WARNING) |
| api_contract | LOW | 응답 payload 버전 신호 없이 축소(CHANGELOG 로 완화, INFO), null/`{}` 구분 보존 확인 |
| user_guide_sync | NONE | doc-sync-matrix 21개 trigger 전수 대조, 매칭 0건 |

## 발견 없는 에이전트

- user_guide_sync — 해당 없음(유저 가이드 동반 갱신 trigger 0건 매칭)

## 권장 조치사항
1. `plan/in-progress/HANDOFF-eia-terminal-payload.md` 상단에 "차단 1·2 는 `462455a52` 로 해소됨" 소급 정정 blockquote 를 추가하고 frontmatter `status`/HEAD 를 현재 값으로 갱신할 것 (WARNING #1, documentation+maintainability 공통 지적).
2. `emitNodeEvent` 의 무상한 strip 오버헤드는 이미 HANDOFF 문서에 "이 PR 밖 별건"으로 등재돼 있으므로 별도 후속 PR 에서 프로덕션 관측(APM latency) 후 "직렬화 문자열 선판정" 최적화를 검토할 것 (WARNING #2, 이번 라운드 즉시 조치 불요).
3. 브랜치가 표방하는 1차 요구사항(`eia-terminal-payload.md` — 종결 payload 정리)은 이번 diff 로 전혀 진전되지 않았으므로, 다음 세션에서 실제 착수 여부를 판단할 것 (INFO #1).
4. 그 외 INFO 항목(리뷰 라운드 타임스탬프 각주, fanout 중복, 회귀 벤치마크 미커밋)은 모두 조치 불요/저우선 참고 사항으로, 즉각 조치 없이 push 가능.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — **전원 결과 확보됨**

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단 — 이번 diff 에 패키지/의존성 변경 없음(구체적 사유 텍스트는 prompt 에 미기재) |
  | database | router 판단 — DB 스키마/쿼리 변경 없음(구체적 사유 텍스트는 prompt 에 미기재) |
  | concurrency | router 판단 — 동시성/레이스 관련 변경 없음(구체적 사유 텍스트는 prompt 에 미기재) |