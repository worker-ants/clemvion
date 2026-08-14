# 유지보수성(Maintainability) Review — `23_49_41`

## 리뷰 범위에 대한 메모

이 changeset 은 이미 세 라운드(`22_55_51` CRITICAL 1/WARNING 10 → `23_17_57` WARNING 6 →
`23_34_12` WARNING 3)를 거쳐 수렴한 상태다. 핵심 코드 파일(`terminal-error-payload.ts` 신설,
`chat-channel.dispatcher.ts`/`types.ts`, `execution-engine.service.ts`/`retry-turn.service.ts`
의 4개 emit 지점, `use-execution-events.ts`)을 diff 문맥이 아니라 현재 HEAD(`843a36ac7`)
기준으로 직접 `Read`/`grep` 해 재확인했다. `plan/**`·`review/**` 산출물(50여 개)은 코드가
아니므로 이 리뷰 대상에서 제외한다.

## 발견사항

- **[INFO]** (긍정 확인) 직전 라운드(`23_17_57`) maintainability WARNING — "정규화 로직을
  emit 지점마다 손으로 하면 빠진다"는 헬퍼 도입 근거가 `chat-channel.dispatcher.ts` 컨슈머
  쪽에서 재현되고 있었다 — 이 diff 로 실제로 해소돼 있다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:546-558`
    (`case 'execution.failed':` 블록, `const error: EiaFailedEvent['error'] = toTerminalErrorPayload(errorRaw) ?? {...}`)
  - 상세: 직접 읽어 확인한 결과 종전 3-way 손수 분기(`errorRaw as typeof error` 무검증
    캐스트 포함)가 제거되고 producer(엔진) 4곳과 동일한 `toTerminalErrorPayload` 헬퍼를
    그대로 재사용한다. 정규화 로직의 SoT 가 `codebase/backend/src/shared/utils/terminal-error-payload.ts`
    하나로 수렴했다.

- **[INFO]** string-or-object 추출 관용구가 프런트엔드 한 파일에서 세 번째로 반복
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:268-270`
    (`handleExecutionFailed`, 이번 diff 신규). 동일 관용구가 `handleNodeFailed:863-865`,
    `handleNodeCancelled:970-972` 에도 이미 존재함을 grep 으로 재확인(둘 다 diff 밖,
    기존 코드).
  - 상세: 세 곳 모두 로컬 타입 선언은 조금씩 다르지만 핵심 로직(`typeof payload.error === "string" ? payload.error : payload.error?.message`)은 동일하다. 코드 주석이 "같은 파일 `node.failed` 핸들러가 이미 쓰는 관용구로 통일한다"고 명시해 의도적 일관성 유지이며 스타일 이탈은 아니다. 다만 세 번째 반복 시점에서 공용 헬퍼로 뽑지 않은 것은 DRY 관점에서 경미한 잔여 부채다. 두 이전 라운드(`23_17_57`, `23_34_12`)에서 이미 같은 내용으로 지적·"4번째 반복 시 추출" 로 조치 방향이 합의된 항목이라 새 지적은 아니다.
  - 제안: 시급하지 않음. 네 번째 반복이 생기면 `extractErrorMessage(error: string | { message?: string } | null | undefined): string | undefined` 같은 작은 헬퍼로 추출.

