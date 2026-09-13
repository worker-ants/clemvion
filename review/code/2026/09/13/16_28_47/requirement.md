# 요구사항(Requirement) 코드 리뷰

## 검증 방법

- 실제 diff 대상(`codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`,
  `guide-identifier-scan.ts`, `guide-sanitized-message-parity.test.ts`, `CHANGELOG.md`,
  `PROJECT.md`, `plan/in-progress/guide-identifier-existence.md`)를 `Read`로 직접 열어
  전문을 확인했다(프롬프트가 크기 제한으로 diff 를 생략한 파일들 포함).
- `npx vitest run src/lib/docs/__tests__/guide-identifier-existence.test.ts` 를 직접
  실행 — **31/31 PASS**.
- 정규식 경계 3곳(`CODE_FIELD`, `collectEnvDeclarations` compose 분기)을 저장소 밖
  scratch 스크립트(`/private/tmp/.../scratchpad/t.mjs`)로 겨눴다 — 저장소 파일은 전혀
  건드리지 않았고 `git status --short` 로 무변경 확인.
- `spec/conventions/user-guide-evidence.md`, `spec/conventions/error-codes.md` 를 Read.
- `plan/in-progress/guide-identifier-existence.md` 의 라운드 1~5 이력·체크리스트를 대조.

## 발견사항

- **[INFO]** `CODE_FIELD` 의 `(?<!\w)` 왼쪽 경계는 하이픈으로 끝나는 키(`x-code`,
  `status-code` 류)를 배제하지 못한다 — 실측으로 확인.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:135`
    (`const CODE_FIELD = new RegExp(...)`)
  - 상세: `{ "x-code": "WEIRD_CASE" }` 를 스캔하면 `code-field:WEIRD_CASE` 로 잡힌다
    (하이픈은 `\w` 가 아니므로 `(?<!\w)` 를 통과). 라운드 5 JSDoc(라인 121~134)이
    "6갈래 실측 대조표에서 불일치 2건 → 0건" 이라 적었지만 그 6갈래는 전부 밑줄
    변형(`error_code`/`http_code`)이었고 하이픈 변형은 포함되지 않았다. 다만 **기능적
    피해는 없다** — 이 오분류는 축 라벨(`code-field` vs `backtick`)만 바꿀 뿐, 실제
    판정은 어느 축이든 `basis.has(token)` 으로 동일하게 걸리므로 존재성 검증 자체는
    깨지지 않는다. 오늘 코퍼스에 `[a-z]-code"?\s*:` 형태의 키가 0건임을 grep 으로
    확인했다(비영향).
  - 제안: 조치 불요 수준이지만, 다음에 `CODE_FIELD` 경계를 다시 만질 때 이 형태도
    6갈래 표에 추가할 것.

- **[INFO]** `collectEnvDeclarations` 의 compose 정규식(`^\s+(UPPER_SNAKE):\s`)은
  YAML 매핑 스타일만 잡고 리스트 스타일(`environment:\n  - KEY=value`)은 못 잡는다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:235`
  - 상세: 저장소의 `docker-compose.yml`/`docker-compose.e2e.yml` 전체를 확인했고
    `environment:` 블록은 전부 매핑 스타일이라(리스트 스타일 0건) 오늘은 영향이
    없다. 게다가 이 함수 자체가 스캐너 JSDoc(라인 213~219)·테스트(라인 83~95)에
    "오늘 판정을 지탱하지 않는다"고 이미 명시·뮤테이션으로 증명돼 있어, 이 갭은
    현재 안전망 바깥의 안전망 바깥이다.
  - 제안: 조치 불요 — 다음에 compose 가 리스트 스타일 env 를 쓰게 되면 그때 보강.

- **[SPEC-DRIFT]** `spec/conventions/user-guide-evidence.md §2` 가 "Build-time 가드
  (3건)" 이라고 명시하는데, 표에 나열된 세 가드(`impl-anchor-existence`,
  `integrations-coverage`, `triggers-coverage`)는 이번 PR 이 다루는
  `guide-identifier-existence`/`guide-sanitized-message-parity` 가드 가족을 포함하지
  않는다 — 즉 그 문서가 자칭하는 "이 가드 가족의 SoT" 목록이 실제 가드 인벤토리보다
  좁다.
  - 위치: `spec/conventions/user-guide-evidence.md:155` (`1. **build-time 가드 3건**
    (§2) — CI 차단 *(구현됨)*`)
  - 상세: 이 불일치는 코드 결함이 아니라 spec 갱신 누락이다 — `#1330` 부터 존재해
    온 선재 갭이며, `plan/in-progress/guide-identifier-existence.md:11,137,142,191`
    이 이미 developer 권한 밖(`spec/` 쓰기는 `project-planner` 소관)이라고 명시하고
    planner 백로그로 등재했다고 기록한다(plan 문서 자체가 "통산 8회 확인" 이라고
    적음 — 이번이 새 발견이 아니라 기존 등재분의 9번째 독립 확인에 해당). 판단
    방향: spec 이 낡았고 코드(가드 확장)는 의도적·합리적 — 되돌릴 대상이 아니다.
  - 제안: 코드 변경 없음. `project-planner` 턴에서 `user-guide-evidence.md §2` 표에
    `guide-identifier-existence.test.ts`·`guide-sanitized-message-parity.test.ts`
    행을 추가하고 "가드 3건" 표제를 실제 건수로 갱신.

## 요약

`guide-identifier-existence` 가드(+ `guide-identifier-scan.ts`)는 트래커 항목("가이드가
적는 식별자가 실재하는지 세는 가드가 없다")이 요구한 두 축(에러 코드 + 환경변수)을 모두
구현했고, 그 항목의 등재 근거였던 과거 결함(`#1328` 의 `MCP_INSECURE_URL_ALLOWED` 오기)을
합성 재현 테스트 3갈래로 직접 겨눠 통과시킨다. `#1330`의 문맥-게이팅 축이 그 결함을
놓쳤을 것이라는 사실까지 회귀 테스트로 고정해 "왜 이 가드가 넓어졌는가"가 코드에서
스스로 증명된다. 허용목록(`GUIDE_EXTERNAL_VOCABULARY`)은 은폐 수단화를 막는 4가지
제약(외부 시스템 의무·상한·인용 여부·기준집합 비포함)을 테스트로 강제하고, vacuity
floor·축별 존재 단언·명명 회귀(구체 파일·토큰 고정)까지 갖춰 "총량만 봐도 통과" 형태의
공허한 테스트가 아니다. 정규식 경계는 5라운드에 걸쳐 6개 형태의 뮤테이션으로 검증됐고
(이번 라운드에서 실행한 31/31 PASS 로 재확인), 남은 것은 극히 드문 케이스(하이픈 키
오분류, compose 리스트 스타일 미지원)뿐이며 둘 다 오늘의 판정에 영향이 없다.
`spec/conventions/user-guide-evidence.md §2` 의 가드 인벤토리 문구가 낡아 있는 것은
사실이나 이는 이미 planner 백로그에 등재된 선재 갭(developer 권한 밖)이라 이번 PR 의
결함으로 볼 수 없다. 삭제된 파일(`guide-error-code-existence.test.ts` 등)에 대한
잔여 참조도 없음을 grep 으로 확인했다(자매 파일의 크로스레퍼런스는 이미 갱신됨).
기능 완전성·엣지 케이스·에러 시나리오·반환값·비즈니스 로직 관점에서 CRITICAL/WARNING 급
결함은 발견되지 않았다.

## 위험도

LOW
