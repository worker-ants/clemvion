# 테스트(Testing) 리뷰

## 컨텍스트

리뷰 대상 파일은 `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` 1건이나, 이 변경은
같은 커밋 세트의 `plan-scan.ts`(신설, 순수 함수) · `plan-scan.test.ts`(신설, 합성 fixture) ·
`spec-links.ts`(`findBrokenPlanLinks` 3번째 진입점 추가) · `spec-links.test.ts`(신설 negative-path
스위트)와 한 몸이라, 판정 정확성을 위해 네 파일 모두 열어 대조했다(`git diff origin/main...HEAD`
기준). `pnpm vitest run` 으로 세 테스트 파일(plan-frontmatter/plan-scan/spec-links)을 직접 실행해
175개 테스트 전량 GREEN 을 확인했다.

이 변경은 "실저장소 대상 positive-only 검사는 위반 수집 분기를 한 번도 실행하지 않고도 영원히
초록일 수 있다"는, 이 저장소가 이미 `#1108`/`#1117`에서 두 번 실측으로 겪은 결함 패턴을 정면으로
겨냥해 설계됐다. 판정 로직을 `plan-scan.ts`/`spec-links.ts`의 순수 함수로 뽑아 `plan-scan.test.ts`/
`spec-links.test.ts`가 합성 임시 디렉터리(`fs.mkdtempSync`)로 negative-path(위반 발생·재귀·예외
경로·비-문자열 status 등)를 직접 증명하고, 실저장소 스위트(`plan-frontmatter.test.ts`)는 "위반
0건"이 정상 상태임을 확인하는 캐너리 역할만 맡는 구조로 책임을 분리했다. 이 구조 자체는 테스트
설계 관점에서 모범적이다.

## 발견사항

- **[WARNING]** "non-vacuity" 로 이름 붙인 캐너리가 실제로는 "링크를 봤다"가 아니라 "파일이
  존재한다"만 증명한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:161-165`
    (`it("the plan link scanner actually sees links (non-vacuity)", ...)`), 같은 성격의
    `:172-176` (`it("finds completed plans to validate", ...)`)
  - 상세: 두 테스트 모두 `collectLivePlanMarkdown(root).length` / `collectCompletePlanMarkdown(root).length`
    이 5보다 큰지만 단언한다. 이는 **파일 탐색(discovery) 단계**가 죽지 않았음만 증명하며, 그 뒤
    단계인 `extractLinks`(`spec-links.ts`)나 `matter()` 기반 `status` 파싱(`plan-scan.ts`)이 실제
    파일 내용을 열어 링크/필드를 추출했는지는 전혀 검증하지 않는다. 만약 `extractLinks` 의
    정규식이 항상 빈 배열을 반환하도록 깨진다면(`findBrokenLinksInFiles` 의 `for (const link of
    extractLinks(f.absPath))` 루프가 그냥 0회 순회), `findBrokenPlanLinks(root)` 는 실저장소에서
    여전히 `[]` 를 돌려주고, 이 "non-vacuity" 단언도 그대로 통과한다 — 코멘트가 명시적으로 경계하는
    바로 그 실패 모드(“스캐너가 조용히 빈 집합을 돌려주면… 영원히 초록”)를 이 단언 자체는 못 잡는다.
    실제로 `grep -rl '](.*\.md)' plan/in-progress` 로 확인한 결과 `plan/in-progress/*.md` 29개 파일이
    현재 마크다운 링크를 포함하므로 production 데이터 자체는 문제없지만, 이 특정 단언이 그 사실을
    검증하고 있지는 않다. 실제 탐지 로직(추출 자체)은 `spec-links.test.ts`/`plan-scan.test.ts` 의
    합성 fixture 가 이미 증명하므로 시스템 전체 위험은 낮지만, 이 캐너리의 "본다"는 이름/주석과
    실제 보증 범위 사이에 갭이 있다.
  - 제안: 파일 수 대신 "실제로 추출된 링크 수"(예: 발견된 plan 파일들에 대해 `extractLinks` 합계 >
    0, 또는 `spec-links.ts` 에서 스캔한 링크 총수를 노출)를 단언하도록 강화하거나, 최소한 주석에
    "이 단언은 discovery 단계만 증명하며 extraction 단계는 `spec-links.test.ts`/`plan-scan.test.ts`
    가 별도로 증명한다"고 범위를 명시해 향후 다른 개발자가 이 캐너리만으로 전체 파이프라인이
    살아있다고 오해하지 않게 한다.

