# 문서화(Documentation) Review — `execution.failed` error 객체화 (4차 라운드, `23_49_41`)

## 리뷰 범위에 대한 메모

이 changeset(`origin/main` `589914d6d` → HEAD)은 이전 3개 ai-review 라운드
(`22_55_51` CRITICAL 1/WARNING 10, `23_17_57` CRITICAL 0/WARNING 6, `23_34_12`
CRITICAL 0/WARNING 3)의 fix 가 전부 누적 반영된 최종 상태다. 세 라운드 모두 문서화
관점 발견사항(CHANGELOG 누락, JSDoc 스코프 과장, spec §6 표/§6.4 blockquote 자기모순,
소스/스펙 JSDoc 죽은 참조 불일치)을 조치했고, `git diff` 로 직접 재확인한 결과
전부 실제로 해소돼 있다 — 아래 "긍정 확인" 참조. 이번 라운드는 (a) 그 재확인과
(b) 세 라운드 모두 다루지 않은 **plan 문서 자체의 신규 체크리스트 불일치**를 찾는 데
집중했다.

## 발견사항

- **[WARNING]** `plan/in-progress/eia-terminal-payload.md` 의 "이번 PR" 범위 체크리스트가
  구현 완료 후에도 미체크로 남아 있다 — 이 PR 이 세 번 반복 지적하고 "고쳤다"고 선언한
  바로 그 결함 클래스(체크리스트가 커밋보다 늦다)의 **네 번째 사례**다.
  - 위치: `plan/in-progress/eia-terminal-payload.md:173`, `:175`, `:177` (`## 범위` →
    `### 이번 PR` 절의 `- [ ] \`error\` 객체 형태`, `- [ ] **\`null\` 정규화**`,
    `- [ ] **동반 필수**` 세 항목)
  - 상세: 같은 파일 하단 `## 체크리스트` 절(:217~239)은 `--impl-prep` 재실행·구현+테스트·
    `/ai-review` 1~3차·`/consistency-check --impl-done`·자매 plan 갱신까지 전부 `[x]`로
    표시돼 있고, 바로 그 자리에 "체크리스트가 커밋 메시지보다 늦는 것이 이 plan 에서만
    세 번째다(`22_55_51` W11 · `23_18_06` W2 · `23_34_12` W2)... 커밋 직전에 체크박스를
    함께 스테이징하는 것이 유일한 해법이었고, 이번엔 그렇게 했다"라고 명시적으로 적혀
    있다. 그런데 같은 파일 앞부분의 **다른** 체크리스트(`### 이번 PR` — `error` 객체
    형태·`null` 정규화·동반 필수 3항목, `:173/175/177`)는 여전히 `- [ ]`다. 이 세 항목은
    "이번 PR"이 실제로 완료해 커밋(`6aa0699b8`/`5776126bd`/`66baf81f0`/`843a36ac7`)까지
    된 작업 그 자체이며, `## 체크리스트`가 인용하는 성과("`error` 객체화 4곳 ·
    `toTerminalErrorPayload` 15 tests · chat-channel 동반 3건")와 1:1로 대응한다.
    즉 한 문서 안에 "선언 시점"(이번 PR 범위 표)과 "완료 표시 시점"(하단 체크리스트)이
    또 어긋난 것이고, 이번엔 **본문에 이미 그 실수를 세 번 겪었다는 회고문까지 붙어 있는
    상태에서** 네 번째로 재발했다. `plan/complete/HANDOFF-eia-terminal-payload.md`(같은
    커밋 세트에서 `in-progress` → `complete` 로 이동됨)가 이 작업을 "완료"로 취급하는
    것과도 어긋나 신뢰도를 떨어뜨린다.
  - 제안: `:173`/`:175`/`:177` 세 체크박스를 `[x]`로 갱신. 근본 원인이 이미 문서화돼
    있으므로(같은 파일 `:234~237`), 다음에 이 plan 을 다시 여는 사람은 "체크박스 = 실제
    상태" 원칙에 따라 **본문 안의 모든 체크리스트 절**(범위 선언용 vs 완료 추적용)을
    같이 스캔해야 한다는 점을 그 회고문에 한 줄 추가하는 것도 재발 방지에 도움이 된다.

- **[INFO]** (이월, 조치 불요로 기결정됨) `chat-channel.dispatcher.ts` 신규 주석의
  마지막 문장이 실제 대입값(`null`)이 아니라 다운스트림 표현(`""`)을 "코드가 없었다"의
  근거로 다시 인용한다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:565-566`
    (`... \`code: ""\` 는 "코드가 없었다" 를 정직하게 말한다.` — 바로 위 `:552-558`의
    실제 대입은 `code: null`)
  - 상세: 직접 파일을 읽어 재확인 — 이 문장은 `22_55_51`/`23_17_57` documentation 리뷰가
    이미 같은 자리에서 INFO 로 지적했고, `23_34_12` RESOLUTION 의 "INFO 넘김" 표(#7·9·10
    "기결정")에서 조치 불요로 처분된 항목이 여전히 그대로 남아 있는 상태다. 새 지적이
    아니라 재확인이며, 바로 위 줄(`:563`)이 이미 "`null`(→ `code ?? ''`)"이라고 변환을
    정확히 짚어 두고 있어 실무 혼선 위험은 낮다. 팀이 이미 두 라운드에 걸쳐 비차단으로
    판단했으므로 이번 라운드에서 등급을 올릴 근거는 없다.
  - 제안: 조치 불요(기결정 유지). 다음에 이 블록을 다시 건드릴 기회가 있으면 마지막
    문장을 "`code: null`(→ classifier 가 `code ?? ''` 로 읽어 빈 문자열과 동일 취급)"
    처럼 대입값 표기로 통일.

