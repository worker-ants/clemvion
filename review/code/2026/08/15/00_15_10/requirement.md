STATUS=success requirement review complete — 0 CRITICAL, 0 WARNING, 2 INFO
===REPORT_MARKDOWN_BELOW===
### 발견사항

- **[INFO]** `execution.cancelled` 의 `error` 는 이번 §6.4 object 일원화 범위 밖으로 남아 있다
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts` `EiaCancelledEvent.error?: { code: string; message?: string }` (nullable 화·`nodeId`/`details` 미포함, diff 밖 기존 코드 — 직접 Read 로 확인), `codebase/backend/src/shared/utils/terminal-error-payload.ts:4-9`(JSDoc 이 범위를 `execution.failed` 4개 emit 지점으로 명시적으로 좁힘)
  - 상세: `spec/5-system/14-external-interaction-api.md` §6 필드 집합 표(`error` 행, 게이트 572)는 `failed`/`cancelled` 를 같은 목표 형태로 규정하면서도 "`cancelled` 는 아직 `{code, message}` 를 손으로 만들어 `nodeId`/`details` 가 없다" 고 **그 갭을 명시적으로 기록**한다. `spec-draft-eia-notification-payload-contract.md:105`·`terminal-error-payload.ts` JSDoc(§"현재 호출부는 4곳뿐이다")도 동일하게 좁은 범위를 선언해 3계층(코드·spec·plan)이 일관되게 이 경계를 서술한다. 은폐가 아니라 spec 이 스스로 선언한 잔여 스코프이므로 이번 diff 의 결함은 아니다.
  - 제안: 조치 불요. 후속 PR 착수 시 `spec-draft-eia-notification-payload-contract.md` 체크리스트를 그대로 사용.

- **[INFO]** `TerminalErrorPayload.details` 는 값-패턴 시크릿 마스킹을 거치지 않고 wire 로 통과하지만, 현재 4개 producer 어느 곳도 `details` 를 채우지 않아 도달 불가 경로다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:78-80` (`if (src.details !== undefined) out.details = src.details;`)
  - 상세: `failFirstSegmentSetup`(`{message}`)·`finalizeStalledExhausted`(`{code,message}`)·`finalizeFailedExecution`(`{message, code?}`)·`failRetryExecution`(`{message}`) 리터럴을 직접 Read 로 전수 확인한 결과 어느 곳도 `details` 키를 쓰지 않는다. `message` 자체도 임의 예외 원문을 마스킹 없이 내보내지만, 이는 이 PR 이전부터 동일 문자열이 같은 fanout(webhook/SSE/chat-channel)을 타던 선존 갭이며 이번 diff 가 노출 범위를 넓히지 않는다(형태만 string→object). `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 마스킹 항목으로 이미 등재돼 있다.
  - 제안: 조치 불요(이번 PR 범위 밖, 이미 백로그 추적 중).

### 요약

핵심 변경(`terminal-error-payload.ts` 신설 `toTerminalErrorPayload` + spec 128줄, `execution-engine.service.ts`/`retry-turn.service.ts` 의 `EXECUTION_FAILED` emit 4곳 통일, `chat-channel.dispatcher.ts`/`types.ts` 의 레거시 문자열 흡수 경로·유령 필드 정리, `use-execution-events.ts` 프런트 동반 수정)를 소스 파일 전체를 직접 Read 하여 대조 검증했다. 4개 emit 호출부(`execution-engine.service.ts:664,3314,4872`, `retry-turn.service.ts:966`)와 consumer 1곳(`chat-channel.dispatcher.ts:552`)이 모두 같은 헬퍼를 부르며, `stalledError`/`savedExecution.error`/`execution.error`/`row.error` 를 DB write 와 emit 이 공유해 종전에 실제로 벌어져 있던 DB↔wire drift(`attempts` 누락)가 구조적으로 재발 불가능해졌다. `EiaFailedEvent.error.code`(`string|null`)·`nodeId?`(optional 유지 근거 명시) 타입이 헬퍼 반환 형태·spec §6.4 코드 블록과 line-level 로 일치하고, spec 문서 자체도 §6 필드 표(게이트 572)와 §6.4 blockquote(게이트 792-797)가 "전 경로 object" 로 서로 모순 없이 정합되어 있음을 직접 확인했다(이전 라운드가 지적한 두 곳의 자기모순은 해소됨). `toTerminalErrorPayload` 는 null/undefined→`null`, string/number/boolean/bigint→문자열화, 비-object 그 외(symbol 등)→빈 `message`, object→필드별 `typeof` 가드로 부재를 명시적 `null` 로 정규화하는 모든 분기가 `terminal-error-payload.spec.ts`(전문 확인) 에 값-레벨로 고정돼 있고, 프런트 회귀 캐너리(`use-execution-events.test.ts`)도 object 가 스토어에 들어가지 않음을 확인한다. TODO/FIXME/HACK/XXX 잔존 없음(대상 7개 파일 전수 grep). 반환값은 모든 분기에서 §6.4 형태 또는 `null` 로 일관되며, dispatcher 의 `?? {code:null, message:'unknown error', nodeId:null}` 폴백도 `null`/`undefined` 입력에서만 발동해 헬퍼 자체의 스칼라 처리와 중복되지 않는다. 남은 두 관찰(`execution.cancelled` 미통일, `details` 마스킹 미적용)은 spec·plan·코드 3계층에 이미 명시적으로 범위 밖으로 기록된 항목이라 INFO 로만 남긴다.

### 위험도
NONE
