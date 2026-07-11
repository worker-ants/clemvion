# API 계약(API Contract) 리뷰 — EIA/WS continuation 명령 ↔ 대기 노드 표면 매트릭스 가드

검토 대상: `resolveWaitingNodeExecutionId` publisher chokepoint 확장(`waiting-surface-guard.ts` 신설) +
`interaction.controller.ts`/`interaction.service.ts` 문서 갱신 + `hooks.service.ts` graceful catch.
관련 spec: `spec/5-system/4-execution-engine.md §7.5.1`, `spec/5-system/14-external-interaction-api.md`
(EIA-IN-13, §5.1). 관련 plan: `plan/in-progress/eia-command-waiting-surface-guard.md`.

## 발견사항

- **[WARNING] 외부(EIA) 클라이언트 대상 breaking behavior 변경인데 external-facing 공지/체인지로그 메커니즘이 없음**
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `resolveWaitingNodeExecutionId`/`assertCommandMatchesWaitingSurface` (신규), `spec/5-system/14-external-interaction-api.md` §5.1 `STATE_MISMATCH`
  - 상세: 이 변경은 이전에 (버그로 인해) **202/성공 ack 로 조용히 수리**되던 요청 조합(form 대기 중 `end_conversation`/`submit_message`/`click_button`, buttons 대기 중 비-`click_button`)을 **409 STATE_MISMATCH**(EIA REST) / **422 INVALID_STATE**(REST `/continue`) / WS ack `INVALID_EXECUTION_STATE` 로 명시적으로 거부하도록 바꾼다. 이는 실질적인 **behavior breaking change** 다 — 오늘 이 조합을 보내고 있는 (버그를 인지하지 못한) 외부 EIA 클라이언트는 배포 직후 새로운 409 를 처음 보게 된다.
    이를 "버그 수정"으로 정당화하는 근거는 확인됨: (1) 옛 202 는 데이터 오염(빈 폼 제출/엉뚱한 포트 분기)이라는 **결함 동작**이지 정당한 성공 케이스가 아니다. (2) EIA-IN-13("현재 노드 상태와 명령이 맞지 않으면 409 Conflict", **필수** 요구사항)과 §5.1 `STATE_MISMATCH` 표 행이 이미 이런 거부를 계약으로 약속해 왔다 — 코드가 그 약속을 지금까지 이행하지 못했을 뿐. (3) 신규 에러 코드를 만들지 않고 기존 `STATE_MISMATCH`/`INVALID_EXECUTION_STATE`/`INVALID_STATE` 를 그대로 재사용해 코드 표면 자체는 확장되지 않는다.
    다만 이 프로젝트는 **URL 버저닝을 쓰지 않는 단일 버전 운영**(`spec/5-system/2-api-convention.md:31` "버전 | URL 경로에 포함하지 않음")이고, EIA 문서 전체를 검색해도 breaking-change 공지·체인지로그·파트너 통지 절차가 전혀 없다(`spec/5-system/14-external-interaction-api.md:266` 이 유일하게 "하위 호환"을 언급하나 이는 additive field 케이스 한정). 즉 "버그 수정으로 봐도 되는가"의 내부 논증은 spec/plan 수준에서 충분히 이뤄졌지만(자매 `/consistency-check --impl-prep` 세션이 이미 CRITICAL 없음으로 판정), **외부 API 소비자에게 이 동작 변화를 알릴 채널이 이 diff 안에 없다** — Swagger 설명 갱신(파일 5, `interaction.controller.ts`)은 개발자가 API 문서를 다시 읽을 때만 보이는 passive 갱신이고, 실제로 이 조합에 의존하던(의도했든 우연이든) 클라이언트에게 능동적으로 도달하지 않는다.
  - 제안: `--impl-done` 이전 spec 동기화 단계에서 (a) EIA 문서에 최소한의 "Behavior Change" 절 또는 릴리스 노트성 언급을 추가하고, (b) 외부 파트너/채널 어댑터(F-1/F-2 가 이미 식별한 chat-channel 경로 포함) 운영자에게 이 조합이 이제 409/422 로 바뀐다는 사실을 별도 공지할지 여부를 project-planner 가 명시적으로 결정하도록 plan 체크리스트에 항목을 추가할 것. 코드 자체를 되돌릴 필요는 없음(버그 수정이 맞는 방향) — 다만 "이미 약속된 계약의 구현이라 공지 불필요"라는 결론이 어디에도 명문화돼 있지 않다.

