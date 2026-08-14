# 유지보수성(Maintainability) Review

## 리뷰 범위에 대한 메모

이 changeset(base `589914d6d`..HEAD)은 `execution.failed` 의 `error` 를 문자열에서 EIA §6.4
객체(`{code, message, nodeId, details?}`)로 통일하는 리팩터다. 실질 코드 변경은 12개 파일
(신규 `terminal-error-payload.ts`+spec, `execution-engine.service.ts`/`retry-turn.service.ts`
의 4개 `EXECUTION_FAILED` emit 통일, `chat-channel.dispatcher.ts`/`types.ts` 의 back-compat
wrap·유령 필드 정리, `use-execution-events.ts` 프런트 동반 수정)이고, 나머지 다수 파일은
`plan/**`·`spec/**`·`review/**` 문서 산출물이다. 이 diff 는 이미 같은 브랜치 안에서 4라운드
ai-review(`22_55_51`→`23_49_41`)를 거쳤고 각 라운드가 찾은 CRITICAL 1건·WARNING 다수가 전부
조치돼 있다. 실제 소스 파일(`terminal-error-payload.ts`, `chat-channel.dispatcher.ts`,
`execution-engine.service.ts`, `retry-turn.service.ts`, `types.ts`, `use-execution-events.ts`)을
직접 Read 로 열어 diff 문맥이 아니라 파일 전체 기준으로 독립 재확인했다.

## 발견사항

- **[INFO]** `toTerminalErrorPayload` 의 스칼라 방어 분기(`number`/`boolean`/`bigint`)가 실제 호출부가 낼 수 있는 값의 종류보다 넓다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts` 함수 `toTerminalErrorPayload` (58~65행, 66~67행 주석)
  - 상세: 실제 4개 emit 지점이 `Execution.error`(jsonb)에 쓰는 값은 `{message}`/`{code, message}` 형태 객체 또는 레거시 문자열뿐이다. `number`/`boolean`/`bigint` 분기는 함수 시그니처가 `err: unknown` 인 일반 유틸리티로서의 방어이고, `bigint`·`symbol` 은 파일 자신의 주석이 이미 "여기 도달하지 않는다" 고 인정하는 사실상 죽은 분기다. `no-base-to-string` lint 대응으로 분기가 나뉜 것이고 각 분기에 `terminal-error-payload.spec.ts` 테스트가 붙어 있어 결함은 아니며, "한 헬퍼로 4곳을 묶는다" 는 plan 의도 대비로는 방어폭이 넓은 경미한 과설계 성향이다.
  - 제안: 조치 불요. 재지적 방지를 원하면 함수 코멘트에 "DB jsonb 값 종류보다 넓은 일반 유틸리티 방어" 한 줄만 추가.

- **[INFO]** `chat-channel.dispatcher.ts` 의 `execution.failed` 분기에 조사 경위를 서술하는 주석이 실제 정규화 로직보다 길다
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` — `toChatChannelEvent` 의 `case 'execution.failed':` 블록 (537~546행, 559~566행)
  - 상세: "종전 주석이 가리키던 `spec-update-execution-failed-payload-shape` plan 은 존재한 적이 없다(`git log --diff-filter=A` 0건)", "`code: "INTERNAL_ERROR"` 대신 `null` 을 쓰는 이유" 를 설명하는 조사 로그 성격 문단이 각각 9줄·8줄인데, 실제 대입 코드(`const error = toTerminalErrorPayload(errorRaw) ?? {...}`)는 6줄이다. 근거를 코드 옆에 남기는 것 자체는 이 저장소가 반복해서 채택해 온 관례이고 무관한 잡담도 아니지만, 조사 절차(`git log` 실행 결과 같은 디버깅 로그)까지 프로덕션 소스에 남으면 다음 사람이 실제 로직을 찾기까지 읽어야 하는 텍스트 양이 늘어난다.
  - 제안: 조치 불요(차단 사유 아님). 다음에 이 블록을 다시 건드릴 때 조사 경위 전문은 `plan/in-progress/eia-terminal-payload.md` 재판정 절로만 남기고 코드 주석은 결론 1~2줄로 압축하는 것을 고려.

