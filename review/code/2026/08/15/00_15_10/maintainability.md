# 유지보수성(Maintainability) Review

## 리뷰 범위에 대한 메모

이 changeset 은 `execution.failed` 의 `error` 를 string → EIA §6.4 object 로 통일하는 리팩터의 최종
상태다. 직전 5라운드(`22_55_51`, `23_17_57`, `23_34_12`, `23_49_41`, `00_02_43`)의 ai-review 가 이미
CRITICAL 1건(프런트 캐스팅-only 렌더 크래시)과 maintainability WARNING 1건("컨슈머가 정규화를 손으로
재구현하며 무검증 캐스팅을 했다")을 찾아 각 RESOLUTION.md 로 조치를 기록해 왔다. 실코드
(`terminal-error-payload.ts`, `chat-channel.dispatcher.ts`, `execution-engine.service.ts`,
`retry-turn.service.ts`, `use-execution-events.ts`, `types.ts`)를 diff 문맥이 아니라 `Read` 로 파일
전체를 열어 현재 상태를 직접 재확인했다. `plan/**`·`review/**` 산출물(90여 개)은 코드가 아니므로 본
리뷰 대상에서 제외한다.

## 발견사항

- **[INFO]** (긍정 확인) 직전 라운드 maintainability WARNING이 실제로 해소돼 있음을 재확인
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` — `toChatChannelEvent` 의 `case 'execution.failed':` 블록 (직접 Read 로 확인한 현재 줄 번호 546~558, `const error: EiaFailedEvent['error'] = toTerminalErrorPayload(errorRaw) ?? {...}`)
  - 상세: 종전 3-way 손수 분기(`errorRaw as typeof error` 무검증 캐스트 포함)가 제거되고 producer(엔진) 4곳과 동일한 `toTerminalErrorPayload` 헬퍼를 그대로 재사용한다. §6.4 정규화 로직의 SoT 가 `codebase/backend/src/shared/utils/terminal-error-payload.ts` 하나로 수렴했다 — "정규화를 emit 지점마다 손으로 하면 한 곳씩 빠진다"는 이 PR 자신의 헬퍼 도입 근거가 컨슈머 쪽에서도 지켜졌다.

- **[INFO]** `execution.failed` case 블록의 조사 경위 주석이 실제 정규화 로직(코드 6줄)보다 길다(주석 약 21줄)
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` — `case 'execution.failed':` 블록 상단(538~545행)과 `error` 대입 직후(559~566행)
  - 상세: "존재한 적 없는 plan 이름을 가리키던 종전 주석을 걷어낸 경위"(`git log --diff-filter=A` 0건 확인 등 진단 절차 서술), "`INTERNAL_ERROR` 대신 `null` 을 쓰는 이유"를 설명하는 문단이 각각 8줄·8줄이고, 그 사이 실제 대입 코드는 6줄이다. 근거를 코드 옆에 남기는 것 자체는 이 저장소의 관례이고 무관한 잡담도 아니지만, 조사 경위(git log 결과 같은 진단 과정)까지 프로덕션 소스에 남으면 다음 사람이 실제 분기 로직을 찾기 위해 읽어야 하는 텍스트 양이 늘어난다. 차단 사유는 아니며 직전 3라운드(`23_17_57`/`23_34_12`/`00_02_43`)에서 이미 INFO 로 등재·조치 불요 처리된 항목의 재확인이다.
  - 제안: 조치 불요. 다음에 이 블록을 다시 건드릴 때 조사 경위 문단은 요약 1~2줄로 줄이고 전문은 `plan/in-progress/eia-terminal-payload.md` 재판정 절로만 남기는 것을 고려.

- **[INFO]** string-or-object 추출 관용구(`typeof x === "string" ? x : x?.message`)가 한 파일에서 세 번째로 반복
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:268` (`handleExecutionFailed`, 이번 diff 신규). 같은 파일 `handleNodeFailed`(863행), `handleNodeCancelled`(970행)에도 동일 패턴이 있음을 직접 grep 으로 확인(둘 다 이번 diff 밖, pre-existing).
  - 상세: 세 곳 모두 로컬 타입 선언(필드 목록)은 조금씩 다르지만 핵심 3줄 로직은 동일하다. 함수 내 주석이 "같은 파일 `node.failed` 핸들러가 이미 쓰는 관용구로 통일한다"고 명시해 의도적 일관성 유지임을 밝히고 있어 스타일 이탈은 아니다. 다만 세 번째 반복 시점에서 공용 헬퍼로 뽑지 않은 것은 DRY 관점에서 경미한 잔여 부채이며, 직전 라운드들에서도 같은 판단(4번째 반복 시 추출)으로 조치 불요 처리됐다.
  - 제안: 시급하지 않음. 네 번째 반복이 생기기 전에 `extractErrorMessage(error: string | { message?: string } | null | undefined): string | undefined` 같은 작은 헬퍼로 추출 검토.

- **[INFO]** `toTerminalErrorPayload` 의 스칼라 방어 범위(`number`/`boolean`/`bigint`)가 실제 DB 호출부가 낼 수 있는 값의 종류보다 넓다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:58-65`
  - 상세: 실제 4개 emit 지점이 `Execution.error`(jsonb)에 쓰는 값은 `{message}`/`{code, message}` 객체 또는 레거시 문자열뿐이다. `bigint`(JSON 에 존재 불가) 분기는 함수 자신의 다음 줄 주석이 이미 "symbol·function 은 여기 도달하지 않는다"고 인정하는 것과 같은 성격이다. `no-base-to-string` lint 대응으로 분기가 나뉜 것이고, 나눈 뒤 `terminal-error-payload.spec.ts` 로 각 분기를 테스트까지 붙여 뒀으므로 결함은 아니다. 직전 4라운드에서 동일 내용으로 지적·조치불요 처리된 항목의 재확인이다.
  - 제안: 조치 불요.

## 요약

핵심 변경은 `execution.failed` 의 `error` 를 문자열에서 EIA §6.4 객체로 통일하며 신설한
`toTerminalErrorPayload` 헬퍼(짧고 단일 책임, 각 분기·기본값의 근거가 JSDoc/인라인 주석에 잘 남음,
`terminal-error-payload.spec.ts` 로 스칼라·null·부재 케이스가 촘촘히 고정됨)를 엔진 3곳(`markExecutionFailedInner`/`finalizeStalledExhausted`/`finalizeFailedExecution`)·`retry-turn.service.ts` 1곳의
producer 와 `chat-channel.dispatcher.ts` 1곳의 consumer 가 전부 공유하도록 정리한 것이다. `stalledError`/
`stalledError.code` 를 부모·자식 두 UPDATE 가 공유하도록 바꾼 것처럼 "DB 와 emit 문구가 손으로
반복되며 갈리던"(실제로 `attempts` 가 emit 에서 빠져 있던) 기존 결함 유형을 구조적으로 막는 리팩터도
함께 이뤄졌다. 직전 라운드가 찾은 maintainability CRITICAL/WARNING(프런트 캐스팅-only 렌더 크래시,
컨슈머 손수 정규화 + 무검증 캐스팅)은 이번 diff 에서 실제로 해소돼 있음을 코드 레벨에서 직접 재확인했다.
`EiaCompletedEvent`/`EiaFailedEvent` 타입의 유령 필드 제거·nullable 승격도 "타입이 다음 사람에게
잘못된 신호를 준다"는 문제를 없애는 정리다. 함수 길이·중첩 깊이·네이밍 컨벤션·기존 스타일과의
일관성 모두 양호하며, 새로 발견된 WARNING/CRITICAL 급 항목은 없다. 남는 관찰은 전부 INFO 수준(프로덕션
코드 내 조사 경위 주석의 상대적 장문화, 프런트 3중 반복 관용구, 헬퍼의 다소 넓은 방어 범위)이고,
모두 직전 라운드들에서 이미 검토·조치불요로 판정된 항목의 재확인이라 이번 라운드에서 새로 차단할
사유는 없다.

## 위험도

LOW