- **[INFO]** `status` 값의 대소문자/공백 변형은 합성 fixture 로 커버되지 않음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` 의 `findNonTerminalCompletedPlans`
    (`TERMINAL_PLAN_STATUSES.has(status)` 비교), fixture 는
    `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts:26-55`
  - 상세: `plan-scan.test.ts` 는 null/number/array/"no"(YAML 1.1 불리언 함정) 등 비-문자열·미등재
    어휘 경로를 꼼꼼히 커버하지만, `status: Complete`(대문자)나 `status: " complete"`(공백 포함)
    같은 대소문자/공백 변형은 다루지 않는다. `TERMINAL_PLAN_STATUSES` 가 소문자 리터럴 Set 이므로
    현재 동작상 이런 값은 위반으로 잡히는데(아마 의도된 엄격함), 이 경계 동작이 테스트로 고정돼
    있지 않아 향후 누군가 "느슨하게 만들자"며 `.toLowerCase()` 를 추가해도 아무 테스트도 깨지지
    않는다.
  - 제안: 필수는 아니나, `status: Complete` 같은 fixture 한 줄을 추가해 대소문자 엄격성이 의도된
    동작임을 회귀로 고정하면 향후 드리프트를 막을 수 있다.

- **[INFO]** Gate C(`spec-plan-completion.test.ts`)의 `collectCompletePlans` 는 이번 통합에서 빠져
  독립 구현으로 남음 — 이미 추적됨, 조치 불요
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:59` (`function
    collectCompletePlans`) — 이 PR 의 diff 밖(비변경 파일)
  - 상세: `plan-scan.ts` 상단 주석이 이 잔존을 스스로 밝히고 `plan/in-progress/docs-guard-walker-dedup.md`
    로 추적을 명시했으며, 해당 plan 파일 존재를 확인했다. 지금 당장 회귀 위험은 아니지만(면제
    규칙 값이 현재 일치한다고 주석에 명시), 이 PR 이 고치려는 "같은 트리를 도는 walker 가 여러
    벌이라 조용히 어긋난다"는 바로 그 패턴이 한 곳 남아 있다는 점은 테스트 관점에서 참고할 가치가
    있다. 정보성 기록으로만 남긴다.

## 요약

이 변경은 "positive-only 실저장소 검사는 위반 분기를 한 번도 태우지 않고도 영원히 GREEN 일 수
있다"는, 이 저장소가 두 번 실측으로 겪은 결함 클래스를 정면으로 겨냥해 판정 로직을 순수 함수로
분리하고, 합성 임시 디렉터리 기반 negative-path fixture(재귀·archive/인덱스 면제·YAML 파싱 실패·
비-문자열 status·코드펜스 내부 링크 무시 등)로 각 분기를 직접 증명하는 구조로 설계됐다. mock 은
전혀 쓰지 않고 실제 `fs`/임시 디렉터리를 사용해 실제 동작과의 괴리가 없으며, `root: string` 매개변수
주입으로 테스트 용이성도 좋다. `beforeAll`/`afterAll` 로 각 스위트가 고유 임시 디렉터리를 만들고
정리해 격리도 확보돼 있다. `pnpm vitest run` 으로 관련 3개 테스트 파일(175 tests)을 직접 실행해 전량
통과를 확인했다. 유일하게 지적할 만한 것은 실저장소 스위트의 "non-vacuity" 캐너리 2건이 이름이
약속하는 것(추출 단계까지 살아있음)보다 약한 것(파일 discovery 만)을 증명한다는 점인데, 이는 이미
합성 fixture 스위트가 별도로 보완하고 있어 시스템 전체 위험은 낮다.

## 위험도
LOW
