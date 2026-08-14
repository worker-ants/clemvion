# Code Review 통합 보고서

## 전체 위험도
**LOW** — 실질 CRITICAL 0건. WARNING 4건은 전부 코드 결함이 아니라 spec/plan 문서 정합·테스트 갭·API 계약 고지 성격이며, forced reviewer 7명 전원 결과 확보(누락 없음).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `finalizeFailedExecution` emit 의 `error` 값(특히 sentinel `code`: `ERROR_PORT_FALLBACK`/`ExecutionTimeLimitError` 보존 여부)을 단언하는 테스트가 없다 — 이 PR 이 다른 3개 emit 지점에서 이미 뮤테이션으로 찾아 고친 "status 만 보면 error 자리를 바꿔도 GREEN" 갭이 같은 파일의 이 지점에는 그대로 남음 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4872`(변경 라인); 미보강 테스트 `execution-engine.service.spec.ts:999`, `:6913` | `emitSpy` 단언에 `error: { code: null/'ERROR_PORT_FALLBACK', message: ..., nodeId: null }` 추가해 sentinel code 보존을 emit 레벨에서 고정 |
| 2 | requirement / SPEC-DRIFT(문서 정합) | `execution.failed` 의 `error.code` nullable 계약을 이 PR 이 §6.4/필드표에서 재확정했으나, 같은 PR 이 직접 손댄 `chat-channel-adapter.md` 의 `EiaEvent` TS union 은 여전히 `code: string`(non-nullable)로 미갱신 — "고칠 때 자매 위치 누락" 패턴의 재발 | `spec/conventions/chat-channel-adapter.md:150` vs 같은 파일 `:159-163`, `spec/5-system/14-external-interaction-api.md:572,781-789`, 런타임 타입 `chat-channel/types.ts`(`code: string \| null`, 이 PR 이 정정) | `project-planner` 턴에서 `chat-channel-adapter.md:150` 의 `error` 필드를 `{ code: string \| null; ... }` 로 정정. `error` 서술 전 위치(필드표·§6.4 예시 2곳·union) 전수 재확인 |
| 3 | documentation | `plan/in-progress/eia-terminal-payload.md` 의 "이번 PR" 범위 체크리스트(`error` 객체 형태 / `null` 정규화 / 동반 필수, 3항목)가 구현·커밋 완료 후에도 `[ ]` 미체크로 남음 — 같은 파일이 "체크리스트가 커밋보다 늦은 것이 세 번째"라고 스스로 반성문을 적어놓고도 네 번째로 재발 | `plan/in-progress/eia-terminal-payload.md:173,175,177`(미체크) vs `:217-239`(하단 `## 체크리스트`는 `[x]` 완료 처리) | 세 체크박스를 `[x]`로 갱신. "체크박스=실제 상태" 원칙을 본문 안 모든 체크리스트 절(범위 선언용/완료 추적용)에 적용하도록 회고문에 한 줄 추가 |
| 4 | api_contract | `execution.failed` 의 `error` 필드(string→object) breaking change 가 HMAC 서명 외부 webhook 계약에 버전 협상/과도기 수단 없이 배포됨 — 저장소가 URL 버전 세그먼트 미사용 단일 버전 운영이라 CHANGELOG 만이 유일한 통지 경로 | emit 4곳(`execution-engine.service.ts:664,3314,4872`, `retry-turn.service.ts:966`); 문서 `CHANGELOG.md:9-11`, `spec/5-system/14-external-interaction-api.md:572,792` | 실제 활성 외부 webhook 구독자 유무를 확인해 plan 산출물에 한 줄 기록. 필요 시 dual-shape 과도기/버전 신호 검토(완화 요인: 새 형태가 spec 목표 형태와 일치, spec 상태 `partial`) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 5 | security | `error.message`/`details` 가 값-패턴 시크릿 마스킹(`deepRedactSecrets`) 없이 외부 webhook 까지 그대로 전달 — 이 PR 이전부터 있던 노출(string→object 포장만 변경), 이미 백로그 등재·근거 기록됨 | `terminal-error-payload.ts:80`, `execution-engine.service.ts:664,4872`, `notification-fanout.service.ts:134` | 후속 PR 에서 `deepRedactSecrets` 를 `Execution.error.message` 저장 또는 `toTerminalErrorPayload` 에 적용 검토(특히 `details` 필드가 채워지기 시작하기 전) |
| 6 | testing | dispatcher `toChatChannelEvent` — `errorRaw` 가 필드 없는 빈 객체(`{}`)인 경계 케이스(placeholder 대신 빈 문자열 `message` 발생) 미테스트 | `chat-channel.dispatcher.ts:552-558` | 회귀 케이스 추가로 placeholder 폴백 vs "필드 없는 객체" 폴백 경계 명시적 고정 |
| 7 | testing | 프런트 `handleExecutionFailed` — `error` 객체가 `message` 없이 `{code, nodeId}` 뿐인 케이스 미테스트 | `use-execution-events.ts:264-276` | `message: ''` fixture 로 경계 한 줄 고정(필수 아님) |
| 8 | maintainability | string-or-object 추출 관용구가 프런트 한 파일에서 세 번째로 반복(`handleExecutionFailed`/`handleNodeFailed`/`handleNodeCancelled`) — 의도적 일관성, 4번째 반복 시 헬퍼 추출 합의됨 | `use-execution-events.ts:268-270`(및 `:863-865`,`:970-972`) | 조치 불요(4번째 반복 시 `extractErrorMessage` 헬퍼 검토) |
| 9 | maintainability | `toTerminalErrorPayload` 의 스칼라 방어 범위(`number`/`boolean`/`bigint`)가 실제 4개 호출부(jsonb, `{message}`/`{code,message}`/문자열뿐)보다 넓음 — `no-base-to-string` lint 대응, 테스트로 고정됨 | `terminal-error-payload.ts:58-65` | 조치 불요(과설계이나 결함 아님, 3라운드 연속 재확인) |
| 10 | maintainability | `chat-channel.dispatcher.ts` `execution.failed` case 의 조사 경위 주석이 실제 로직(6줄)보다 김(15줄) | `chat-channel.dispatcher.ts:538-545,559-566` | 조치 불요. 다음에 건드릴 때 요약 1~2줄로 축소 고려 |
| 11 | maintainability | 같은 함수 안에서 `execution.failed`(헬퍼 기반, 타입 안전)와 `execution.cancelled`(손수 캐스트)가 구조적으로 비대칭 | `chat-channel.dispatcher.ts:574-581`(cancelled, 이번 diff 밖) | 조치 불요(범위 밖, plan 에 후속 PR 로 이미 등재) |
| 12 | scope | 코드 변경(12개 소스/테스트+spec) 대비 `plan/`·`review/` 프로세스 산출물 비중이 큼(누적 77 files) — 대조 결과 무단 확장 아님(전부 이전 라운드 증적·rename·명시 근거) | `review/code/2026/08/14/{22_55_51,23_17_57,23_34_12}/**` 등 | 조치 불요 |
| 13 | documentation | `chat-channel.dispatcher.ts` 신규 주석 마지막 문장이 대입값(`null`)이 아니라 다운스트림 표현(`""`)을 근거로 인용 — 2라운드 연속 조치 불요 처분된 항목 | `chat-channel.dispatcher.ts:565-566` | 조치 불요(다음 편집 시 `code: null` 표기로 통일 고려) |
| 14 | user_guide_sync | `run-debug-flow-change` 매트릭스 항목과 표면적으로 유사하나 대조 결과 무관(다른 객체, 최종 사용자 문구 불변) — 이전 라운드와 동일 판정 재확인 | `05-run-and-debug/error-handling.mdx`, `run-results.mdx` | 조치 불요 |
| 15 | security/requirement/side_effect/api_contract | (긍정 확인) `toTerminalErrorPayload` 는 스프레드 없는 화이트리스트 방식으로 prototype pollution 벡터 없음, DB write 파라미터화 유지, 컨슈머 무검증 캐스팅(`as typeof error`) 제거, DB↔wire drift(`attempts` 누락 등) 구조적 해소, 프런트 캐스팅→narrowing 전환(직전 CRITICAL 해소) | `terminal-error-payload.ts`, `chat-channel.dispatcher.ts:552-558`, `use-execution-events.ts:264-276` | 해당 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | prototype pollution 없음, DB 쿼리 안전, 캐스팅 취약점 해소 확인. 값-패턴 마스킹 갭은 pre-existing (INFO) |
| requirement | LOW | 4개 emit 지점 통일 실측 확인. spec 내부(`chat-channel-adapter.md`) nullable 표기 불일치 WARNING |
| scope | LOW | 실질 코드 변경 12개 파일로 좁고 plan 범위와 1:1 대응. 프로세스 산출물 비중은 정당 |
| side_effect | LOW | wire breaking change 는 문서화·완화됨. non-mutation 확인, dead field 제거 안전 |
| maintainability | LOW | 헬퍼 일원화로 직전 WARNING 해소. 잔여는 전부 기결정 INFO |
| testing | MEDIUM | `finalizeFailedExecution` sentinel code 미단언 WARNING. 나머지는 경계 케이스 INFO |
| documentation | LOW | 3라운드 지적 전부 해소 확인. plan 체크리스트 미체크 4번째 재발 WARNING |
| api_contract | LOW | 외부 webhook breaking change 고지 미흡 WARNING. spec-conformant 방향이라 완화됨 |
| user_guide_sync | NONE | 매칭 trigger 0건, 누락 동반 갱신 0건 |

