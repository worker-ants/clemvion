# 정식 규약 준수 검토 — convention_compliance

## 조사 방법 메모

- `--impl-done` 프롬프트 번들의 `scope`(`spec/conventions/`) 델타는 0개 파일 — 이 브랜치는
  `spec/**` 을 전혀 바꾸지 않는다(정상, `spec_impact: none` 과 일치). 실제 구현 diff
  (`origin/main`..HEAD, `codebase/`) 는 4개 파일·571줄이며 프롬프트 예산에 잘려 있었으므로,
  워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/error-code-emission-axis-56c9ff`)를
  절대경로로 직접 읽어 실제 diff·SoT 대상(`spec/conventions/error-codes.md`,
  `spec/conventions/user-guide-evidence.md`, `spec/conventions/review-citations.md`,
  `spec/conventions/node-output.md`, `spec/5-system/3-error-handling.md §1.4`)을 확인했다.
- `git log`로 확인하니 이 세션은 이미 4라운드(`/ai-review` + `--impl-done` 교차)를 돌았고,
  라운드 1~3 이 지적한 명명·구조 이슈는 라운드 4(`57288e47f`, 이번 리뷰 직전 커밋)에서
  전부 처리됐다. 이번 라운드의 **순증분**은 `guide-identifier-existence.test.ts` 41줄
  (JSDoc 위치 정정 1건 + `staleEntries`→`staleGuideEntries` 개명 전수 반영)과 plan 보강뿐이다.
  아래 발견사항은 이 순증분과, 직전 라운드들이 이미 "조치 불요·등재분"으로 처분한 항목이
  이번에도 유효한지 재확인한 결과다.

## 발견사항

### [INFO] 라운드 4 순증분 자체는 규약 위반 없음 — 오히려 규약 준수 방향의 수정

- target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`
  (JSDoc 블록 위치 정정, `staleEntries`→`staleGuideEntries` 전수 개명)