- **[INFO]** string-or-object 추출 관용구가 같은 파일에서 3번째로 반복된다
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:268-270`(`handleExecutionFailed`, 이번 diff 신규 추가) — 기존 `handleNodeFailed`(863-865행)·`handleNodeCancelled`(970-972행)에 동일 3줄(`typeof payload.error === "string" ? payload.error : payload.error?.message`)이 이미 존재함을 grep 으로 직접 확인.
  - 상세: 세 곳 모두 로컬 타입 선언(필드 목록)은 약간씩 다르지만 핵심 로직은 동일하다. 코드 주석이 "같은 파일 `node.failed` 핸들러가 이미 쓰는 관용구로 통일한다" 고 명시해 스타일 이탈이 아니라 의도적 일관성 유지이며, 이 changeset 의 RESOLUTION 문서에서 이미 "4번째 반복 시점에 `extractErrorMessage` 로 추출" 하기로 합의된 상태다. DRY 관점의 경미한 잔여 부채로만 남긴다.
  - 제안: 시급하지 않음. 4번째 반복이 생기기 전에 `extractErrorMessage(error: string | { message?: string } | null | undefined): string | undefined` 같은 작은 공용 헬퍼로 추출 검토.

- **[INFO]** (참고, 신규 지적 아님) 소스 코드 주석이 `review/code/**` 세션 타임스탬프(예: `` `22_55_51`/`23_17_57` maintainability W3 ``)를 근거 포인터로 인용한다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:9`, `:62`; `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:551`; `codebase/backend/src/modules/chat-channel/types.ts:403`; `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts:277`; `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 4곳
  - 상세: 바로 이 diff 가 "존재한 적 없는 plan 이름을 가리키던 죽은 참조"를 걷어내는 작업(`chat-channel.dispatcher.ts` JSDoc 리라이트)을 하면서, 같은 diff 가 남긴 다른 주석들은 `review/code/<YYYY>/<MM>/<DD>/<hh_mm_ss>/` 트리 아래의 **날짜 없는 bare 타임스탬프**(`22_55_51` 등)만으로 근거를 인용한다. 이 값 자체로는 정확한 날짜 디렉터리를 특정할 수 없어(같은 `hh_mm_ss` 가 다른 날짜에 재등장할 가능성이 이론상 있다), 다음 조사자가 인용을 추적하려면 저장소의 `review/code/**` 레이아웃 관례를 미리 알고 있어야 한다. 다만 `grep -rn "22_45_24\|23_07_11\|23_46_00" codebase/backend/src/` 로 확인한 결과 이 패턴은 `update-returning-rows.ts`/`knowledge-base.service.spec.ts` 등 이 PR 이전부터 저장소 전역에 이미 널리 쓰이던 기존 컨벤션이며, 이번 diff 는 그 기존 스타일을 그대로 따른 것일 뿐 새로 도입한 패턴이 아니다 — 컨벤션 일관성 관점에서는 오히려 준수다.
  - 제안: 이 PR 범위에서 조치 불요(기존 저장소 전역 컨벤션). 저장소 차원에서 재검토한다면, 향후엔 `hh_mm_ss` 대신 날짜를 포함한 전체 세션 경로(`2026-08-14/22_55_51`)로 인용하면 모호성이 줄어든다는 정도만 참고로 남긴다.

## 요약

핵심 변경(`terminal-error-payload.ts` 신설 헬퍼+테스트, 엔진/재시도 서비스의 4개 `EXECUTION_FAILED`
emit 지점 통일, `chat-channel.dispatcher.ts`/`types.ts` 의 back-compat wrap·유령 필드 정리,
`use-execution-events.ts` 의 프런트엔드 companion fix)는 함수 길이·중첩 깊이·매직 넘버·네이밍
컨벤션 모두 양호하다. 신설 헬퍼는 짧고 단일 책임이며 각 분기·기본값의 근거가 JSDoc/인라인 주석에
잘 남아 있고, `stalledError`/`stalledError.code` 재사용처럼 "DB 와 emit 이 손으로 반복되며
갈리던" 기존 결함 유형(실측: `finalizeStalledExhausted` 가 `attempts` 를 emit 문구에서 빠뜨려
DB·wire 가 이미 어긋나 있었음)을 구조적으로 막는 리팩터가 이뤄졌다. 직전 4라운드가 찾은 CRITICAL
(프런트 캐스팅-only 로 인한 렌더 크래시)과 WARNING(컨슈머가 정규화를 손으로 재구현하며 무검증
캐스팅까지 있었던 것)은 코드 레벨에서 실제로 해소됐음을 직접 확인했다. 남는 관찰은 전부 INFO
수준 — 신설 헬퍼의 방어 범위가 실제 DB 호출부보다 다소 넓은 것(테스트로 고정돼 있어 결함은 아님),
`chat-channel.dispatcher.ts` 의 조사 경위 주석이 실제 로직보다 긴 것, 프런트 string-or-object
추출 관용구가 3번째로 반복돼 DRY 부채가 경미하게 누적되는 것, 그리고 소스 주석이 review 세션의
bare 타임스탬프를 근거로 인용하는 기존 저장소 관례(이 PR 이 새로 만든 패턴은 아님)이며, 어느 것도
차단 사유가 아니다.

## 위험도
LOW
