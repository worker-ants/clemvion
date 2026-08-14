# 문서화(Documentation) 리뷰 — `execution.failed` error 객체화 (RESOLUTION 라운드, `23_17_57`)

## 리뷰 범위에 대한 메모

이번 diff 는 직전 ai-review(`22_55_51`, CRITICAL 1 / WARNING 10)의 fix 커밋
(`6aa0699b8` → `5776126bd`)이다. 그중 문서화 관점 WARNING 2건(CHANGELOG 누락,
`toTerminalErrorPayload` JSDoc 스코프 과장)은 실제로 잘 해소됐음을 코드로 확인했다.
다만 그 fix 가 건드린 **바로 그 spec 파일 안에서, 몇 줄 아래에 있는 자매 문장은 갱신에서
빠졌다** — 아래 CRITICAL/WARNING 참조. `review/code/2026/08/14/22_55_51/**`,
`review/consistency/2026/08/14/22_29_16/**` 는 이미 커밋된 과거 리뷰 산출물이라 문서화
품질 판단 대상에서 제외했다(자동 생성 리포트).

## 발견사항

- **[WARNING]** spec §6.4 예시 바로 아래 캐비엇이 같은 커밋이 §6 필드표에서 막 해소한
  "일부 경로는 string" 캐비엇을 그대로 반복하고 있다 — 같은 파일 안에서 표는 고쳤는데
  본문 blockquote 는 안 고쳤다.
  - 위치: `spec/5-system/14-external-interaction-api.md:792` (§6.4, `> **error 는 현행
    일부 경로에서 string 이다** — 위 객체 형태가 목표이고, 수신자는 당분간 양쪽을
    방어해야 한다. 필드 집합 표의 error 행 참조.`)
  - 상세: 이 diff 는 같은 파일 §6 필드표의 `error` 행(:572, 프롬프트 상 diff 게이트로는
    변경 후 라인 572)을 "구현됨 — 형태 불일치"에서 "구현됨"으로, 캐비엇을 "**현행 일부
    경로는 string** 을 넣는다"에서 "`failed` 는 **전 경로 object** 다 … 종전의 '일부
    경로는 string' 캐비엇 **해소**"로 명시적으로 정정했다. 그런데 바로 같은 hunk 범위
    밖, §6.4 JSON 예시 직후(diff 가 손댄 `code: null` blockquote 바로 다음 문단)에
    "`error` 는 현행 일부 경로에서 string 이다 … 필드 집합 표의 `error` 행 참조" 라는
    **거의 동일한 취지의 캐비엇이 그대로 남아 있다.** 이 문장은 정확히 방금 표에서
    "해소"라고 선언한 바로 그 사실을 반대로 말하고, 심지어 "필드 집합 표의 `error` 행
    참조"라고 스스로를 그 표로 되돌려 보내는데 그 표는 이미 반대 내용을 담고 있다 —
    같은 spec 파일이 2문단 거리에서 자기모순을 일으킨다. `git diff origin/main..HEAD --
    spec/5-system/14-external-interaction-api.md` 로 실측: 이 커밋의 diff hunk 는
    `@@ -779,9 +779,10 @@` 에서 끝나고(마지막 컨텍스트 줄이 `[chat-channel
    CCH-ERR-04]` 인용), 문제의 `:792` 문장은 그 hunk 범위 밖이라 아예 건드려지지 않았다.
    이 spec 은 `terminal-error-payload.ts` JSDoc 의 SoT 로 직접 인용되는 문서라(§6.4),
    다음에 이 파일을 읽는 사람(특히 외부 API 통합자)이 §6.4 예시 바로 아래 이 문장을
    보고 "여전히 string 을 방어해야 한다"고 오판할 위험이 표 정정보다 오히려 크다 —
    예시 코드 블록에 훨씬 가깝게 붙어 있기 때문이다.
  - 제안: `:792` 문장을 표와 같은 방향으로 정정하거나(예: "`failed` 는 이제 전 경로
    object 다 — 필드 집합 표 참조"), 표와 중복이라 판단되면 이 blockquote 자체를 제거.
    cancelled 경로는 아직 손으로 만들고 있으므로 그쪽 캐비엇(§6.5 또는 이 문단)은
    남기되 `failed`/`cancelled` 를 명확히 구분해서 서술할 것.

- **[INFO]** `chat-channel.dispatcher.ts` 의 `code: null` 관련 신규 주석이 "대입하는
  값"과 "다운스트림 표현"을 같은 표기(`code: ""`)로 섞어 쓰는 문제가 직전 라운드에서
  이미 INFO 로 지적됐는데(`22_55_51` documentation.md), 이번 fix 커밋에서 그 문장이
  그대로 남아 있다 — CRITICAL/WARNING 해소에 집중하느라 INFO 는 넘어간 것으로 보이며
  차단 사유는 아니다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:562-563`
    (`… \`code: "INTERNAL_ERROR"\` 는 … \`code: ""\` 는 "코드가 없었다" 를 정직하게
    말한다.` — 정작 같은 블록의 실제 대입(:552, :554)은 `code: null`)
  - 상세: 바로 위 줄(:560)에서 이미 "`null`(→ `code ?? ''`)" 이라고 다운스트림 변환을
    정확히 짚어 놓고, 마지막 문장에서 다시 `code: ""` 로 되돌아가 쓴다. 내용 자체는
    틀리지 않지만(실제 대입은 `null`, classifier 가 `code ?? ''` 로 읽어 빈 문자열과
    동일 취급) 처음 읽는 사람은 "이 함수가 `code: ""` 를 대입한다"로 오독할 수 있다.
  - 제안: (선택) 마지막 문장을 "`code: null`(→ classifier 가 `code ?? ''` 로 읽어 빈
    문자열과 동일하게 처리)은 …" 처럼 대입값과 다운스트림 값을 명시적으로 구분.

