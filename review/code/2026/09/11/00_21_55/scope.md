# 변경 범위(Scope) 리뷰 — `impl-chat-channel-patch-token` (3라운드, `00_21_55`)

## 검토 방법

`origin/main...HEAD` 전체 diff(67개 파일, `4a8b5f456`~`83d5f3f94` 5개 커밋)를 대상으로 했다.
이전 두 라운드(`review/code/2026/09/10/23_21_57/scope.md`, `review/code/2026/09/10/23_55_23/scope.md`)가
이미 핵심 코드 6개 파일(DTO·서비스·컨트롤러·e2e)의 스코프를 상세 검증해 NONE/LOW 로 수렴했으므로,
이번 라운드는 (a) 그 결론이 최신 소스에서도 유지되는지 표본 재확인하고 (b) 두 라운드 **이후** 실제로
추가된 델타(마지막 커밋 `83d5f3f94` — W2/W3/W4/W5 조치 + `d4339ee82` RESOLUTION 오탈자 정정)에
스코프 이탈이 있는지에 집중했다. `git show <hash> --stat`/`-- <path>` 로 커밋 단위 diff 를 직접
열었고, 저장소 트리에 대한 뮤테이션은 하지 않았다(`git status --short` 확인, 잔여물 없음).

## 발견사항

- **[INFO]** 실질 문구 수정에 섞여 들어간 이중 공백 오탈자 (해당 diff 가 만든 것)
  - 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx:429`
  - 상세: 이번 PR 2라운드 fix 커밋(`83d5f3f94`, W2 조치)이 `botTokenRef` → `botToken` 필드명·
    `details.field` 형식을 바로잡으면서 "토큰 변경은 **항상 rotate API 만**" 문구를
    "토큰 변경은 **항상  rotate API 만**" 으로 바꿨다 — "항상"과 "rotate" 사이에 공백이
    한 칸에서 두 칸으로 늘었다(원본 `origin/main` 대조로 확인, `sed 's/ /_/g'` 치환 재현:
    `항상__rotate`). 같은 커밋이 고친 나머지 세 파일(`triggers.en.mdx:418`,
    `telegram.en.mdx:106`, `telegram.mdx:119`)에는 이 이중 공백이 없다 — 이 한 줄만의
    타이핑 실수다. 렌더링에는 영향 없을 가능성이 높지만(MDX/HTML 공백 축약), 실질 내용
    수정과 무의미한 공백 변화가 한 줄에 섞인 사례라 "포맷팅 변경" 관점에서 기록한다.
  - 제안: 공백 한 칸 제거. 사소하며 이 라운드를 막을 사유는 아니다.

## 스코프 밖 변경 없음 확인 (3라운드 델타)

- **`83d5f3f94`(2라운드 리뷰 조치) 5개 코드/문서 파일**은 전부 직전 라운드 SUMMARY 의 WARNING
  2~5 항목(측정 범위 과잉 일반화 W3 · 사용자 문서 오기 W2 · `mode` 판별자 타입 결속 W4 ·
  `null`/`''` 4조합 누락 W5)에 1:1 대응한다 — 각 변경에 커밋 본문·인접 주석이 "어느 WARNING
  때문인가"를 명시하고 있어 임의 추가로 볼 근거가 없다.
    - `trigger-dto-validation.spec.ts`: 신규 `it()` 1개(값 형태 분리) + docstring 보강만.
    - `triggers.controller.ts`: `@ApiBadRequestResponse` 설명 확장 한 곳뿐.
    - `triggers.service.spec.ts`: 기존 `it`/`it.each` 2개를 4-조합 `it.each` 1개로 재구성 —
      새 동작 코드가 아니라 테스트 커버리지 재배치.
    - `triggers.service.ts`: `assertChatChannelInputSafe` 앞에 오버로드 시그니처 2개 추가 —
      본문 로직 변경 없이 컴파일 타임 타입 결속만 얹었다(W4 그대로).
    - `*.mdx` 4개: `botTokenRef`→`botToken` 필드명·`details.field` 형식 정정뿐, 다른 절 미접촉.
  - `d4339ee82`(RESOLUTION 오탈자 정정)은 `review/code/2026/09/10/23_21_57/RESOLUTION.md` 한
    파일만 건드리며, 커밋 해시·테스트 수치를 실측값으로 고치는 자기 정정이다 — 코드 스코프와
    무관.
- **import 변경**: 이번 델타에서 새 import 는 없다(오버로드는 기존 `ChatChannelConfigDto`/
  `ChatChannelUpdateConfigDto` 타입만 재사용).
- **설정 파일**: `package.json`/`tsconfig*`/`eslint.config.mjs` 등 0건(3라운드 델타 포함 전체
  67개 파일 어디에도 없음, `git diff origin/main...HEAD --stat` 로 재확인).
- **spec/ 미접촉**: 이번 델타를 포함한 전체 diff 에 `spec/**` 파일 0건 — developer 가 spec
  정정 필요 항목(§5.4.1 `details.field` placeholder 의 "두 갈래" 실측, `store()`/`rotate()`
  용어 drift)을 코드로 우회하지 않고 `plan/in-progress/spec-draft-nullable-notation-followups.md`
  에 planner 인계 항목으로만 남긴 것을 재확인했다(경계 유지).
- **리뷰/일관성 산출물 커밋**: `review/code/2026/09/10/23_55_23/**`·
  `review/consistency/2026/09/10/23_54_09/**` 를 코드 수정과 같은 커밋(`83d5f3f94`)에 묶은 것은
  CLAUDE.md 저장소 관례("일관성/코드 리뷰 산출물 → 지정 경로에 커밋")와 이전 라운드
  (`RESOLUTION.md` 패턴)가 이미 일관되게 해 온 방식이라 스코프 위반이 아니다.

## 요약

핵심 구현(파일 1~7)은 이전 두 스코프 리뷰가 이미 D-1/D-2/D-3 세 항목에 좁게 대응함을 확인했고,
이번 3라운드가 대상으로 하는 델타(`83d5f3f94`+`d4339ee82`)도 직전 리뷰 라운드의 WARNING 5건에
정확히 1:1 대응하는 최소 수정이다 — 새 기능·무관한 리팩토링·설정 변경·미사용 import 는 없다.
유일한 발견은 문서 수정 한 줄에 섞여 들어간 이중 공백 오탈자(`triggers.mdx:429`)로, 실질 변경과
무의미한 공백 변화가 뒤섞인 사소한 사례이며 차단 사유는 아니다.

## 위험도

NONE
