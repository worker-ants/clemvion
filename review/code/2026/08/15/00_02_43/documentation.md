# 문서화(Documentation) Review — `execution.failed` error 객체화 (누적 diff, `00_02_43`)

## 리뷰 범위에 대한 메모

이 changeset(`origin/main` → HEAD)은 이전 4개 ai-review 라운드(`22_55_51` CRITICAL 1/
WARNING 10, `23_17_57` CRITICAL 0/WARNING 6, `23_34_12` CRITICAL 0/WARNING 3, `23_49_41`
CRITICAL 0/WARNING 4)와 2개 consistency-check 라운드(`22_29_16`, `23_18_06`)가 낸 fix 가
전부 누적 반영된 상태다. 그 라운드들이 이미 문서화 관점 발견사항(CHANGELOG 누락, JSDoc
스코프 과장, spec §6 필드표/§6.4 blockquote 자기모순 — 5곳, 소스/스펙 JSDoc 죽은 참조
불일치, plan 체크리스트가 커밋보다 늦는 문제 4회 재발)을 전부 조치 완료로 표시해 뒀으므로,
이번 라운드는 그 주장들을 **직접 파일을 읽고 grep 해 재검증**하는 데 집중했다 — RESOLUTION.md
의 서술을 그대로 받아들이지 않았다.

## 발견사항

- **[INFO]** (직접 재검증 완료) 이전 라운드들이 지적한 문서화 결함이 실제로 전부 해소돼 있음을
  확인
  - 위치/방법:
    - `spec-update-execution-failed-payload-shape` (`git grep`): 살아있는 참조는
      `chat-channel.dispatcher.ts:542`(그 이름이 존재한 적 없었다는 것을 설명하는 문장 자체)와
      `plan/in-progress/backend-lint-gate-broken-on-main.md:774-776`(같은 사실을 기록한 과거
      조사 로그)뿐 — 둘 다 "죽은 참조였다"를 서술하는 문맥이라 재발이 아니다.
    - `INTERNAL_ERROR`(`git grep` -- `codebase/backend/src/modules/chat-channel`): 남은 2건 모두
      "종전엔 이걸 지어냈다"를 설명하는 주석이고, 실제 `error.code` 값으로 쓰는 코드 경로는
      0건.
    - `spec/5-system/14-external-interaction-api.md:572`(§6 필드표)·`:792-797`(§6.4
      blockquote)·`spec/conventions/chat-channel-adapter.md:161-163` 세 곳을 직접 Read —
      셋 다 "`failed` 는 전 경로 object, 레거시 흡수 분기만 의도적 유지"로 같은 결론을 말한다.
      `23_17_57`/`23_18_06` 라운드가 지목한 자기모순(표는 object, 본문은 아직 string)이
      실제로 해소돼 있다.
    - `plan/in-progress/eia-terminal-payload.md:171-177`("이번 PR" 범위 체크리스트 3항목)을
      직접 Read — `[x]`로 갱신돼 있다(`23_49_41` documentation WARNING이 지적한 "체크리스트가
      커밋보다 늦다"의 4번째 재발이 실제로 fix됨).
    - `plan/in-progress/spec-sync-external-interaction-api-gaps.md:20`을 직접 grep — `error`
      객체화 항목이 `[x]`로 flip돼 있다.
  - 상세: 문서 SoT(spec)·주석·CHANGELOG·plan 체크리스트 네 층위가 실측상 서로 어긋나지 않는다.
    새로 등급을 올릴 근거를 찾지 못했다.

- **[INFO]** (이월, 조치 불요로 3라운드 연속 기결정됨 — 재확인만 함) `chat-channel.dispatcher.ts`
  의 `execution.failed` 케이스 주석 마지막 문장이 실제 대입값(`null`)이 아니라 classifier의
  내부 표현(`''`)을 "코드가 없었다"의 근거로 인용한다
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:565-566`
    (`... \`code: ""\` 는 "코드가 없었다" 를 정직하게 말한다.` — 실제 대입은 `:552-558`에서
    `code: null`)
  - 상세: `execution-failure-classifier.ts:105`의 `event.error?.code ?? ''`를 직접 확인 —
    바로 위 줄(`:563`)이 이미 "`null`(→ `code ?? ''`)"이라고 변환을 정확히 짚어 두고 있어
    실무 혼선 위험은 낮다. `22_55_51`/`23_17_57`/`23_49_41` documentation 리뷰가 이미 같은
    자리에서 INFO로 지적했고 조치 불요로 처분됐다 — 등급을 올릴 새 근거는 없어 그대로
    유지한다.
  - 제안: 조치 불요(기결정 유지). 이 블록을 다시 건드릴 기회가 있으면 마지막 문장을
    "`code: null`(→ classifier가 `code ?? ''`로 읽어 빈 문자열과 동일 취급)"처럼 대입값
    표기로 통일하면 재지적을 막을 수 있다.

- **[INFO]** (positive finding) 신규 헬퍼 `terminal-error-payload.ts`의 JSDoc과
  `terminal-error-payload.spec.ts` 상단 독스트링이 실제 구현·테스트와 정확히 일치
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:1-35`,
    `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts:1-9`
  - 상세: SoT 상대경로 링크(`../../../../../spec/5-system/2-api-convention.md`)와 앵커
    (`#종결-이벤트의-필드-집합-normative`)를 파일시스템 경로/헤딩 대조로 확인했고 정확히
    해석된다. "`execution.cancelled`는 아직 커버하지 않는다"는 스코프 제한 문장도
    `emitCancellationEvent` 실제 코드(diff 밖, 직접 확인)와 일치해 "문서한 보장이 구현보다
    넓다"는 이 저장소 반복 결함 패턴을 피했다. 스칼라 분기(`number`/`boolean`/`bigint`) 도달
    가능성에 대한 자기고백 주석(`:66-67`, "symbol·function 은 여기 도달하지 않는다")도 이전
    라운드 scope 리뷰가 지적한 "DB 실경로보다 넓은 방어" 관찰과 모순 없이 정합한다.
  - 제안: 없음(참고용 긍정 기록).

## 요약

핵심 코드 변경(신규 `toTerminalErrorPayload` 헬퍼 + 엔진/retry-turn 4개 emit 지점 통일 +
chat-channel dispatcher/타입 정리 + 프런트엔드 `use-execution-events.ts` 동반 수정)에 대한
독스트링·JSDoc·CHANGELOG·인라인 주석·spec 문서는 4라운드에 걸친 반복 리뷰로 이미 높은
수준까지 정리돼 있고, 이번 라운드에서 `git grep`/`Read`로 독립 재검증한 결과 이전에 지적된
spec 자기모순(§6 표 vs §6.4 blockquote, 5곳)·죽은 plan 참조·plan 체크리스트 지연(4회
재발분)은 모두 실제로 해소돼 있다. CHANGELOG는 URL 버전 세그먼트가 없는 이 저장소에서
breaking change의 유일한 통지 경로 역할을 정확히 수행한다(수신자 영향·부재 표현 규칙·
`INTERNAL_ERROR` 제거 이유·프런트 동반 갱신까지 열거). 새로 발견된 CRITICAL/WARNING급
문서화 결함은 없다. 유일하게 남는 것은 `chat-channel.dispatcher.ts:565-566`의 `code: ""`
표기가 실제 대입값(`null`)과 어휘가 다른 미세한 표현 이슈인데, 이미 3라운드 연속 조치
불요로 판정됐고 바로 위 줄이 정확한 변환을 짚고 있어 이번 라운드에서도 등급을 올릴 근거를
찾지 못했다.

## 위험도

LOW