- **[INFO] STATE_MISMATCH 카탈로그가 신규 트리거 조건(표면 불일치)을 아직 열거하지 않음 — 이미 트래킹됨**
  - 위치: `spec/5-system/14-external-interaction-api.md:341`(`STATE_MISMATCH` 행 예시 "completed 상태에서 submit_message, 또는 다른 nodeId"), `spec/5-system/4-execution-engine.md §7.5.1`(0건/다중row 2-case 표)
  - 상세: `interaction.controller.ts` 의 `@ApiConflictResponse` 설명(Swagger, 외부 개발자가 실제로 보는 문서)은 이번 diff 에서 이미 갱신됐으나(파일 5), §5.1 본문 표와 §7.5.1 표는 아직 새 케이스("표면(interactionType) 불일치")를 반영하지 않는다. 자매 `/consistency-check --impl-prep` 세션(`review/consistency/2026/07/10/23_19_34/*.md`)이 이미 이 갭을 WARNING 3건(convention_compliance·cross_spec·rationale_continuity)으로 잡았고, plan 의 "spec 동기" 체크리스트 항목이 명시적으로 이를 닫도록 예정돼 있다. 신규 이슈 아님 — `--impl-done` 이전 필수 이행 확인용으로만 기록.
  - 제안: 별도 조치 불요(이미 plan 에 등재) — `--impl-done` 리뷰에서 이 항목이 실제로 닫혔는지만 재확인할 것.

- **[INFO] `expectedCommands`(§6.2, 미구현 문서 필드) 값 집합이 실제 서버 허용 범위(4종)보다 좁게 서술** — 코드 계약 아님
  - 위치: `spec/5-system/14-external-interaction-api.md:560`
  - 상세: 크로스체크 결과 `expectedCommands` 는 코드베이스에 구현이 전혀 없는 순수 문서 필드(grep 0건)라 실제 wire 응답에 영향이 없다 — API 계약 위반이 아니라 문서 내부 불일치일 뿐. 이미 plan 의 spec 동기 항목에 반영 예정.
  - 제안: 조치 불요(이미 트래킹).

- **[정보 확인 — 문제 없음] 에러 응답 shape·HTTP 상태 코드는 규약과 완전히 정합**
  - 신규 거부는 EIA 409(`{error:{code:'STATE_MISMATCH', message}}`), WS ack(`{success:false, error:{code:'INVALID_EXECUTION_STATE', message}}`), REST `/continue` 422(`{error:{code:'INVALID_STATE', message}}`) 세 표면 모두 **기존** 매핑 코드 경로(`dispatchContinuation`/websocket gateway/`executions.controller.ts`)를 그대로 재사용한다 — 신규 에러 클래스·신규 status 코드 도입 없음. `2-api-convention.md §5.3` 의 `{error:{code,message,details?}}` envelope 을 그대로 따른다. HTTP 상태 코드 선택(409 for state-conflict on EIA, 422 for semantic-invalid on `/continue`)도 REST 관례상 적절.
  - `InvalidExecutionStateError` 의 client-safe 고정 메시지(`'Execution is not waiting for input.'`) + `serverDetail` 분리(§7.5.2)가 신규 조건에도 그대로 적용돼 대기 노드의 실제 `nodeId`/표면 타입이 client 응답에 노출되지 않는다 — e2e 테스트(`execution-park-resume.e2e-spec.ts`)가 `JSON.stringify(rejected.body)` 로 `nodeId` 부재를 직접 실증. 정보 노출 관점 문제 없음.

