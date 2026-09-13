# 변경 범위(Scope) 리뷰 — error-code-emission-axis (라운드 8, `22_06_10`)

## 검토 방법

`git log origin/main..HEAD` 로 이 PR 이 8개 커밋(`65256a109` feat + 7회 `fix(guards)` 라운드)
누적임을 확인했다. 라운드 1~7 의 `scope.md`(전부 확인 가능, 전부 위험도 **NONE**)가 매 라운드
"실질 변경은 소수 파일에 국한, 나머지는 `review/**` 세션 산출물" 이라는 동일 결론에 도달해
왔으므로, 이번 라운드는 **직전 스코프 리뷰(`21_41_23/scope.md`) 이후 새로 들어온 것**, 즉
최신 커밋 `53d29a6f4`("라운드 7 — 내 뮤턴트가 «분기 하나» 를 덜 겨눴다 + 내 코드가 없는 것을
SoT 로 가리켰다")의 diff 를 `git show 53d29a6f4` 로 직접 열어 재확인하는 데 집중했다. 이
커밋의 실질 코드/문서/plan 변경은 5개 파일이다:

- `PROJECT.md`(+1/-1)
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`(+28/-1, 신규
  `describe("resolveSourceLines — 유일성 가드")`)
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(헤더 주석만, +8/-1)
- `plan/in-progress/error-code-emission-axis.md`(§K 신규 절 + 체크리스트/표 갱신)
- `plan/in-progress/spec-draft-nullable-notation-followups.md`(줄 번호 정정 2곳 + 역참조 단락
  1개)

나머지 20개 파일(`review/code/2026/09/13/21_41_23/**`, `review/consistency/2026/09/13/21_41_25/**`)
은 이 커밋이 스스로 포함한 직전 라운드의 `/ai-review`·`--impl-done` 세션 산출물이다. 각
변경분을 `Read`/`grep -n` 으로 저장소 원본과 대조했다(게이트 숫자에 의존하지 않고 소스 파일을
직접 열었다 — 이 파일들은 프롬프트에서 diff 가 생략돼 있었다).

## 발견사항

- **[WARNING]** `guide-identifier-scan.ts` 헤더 주석 수정이 **옛 문장의 꼬리를 지우지 않고
  남겼다** — 이제 아무 문장에도 붙지 않는 독립된 잔해 줄이 됐다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:11`
    (`Read`/`grep -n "코드 명명·은퇴 이력"` 로 직접 확인 — 파일에 이 문자열은 이 한 줄뿐)
  - 상세: 이 커밋의 diff 는 옛 1문장짜리 헤더(`SoT: A (가드 가족) · B (코드 명명·은퇴 이력) ·
    C (카탈로그).`)의 **첫 줄만** 8줄짜리 새 설명(SoT 정정 + `#1330`·미등재 사유)으로
    치환했다. 그런데 원문 두 번째 줄 `// (코드 명명·은퇴 이력) · spec/5-system/3-error-handling.md
    §1 (카탈로그).` 은 diff 에서 건드리지 않고 그대로 남았다. 그 결과 지금 파일에서 11번째
    줄은 — 앞 문단이 이미 마침표로 끝나는 완결된 설명이라 — **어떤 문장의 일부도 아닌 채로
    붕 뜬 조각**이 됐고, `spec/5-system/3-error-handling.md §1 (카탈로그)` 를 4번째 줄과
    **중복 인용**한다(4번째 줄 새 문장도 같은 절을 이미 인용한다). 문법적으로도 이 조각은
    "(코드 명명·은퇴 이력) · …" 로 시작해 앞에 붙을 명사구가 없다.
  - 이 클래스는 이 프로젝트가 이미 반복 관측해 이름 붙인 결함이다 — 이번 브랜치 자체의
    RESOLUTION 이력에도 "orphan JSDoc" 표류(라운드 4)가 등재돼 있고, MEMORY 에도 "파서 주석
    3번·세부코드 위치 3번·orphan JSDoc 3번" 으로 기록된 패턴이다. 이번엔 JSDoc 이 아니라
    파일 최상단 SoT 주석에서 같은 형태(블록을 교체할 때 «자리» 만 보고 «꼬리에 남는 것» 을
    안 봄)로 재발했다.
  - 이 결함은 커밋이 의도한 변경 범위 밖의 새 기능이나 무관한 파일을 건드린 것은 아니지만,
    "주석 변경" 관점(점검 관점 6)에서 **의도한 편집이 불완전하게 적용돼 불필요한 잔여 텍스트를
    남긴 경우**에 해당해 스코프 리뷰 대상으로 보고한다 — 다음 커밋이 이 조각을 진짜 정보로
    오인해 인용하거나, 반대로 "왜 카탈로그가 두 번 나오나" 를 조사하는 시간 낭비로 이어질 수
    있다.
  - 제안: 11번째 줄(`// (코드 명명·은퇴 이력) · spec/5-system/3-error-handling.md §1
    (카탈로그).`)을 삭제한다. 기능·테스트 영향 없음(순수 주석).

- **[INFO]** `guide-identifier-existence.test.ts` 의 신규 `describe("resolveSourceLines —
  유일성 가드")` 블록이 **기존 함수의 로직 변경 없이 순수 테스트 추가**임을 확인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:88-102`
    (`resolveSourceLines` 정의, `found.length === 1` 분기는 라운드 6 도입분으로 이번 커밋에서
    불변) / `:562-583`(신규 describe 3개 `it`)
  - 상세: 커밋 메시지가 주장하는 "라운드 6 이 넣은 유일성 가드에 판별 fixture 가 없었다" 를
    직접 대조 — `resolveSourceLines` 함수 자체(`sourceLinesCache`·`walkTree`·`found.length
    === 1` 삼항) 는 이번 diff 에 등장하지 않고, 추가된 것은 0건/2건 이상/1건 세 분기를 겨눈
    `it()` 세 개뿐이다. `grep -rn resolveSourceLines`로 재확인한 결과 정의는 이 파일 한 곳,
    비-export 로컬 함수라 다른 소비자 영향도 없다. plan §K("같은 함수를 뮤테이션했는데 다른
    분기를 봤다") 항목과 1:1 대응.
  - 제안: 조치 불필요.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 변경이 이 배치가
  직접 반증·등재한 두 지점(줄 번호 오기 정정, 역참조 추가)에 정확히 국한됨을 확인
  - 위치: `:3446`·`:3475`(`execution-engine.service.ts:8016` → `:8017` 정정, 실측:
    `sed -n '8010,8020p' codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    로 직접 대조 — 8016 은 `nodeExec.status = NodeExecutionStatus.FAILED;`, 8017 이
    `nodeExec.error = { message };` 로 정정 값이 정확하다) / `:3494-3501`(카탈로그 탈출구
    조건부 폐기에 대한 양방향 역참조 단락 신규 삽입)
  - 상세: 이 문서의 다른 4,000줄 이상은 diff 에 나타나지 않는다. 삽입된 역참조 단락도 바로
    위/아래의 기존 항목(§1.4 "앵커 없는 코드" 처분 항목)과 내용상 직접 연결되며, 무관한
    다른 트래커 항목을 재작성하지 않았다.
  - 제안: 조치 불필요.

- **[INFO]** `plan/in-progress/error-code-emission-axis.md` 의 §K 신규 절 + 체크리스트/표
  갱신이 이번 라운드(라운드 7 처분)를 기록하는 것에 국한됨을 확인 — 기존 §A~§J 절은 diff 에
  나타나지 않는다.

- **[INFO]** `review/code/2026/09/13/21_41_23/**`(10개) · `review/consistency/2026/09/13/21_41_25/**`(7개)
  포함 — CLAUDE.md 가 의무화한 `/ai-review`·`--impl-done` 세션 산출물이며, 라운드 1~7 이 이미
  같은 판정(정상 워크플로 산출물, 스코프 이탈 아님)을 반복 확인했다. 이번 라운드 자신의
  산출물(`review/code/2026/09/13/22_06_10/**`, `review/consistency/2026/09/13/22_06_21/**`)은
  아직 커밋되지 않은 untracked 상태이므로 이번 diff 범위 밖이다(`git status --short` 로 확인).

- `PROJECT.md` 변경(1줄 치환)은 `guide-identifier-scan.ts` 헤더 주석과 같은 내용(SoT 정정)을
  표 설명문에 반영한 것으로, 표의 다른 행이나 다른 서술은 건드리지 않았다. 위 WARNING 과
  달리 이 줄은 완결된 문장으로 끝나 잔여 텍스트 문제가 없다.

## 요약

라운드 8 이 새로 검토해야 할 실질 diff 는 최신 커밋(`53d29a6f4`) 하나이며, 그 안의 5개
실질 파일 변경은 전부 plan(§K)이 기록한 라운드 7 처분 항목(테스트 분기 보강·SoT 인용 정정·
줄 번호 오기 정정·plan 역참조)과 1:1로 대응한다. 요청 범위를 벗어난 리팩토링, 기능 확장,
무관한 파일 수정은 발견되지 않았다. 다만 `guide-identifier-scan.ts` 헤더 주석 정정이 옛 문장의
꼬리 한 줄(11번째 줄)을 지우지 않고 남겨, 지금은 어떤 문장에도 붙지 않는 중복·잔해 주석이
됐다 — 기능에는 영향이 없지만 이 프로젝트가 반복 관측해 온 "블록 교체 시 꼬리 미삭제" 결함
클래스의 재발이라 WARNING 으로 보고한다. 그 외 20개 `review/**` 신규 파일은 이 PR 자신의
직전 라운드 리뷰 산출물로, 정상적인 워크플로 부산물이다.

## 위험도
LOW