- **[INFO]** (긍정 확인) 직전 라운드 WARNING 2건이 실제로 잘 해소됐다.
  - `CHANGELOG.md` — `## Unreleased —` 절 신설(4곳 정확히 열거, breaking change 명시,
    `'INTERNAL_ERROR'` → `null` 전환·DB/wire 문구 불일치 해소·프런트 동반 갱신까지 포함).
    기존 관례(스택형 `## Unreleased —` 다건)와 형식이 일치한다.
  - `terminal-error-payload.ts` JSDoc — "현재 호출부는 `EXECUTION_FAILED` 4곳뿐이다.
    `execution.cancelled` 는 아직 손으로 만든다"는 caveat 을 명시해 스코프 과장을
    바로잡았고, plan 문서(`eia-terminal-payload.md` 재판정 ③-c)를 정확히 인용한다
    (해당 절 실존 확인). SoT 상대경로 링크(`../../../../../spec/5-system/2-api-
    convention.md`)도 실제 파일로 정확히 해석됨을 확인했다.

## 요약

CHANGELOG 신설과 `toTerminalErrorPayload` JSDoc 스코프 정정은 직전 라운드 WARNING 을
정확히 겨냥해 잘 해소됐고, plan 문서(`eia-terminal-payload.md`) 체크리스트도 실제
진행 상태(consistency 미실행, 교차 plan 미동기화가 `[ ]`로 남음)와 정직하게 일치한다.
다만 spec 파일 자체 안에서 새로 발견된 자기모순 1건이 남아 있다 — §6 필드표의 `error`
행은 "일부 경로는 string" 캐비엇을 이번 커밋으로 명시적으로 "해소"라 선언했는데, 불과
20여 줄 뒤 §6.4 JSON 예시 바로 아래 blockquote 는 정확히 그 반대("현행 일부 경로에서
string")를 여전히 말하고 있다. 같은 커밋의 같은 파일 안에서 표는 고치고 인접 본문은
놓친 형태라 다음 독자(특히 예시 코드에 더 가까운 이 문단을 먼저 읽을 외부 통합자)를
오도할 수 있다. 그 외에는 dispatcher 주석의 사소한 표기 혼용(INFO, 이전 라운드부터
이월) 정도이며 기능적 문제는 없다.

## 위험도

MEDIUM