- **[INFO] `hooks.service.ts` 의 신규 `catch (err instanceof ConflictException)` 가 코드 필터링 없이 광범위**
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` `forwardToInteractionService`
  - 상세: 이 in-process 호출 경로는 오늘은 `STATE_MISMATCH` 만 던질 수 있다(idempotency interceptor 는 HTTP 계층에만 적용되고 in-process 호출은 우회하므로 `IDEMPOTENCY_KEY_CONFLICT` 는 이 경로에 도달 불가 — 확인함). 그러나 catch 조건이 `ConflictException` 클래스 전체이지 `error.code === 'STATE_MISMATCH'` 로 좁히지 않아, 향후 이 호출 경로에 다른 `ConflictException` 트리거가 추가되면(예: idempotency 검증이 in-process 경로로 확장) 의도치 않게 같이 삼켜질 위험이 있다. 오늘 당장의 결함은 아님.
  - 제안: 필수는 아니나 `err instanceof ConflictException && (err.getResponse() as any)?.error?.code === 'STATE_MISMATCH'` 로 좁히면 향후 drift 에 더 안전. Low priority.

- **[정보 확인 — 문제 없음] 요청 검증·에러 우선순위**: `dispatchContinuation` 의 catch 순서(`InvalidExecutionStateError` → `MessageTooLongError` → `FormValidationError` → rethrow)는 변경되지 않았고, 신규 표면 검증은 이 체인의 가장 앞(`InvalidExecutionStateError`) 분기를 그대로 타므로 기존 400 `VALIDATION_ERROR`/`MESSAGE_TOO_LONG` 우선순위 계약과 충돌하지 않는다. `assertNodeId`(존재 여부만 검사, nodeId 실제 일치는 미검증 — F-1 로 이미 별도 추적 중인 pre-existing gap)는 이번 변경으로 악화되지 않음.

- **[정보 확인 — 문제 없음] URL/경로·페이지네이션·인증/인가**: 신규 엔드포인트·경로 변경 없음(기존 `POST /api/external/executions/:id/interact`, `POST /api/executions/:id/continue`, WS `execution.*` 그대로). 목록 API 아님 — 페이지네이션 무관. 토큰 검증(`InteractionGuard`)·`in_process_trusted` scope 로직 모두 미변경 — 인가 우회/약화 없음(가드는 publish 이전 추가 검증을 얹을 뿐, 기존 authn/authz 체크를 대체하거나 건너뛰지 않음).

## 요약

핵심 변경(publisher chokepoint 에 대기 표면-명령 매트릭스 사전 검증 추가)은 API 계약 관점에서 견고하다 — 신규 에러 코드 없이 기존 `STATE_MISMATCH`/`INVALID_EXECUTION_STATE`/`INVALID_STATE` 세 표면 매핑을 그대로 재사용하고, 에러 응답 envelope·client-safe 메시지 분리·HTTP 상태 코드 선택 모두 기존 규약(`2-api-convention.md §5.3`, `4-execution-engine.md §7.5.2`)을 정확히 따른다. 다만 지시받은 핵심 쟁점 — **종전 202(성공)를 409/422 로 바꾸는 하위 호환성 파괴** — 는 실질적인 breaking behavior change 다. 이를 "버그 수정"으로 정당화하는 근거(EIA-IN-13 필수 요구사항이 이미 이 거부를 약속했고, 옛 202 는 데이터 오염 결함이었다)는 spec 교차검증(선행 `/consistency-check --impl-prep` 세션, `review/consistency/2026/07/10/23_19_34/*`)으로 이미 충분히 뒷받침되며 CRITICAL 급 계약 위반은 없다. 그러나 이 프로젝트는 URL 버저닝이 없는 단일 버전 API 운영이고 EIA 문서 어디에도 breaking-change 공지·체인지로그 절차가 없어, **오늘 이 결함 조합에 (의도치 않게) 의존 중인 외부 EIA 클라이언트에게 이 변화를 알릴 채널이 이 diff 범위에 없다** — 이것이 유일한 실질 WARNING 이다. STATE_MISMATCH 카탈로그 열거 갭·`expectedCommands` 문서 불일치는 이미 plan 의 spec 동기 체크리스트로 트래킹 중이라 재차 차단할 필요는 없다.

## 위험도

MEDIUM — CRITICAL 급 계약 위반(신규 미문서화 에러 코드, envelope 붕괴, 인가 약화 등)은 없으나, 외부 파트너 대상 API 의 behavior tightening 에 대한 공지 메커니즘 부재는 코드 자체보다 상위(운영/커뮤니케이션) 레벨에서 반드시 결정돼야 할 WARNING 이다.
