# 문서화(Documentation) Review

대상 diff: `origin/main..b8689ec41` (18 파일 — CHANGELOG.md, session-store.ts, use-token-refresh.ts,
use-widget.ts, use-widget-eager-start.test.ts, 신규 plan `webchat-auth-session-status-reconcile.md`,
`review/code/2026/08/10/16_09_40/**`(전 라운드 산출물 11건), `spec/7-channel-web-chat/3-auth-session.md`).

직전 라운드(`16_09_40`)의 documentation WARNING 3건(테스트 JSDoc 이 미머지 PR 상태를 현재형으로 서술 ·
`seedWaitingFromStatus` 함수 계약 stale · CHANGELOG 관례 미이행) 반영 여부와, 저장소 전체 × "미구현"·
"Planned"·"후속 결정"·"partial" 용어 축으로 동일 클래스 재발 여부를 확인했다.

## 발견사항

- **[WARNING]** 리뷰 합의 인원수를 "3명"으로 오기 — 근거 문서(`SUMMARY.md`/`RESOLUTION.md`)는 "4명"이라고 명시한다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:396`, `CHANGELOG.md:173`
  - 상세: 이번 diff 가 새로 쓴 두 문서가 같은 CRITICAL 을 두고 서로 다른 숫자를 적는다.
    - `use-widget.ts:396`: "(ai-review `16_09_40` CRITICAL — **3명** 독립 수렴)."
    - `CHANGELOG.md:173`: "**리뷰 3명**이 독립 수렴해 잡았고, ..."
    - 그러나 같은 diff 에 함께 새로 커밋되는 `review/code/2026/08/10/16_09_40/SUMMARY.md:18`
      은 해당 CRITICAL 을 `security · side_effect · requirement · testing (**4명** 독립 수렴)`
      로 4명을 명시해 나열하고, `RESOLUTION.md:5`("## 1. 내가 만든 CRITICAL — **4명**이 독립
      수렴했다")도 같은 4명을 재확인한다. `testing.md` 를 직접 대조해도 root-cause 코드 라인까지
      명시하며 독립적으로 결함을 짚어(단순 "테스트가 안 잡았다"가 아니라 근본 원인 코드까지
      지목) 4명 집계가 맞다.
    - `use-widget.ts:628`(같은 파일, `openStream` 호출부 주석)와 test 파일의 대응 주석
      (`use-widget-eager-start.test.ts:95`)은 "security·side_effect 독립 수렴"으로 **두 명만
      구체 지명**하고 총원을 주장하지 않아 문제 없다 — 오직 총원을 숫자로 못박은 두 곳(위)만
      근거 문서와 어긋난다.
  - 제안: `use-widget.ts:396`, `CHANGELOG.md:173` 의 "3명"을 "4명"으로 정정.

- **[WARNING]** `seedWaitingFromStatus`/`SeedOutcome` JSDoc — 이번 diff 가 새 단락(REST 오류 분기 3종)을
  추가했지만, 그 새 단락과 정면으로 배치되는 기존 서술 3곳은 그대로 남아 자기모순적인 문서가 됐다
  (직전 라운드 WARNING #2 의 **부분 반영**)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:369-370`(함수 요약),
    `:380-381`(실패 정책 한 줄 요약), `:401-404`(`@returns` 의 `"ended"` 설명),
    타입 `SeedOutcome` 의 `"ended"` 유니언 멤버 독스트링(`:85`, 이번 diff 밖 — 기존 코드).
  - 상세: 새로 삽입된 `389-399`행("REST 오류 분기 ... 세 갈래를 상태코드로 가른다: `404`→`"ended"`,
    `401`→낙관적 refresh, 재차 `401`→`"ended"`, 그 외→soft-fail")은 정확하고 새 코드와 일치한다.
    그런데 바로 그 위·아래에 있는 세 문장은 이번 diff 로 손대지 않아 여전히 옛 뜻(성공 응답의
    status 값만으로 두 갈래) 그대로다.
    - `:369-370` — "`getStatus` REST 응답으로 현재 `waiting_for_input` 표면을 시드하거나,
      스냅샷이 이미 terminal 이면 세션을 정리하고 `ENDED` 로 전이한다": 예외(`catch`) 경로에서도
      이제 `ENDED` 로 갈 수 있다는 사실이 요약에 없다.
    - `:380-381` — "**실패 정책**: soft-fail — HTTP 오류·네트워크 실패 시 `console.warn` 후
      진행": 새 `404`/`401` 분기는 `console.warn` 을 거치지 않고 `finalizeEnded`/`refreshToken`
      을 수행하므로 이 한 줄만 보면 오독한다. 8줄 뒤(`389-399`)에 정확한 예외가 있지만, 이 요약
      줄 자체는 갱신되지 않아 두 서술이 나란히 충돌한다.
    - `:401-404`(`@returns`) — "`"ended"`(스냅샷이 terminal → 종료 확정)": `"ended"` 는 이제
      (a) 스냅샷 terminal, (b) `404` catch, (c) 재차 `401` catch 세 경로에서 반환되는데,
      `@returns` 는 바로 세 줄 위 새 단락이 설명한 (b)/(c)를 반영하지 않은 채 (a)만 남겼다.
    - 타입 `SeedOutcome` 의 `"ended"` 유니언 멤버 독스트링(`/** 스냅샷이 terminal →
      \`finalizeEnded\` 로 종료 확정함. */`, `:85`)도 같은 이유로 stale — 이번 diff 가 건드리지
      않은 위치라 함수 JSDoc 보다도 더 눈에 안 띄게 남았다.
  - 근거: 직전 라운드 `documentation.md` WARNING #2 가 정확히 이 세 지점(369-370/380-381/
    389-392 구 라인 번호, `SeedOutcome` 84-86행)을 "이 diff 로 stale" 이라고 지목했고, 제안도
    "함수 JSDoc 에 한 문단 추가 + `"ended"` 유니언 멤버 독스트링과 `@returns` 설명을 갱신"
    이었다. 이번 반영은 "한 문단 추가"만 했고 뒤의 "`"ended"` 유니언 멤버 독스트링과 `@returns`
    설명 갱신"은 하지 않았다. `RESOLUTION.md:53`/`SUMMARY.md:31` 는 이 항목을 "**반영** — 세
    갈래 + 호출부 계약 명시"로 완료 처리했지만, 실제로는 새 단락 삽입에 그쳐 원래 지적의 절반만
    닫혔다.
  - 제안: `:369-370` 요약에 "REST 오류(404/401)로도 `ENDED` 로 갈 수 있다" 한 구 추가,
    `:380-381` 을 "그 외 오류는 여전히 soft-fail"로 한정, `:401-404` 의 `"ended"` 설명과
    `SeedOutcome` 타입의 `"ended"` 유니언 독스트링을 "스냅샷 terminal **또는** 404/재차-401
    확정"으로 갱신.