- **[INFO]** (긍정 확인) 세 라운드에 걸쳐 지적된 문서화 결함이 모두 실제로 해소돼 있음을
  `git diff`/`Read` 로 직접 재검증했다.
  - `CHANGELOG.md` — `## Unreleased —` 절 신설, breaking change 명시, 4개 emit 지점·
    `'INTERNAL_ERROR'` → `null` 전환·프런트 동반 갱신까지 정확히 열거(`:3-23`).
  - `spec/5-system/14-external-interaction-api.md` — §6 필드 표(`:572`)와 §6.4 blockquote
    (`:792-797`)가 `23_17_57` 라운드에서 지적된 자기모순("표는 object, 본문은 아직
    string")을 해소하고 서로 같은 방향("failed 는 전 경로 object, 레거시 흡수 분기는
    의도적 유지")을 말하는 것을 diff 로 직접 확인.
  - `spec/conventions/chat-channel-adapter.md:158-163` — `| string` 유니온이 남은 이유를
    "구현 지연"에서 "레거시 재생 이벤트 흡수"로 정확히 갱신.
  - `chat-channel.dispatcher.spec.ts` describe JSDoc(`:267-278`) — 형제 `.ts` 파일에서
    걷어낸 것과 같은 죽은 참조(존재한 적 없는 plan 이름·stale 줄 번호)를 `23_34_12` 라운드
    지적대로 갱신, 테스트 타이틀(`code=null`)도 실제 단언과 일치.
  - `terminal-error-payload.ts` JSDoc의 SoT 상대경로 링크(`../../../../../spec/5-system/
    2-api-convention.md`)와 앵커(`#종결-이벤트의-필드-집합-normative`,
    `#64-페이로드--executionfailed`)를 직접 파일시스템 경로/헤딩 대조로 재검증 — 둘 다
    정확히 해석된다.
  - `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — `error` 객체화 항목이
    `[x]`로 flip 됐고 "wrap 을 절반만 제거했다(의도적)"는 근거가 명시돼 있으며, 신규
    HMAC/마스킹 백로그 항목도 "왜 이 PR 에서 안 고쳤나"를 각각 서술해 스코프 규율이
    유지되고 있다.

## 요약

핵심 코드 변경(신규 `toTerminalErrorPayload` 헬퍼 + 4개 emit 지점 통일 + chat-channel/
프런트엔드 소비자 동반 수정)에 대한 독스트링·JSDoc·CHANGELOG·인라인 주석은 세 라운드의
반복 리뷰를 거치며 이미 높은 수준으로 정리돼 있고, 이번 라운드에서 직접 재검증한 결과
이전에 지적된 spec 자기모순·죽은 참조·CHANGELOG 누락은 모두 실제로 해소됐다. 다만 이번
라운드에서 새로 찾은 것은 코드가 아니라 **plan 문서 자신의 체크리스트 불일치**다 —
`eia-terminal-payload.md` 는 "체크리스트가 커밋보다 늦는 것이 세 번째"라고 스스로 반성문을
적어 놓고도, 같은 파일의 다른 절("이번 PR" 범위 선언 체크박스 3개)에서 정확히 같은 실수를
네 번째로 반복하고 있다. 기능적 위험은 없지만(이미 구현·머지·리뷰된 작업의 상태 표기
문제), 다음에 이 plan 을 참조하는 사람이 "이번 PR" 항목이 미완료라고 오판할 수 있어
WARNING 으로 등재한다. 그 외 남은 것은 이미 두 차례 조치 불요로 처분된 INFO 1건의
재확인뿐이다.

## 위험도

LOW
