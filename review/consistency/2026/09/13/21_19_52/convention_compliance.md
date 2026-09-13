# 정식 규약 준수 검토 — convention_compliance

## 조사 방법 메모

- 프롬프트 번들의 `scope`(`spec/conventions/`) 델타는 **0개 파일** — 이 브랜치는 `spec/**` 을
  전혀 바꾸지 않는다(`plan/in-progress/error-code-emission-axis.md` frontmatter
  `spec_impact: none` 과 일치, 정상). `error-codes.md` 본문과 `<git diff … code_areas>` 는
  프롬프트 예산 절단으로 생략돼 있었으므로, 지시대로 워킹트리
  (`/Volumes/project/private/clemvion/.claude/worktrees/error-code-emission-axis-56c9ff`)를
  절대경로로 직접 읽고 `git diff origin/main...HEAD` 를 직접 실행해 실제 diff 를 확보했다.
- 실제 구현 diff(`origin/main...HEAD`, `codebase/` 한정)는 **4개 파일·662줄**:
  `logic.mdx`/`logic.en.mdx`(각 1줄) + `guide-identifier-existence.test.ts`(+429)
  + `guide-identifier-scan.ts`(+234). `CHANGELOG.md`·`PROJECT.md`·`plan/**` 를 더하면
  6개 파일·695줄.
- `git log`로 확인하니 이 세션은 이미 5라운드(`/ai-review`+`--impl-done` 교차)를 돌았고,
  라운드 1~4 가 지적한 사항은 각 라운드에서 처리됐다. **이번 라운드(6번째)의 순증분은
  라운드 5 커밋(`2931d921f`, 이 리뷰 직전 커밋) 하나뿐**이다 — `computeNonEmittedOffenders`
  정본 추출(+34줄, `guide-identifier-scan.ts`) + 그 정본을 호출하도록 테스트 재배선
  (+82줄, `guide-identifier-existence.test.ts`) + plan/tracker 갱신. 대조 규약:
  `spec/conventions/error-codes.md`, `user-guide-evidence.md`, `review-citations.md`,
  `node-output.md`, `i18n-userguide.md` (전부 워킹트리 절대경로 실측) +
  `spec/5-system/3-error-handling.md §1.4`.

## 발견사항

### [INFO] 라운드 5 순증분 자체는 규약 위반 없음

- target 위치: `guide-identifier-scan.ts` `computeNonEmittedOffenders`(신설) ·
  `guide-identifier-existence.test.ts` (베이스라인/한계 테스트가 그 정본을 호출하도록 재배선
  + `computeNonEmittedOffenders — 네 항이 각각 무는가` describe 신설)
- 상세: 이 증분은 리뷰어가 뮤테이션(카탈로그 필터 한 줄 삭제 → 71/71 GREEN 생존)으로 지적한
  "헬퍼 테스트 ≠ 호출부 테스트" 문제에 대한 처방이다. 새로 추가된 인용은 전부
  `review/code/2026/09/13/20_57_13`(`review-citations.md` §2 "권장" 전체 경로 형태) —
  bare `hh_mm_ss` 0건. 신규 export 함수 `computeNonEmittedOffenders` 는 `grep -rn
  "computeNonEmittedOffenders" codebase/` 결과 이 두 파일 외 어디에도 없어 신규 식별자
  충돌 없음(이 세션이 라운드 4 에서 이미 `staleEntries`→`staleGuideEntries` 로 겪은 충돌
  형태의 재발 없음). `MAKESHOP_UNRESOLVED_PATH_PARAM`/`CONTAINER_MISSING_EMIT`/
  `CONTAINER_MULTIPLE_EMIT` 세 토큰은 여전히 `error-codes.md` §1 이 규율하는 "실제 발행되는
  `error.code` 문자열"이 아니라 **메시지 접두 문자열**이므로 그 규율의 적용 대상 밖이라는
  라운드 5 판단이 유지된다(재확인: `execution-engine.service.ts:8016` 이
  `nodeExec.error = { message }` 로만 기록 — `code` 필드 없음).
- 제안: 없음 — 순증분은 규약과 충돌하지 않는다.

### [INFO] (재확인, pre-existing·이 PR 발생 아님) `PROJECT.md:300` 의 SoT 인용이 실제 대상 절을 가리키지 않는다

- target 위치: `PROJECT.md:300`(`guide-identifier-existence.test.ts` 항목 끝의
  `SoT: spec/conventions/user-guide-evidence.md §2`)