## 저장소 전체 × 용어 축 재검사 ("미구현"·"Planned"·"후속 결정"·"partial")

- `spec/7-channel-web-chat/**`, `codebase/channel-web-chat/**`, `plan/in-progress/webchat*`,
  `CHANGELOG.md` 범위를 다시 훑었다. 이번 diff 가 손댄 §3.1 배너·plan·CHANGELOG 는 모두 사실과
  일치하고("도 구현됐다(2026-08-10)"), 잔존하는 "partial"/"pending_plans" 언급은 전부
  `webchat-auth-session-status-reconcile.md` 와 `3-auth-session.md` 신규 note 안에서 **PR #1130
  이 아직 진행 중이라는 사실을 정확히 현재형으로 서술**한 것이지, 이미 끝난 일을 미완으로 잘못
  적은 사례가 아니다(`spec-impl-evidence.md §3` `pending_plans` 승격 가드 규칙과도 대조해 plan
  본문의 기술적 설명이 정확함을 확인).
- 새로 스캔한 범위 밖(`spec/2-navigation/**` 등)에도 "미구현 (Planned)" 표기가 다수 있으나, 전부
  이번 diff 와 무관한 기존·별개 기능의 정당한 로드맵 마커이거나(예: 조직 레벨 Integration 공유,
  알림 기본 설정) 이미 스스로 drift 를 기록/정정한 Rationale(예: `4-security.md:212-215` 의
  "EIA rate-limit 값·구현 상태는 복제하지 않는다(결정 2026-07-11)")이라 이 리뷰의 재발 클래스에
  해당하지 않는다.
