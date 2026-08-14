# Code Review 통합 보고서

## 전체 위험도

**LOW** — Critical 0건. 실질 WARNING 은 (a) spec 문서 내부 자기모순(같은 문서, 표는 정정됐는데 §6.4 blockquote 는 미정정), (b) `error.message` 값-패턴 시크릿 마스킹 비대칭(pre-existing, 이미 백로그 등재), (c) 컨슈머 쪽(`chat-channel.dispatcher.ts`)에 손으로 재구현된 정규화 로직, (d) `failFirstSegmentSetup` emit 지점의 `error` 값이 어떤 테스트에서도 검증되지 않음(뮤테이션 생존 실측)이다. forced reviewer 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT 아님 — spec 내부 불일치] §6 필드 표(`error` 행)는 이번 diff로 "전 경로 object" 로 갱신됐는데, 같은 파일 §6.4 payload 블록의 캐비엇("현행 일부 경로에서 string")은 갱신에서 빠져 같은 문서 안에서 자기모순이 남음. 실제 구현은 표(정정된 쪽)가 맞음 — 코드 결함 아님, spec 정정 대상 | `spec/5-system/14-external-interaction-api.md:572`(정정됨) vs `:792-793`(미정정, "필드 집합 표의 error 행 참조"라고 스스로를 그 표로 되돌림) | `project-planner` 턴에서 `:792-793` 을 삭제하거나 `:572` 와 같은 방향으로 교체. 같은 문서 내 `error` 서술 지점(§6 표, §6.4 콜아웃 2개) 전수 grep 후 재발 방지 |
| 2 | 보안 | `toTerminalErrorPayload` 가 만드는 `message`/`details` 에 값-패턴 시크릿 마스킹(`deepRedactSecrets`)이 미적용된 채 WS→SSE 외부 스트림까지 원문 전달. REST `getStatus` 는 `stripAndRedact` 를 거쳐 비대칭. **pre-existing** — 이번 diff 가 새로 만든 노출 아님(직접 대조 확인), 같은 브랜치에서 이미 실측·백로그 등재됨(`plan/in-progress/spec-sync-external-interaction-api-gaps.md:129-142`, `22_55_51` W2) | `codebase/backend/src/modules/execution-engine/terminal-error-payload.ts:74-76`, 소비처 `execution-engine.service.ts:664/3314/4872`, `retry-turn.service.ts:966` | 백로그 항목대로 `toTerminalErrorPayload` 내부(또는 fanout 경계)에서 `deepRedactSecrets` 적용해 REST 와 대칭 맞출 것. 트래킹 유실 여부만 재확인 |
| 3 | 유지보수성 | `toTerminalErrorPayload` 신설로 없앤 "emit 지점마다 손으로 정규화" 패턴이 컨슈머(`chat-channel.dispatcher.ts`)에서 재현됨 — 특히 무검증 캐스트(`errorRaw as typeof error`)가 헬퍼의 필드별 타입 방어를 우회 | `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:545-555` | string/기타 분기만이라도 `toTerminalErrorPayload(errorRaw) ?? {...}` 로 공용 헬퍼 재사용, 또는 분리 이유를 주석으로 명시 |
| 4 | 테스팅 | 4개 `EXECUTION_FAILED` emit 지점 중 `failFirstSegmentSetup` 만 `error` 값이 어떤 테스트에서도 검증되지 않음 — 뮤테이션(`toTerminalErrorPayload('MUTATED')`)으로 GREEN 유지 실측 확인. 나머지 테스트는 이 함수를 전부 `jest.spyOn().mockResolvedValue()` 로 대체해 내부 emit 로직 미실행 | `execution-engine.service.ts:657-666`(`:664`) / 테스트 `execution-engine.service.spec.ts:5132-5178`(W2, `objectContaining({status: FAILED})` 뿐) | W2 단언을 `error: { code: null, message: expect.stringContaining('boom'), nodeId: null }` 로 확장 |
| 5 | 부작용 | `execution.failed` 이벤트의 `error` payload 형태가 string→object 로 바뀌는 breaking wire 변경. 저장소 내부 소비자는 동반 갱신됐으나, URL 버전 세그먼트 없는 정책상 저장소 밖 외부 webhook/SSE 구독자는 이 PR 로는 손댈 수 없음(`notification-fanout.service.ts:134` 가 가공 없이 forward 확인) | `execution-engine.service.ts:664/3314/4872`, `retry-turn.service.ts:966`, `notification-fanout.service.ts:134` | CHANGELOG 에 breaking 명시 이미 완료. 릴리스 시 실제 외부 구독자 있으면 별도 채널 사전 공지 권장 |
| 6 | API 계약 | 항목 5 와 동일 breaking change 를 API 계약 관점에서 재확인 — CHANGELOG 문서화로 이전 라운드 지적은 해소됨, 잔여는 배포 커뮤니케이션 영역 | `CHANGELOG.md`(신규 `## Unreleased`), `terminal-error-payload.ts` | PR 본문/릴리스 노트에도 동일 문구 반영 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 위조 에러 코드(`'INTERNAL_ERROR'`) → `null` 제거는 조사 정확성 개선. fail-closed 유지, 회귀 아님 | `chat-channel.dispatcher.ts:552-554` | 조치 불요 |
| 2 | 보안 | `toTerminalErrorPayload` 는 named 필드만 대입, prototype pollution 벡터 없음 | `terminal-error-payload.ts:72-81` | 조치 불요 |
| 3 | 보안 | 이전 라운드 CRITICAL(프런트 `{item.error}` object JSX 렌더 크래시)이 실제로 닫힘 확인 — XSS 아니었음(React 는 항상 텍스트 이스케이프) | `use-execution-events.ts:264-276` | 조치 불요 |
| 4 | 아키텍처 | `TerminalErrorPayload`(execution-engine)와 `EiaFailedEvent.error`(chat-channel) 두 wire 타입 선언이 여전히 독립적 — producer 필드 변경이 컴파일러로 consumer 에 전파 안 됨. 의도된 모듈 경계(순환 의존 방지)의 대가 | `terminal-error-payload.ts:36-41` vs `chat-channel/types.ts:395-408` | 조치 불요(문서화된 트레이드오프). 다음 필드 추가 시 `Pick<>` 재사용 또는 상호 링크 주석 고려 |
| 5 | 아키텍처 | `execution.cancelled` 계열은 이번 정규화 헬퍼 미적용 — 같은 "종결 error" 카테고리 안에 두 wire 스키마 공존. 스코프 밖으로 명시적으로 이연됨(JSDoc 근거) | `execution-engine.service.ts:1079-1103` 등 5곳, `chat-channel/types.ts:413-423` | 조치 불요(범위 밖, 이미 별도 비용 그룹으로 추적) |
| 6 | 아키텍처 | 이벤트 emit 경계(`emitExecution`)가 `payload: unknown` 이라 강타입이 전송 경계에서 소실 — 이전 CRITICAL 의 근본 원인이나 이번 PR 은 증상만 재동기화 | `execution-event-emitter.service.ts:37-40` | 조치 불요(범위 밖). discriminated payload union 을 별도 개선 항목으로 plan 등재 고려 |
| 7 | 요구사항 | 핵심 기능(4개 emit 지점 정규화)은 spec §6.4·타입·런타임 세 층위가 실측상 정확히 일치 | `terminal-error-payload.ts:36-82`, 4개 호출부, `chat-channel/types.ts:395-408` | 조치 불요 |
| 8 | 요구사항 | 프런트엔드 소비자가 캐스팅 아닌 타입 내로잉으로 안전 처리, 회귀 테스트로 고정 — 직전 라운드 CRITICAL 해소 확인 | `use-execution-events.ts:253-279`, 테스트 `:1140-1159` | 조치 불요 |
| 9 | 요구사항 | `execution.cancelled` 미커버 범위가 코드·plan·spec 세 층위에서 일관되게 문서화됨 | `terminal-error-payload.ts:1-9`, plan, spec `:572` | 조치 불요 |
| 10 | 스코프 | `toTerminalErrorPayload` 방어 범위(number/boolean/bigint)가 실제 DB jsonb 값 종류보다 넓음 — 직전 라운드 이미 INFO 등재, 조치 불요 처리됨 | `terminal-error-payload.ts:59-65` | 조치 불요(이미 팀 판단 완료) |
| 11 | 스코프 | `chat-channel.dispatcher.ts` 에 조사 경위 서술 장문 주석 — 변경과 직결된 근거라 저장소 관례와 일치 | `chat-channel.dispatcher.ts:537-544, 556-563` | 조치 불요 |
| 12 | 스코프 | 코드 변경 대비 `review/**`·`plan/**` 산출물 비중이 크나, 전부 SDD 워크플로의 정상 부산물로 대응 확인됨 | `review/**`, `plan/**` 신규/변경 파일 | 조치 불요 |
| 13 | 부작용 | 위조 코드 제거로 관측 가능한 `error.code` 값이 바뀌지만 저장소 내부 분류 결과는 불변(classifier 의 `?? ''` 흡수), CHANGELOG 에 이미 언급 | `chat-channel.dispatcher.ts:552, 554` | 조치 불요 |
| 14 | 부작용 | `EiaFailedEvent.error.code` 타입이 `string`→`string\|null` 로 넓어졌으나 소비 코드가 이미 방어적(optional chaining) | `chat-channel/types.ts:400`, 소비처 2곳 | 조치 불요 |
| 15 | 부작용 | 신규 헬퍼는 순수 함수, `stalledError` 참조 공유(DB write + emit)에도 aliasing 부작용 없음 | `terminal-error-payload.ts:72-77`, `execution-engine.service.ts:3268-3314` | 조치 불요 |
| 16 | 부작용 | `EiaCompletedEvent.result` 유령 필드(`finalNodeId`/`finalPort`) 제거 — 저장소 내 소비자 0건, 안전한 narrowing | `chat-channel/types.ts:391` | 조치 불요 |
| 17 | 유지보수성 | `error` string-or-object 흡수 3줄 관용구가 `use-execution-events.ts` 한 파일에서 세 번째 반복(기존 두 핸들러와 동일 패턴, 의도적 일관성) | `use-execution-events.ts:264-270` | 시급하지 않음. 공용 헬퍼(`extractErrorMessage`) 추출 고려 |
| 18 | 테스팅 | 프런트 `handleExecutionFailed` 의 "object 인데 message 없음"/"error 자체 null" 경로가 명시 테스트로 고정 안 됨 | `use-execution-events.ts:264-271`, 테스트 `:1140-1159` | 캐너리 테스트 1건 추가 권장, 차단 아님 |
| 19 | 문서화 | `chat-channel.dispatcher.ts` 신규 주석이 대입값(`code: null`)과 다운스트림 표현(`code: ""`)을 혼용 — 직전 라운드부터 이월된 INFO | `chat-channel.dispatcher.ts:562-563` | 선택: 대입값/다운스트림 값 명시적 구분 |
| 20 | 문서화 | 직전 라운드 WARNING 2건(CHANGELOG 누락, JSDoc 스코프 과장)이 실제로 잘 해소됨 확인 | `CHANGELOG.md`, `terminal-error-payload.ts` JSDoc | 조치 불요(긍정 확인) |
| 21 | API 계약 | `execution.cancelled` 스키마 이탈은 여전히 남아 있으나 code·spec·plan 3곳에서 일관되게 "별도 비용 그룹" 으로 추적됨 — 은폐 아님 | `chat-channel/types.ts:413-424`, `execution-engine.service.ts:1079-1104` | 현 상태 유지 가능. `emitCancellationEvent` 통일 계획이 plan 에 등재돼 있는지만 재확인 |
| 22 | API 계약 | spec §6 필드 표 stale caveat 이 이번 diff 로 실측과 일치하게 정정됨 | `spec/5-system/14-external-interaction-api.md` §6 표 | 조치 불요(긍정 확인) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `error.message` 시크릿 마스킹 비대칭(pre-existing, 백로그 등재됨). 위조 코드 제거는 개선. 이전 CRITICAL 렌더 크래시 닫힘 확인 |
| architecture | LOW | wire 타입 3중 선언 잔존(부분 해소), `execution.cancelled` 미통일, emit 경계 `unknown` 타입 소실 — 전부 INFO, 이미 문서화된 트레이드오프 |
| requirement | LOW | 핵심 기능 spec-타입-런타임 정합 확인. spec 내부 자기모순 1건(SPEC-DRIFT 아닌 spec 정정 대상) |
| scope | LOW | 스코프 이탈 없음. 방어 범위 과설계·조사 주석·산출물 비중 모두 이미 검토된 INFO |
| side_effect | LOW | breaking wire 변경(내부 동반 갱신 완료, CHANGELOG 통지), 그 외 순수 함수·안전한 타입 확장 다수 확인 |
| maintainability | LOW | 컨슈머 쪽 정규화 로직 재구현(WARNING), 프런트 3중 반복 관용구(INFO) |
| testing | LOW | `failFirstSegmentSetup` emit 값 미검증(뮤테이션 실측), 나머지 3곳은 촘촘히 검증됨 |
| documentation | MEDIUM | spec §6.4 blockquote 미정정으로 같은 문서 내 자기모순(WARNING). CHANGELOG/JSDoc fix 는 잘 해소됨 확인 |
| api_contract | LOW | breaking change CHANGELOG 로 문서화 완료. cancelled 스키마 이탈은 추적 상태로 완화 |