- **[INFO]** `toTerminalErrorPayload` 의 스칼라 방어 범위(`number`/`boolean`/`bigint`)가 실제
  호출부(DB jsonb 컬럼)가 낼 수 있는 값의 종류보다 넓다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:58-65`
  - 상세: 4개 emit 지점이 `Execution.error`(jsonb)에 실제로 쓰는 값은 `{message}` /
    `{code, message}` 객체 또는 레거시 문자열뿐이다. `bigint` 분기는 파일 자신의 주석
    (`:66`, "symbol·function 은 … 여기 도달하지 않는다")이 이미 인접 분기의 도달 불가를
    인정하고 있을 정도로 일반화돼 있다. `no-base-to-string` lint 대응으로 분기가 나뉜
    것이고, `terminal-error-payload.spec.ts` 가 각 분기를 개별 테스트로 고정해 사각지대는
    없다. 세 라운드 전부에서 같은 내용으로 지적·조치불요(과설계이나 결함 아님) 처리된
    항목의 재확인이다.
  - 제안: 조치 불요.

- **[INFO]** `chat-channel.dispatcher.ts` 의 `execution.failed` case 블록에서 조사 경위를
  서술하는 주석이 실제 정규화 로직(6줄)보다 길다
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:538-545`,
    `559-566` (게이트 기준, 두 주석 블록 합산 15줄 vs 실제 대입 코드 6줄)
  - 상세: "존재한 적 없는 plan 을 가리키던 종전 주석" 대체 근거, "`INTERNAL_ERROR` 대신
    `null` 을 쓰는 이유"를 설명하는 문단이 각각 8줄·8줄이다. 근거를 코드 옆에 남기는 것
    자체는 이 저장소의 관례이고 무관한 잡담은 아니지만, 조사 절차("`git log --diff-filter=A`
    0건" 류)까지 프로덕션 소스에 남으면 다음 사람이 실제 로직을 찾기 위해 읽어야 하는
    텍스트 양이 늘어난다. 직전 두 라운드에서 이미 같은 내용으로 지적·조치불요 처리됐다.
  - 제안: 조치 불요. 다음에 이 블록을 건드릴 때 조사 경위는 요약 1~2줄로 줄이고 전문은
    `plan/in-progress/eia-terminal-payload.md` 재판정 절로만 남기는 것을 고려.

- **[INFO]** 같은 `toChatChannelEvent` 함수 안에서 `execution.failed`(신규, 헬퍼 기반·타입
  안전)와 `execution.cancelled`(기존, 손수 캐스트)가 구조적으로 비대칭이다
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:574-581`
    (`case 'execution.cancelled':`, `errRaw as { code: string; message?: string }`) —
    이번 diff 밖(미변경)이나 바로 12줄 위 `execution.failed` 블록과 대비된다.
  - 상세: `execution.failed` 는 이제 `toTerminalErrorPayload` + `EiaFailedEvent['error']`
    타입으로 무검증 캐스팅이 제거됐는데, 바로 아래 `execution.cancelled` 는 여전히
    `errRaw as { code: string; message?: string }` 무검증 캐스트를 쓴다. 두 분기가 나란히
    있어 다음 사람이 "같은 패턴이겠거니" 하고 `cancelled` 쪽도 안전하다고 오판할 여지가
    있다. 다만 이는 새 결함이 아니라 세 라운드 전부에서 "cancelled 는 별도 비용 그룹으로
    의도적 이연"이라고 code(`terminal-error-payload.ts` JSDoc)·spec(§6 표)·plan
    (`eia-terminal-payload.md` 재판정 ③-c) 3곳에 일관되게 기록된 스코프 밖 항목이다.
  - 제안: 조치 불요(범위 밖, 이미 기록됨). 후속 PR 에서 `cancelled` 를 통일할 때 같은
    `toTerminalErrorPayload` 재사용을 우선 검토할 것 — 이미 plan 에 그 방향으로 등재돼 있다.

## 요약

핵심 변경은 `execution.failed` 의 `error` 를 문자열에서 EIA §6.4 객체로 통일하며 신설한
`toTerminalErrorPayload` 헬퍼(35줄, 단일 책임, 분기별 근거가 JSDoc/주석에 남음)를 producer
4곳(엔진 3곳 + retry-turn 1곳)과 consumer 1곳(`chat-channel.dispatcher.ts`)이 전부 공유하도록
수렴시킨 것이다. 직전 라운드가 찾은 maintainability WARNING("정규화 로직을 컨슈머가 손으로
재구현하고 무검증 캐스팅까지 있었다")이 이번 diff 로 실제로 해소됐음을 코드 직접 확인으로
재검증했다. `finalizeStalledExhausted` 가 `stalledError` 객체를 부모 UPDATE·자식 cascade·
emit 세 지점에서 공유하도록 리팩터한 것도 "DB 와 emit 이 손으로 반복되며 갈리던" 기존 결함
유형(§6.4 재판정에서 실측된 `attempts` 누락)을 구조적으로 재발 방지한다. 함수 길이·중첩
깊이·네이밍 컨벤션 모두 양호하며 새로 발견된 WARNING/CRITICAL 급 항목은 없다. 남은 관찰은
전부 INFO 수준(프런트 3중 반복 관용구, 헬퍼의 다소 넓은 방어 범위, 프로덕션 코드 내 조사
경위 주석의 장문화, `execution.cancelled` 분기와의 구조적 비대칭)이며 모두 이전 두 라운드에서
이미 검토·조치불요로 판정된 항목의 재확인이라 이번 라운드에서 새로 차단할 사유는 없다.

## 위험도

LOW