- 결론: 직전 3건의 WARNING 은 실질적으로 반영됐고, "미구현/Planned/후속 결정" 축의 **새로운**
  거짓 진술은 이 diff 안에 없다. 다만 그 수정 과정 자체가 위 두 건(리뷰 인원수 오기, JSDoc 부분
  갱신)의 **새로운** 문서 정확성 결함을 만들었다 — 같은 "고치다가 인접 서술을 안 맞춘다"는
  근본 패턴의 변주다.

## 양호한 부분

- `applyRefreshedToken`(`session-store.ts:110-133`) 신규 JSDoc은 왜 오케스트레이션은 안 합쳤고
  무엇만 뽑았는지, 실패 동작이 왜 정반대라 옵션 파라미터로 합치면 안 되는지를 정확히 근거와 함께
  설명하고, "세대 검사는 호출부 책임"이라는 계약도 실제 호출부(`use-widget.ts`, `use-token-refresh.ts`)
  구현과 일치한다.
- CHANGELOG 신규 항목(`CHANGELOG.md:166-173`)은 선행 항목(예: 192행 "버퍼 만료 재동기화")과 동일한
  포맷·서술 밀도를 따르고, 내용도 코드·spec 과 일치한다(숫자 오기 1곳 제외).
- `spec/7-channel-web-chat/3-auth-session.md:66-70` 은 §3.1 배너 정정에 더해 "frontmatter 재판정
  대기" note 를 spec 본문에 신설해, 직전 라운드 INFO(#4, "PR 간 frontmatter 소유권 조율이 커밋
  메시지에만 있고 spec 어디에도 없음")까지 함께 해소했다 — 요청받지 않은 항목까지 반영.
- 신규 테스트 4건의 선행 JSDoc(`use-widget-eager-start.test.ts:255-267`)은 직전 WARNING #1이
  지적한 "frontmatter 가 partial 이었다"는 거짓 서술을 "frontmatter 는 `implemented` 였는데
  본문만 미구현을 자인했다"는 실제 이력으로 정확히 정정했다.

## 요약

직전 라운드 documentation WARNING 3건(테스트 JSDoc 의 frontmatter 이력 오기, 함수 계약 stale,
CHANGELOG 누락)은 실질적으로 반영됐고, 저장소 전체를 "미구현/Planned/후속 결정/partial" 축으로
재훑어도 이 기능 영역에 새로 남은 거짓 진술은 없다. 다만 그 수정 자체가 두 개의 새 결함을 남겼다:
(1) `use-widget.ts`/`CHANGELOG.md` 가 리뷰 합의 인원수를 "3명"으로 적었는데, 같은 diff 로 함께
커밋되는 `SUMMARY.md`/`RESOLUTION.md` 는 "4명"이라고 명시해 서로 모순된다. (2) `seedWaitingFromStatus`
JSDoc 은 새 단락(REST 오류 분기 설명)만 추가됐을 뿐, 그 단락과 배치되는 기존 요약·`실패 정책`·
`@returns` 문장, 그리고 `SeedOutcome` 타입의 `"ended"` 유니언 독스트링은 갱신되지 않아 같은 함수
JSDoc 안에 서로 다른 두 설명이 공존한다 — 직전 WARNING 의 절반만 닫힌 상태다. 둘 다 기능에는
영향이 없는 문서 정확성 문제다.

## 위험도

LOW