- 위반 규약: CLAUDE.md "정보 저장 위치" 원칙(정식 규약 SoT 인용은 실제로 그 대상을 서술하는
  절을 가리켜야 함)
- 상세: `spec/conventions/user-guide-evidence.md §2` 는 `impl-anchor-existence.test.ts` /
  `integrations-coverage.test.ts` / `triggers-coverage.test.ts` **3건**만 열거한
  "Build-time 가드" 표이고 frontmatter `code:` 도 이 3건 + 보조 파서만 나열한다
  (`grep -rn "guide-identifier" spec/conventions/` = 0건,
  `grep -rn "GUIDE_EXTERNAL_VOCABULARY\|GUIDE_NON_EMITTED_VOCABULARY" spec/` = 0건, 이번
  라운드 재확인). `git show origin/main:PROJECT.md` 로 확인하면 이 SoT 태그는 `origin/main`
  시점부터 이미 이렇게 걸려 있었다 — 이번 브랜치의 6개 커밋 어디도 `PROJECT.md` 의 이 줄을
  건드리지 않았다(라운드 1 이 가운데 서술만 갱신했을 뿐 SoT 태그는 손대지 않음). 라운드
  3(`20_13_19`) 이후 4라운드 연속 동일하게 재확인·비차단 처분됐다.
- 제안: 이 PR 의 책임 범위 밖(차단 사유 아님). 후속으로 (a) SoT 를 실제로 이 가드를
  설명하는 절로 정정하거나, (b) 이 가드 정책을 `spec/conventions/` 문서로 승격해 SoT 를
  그쪽으로 옮기는 것을 권고 — planner 트래커(§1.4 backfill 항목)와 함께 처리 가능.

### [INFO] (재확인, pre-existing·이 PR 이 확장만 함) 존재/발행 2축 하네스가 `spec/conventions/` SoT 문서 없이 코드 주석에만 존재

- target 위치: `guide-identifier-scan.ts` 전체(`GUIDE_EXTERNAL_VOCABULARY`·
  `GUIDE_NON_EMITTED_VOCABULARY`·두 axis 판정 함수·이번 라운드가 더한
  `computeNonEmittedOffenders` 정본)
