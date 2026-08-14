# 유지보수성(Maintainability) Review

## 리뷰 범위에 대한 메모

이 diff 는 `execution.failed` 의 `error` 를 문자열에서 EIA §6.4 object(`{code, message, nodeId, details?}`)로
통일하는 변경의 최종 상태이며, 직전 두 라운드(`22_55_51`, `23_17_57`)의 ai-review 가 이미 CRITICAL 1 건과
maintainability WARNING(“컨슈머가 정규화를 손으로 재구현”)을 찾아 그 fix 가 이 diff 안에 반영돼 있다.
실제 코드(`terminal-error-payload.ts`, `chat-channel.dispatcher.ts`, `execution-engine.service.ts`,
`retry-turn.service.ts`, `use-execution-events.ts`)를 직접 Read 로 열어 diff 문맥이 아니라 파일 전체
기준으로 확인했다. `plan/**`·`review/**` 산출물(문서 40여 개)은 코드가 아니므로 이 리뷰의 대상에서 제외한다.

## 발견사항

- **[INFO]** (긍정 확인) 직전 라운드 maintainability WARNING("정규화를 emit 지점마다 손으로 하면 빠진다"는
  헬퍼 도입 근거가 컨슈머 쪽에서 재현되고 있었다)이 이번 diff 로 해소됨
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:552` (`toTerminalErrorPayload(errorRaw) ?? {...}`)
  - 상세: 직접 Read 로 확인한 결과 종전의 3-way 손수 분기(`errorRaw as typeof error` 무검증 캐스트 포함)가
    제거되고 producer(엔진)와 같은 `toTerminalErrorPayload` 헬퍼를 그대로 재사용한다. 정규화 로직의 SoT 가
    이제 하나(`codebase/backend/src/shared/utils/terminal-error-payload.ts`)로 수렴했다 — 이 PR 이 스스로
    지목했던 결함 클래스가 실제로 닫혔다.

- **[INFO]** `execution.failed` case 블록에 조사 경위를 서술하는 주석이 실제 정규화 로직(3줄)보다 길다
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:537-546`, `559-566`
  - 상세: "존재한 적 없는 plan 이름을 가리키던 종전 주석" 을 대체하는 내력, "`INTERNAL_ERROR` 대신 `null`
    을 쓰는 이유" 를 설명하는 문단이 각각 9줄·7줄이며, 그 사이에 실제 대입 코드(`const error = ... ?? {...}`)는
    6줄뿐이다. 근거를 코드 옆에 남기는 것 자체는 이 저장소의 관례이고 무관한 잡담도 아니지만, 조사 경위
    ("`git log --diff-filter=A` 0건" 같은 진단 절차)까지 프로덕션 소스에 남기면 다음 사람이 실제 로직을
    찾기 위해 읽어야 하는 텍스트 양이 늘어난다. 차단 사유는 아니며 직전 두 라운드에서도 이미 INFO(scope/
    documentation)로 등재되고 조치 불요 처리된 항목이라 새 지적은 아니다 — maintainability 관점에서도 같은
    결론(가독성 경미 저하, 비차단)으로 재확인한다.
  - 제안: 조치 불요. 다음에 이 블록을 다시 건드릴 때 조사 경위 문단은 요약 1~2줄로 줄이고 전문은
    `plan/in-progress/eia-terminal-payload.md` 재판정 절로만 남기는 것을 고려.

- **[INFO]** string-or-object 추출 관용구(`typeof x === "string" ? x : x?.message`)가 한 파일에서 3번째로 반복
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:268` (`handleExecutionFailed`, 이번 diff 신규),
    기존 `handleNodeFailed:863`, `handleNodeCancelled:970` (직접 grep 으로 3곳 확인, 이번 diff 밖)
  - 상세: 세 곳 모두 로컬 타입 선언(필드 목록)은 조금씩 다르지만 핵심 3줄 로직은 동일하다. 커밋 주석이
    "같은 파일 `node.failed` 핸들러가 이미 쓰는 관용구로 통일한다"고 명시해 의도적 일관성 유지임을 밝히고
    있어 스타일 이탈은 아니다. 다만 3번째 반복 시점에서 공용 헬퍼로 뽑지 않은 것은 DRY 관점에서 경미한
    잔여 부채다.
  - 제안: 시급하지 않음. 네 번째 반복이 생기기 전에 `extractErrorMessage(error: string | { message?: string } | null | undefined): string | undefined` 같은 작은 헬퍼로 추출 검토.

- **[INFO]** `toTerminalErrorPayload` 의 스칼라 방어 범위(`number`/`boolean`/`bigint`)가 실제 DB 호출부가
  낼 수 있는 값의 종류보다 넓다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:58-65`
  - 상세: 4개 emit 지점이 `Execution.error`(jsonb)에 쓰는 값은 `{message}`/`{code, message}` 객체 또는
    레거시 문자열뿐이다. `bigint`·`symbol` 분기는 파일 자신의 주석(`:66`)이 이미 "여기 도달하지 않는다"고
    인정한다. `no-base-to-string` lint 대응으로 분기가 나뉜 것이고 나눈 뒤 테스트(`terminal-error-payload.spec.ts`)
    까지 붙여 뒀으므로 결함은 아니다. 직전 두 라운드(`22_55_51`/`23_17_57` scope.md)에서 이미 동일 내용으로
    지적·조치불요 처리된 항목의 재확인이다.
  - 제안: 조치 불요.

## 요약

핵심 변경은 `execution.failed` 의 `error` 를 문자열에서 EIA §6.4 객체로 통일하며 신설한
`toTerminalErrorPayload` 헬퍼(짧고 단일 책임, 분기 근거가 JSDoc/주석에 잘 남음)를 엔진 3곳·retry-turn
1곳의 producer 와 chat-channel dispatcher 1곳의 consumer 가 전부 공유하도록 정리한 것이다. 직전 라운드가
찾은 maintainability WARNING("정규화를 컨슈머가 손으로 재구현하고 무검증 캐스팅까지 있었다")이 이번 diff
로 실제로 해소됐음을 코드 레벨에서 재확인했고, 새로 발견된 WARNING/CRITICAL 급 항목은 없다. 함수 길이·
중첩 깊이·매직 넘버·네이밍 컨벤션 모두 양호하며, `stalledError`/`stalledError.code` 재사용처럼 "DB 와
emit 이 손으로 반복되며 갈리던" 기존 결함 유형을 구조적으로 막는 리팩터가 함께 이뤄졌다. 남는 관찰은
전부 INFO 수준(프로덕션 코드 내 조사 경위 주석의 장문화, 프런트 3중 반복 관용구, 헬퍼의 다소 넓은 방어
범위)이며 모두 직전 라운드에서 이미 검토·조치불요로 판정된 항목의 재확인이라 이번 라운드에서 새로 차단할
사유는 없다.

## 위험도
LOW