## 발견 없는 에이전트

- user_guide_sync (위험도 NONE — 매칭되는 문서 동기화 trigger 없음)

## 권장 조치사항

1. `execution-engine.service.spec.ts` 의 `finalizeFailedExecution` 테스트 2곳(:999, :6913)에 `error` 필드(특히 sentinel `code` 보존) 단언 추가 — testing WARNING #1.
2. `project-planner` 턴에서 `spec/conventions/chat-channel-adapter.md:150` 의 `EiaEvent.error.code` 를 `string | null` 로 정정 — requirement WARNING #2.
3. `plan/in-progress/eia-terminal-payload.md:173,175,177` 체크박스를 `[x]` 로 갱신 — documentation WARNING #3.
4. 외부 webhook 활성 구독자 유무를 확인해 plan 산출물에 근거 한 줄 기록(breaking change 리스크 종결 또는 마이그레이션 경로 검토) — api_contract WARNING #4.
5. (선택) `deepRedactSecrets` 를 `Execution.error.message`/`details` 경로에 적용하는 후속 PR 검토 — security INFO #5.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (9명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보 확인, 누락 없음.
  - **제외**: 아래 표 (5명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 diff 범위(wire 필드 형태 통일)에 성능 영향 저관련 |
  | architecture | router 판단 — 아키텍처 구조 변경 없음 |
  | dependency | router 판단 — 신규 의존성 없음 |
  | database | router 판단 — 쿼리 구조 미변경(파라미터화 유지) |
  | concurrency | router 판단 — 동시성 로직 변경 없음 |