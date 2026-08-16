# Code Review 통합 보고서

## 전체 위험도
**LOW** — EIA 종결 이벤트(`execution.failed` 등) `error.message`/`error.details` 를 WS/SSE/outbound webhook 으로 내보내기 전 값-패턴 secret 마스킹(`redactTerminalError`)을 egress 초크포인트(`toTerminalErrorPayload`)에 배선하는 하드닝. 5라운드째 리뷰(코드 3회+consistency 2회)를 거치며 실질 결함은 모두 해소됐고, 8명(전원 forced) reviewer 가 전문을 제출해 강제 화이트리스트 미이행 없음. 남은 것은 spec 미러 갱신(SPEC-DRIFT, planner 후속 이미 등재) 1건과 경미한 WARNING/INFO뿐.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | api_contract | 신규 값-마스킹이 API 정본 계약 문서(§6.4 `execution.failed` 페이로드 절)와 R17 마스킹 카탈로그에 아직 반영되지 않음 — `CHANGELOG.md`(저장소 내부 문서)에만 고지됨 | `spec/5-system/14-external-interaction-api.md:770-806`(§6.4), `:1414-1457`(R17 불릿) | `spec/` 은 developer 쓰기 권한 밖. 이미 `plan/in-progress/eia-terminal-error-sanitize.md:153-159` 에 planner 턴 후속으로 등재됨 — 추가 개발 조치 불요, push 게이트 전 해당 planner 턴 실행 여부만 추적 |
| 2 | maintainability | 이전 라운드가 "완전 동일 중복 단언 2건"으로 함께 지적했던 것 중 한쪽에만 의도 설명 주석이 달리고 다른 쪽(`details` 키 생략 테스트)은 여전히 무설명 순수 중복으로 남아 비대칭 | `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts:219-222`(무설명) vs `:193-194`(설명 있음) | `:219` 테스트에도 동일 취지 주석("상단 스위트의 details-생략 단언과 동일 — 마스킹 도입 후에도 이 경로가 그대로인지 확인") 추가 |

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] EIA §R17 "표면 제약(보안)" 마스킹 카탈로그와 §6.4 페이로드 절이 이번에 신설된 5번째 egress 마스킹 지점(`execution.failed`/시스템 `execution.cancelled`/chat-channel 종결 `error.message`·`error.details`)을 아직 반영하지 않는다. 코드는 spec 본문과 모순되지 않으나(§6.4 가 새니타이즈를 요구하지 않으므로 계약 위반 아님), spec 이 실제 구현이 강제하는 보안 불변식을 아직 열거하지 않아 코드가 spec 보다 앞서 있다 | `spec/5-system/14-external-interaction-api.md` R17 불릿(1414행 부근), §6.4 `error` 필드 정의(770~786행) / 코드: `codebase/backend/src/shared/utils/terminal-error-payload.ts` `redactTerminalError`(107행) | 코드 변경 불요. `project-planner` 턴에서 R17 에 5번째 항목 추가 + §6.4 에 마스킹 note 추가. 이미 `plan/in-progress/eia-terminal-error-sanitize.md` "후속" 섹션에 등재되어 있으므로 그 항목을 그대로 집행하면 됨 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 자격증명 없는 연결 문자열·내부 호스트명·사설 IP·스택 프래그먼트는 여전히 마스킹되지 않음(선존 갭, 이번 diff 가 악화시키지 않음, 명시적으로 추적됨) | `terminal-error-payload.ts` `redactTerminalError`(107~115행) | 별도 후속 PR 로 `CONNECTION_STRING_PATTERN`류 승격 시 blast radius 검토. 차단 사유 아님 |
| 2 | security | `toTerminalErrorPayload`/`redactTerminalError` 출력에 길이/크기 상한 없음(선존 상태) | `terminal-error-payload.ts` `toTerminalErrorPayload`(122~161행) | 조치 불요. 후속 항목으로 길이 상한 검토 권장 |
| 3 | security | 테스트 픽스처의 secret 형 리터럴은 합성 값이며 실제 자격증명 아님 | `terminal-error-payload.spec.ts` 140/147/154/166~167행 | 조치 불요 |
| 4 | requirement | `execution.cancelled`(시스템 취소) 의 `error` 는 여전히 `toTerminalErrorPayload`/마스킹 경로 미경유 — 현재는 고정 문자열만 실려 안전하나 구조적으로 열린 우회 표면 | `execution-engine.service.ts` `emitCancellationEvent` 5개 호출부 | 이번 PR 범위 밖(plan 명시). 별도 조치 불요 |
| 5 | requirement | `chat-channel.dispatcher.ts:551` 이 이미 마스킹된 payload 를 재정규화해 이중 마스킹 발생하나 idempotent(no-op) | `chat-channel.dispatcher.ts:551` | 조치 불요 |
| 6 | side_effect | (신규 검증) SSE·outbound webhook fanout 이 `Execution.error` 를 재조회하지 않고 이미 마스킹된 `event.payload` 를 그대로 미러링 — 마스킹 우회 경로 없음을 확인 | `notification-fanout.service.ts:132`, `sse-adapter.service.ts:162` | 조치 불요(긍정 확인). JSDoc/plan 에 "fanout 은 재조회 없이 emit payload 미러링" 한 줄 추가하면 향후 회귀 조기 발견에 도움 |
| 7 | side_effect | `execution.cancelled` 마스킹 우회 재확인(이전 라운드와 동일 관측) | `terminal-error-payload.ts:8-13` | 조치 불요, 이미 plan 등재 |
| 8 | side_effect | chat-channel 이중 마스킹 idempotent 재확인 | `terminal-error-payload.ts:107-115`, `chat-channel.dispatcher.ts:551` | 조치 불요 |
| 9 | maintainability | `deepRedactSecrets` 반환값(`unknown`)을 `string` 으로 무검증 타입 단언(이전 라운드에서 기결정, 재확인만) | `terminal-error-payload.ts:110` | 조치 불요(기결정). 원하면 캐스트 옆 불변식 주석 |
| 10 | maintainability | "optional 키 생략" 관용구 혼재(명령형 `if` vs 조건부 spread), 이미 무조치 확정 | `terminal-error-payload.ts:159` vs `:111-113` | 조치 불요(기결정 유지) |
| 11 | testing | 스칼라(`number`/`boolean`/`bigint`) 반환 분기는 값 공간상 어떤 테스트로도 마스킹 래핑 제거를 판별 불가 — 문서화된 의도적 잔여 갭 | `terminal-error-payload.ts` JSDoc 74~78행 / 134~148행 | 조치 불요 — 이미 올바르게 처리됨(JSDoc 으로 검증 범위 명시) |
| 12 | testing | 위협표의 "자격증명 포함 연결 문자열 마스킹" 행이 `terminal-error-payload.spec.ts` 안에서 양성 케이스로 자체 증명되지 않음(부정 케이스만 존재) — 단, 자매 spec 파일에서 이미 검증됨 | `terminal-error-payload.ts` 84~89행 위협표 vs `.spec.ts` 211~217행 | 우선순위 낮음. 원하면 대응 양성 케이스 1개 추가 |
| 13 | documentation | `spec-sync-external-interaction-api-gaps.md` 신규 "잔여" 항목 문장이 술어 없이 끊김(오탈자성) | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:169` | `blast radius 가 다른 별건이다`(또는 코드 JSDoc 과 동일 문구)로 문장 완결 |
| 14 | api_contract | CHANGELOG 의 EIA 섹션 인용 오류(§3.3→§3.1)가 이번 diff 에서 실제로 정정됨을 확인 | `CHANGELOG.md:45`, `:6` | 조치 불요(확인용) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 마스킹이 4개 반환 지점 전부·5개 emit 호출부 전부에 적용됨을 직접 확인. 잔여 INFO 2건(연결문자열 미마스킹, 길이상한 부재)은 선존 상태 |
| requirement | LOW | JSDoc/CHANGELOG/plan 의 정량 주장이 실측과 정확히 일치(26/26 테스트, 호출부 수 등). SPEC-DRIFT 1건(R17/§6.4 미반영, planner 후속 등재됨) |
| scope | NONE | 실질 코드 변경 4개 파일로 좁게 유지, 무관 파일/설정 변경 없음. 이전 scope WARNING(JSDoc 궤도 이탈)은 해소 재확인 |
| side_effect | LOW | fanout 이 재조회 없이 마스킹된 payload 미러링 확인(신규). DB write/mutation/순환참조/env·네트워크 부작용 없음 |
| maintainability | LOW | 중복 테스트 주석 처리 비대칭 WARNING 1건. 나머지(타입 단언, 관용구 혼재)는 기결정 재확인 |
| testing | LOW | 26/26 PASS 재실행 확인. 판별력 문제 4건 전부 해소 재확인, 잔여 INFO 2건은 구조적 한계/자매 파일 커버 |
| documentation | LOW | 라운드 수 불일치·§3.3 오인용·"5곳" 중의성 등 이전 지적 전부 해소 확인. 신규 INFO 1건(문장 미완결) |
| api_contract | LOW | wire 스키마 불변, structural breaking change 없음. WARNING 1건(§6.4/R17 미반영, planner 후속 등재됨) |

## 발견 없는 에이전트

- scope (위험도 NONE, Critical/Warning/INFO 발견 없음 — 이전 지적 해소 재확인만)

## 권장 조치사항

1. (maintainability WARNING) `terminal-error-payload.spec.ts:219-222` 에 `:193-194` 와 대칭되는 의도 설명 주석 추가 — "상단 스위트의 details-생략 단언과 동일, 마스킹 도입 후에도 이 경로 유지 확인용" 취지.
2. (api_contract WARNING / SPEC-DRIFT) `project-planner` 턴에서 `spec/5-system/14-external-interaction-api.md` 의 R17 마스킹 카탈로그에 5번째 항목(`execution.failed`/`cancelled`/chat-channel 종결 `error.message`·`error.details` 마스킹) 추가 + §6.4 페이로드 절에 마스킹 적용 note 추가. `plan/in-progress/eia-terminal-error-sanitize.md` "후속" 섹션에 이미 구체적으로 등재돼 있으므로 그대로 집행.
3. (INFO, 낮은 우선순위) `plan/in-progress/spec-sync-external-interaction-api-gaps.md:169` 미완결 문장 정정.
4. (INFO, 선택) `side_effect` 라운드의 신규 확인("fanout 은 재조회 없이 emit payload 를 그대로 미러링")을 JSDoc/plan 에 한 줄 남겨 향후 fanout 리팩터 시 회귀를 조기 포착.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract` (8명)
  - **제외**: 표 (6명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명, 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 범위(값-패턴 마스킹 유틸)와 무관 |
  | architecture | router 판단상 이번 diff 범위와 무관 |
  | dependency | router 판단상 이번 diff 범위와 무관 |
  | database | router 판단상 이번 diff 범위와 무관 (DB write 없음, 다른 reviewer 들이 직접 확인) |
  | concurrency | router 판단상 이번 diff 범위와 무관 |
  | user_guide_sync | router 판단상 이번 diff 범위와 무관 |