- 관련 규약: 신규 식별자 명명 관례(이 저장소가 스스로 적어 둔 "새 식별자는 후보 토큰이 grep
  0건임을 먼저 보여라") — `spec/conventions/*.md` 항목은 아니지만 이 저장소 다수 규약
  (`error-codes.md` §2 rename 정책, `naming_collision` checker 계열)이 공유하는 "충돌 회피"
  원칙과 결이 같다.
- 상세: 개명 전 이름(`staleEntries`)이
  `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:129`
  의 기존 **export 함수**와 동명이었다(시그니처 상이, 기존 8곳 사용). 이번 diff 는 지역
  함수를 `staleGuideEntries` 로 개명해 그 충돌을 제거했고, 두 파일을 함께 실행해(24파일
  3,419건 GREEN) 기존 소유자에 영향이 없음을 확인했다. 또한 "발행 축 수집기 3종의 합성
  경계 대조군" JSDoc 이 라운드 2~3 사이에 원래 대상(`describe("발행 축 수집기 — 경계
  대조군", …)`)에서 두 블록 밀려나 있던 것을 원위치시켰다 — 직접 확인
  (`grep -n "발행 축 수집기 3종의" -A3 guide-identifier-existence.test.ts`)한 결과 현재는
  올바른 `describe` 블록 바로 위에 있다.
- 제안: 없음 — 이 순증분은 이미 규약 방향으로 수정된 상태다.

### [INFO] (재확인, pre-existing·이 PR 발생 아님) `PROJECT.md:300` 의 SoT 인용이 실제 대상 절을 가리키지 않는다

- target 위치: `PROJECT.md:300` (`guide-identifier-existence.test.ts` 항목 끝의
  `SoT: spec/conventions/user-guide-evidence.md §2`)
- 위반 규약: CLAUDE.md "정보 저장 위치" 원칙(정식 규약 인용은 실제로 그 대상을 서술하는
  절을 가리켜야 함)
- 상세: `spec/conventions/user-guide-evidence.md §2` 는 `impl-anchor-existence.test.ts` /
  `integrations-coverage.test.ts` / `triggers-coverage.test.ts` **3건**만 열거한
  "Build-time 가드" 표다. `grep -rn "guide-identifier" spec/conventions/` = 0건,
  `grep -rn "GUIDE_EXTERNAL_VOCABULARY\|GUIDE_NON_EMITTED_VOCABULARY" spec/` = 0건 —
  `guide-identifier-existence.test.ts` 가 검증하는 존재/발행 2축 하네스는 어떤
  `spec/conventions/*.md` 에도 등장하지 않는다. `origin/main` 시점부터 이미 이렇게 잘못
  걸려 있었고(직접 `git show origin/main:PROJECT.md` 로 확인), 이 PR 은 같은 줄의 가운데
  서술(발행 축 추가 설명)만 갱신하며 SoT 태그는 그대로 두었다 — **이 PR 이 새로 만든
  결함이 아니다.** 라운드 3(`20_13_19`)에서 이미 INFO 로 지적됐고 라운드 4 RESOLUTION 이
  "등재분·조치 불요"로 처분했다. 이번 라운드에서 다시 실측해도 상태는 불변이다.
- 제안: 이 PR 의 책임 범위 밖(차단 사유 아님). 후속으로 (a) SoT 를 실제로 이 가드를
  설명하는 절로 정정하거나, (b) 이 가드 정책(2축·두 allowlist·cap·escape-hatch)을
  `spec/conventions/` 문서로 승격해 SoT 를 그쪽으로 옮기는 것을 권고 — 아래 항목과 동일
  트래커에서 함께 처리 가능.

### [INFO] (재확인, pre-existing·이 PR 이 확장만 함) 존재/발행 2축 하네스가 `spec/conventions/` SoT 문서 없이 코드 주석에만 존재

- target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 전체
  (`GUIDE_EXTERNAL_VOCABULARY`·`GUIDE_NON_EMITTED_VOCABULARY`·두 axis 판정 함수)
- 위반 규약: 직접적인 "금지" 조항 위반은 아니지만, CLAUDE.md "정보 저장 위치" 표의 원칙
  ("정식 규약 → `spec/conventions/<name>.md`")과 결이 어긋난다. 자매 하네스인
  `impl-anchor-existence` 계열(`user-guide-evidence.md`)은 정식 SoT 문서를 갖는 반면, 같은
  범주("가이드 진실성 하네스")의 `guide-identifier-existence` 계열은 상한(`_CAP` 2종)·예외
  레지스트리(2종)·죽은 항목 정리 강제·"두 목록은 제약이 정반대라 합칠 수 없다" 같은 설계
  근거를 갖춘 "정식 규약" 수준으로 성숙했음에도 `spec/conventions/**` 어디에도 대응 문서가
  없다.
- 상세: 이 비대칭은 `GUIDE_EXTERNAL_VOCABULARY`(선재, #1330/#1331)부터 있었고, 이번 PR 은
  같은 형태의 **두 번째 완전한 축**(`GUIDE_NON_EMITTED_VOCABULARY` — 카탈로그 참조·사유
  필드·`where` grep 검증까지)을 얹으면서 그 비대칭을 한 단계 더 키웠다. 이는 이번 PR 이
  새로 만든 결함이 아니라 기존 구조적 공백을 계승·확장한 것이며, 라운드 3~4 에서 이미
  "planner 트래커 등재분·이 PR 비차단"으로 3차례 연속 동일 처분됐다
  (`plan/in-progress/error-code-emission-axis.md` 의 §1.4 backfill 택일 항목이 해소되면
  이 하네스 자체의 존재 이유 일부가 사라지므로, 승격 여부는 그 판정과 함께 결정하는 편이
  합리적이라는 처분 근거도 유효하다).
- 제안: 이 PR 범위에서 강제하지 않는다(이미 위임됨). 후속으로 `error-codes.md` §1 "적용
  범위" 단락에 "메시지 접두로만 등장하고 `.code` 로 발행되지 않는 토큰은 본 규율의 적용
  대상이 아니다(가이드 하네스는 `guide-identifier-scan.ts` 참고)" 각주를 추가하거나, 신설
  convention 문서로 이 2축 하네스를 승격하는 것을 권고.

### [양성 확인] 인용 형식·명명·역할 경계 — 규약 준수 확인

- `review-citations.md` §2/§3: 이번 diff 가 추가한 모든 리뷰 산출물 인용(`guide-identifier-scan.ts`·
  `guide-identifier-existence.test.ts` 30여 곳)을 전수 grep 했다 — **전부** `review/code/2026/09/13/HH_MM_SS`
  또는 `review/consistency/2026/09/13/HH_MM_SS` **전체 경로** 형태이고 bare `hh_mm_ss` 는
  0건이다 (§2 "권장" 형태 준수).
- `review-citations.md` §4: plan(`error-code-emission-axis.md` §G)이 "가드 폴더 전체에
  전체-경로 인용을 강제하는 별도 가드"를 만들려다, 그 폴더에 이미 있던 선재 bare 인용
  3건(`spec-links.test.ts`)까지 강제 정리하게 되어 **§4 "기존 bare 인용은 소급 정리 대상이
  아니다 — 일괄 치환은 하지 않는다"** 를 위반하게 됨을 스스로 발견하고 철회했다 — 규약을
  실측 없이 어길 뻔한 것을 문서를 다시 읽어 막은 사례다.
- `error-codes.md` §1(의미 기반 명명, `UPPER_SNAKE_CASE`) / `node-output.md` §3.1~3.3: 이번
  diff 가 다루는 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`/
  `MAKESHOP_UNRESOLVED_PATH_PARAM` 은 `UPPER_SNAKE_CASE` 이고 의미 기반이지만, 이들은
  `error-codes.md` §1 이 규율하는 "실제 발행되는 `error.code` 문자열"이 아니라 **메시지
  접두 문자열**이라 애초에 §1 적용 대상 밖이다(실측: `execution-engine.service.ts:8016` 이
  `nodeExec.error = { message }` 로만 기록 — `code` 필드 없음). 가이드 정정 문구("전용
  에러 코드는 없으니 코드가 아니라 메시지를 봐야 해요")가 이 경계를 정확히 서술해 규약과
  충돌하지 않는다.
- CLAUDE.md 역할 경계: `CONTAINER_*` 를 `3-error-handling.md §1.4` 카탈로그에 backfill할지
  여부는 spec 본문 변경 사안인데, developer 는 이를 직접 편집하지 않고
  `spec-draft-nullable-notation-followups.md` 트래커에 planner 항목으로 등재한 채
  `spec_impact: none` 으로 이번 PR 을 마감했다 — 경계 준수.
- Gate C(`spec-impl-evidence.md`): `plan/in-progress/error-code-emission-axis.md` frontmatter
  `spec_impact: none` 은 bare `none` 이며 리스트 형태 오용(`- none` 등) 없음 — 정상.

## 요약

이번 라운드(20_57_15)가 검토하는 순증분은 직전 라운드(`review/code/2026/09/13/20_34_32`,
`review/consistency/2026/09/13/20_34_48`)가 지적한 두 항목(orphan JSDoc 위치·`staleEntries`
이름 충돌)을 정확히 해소한 41줄뿐이며, 이 수정 자체는 규약을 어기지 않고 오히려 명명 충돌을
없애는 방향이다. `spec/conventions/**` 델타는 0(코드 전용 PR 로서 정상)이고, 구현 diff는
기존 정식 규약(`review-citations.md` 인용 형식, `error-codes.md` §1 명명·적용범위,
`node-output.md` §3.1~3.3 에러 라우팅 경계, Gate C `spec_impact`)과 충돌하지 않는다. 새로
발견된 CRITICAL/WARNING 은 없다. 유일하게 남는 것은 이 PR 이 만들지 않았고 4라운드 연속
"조치 불요·planner 등재분"으로 동일 처분된 두 구조적 공백(① `PROJECT.md:300` SoT 인용이
실제 대상 절을 못 가리킴, ② 존재/발행 2축 하네스가 `spec/conventions/` 문서 없이 코드
주석에만 존재)이며, 둘 다 이 PR 을 막을 사유가 아니다.

## 위험도

LOW
