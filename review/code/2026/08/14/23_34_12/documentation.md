# 문서화(Documentation) Review — `execution.failed` error 객체화 (`23_34_12`, 누적 diff `origin/main..HEAD` = `11ba5bdbf`~`66baf81f0`)

## 리뷰 범위에 대한 메모

이 세션의 diff 는 앞선 두 ai-review 라운드(`22_55_51`, `23_17_57`)의 fix 커밋들을 포함한
**누적 diff** 다. 두 라운드가 이미 지적한 문서화 WARNING(§6.4 blockquote 자기모순 등)이
최종 상태에서 실제로 해소됐는지, 그리고 그 fix 커밋들 자체가 새 문서화 결함을 남기지
않았는지를 최종 소스를 직접 열어(`Read`/`grep`) 재검증했다. `review/**` 산출물(파일
13~62)은 이 프로젝트 컨벤션이 요구하는 프로세스 산출물이라 문서 품질 판단 대상에서
제외했다.

## 발견사항

- **[WARNING]** plan 체크리스트가 같은 커밋이 스스로 보고한 완료 상태를 반영하지 않는다
  — "plan 체크박스 = 실제 상태" 원칙 위반이 이 브랜치에서 재발했다.
  - 위치: `plan/in-progress/eia-terminal-payload.md:229` (직접 Read 로 확인한 실제 줄 번호 —
    이 파일의 diff 는 프롬프트 크기 제한으로 생략되어 게이트 번호가 없었다)
  - 상세: HEAD 커밋(`66baf81f0`, 이번 diff 의 최종 커밋)의 커밋 메시지는 "ai-review `23_17_57`
    CRITICAL 0 / WARNING 6 · consistency `--impl-done` `23_18_06` **BLOCK: NO**" 라고 명시하고,
    실제로 `review/consistency/2026/08/14/23_18_06/SUMMARY.md:3` 에도 "**BLOCK: NO** — Critical
    발견 없음" 이 기록돼 있다. 그런데 바로 그 커밋이 함께 수정한
    `plan/in-progress/eia-terminal-payload.md` 의 체크리스트에는:
    - `:229` `- [ ] \`/consistency-check --impl-done\`` — **여전히 미체크**. 같은 커밋이
      바로 그 `--impl-done` 을 실행해 BLOCK: NO 를 받았는데도 체크박스는 갱신되지 않았다.
    - 두 번째 `/ai-review` 라운드(`23_17_57`, CRITICAL 0 / WARNING 6)와 그 RESOLUTION —
      바로 이 fix 커밋 자신 — 을 가리키는 체크리스트 항목이 **아예 없다**. `228`행의
      `- [x] \`/ai-review\` \`22_55_51\`` 만 있고, 두 번째 라운드는 커밋 메시지에만 남아
      plan 문서에는 흔적이 없다.
    이 프로젝트는 과거 이력에서 "plan 체크박스는 실제 상태를 반영해야 한다"(수행 후에만
    체크)와 "완료 선언이 절반만 집행됐다" 류의 결함을 반복적으로 등재해 왔고, 바로 이
    브랜치의 `HANDOFF-eia-terminal-payload.md`(파일 13, 별도 주제)도 같은 계열의 staleness 를
    다루고 있다 — 그런데 정작 이 plan 자체가 그 원칙을 이번 마지막 커밋에서 어겼다. 이
    브랜치가 이전에 한 번 중단·재개된 이력(`HANDOFF-eia-terminal-payload.md`)이 있는 점을
    감안하면, 다음에 이 작업이 다시 중단/재개될 경우 체크리스트만 보고 "`--impl-done` 미실행"
    으로 오판해 불필요하게 재실행하거나, 두 번째 ai-review 라운드가 있었다는 사실 자체를
    놓칠 위험이 있다.
  - 제안: `:229` 를 `- [x]` 로 바꾸고 `23_18_06` **BLOCK: NO** 를 기록. 두 번째
    `/ai-review 23_17_57`(CRITICAL 0/WARNING 6, RESOLUTION `66baf81f0`) 항목을 체크리스트에
    추가해 실제 게이트 이력과 문서를 일치시킬 것 — 후속 커밋이 있다면(push 전 최종 정리 등)
    그 시점에 함께 반영.

- **[INFO]** (긍정 확인) 이전 라운드가 지적한 spec 자기모순이 최종 상태에서 실제로 해소됐다
  - 위치: `spec/5-system/14-external-interaction-api.md:572`(§6 필드 표), `:792-793`(§6.4
    blockquote), `spec/conventions/chat-channel-adapter.md:161`
  - 상세: `23_17_57` documentation/requirement 리뷰가 "표(`:572`)는 '전 경로 object' 로
    고쳤는데 §6.4 blockquote(`:792-793`)는 '현행 일부 경로에서 string' 으로 남아 같은 문서
    안에서 자기모순" 이라고 지적했다. 최종 커밋(`66baf81f0`)의 diff 를 직접 확인한 결과,
    두 곳 모두 이제 "`failed` 의 `error` 는 이제 전 경로 object 다 … 종전의 '일부 경로는
    string' 캐비엇은 해소됐다" 로 정합하게 갱신돼 있고, 배포 경계 레거시 재생 이벤트에 대한
    설명도 함께 추가됐다. 같은 라운드가 체커보다 더 찾아낸 `chat-channel-adapter.md:161`
    ("`| string` 을 안고 있는 이유는 **다르다**")도 동일하게 정합한 상태로 확인했다. 전수
    grep(`일부 경로`)으로 재확인한 결과 spec/conventions 쪽에는 stale 잔재가 없다(남은
    매치는 전부 plan 문서의 과거 인용 서술이며, 그중 하나는 스스로 "정정" 각주를 달고 있다 —
    아래 항목).

