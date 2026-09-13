# 테스트(Testing) 코드 리뷰

## 사전 검증

- `npx vitest run guide-identifier-existence.test.ts guide-sanitized-message-parity.test.ts` 직접 실행 —
  **2 files / 46 tests 전부 PASS** (실측, 608ms).
- `grep -rn "guide-error-code" codebase/ spec/ PROJECT.md CHANGELOG.md` — 잔여 참조 4건 전부
  **역사 서술**(과거 파일명을 각주·본문으로 인용)이고 실제 import·경로 참조는 0건. 자매 파일
  `guide-sanitized-message-parity.test.ts:16` 의 크로스레퍼런스도 새 이름 + 옛 이름 병기로
  이미 갱신되어 있음(직전 라운드 dependency reviewer INFO#1 처분 확인).
- 삭제 대상 `guide-error-code-existence.test.ts` / `guide-error-code-scan.ts` 는 워킹트리에
  실재하지 않음(디렉터리 조회로 확인) — 리네임이 완결됨.

## 발견사항

이 변경분은 이미 `/ai-review` 7라운드에 걸쳐 뮤테이션 실측(생존/사망 표, 판별 fixture 선정
경위, 두 방향(과매치·미탐지) 분리)까지 마친 상태다. 각 정규식 경계·축마다 대조군이 있고,
가드를 등재시킨 과거 결함(`MCP_INSECURE_URL_ALLOWED`)을 합성 재현으로 고정했으며, 라운드 7
CRITICAL(혼합 백틱 스팬 미탐지)도 6종 이름 고정 회귀로 닫혀 있다. 그 결과 표준적인 지적
대부분이 이미 선점되어 있다. 남은 것은 전부 INFO 수준의 잔여 갭이다.

- **[INFO]** `readIfPresent` 의 "파일 부재" 분기가 어느 테스트에서도 실행되지 않는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` 함수 `readIfPresent` (파일 상단, `describe` 밖)
  - 상세: `fs.existsSync(abs) ? [...] : []` 의 `false` 분기는 오늘 `.env.example` 두 파일이
    항상 존재해서 한 번도 관측되지 않는다. 얕은 clone 이나 `.env.example` 이 `.gitignore` 로
    빠지는 배포 환경에서 이 분기가 처음 실행되는데, 그때 조용히 `[]` 를 반환해
    `envTokens` 가 위축되고 "env 선언처 수집기가 살아 있다" 테스트의 `envOnly.length >
    5`(실측 21종) 같은 vacuity floor 가 **그 시점에** RED 로 알려주는 구조이긴 하다. 다만
    그 RED 가 "파일이 없다" 때문인지 "수집기가 깨졌다" 때문인지 메시지로 구분이 안 된다.
  - 제안: 우선순위는 낮음(파일 존재가 저장소 불변식). 필요하면 `readIfPresent` 자체에
    "부재 시 빈 배열" 합성 단위 테스트 한 줄을 추가해 원인 구분을 앞당길 수 있다.

- **[INFO]** `CODE_FIELD` 축의 대조군이 **따옴표 값**만 겨눈다 — 값이 따옴표 없는 형태는 미검증
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 의 `CODE_FIELD`
    정의(`(?<!\\w)"?code"?\\s*:\\s*"(${UPPER_SNAKE})"`) 및 대응 테스트 describe `"scanIdentifierCitations — 축별 대조군"`
    안의 축 2 테스트들(`guide-identifier-existence.test.ts`)
  - 상세: 정규식은 값 쪽에 `"..."` 를 강제한다. 오늘 코퍼스(에러 응답 JSON 예시)가 전부
    따옴표 값이라 baseline-0 은 참이지만, 값이 따옴표 없이 적힌 형태(``code: MADE_UP_CODE``,
    TS 리터럴 예시 등)에 대한 대조군이 없다 — 그런 형태가 생기면 `code-field` 축은 놓치고
    `backtick` 축이 백틱으로 감싸져 있을 때만 대신 잡는다(백틱 없이 적히면 완전히 미탐지).
    라운드 5~7 이 이미 문서화한 "기준집합 vs 인용집합 방향" 논리에 따르면 이 방향은
    거짓 PASS 쪽이다.
  - 제안: 조치 불요에 가까움(코퍼스에 없는 형태) — 다음에 이 축을 만질 때 "값에 따옴표가
    없는 경우" 를 [한계] 주석으로 명시하거나 대조군 한 줄을 추가하면 다음 사람이 재발견할
    필요가 없어진다.

- **[INFO]** `GUIDE_EXTERNAL_VOCABULARY` 의 "system/why 필드 검증" 테스트는 현재 원소 1개로만 실행된다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` — `"각 항목이 외부 시스템과 사유를 밝힌다"` 테스트
  - 상세: `for (const entry of GUIDE_EXTERNAL_VOCABULARY)` 는 배열이 자라면 자동으로 스케일되므로
    구조 자체는 문제 없다. 다만 지금은 원소가 하나뿐이라(`MESSAGE_CREATE`) 이 술어가
    "여러 항목에 대해 독립적으로 통과/실패한다" 는 것을 실제로 관측한 적이 없다 — 두 번째
    항목이 추가될 때 이 술어가 정말로 항목 단위로 개별 실패하는지(예: 하나는 통과, 하나는
    `why` 20자 미만으로 실패)는 합성 fixture 없이는 확인되지 않는다. 회귀 위험은 낮음(로직이
    단순한 `for`+`expect` 조합).
  - 제안: 조치 불요 — 우선순위 낮음. 두 번째 외부 어휘가 실제로 추가되는 시점에 자연히
    검증된다.

- **[INFO]** `lastIndex = 0` 리셋 보일러플레이트가 4곳에 손으로 복제되어 있고, 리셋 누락
  자체를 겨냥한 회귀 테스트는 없다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` — `scanIdentifierCitations`(2회) · `collectSourceTokens`(1회) · `BACKTICK_INNER` 사용부(1회)
  - 상세: 이미 라운드 5 plan(§E "나머지 처분")에서 maintainability WARNING#2 로 지적되고
    "공유 헬퍼로 옮기는 리팩터라 이번 배치 범위를 넘는다" 로 defer 된 항목이다(재-flag
    아님, 기존 결정 확인). 테스트 관점에서 보태자면: 오늘 스위트가 GREEN 인 것은 각 정규식이
    **한 번씩만 재사용**되는 오늘의 호출 패턴 덕분이지, `lastIndex` 리셋 로직 자체를 겨눈
    합성 대조군(예: 같은 정규식 객체를 두 번 연속 다른 입력에 돌려 두 번째 호출이 첫 호출의
    `lastIndex` 잔재로 인해 앞부분을 건너뛰는지)은 없다. 공유 헬퍼로 옮기지 않는 한 이
    갭은 남는다.
  - 제안: 조치 불요(이미 defer 결정됨) — 공유 헬퍼로 리팩터할 때 그 헬퍼에 한 번의
    "두 번째 호출도 처음부터 스캔한다" 테스트를 추가하면 4곳의 잠재 리스크가 한 번에
    닫힌다.

## 요약

`guide-identifier-existence.test.ts`/`guide-identifier-scan.ts` 는 이번 세션만이 아니라 7라운드
`/ai-review` 사이클을 거치며 사실상 뮤테이션 테스팅 모범 사례로 수렴한 상태다 — 정규식 경계마다
"두 판정이 갈리는" 판별 fixture, 과거 결함(`MCP_INSECURE_URL_ALLOWED`)의 3갈래 합성 재현,
허용목록 4강제 각각에 대한 독립 테스트, 그리고 라운드 7 CRITICAL(혼합 백틱 스팬 미탐지 6종)을
이름으로 고정한 회귀까지 갖춰져 있다. 직접 실행한 46개 테스트가 전부 GREEN 이고, 리네임 이후
잔여 참조도 자매 파일·CHANGELOG·PROJECT.md 3곳 모두 정합함을 grep 으로 재확인했다. 새로 지적할
만한 CRITICAL/WARNING 급 커버리지 갭은 찾지 못했다 — 남은 것은 `readIfPresent` 부재 분기,
`CODE_FIELD` 의 따옴표-없는 값 형태, 허용목록 검증의 단일-원소 실행, `lastIndex` 보일러플레이트
회귀 테스트 부재 등 전부 코퍼스에 아직 등장하지 않는 형태를 겨냥한 INFO 수준 잔여 갭이며, 그중
하나(`lastIndex` 리팩터)는 이미 라운드 5 에서 defer 로 처분된 항목의 재확인이다.

## 위험도

NONE