## 발견 없는 에이전트

없음 — 9개 reviewer 전원 최소 INFO 이상 발견사항 보고.

## 권장 조치사항

1. **(spec 정정, planner 턴, 권한 밖)** `spec/5-system/14-external-interaction-api.md:792-793` 를 §6 필드 표(`:572`)와 같은 방향("failed 는 전 경로 object")으로 정정하거나 제거. 같은 문서 내 `error` 서술 지점을 전수 grep 해 재발 방지.
2. **(테스트 보강)** `execution-engine.service.spec.ts:5169-5172` (W2) 의 단언을 확장해 `failFirstSegmentSetup` emit 지점의 `error` 값을 실제로 검증 — 현재 뮤테이션 생존 확인됨.
3. **(보안 백로그 추적 확인)** `toTerminalErrorPayload` 의 `message`/`details` 에 `deepRedactSecrets` 적용 계획이 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 살아있는지 재확인 — 새 회귀는 아니나 유실 방지.
4. **(선택, 유지보수성)** `chat-channel.dispatcher.ts` 의 `execution.failed` 분기가 `toTerminalErrorPayload` 를 재사용하도록 리팩터하거나, 의도적 분리 사유를 주석으로 명시.
5. **(선택, 테스트)** 프런트 `handleExecutionFailed` 의 "error 객체에 message 없음" fallback 분기에 캐너리 테스트 1건 추가.
6. **(선택, 후속 PR)** `emitCancellationEvent` 도 `toTerminalErrorPayload`(또는 하위집합)로 통일해 종결 이벤트 전체의 정규화 완결.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract` (9명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨, 화이트리스트 미이행 없음.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 와 낮은 관련도 |
  | dependency | router 판단상 이번 diff 와 낮은 관련도 |
  | database | router 판단상 이번 diff 와 낮은 관련도 |
  | concurrency | router 판단상 이번 diff 와 낮은 관련도 |
  | user_guide_sync | router 판단상 이번 diff 와 낮은 관련도 |