- **[INFO]** `terminal-error-payload.ts` 의 JSDoc 이 실제 코드와 정확히 일치함을 직접 대조로
  재확인했다 — 새 결함 없음
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:1-35`
  - 상세: (a) "`execution.cancelled` (`emitCancellationEvent` + 호출 5곳)은 아직
    `{code, message}` 를 손으로 만들고 `nodeId`/`details` 가 없다" — `execution-engine.service.ts`
    에서 `emitCancellationEvent` 호출부를 grep 하면 정확히 5곳(1056/1169/2807/2844/4792)이고,
    시그니처는 `error?: { code: string; message: string }` 로 JSDoc 의 서술과 일치한다.
    (b) SoT 상대경로 링크 `../../../../../spec/5-system/2-api-convention.md` 를
    `codebase/backend/src/shared/utils/` 기준으로 실제 해석해 파일 존재를 확인했다.
    긍정 확인 사항으로만 기록.

- **[INFO]** (경미, 이미 triage 됨) dispatcher 주석의 대입값/다운스트림 값 표기 혼용이
  최종 상태에도 남아 있다
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:559-565`
  - 상세: `22_55_51`/`23_17_57` 라운드가 이미 지적했고(`code: null` 대입 vs 다운스트림
    `code ?? ''` vs 문장 끝의 `code: ""` 표기 혼용), `23_17_57` RESOLUTION 의 "INFO 넘김 #19"
    가 "대입값과 다운스트림 표현이 실제로 다르다 — 주석이 그 차이를 말하는 중이라 유지" 로
    명시적으로 판단해 손대지 않기로 한 항목이다. 최종 소스(`:559-565`)에서도 그대로 남아
    있음을 확인했다 — 팀이 이미 검토하고 유지하기로 결정한 사안이므로 새 지적이 아니라
    현황 확인 차원에서만 기록한다. 차단 사유 아님.

- **[INFO]** (긍정 확인) CHANGELOG breaking-change 통지가 저장소 관례·정보 밀도 모두 적절
  - 위치: `CHANGELOG.md:1-23`
  - 상세: 이 저장소는 URL 버전 세그먼트를 쓰지 않아(관례상 `2-api-convention.md §1`) 기계적
    버전 신호가 없으므로 CHANGELOG 가 사실상 유일한 통지 경로다. 신설된 절이 "**수신자 영향
    (breaking)**" 문단으로 영향받는 표면(webhook·SSE·chat-channel)을 명시하고, 기존 관례인
    스택형 `## Unreleased —` 다건 구조와도 일치한다. 4개 emit 지점·`'INTERNAL_ERROR'` → `null`
    전환·DB/wire 문구 불일치 해소·프런트 동반 갱신까지 정확히 열거돼 실제 diff 와 대응한다.

## 요약

핵심 코드 변경(`terminal-error-payload.ts` 신규 헬퍼 승격, `execution-engine.service.ts`/
`retry-turn.service.ts` 4개 emit 지점 통일, `chat-channel.dispatcher.ts` 컨슈머 정규화 통일,
프런트엔드 `use-execution-events.ts` 동반 수정)에 대한 JSDoc·인라인 주석·CHANGELOG 는 실제
코드와 직접 대조한 결과 정확하고, 앞선 두 라운드가 지적했던 spec 내부 자기모순(§6 필드 표
vs §6.4 blockquote)도 최종 상태에서 실제로 해소됐음을 직접 확인했다. 새로 발견된 유일한
문제는 코드가 아니라 **plan 추적 문서 자체**다 — 마지막 fix 커밋(`66baf81f0`)이 커밋
메시지에서는 `--impl-done 23_18_06` **BLOCK: NO** 와 두 번째 `/ai-review 23_17_57` 라운드
완료를 명시하면서도, 같은 커밋이 수정한 `plan/in-progress/eia-terminal-payload.md` 체크리스트
에는 `/consistency-check --impl-done` 이 여전히 미체크로 남아 있고 두 번째 ai-review 라운드
항목 자체가 없다. 기능적 결함은 아니지만, 이 프로젝트가 반복적으로 경계해 온 "plan 체크박스
≠ 실제 상태" 패턴의 재발이며 향후 재개 시 오판 위험이 있어 WARNING 으로 등재한다.

## 위험도

LOW