- 위반 규약: 직접적 "금지" 위반은 아니지만 CLAUDE.md "정보 저장 위치" 표의 원칙("정식 규약
  → `spec/conventions/<name>.md`")과 결이 어긋난다. 자매 하네스인 `impl-anchor-existence`
  계열(`user-guide-evidence.md`)은 정식 SoT 문서를 갖는 반면, 같은 "가이드 진실성 하네스"
  범주의 `guide-identifier-existence` 계열은 상한(`_CAP` 2종)·예외 레지스트리(2종)·판정
  정본 함수·"두 목록은 제약이 정반대라 합칠 수 없다" 같은 설계 근거를 갖춘 "정식 규약"
  수준으로 성숙했음에도 `spec/conventions/**` 어디에도 대응 문서가 없다.
- 상세: 이 비대칭은 `GUIDE_EXTERNAL_VOCABULARY`(선재, `#1330`/`#1331`)부터 있었다. 이번
  브랜치 전체(라운드 1~5)가 `GUIDE_NON_EMITTED_VOCABULARY` 축(카탈로그 참조·사유 필드·
  `where` grep 검증·이번 라운드의 판정 정본화까지)을 더하며 그 비대칭을 한 단계 더 키웠지만,
  라운드 5 순증분 자체는 이 격차를 더 벌리지 않았다(신규 공개 표면 추가가 아니라 기존 두
  베이스라인 테스트의 중복 로직을 정본 함수로 합친 리팩터). 3라운드 연속(`20_13_19`→
  `20_34_48`→`20_57_15`) "planner 트래커 등재분·이 PR 비차단"으로 동일 처분됐고, 이번
  라운드에도 상태 불변.
- 제안: 이 PR 범위에서 강제하지 않는다(이미 위임됨). 후속으로 `error-codes.md` §1 "적용
  범위" 단락에 "메시지 접두로만 등장하고 `.code` 로 발행되지 않는 토큰은 본 규율의 적용
  대상이 아니다(가이드 하네스는 `guide-identifier-scan.ts` 참고)" 각주를 추가하거나, 신설
  convention 문서로 이 2축 하네스를 승격하는 것을 권고 — `spec-draft-nullable-notation-
  followups.md` 의 §1.4 backfill 택일 항목이 해소되는 시점과 함께 처리하는 편이 합리적이다
  (그 처분에 따라 `GUIDE_NON_EMITTED_VOCABULARY` 의 등록 2종이 불필요해질 수 있어, 승격
  범위 자체가 그 판정에 좌우된다 — plan 이 이미 이 순서를 명시).

### [양성 확인] 인용 형식·명명·역할 경계 — 규약 준수 확인

- `review-citations.md` §2/§3: 이번 diff(누적 662줄)가 추가한 모든 리뷰 산출물 인용을 전수
  grep 했다 — 전부 `review/code/2026/09/13/HH_MM_SS` 또는
  `review/consistency/2026/09/13/HH_MM_SS` **전체 경로** 형태이고 bare `hh_mm_ss` 는 0건
  (§2 "권장" 형태 준수). `codebase/` 밖(CHANGELOG.md·PROJECT.md·plan/**)도 동일 형태.
- `review-citations.md` §4: plan(`error-code-emission-axis.md` §G)이 스스로 "가드 폴더
  전체에 전체-경로 인용을 강제하는 별도 가드"를 세우려다, 그 폴더에 이미 있던 선재 bare
  인용 3건(`spec-links.test.ts`)까지 강제 정리하게 되어 §4 "기존 bare 인용은 소급 정리
  대상이 아니다" 를 위반하게 됨을 스스로 발견하고 철회한 이력이 plan 에 남아 있다 —
  규약을 실측 없이 어길 뻔한 것을 문서를 다시 읽어 막은 사례.
- `error-codes.md` §1(의미 기반 명명, `UPPER_SNAKE_CASE`) / `node-output.md` §3.1~3.3:
  `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`/`MAKESHOP_UNRESOLVED_PATH_PARAM` 은
  UPPER_SNAKE_CASE 이고 의미 기반이지만 §1 이 규율하는 "실제 발행되는 `error.code`
  문자열"이 아니라 메시지 접두 문자열이라 애초에 §1 적용 대상 밖이다. 가이드 정정 문구
  ("전용 에러 코드는 없으니 코드가 아니라 메시지를 봐야 해요", KO/EN 쌍)가 이 경계를
  정확히 서술해 규약과 충돌하지 않는다.
- `i18n-userguide.md`: `logic.mdx`/`logic.en.mdx` 두 로케일이 같은 커밋에서 대칭 수정됐다
  (§적용 범위가 요구하는 ko/en parity 정신과 일치, 두 문장의 구조·정보량이 대응).
- CLAUDE.md 역할 경계: `CONTAINER_*` 를 `3-error-handling.md §1.4` 카탈로그에 backfill할지
  여부는 `spec/` 변경 사안인데, developer 는 이를 직접 편집하지 않고
  `spec-draft-nullable-notation-followups.md` 트래커에 planner 항목으로 등재한 채
  `spec_impact: none` 으로 이번 PR 을 마감했다 — 경계 준수.
- Gate C(`spec-impl-evidence.md`): `plan/in-progress/error-code-emission-axis.md` frontmatter
  `spec_impact: none` 은 bare `none` 이며 리스트 형태 오용 없음 — 정상.

## 요약

이번 라운드(6번째, `21_19_52`)가 검토하는 순증분은 직전 라운드(`review/code/2026/09/13/
20_57_13`)가 뮤테이션으로 지적한 "헬퍼 테스트 ≠ 호출부 테스트" 문제를 판정 정본 함수
(`computeNonEmittedOffenders`)로 해소한 106줄(+plan 갱신)뿐이며, 이 수정 자체는 정식
규약과 충돌하지 않는다. `spec/conventions/**` 델타는 0(코드 전용 PR 로서 정상)이고, 누적
구현 diff(4파일·662줄) 전체도 기존 정식 규약(`review-citations.md` 인용 형식, `error-
codes.md` §1 명명·적용범위, `node-output.md` §3.1~3.3 에러 라우팅 경계, `i18n-userguide.md`
ko/en parity, Gate C `spec_impact`)과 충돌하지 않는다. 새로 발견된 CRITICAL/WARNING은 없다.
남는 것은 이 PR 이 만들지 않았고 4라운드 연속 "조치 불요·planner 등재분"으로 동일 처분된
두 구조적 공백(① `PROJECT.md:300` SoT 인용이 실제 대상 절을 못 가리킴, ② 존재/발행 2축
하네스가 `spec/conventions/` 문서 없이 코드 주석에만 존재)뿐이며, 둘 다 이 PR 을 막을
사유가 아니다.

## 위험도

LOW
