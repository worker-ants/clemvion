# 부작용(Side Effect) Review

## 발견사항

- **[INFO]** `walkTree` 에 원래 여섯 walker 어디에도 없던 새 분기(`path.isAbsolute(base)`)가 도입됐고, 현재 어떤 호출부도 쓰지 않는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/tree-walk.ts:78` (`const dir = path.isAbsolute(base) ? base : path.join(root, base);`)
  - 상세: 원래 여섯 walker는 전부 `path.join(root, subPath)` 로만 base 디렉터리를 만들었다. `walkTree` 는 `bases` 원소가 절대경로면 `root` 를 무시하고 그 경로를 그대로 쓰는 분기를 새로 추가했다. 저장소 전수 grep 결과(`impl-anchor-parse.ts`/`plan-scan.ts`/`spec-frontmatter-parse.ts`/`spec-links.ts` 5개 호출부) 모두 상대 문자열(`"spec"`, `path.join("plan", bucket)`, `CODEBASE_SOURCE_ROOTS` 등)만 넘기므로 이 분기는 오늘 실행되지 않는 죽은 코드다. `tree-walk.test.ts` 에도 절대경로 base 를 겨눈 테스트가 없어 무관측 상태다. "리팩터 = 동작 변경 0" 주장과는 별개로, primitive 자체는 새 기능이 하나 늘었다 — 향후 누군가 절대경로를 넘기면 `root` 가 조용히 무시되는 동작이 켜진다.
  - 제안: 현재 시점에는 위험하지 않다(도달 불가). 다만 "동작 변경 0" 서술을 정밀히 하려면 이 분기를 "여섯 walker의 재현이 아니라 primitive 설계상 신설된 것"으로 plan/주석에 명시하거나, 필요 없다면 분기를 제거해 표면을 좁히는 편이 낫다.

- **[INFO]** `collectMdxFiles` 의 정렬 알고리즘이 순서 비교 방식 자체를 바꿨다 (ordinal `sort()` → locale-aware `localeCompare()`)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/tree-walk.ts:98` (`out.sort((a, b) => a.relPath.localeCompare(b.relPath));`) — `collectMdxFiles` 는 `codebase/frontend/src/lib/docs/__tests__/impl-anchor-parse.ts:116` 에서 이 `walkTree` 를 호출
  - 상세: 원래 `collectMdxFiles` 는 절대경로 배열에 기본 `Array.prototype.sort()`(코드유닛 비교)를 썼다. 새 구현은 `walkTree` 를 통해 상대경로에 `String.prototype.localeCompare()`(Node 프로세스의 기본 로케일/ICU 데이터에 의존)를 쓴다. 현재 이 저장소 파일명 집합에 대해서는 두 방식의 결과 순서가 같다고 plan(`plan/in-progress/docs-guard-walker-dedup.md` "조용한 스코프 변경 0" 절)이 실측으로 확인했고, 실제 소비처(`impl-anchor-existence.test.ts`/`integrations-coverage.test.ts`/`no-internal-refs.test.ts`)도 `.length` 만 단언해 순서에 의존하지 않는다(직접 확인). 다만 `localeCompare` 는 실행 환경(Node 버전의 ICU 빌드, `LC_ALL`/`LANG`, OS)에 따라 대소문자·숫자·특수문자 순서가 달라질 수 있어, 파일명이 늘어나면 환경 간 비결정적 순서 차이가 이론상 재도입될 수 있다. (다른 다섯 walker 는 이미 `localeCompare` 를 쓰고 있었으므로 이 파일 하나만 새로 편입된 것.)
  - 제안: 현재는 무해(테스트가 순서를 안 보고, 실측으로 동치 확인됨). 향후 `collectMdxFiles` 출력 순서에 의존하는 코드가 생기면 이 로케일 의존성을 상기할 것.

- **[INFO]** `spec-frontmatter-parse.ts` 의 `parseSpecFile` 이 gray-matter의 프로세스 전역 캐시를 쓰던 호출(`matter(raw)`)에서 캐시 우회 호출(`matterNoCache` = `matter(raw, {})`)로 전환됨 — 의도된 전역 상태 접근 변경
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:100` (구 `matter(raw)` → 신 `matterNoCache(raw)`)
  - 상세: gray-matter 는 옵션 없이 호출되면 내용 문자열을 키로 하는 모듈 전역(프로세스 전역) 캐시에 부분 초기화 객체를 파싱 **전에** 등록한다. 이 PR 은 그 전역 캐시 쓰기를 제거하고 `plan-scan.ts` 의 `matterNoCache`(옵션 `{}`)로 통일했다. 문서화된 대로 오늘은 `spec/**` 만 읽어 `plan-scan.ts` 의 대상(`plan/**`)과 파일이 겹치지 않으므로 관측 가능한 캐시 오염 시나리오는 없다. 전역 상태(gray-matter 내부 캐시)에 대한 쓰기를 줄이는 방향의 변경이라 위험보다는 개선이다.
  - 제안: 없음 — 의도된 수정이고 근거가 diff 주석에 명시돼 있다.

- **[INFO]** Gate C 판정 함수 8개(`isGateCEnforced`/`hasMalformedStarted`/`hasValidSpecImpact`/`findDanglingSpecImpact`(개명)/`makeSpecExists`/`GATE_C_CUTOFF`/`NONE_VALUES`)가 `spec-plan-completion.test.ts` → `plan-scan.ts` 로 이동하며 `export` 가 새로 붙었다(신규 공개 표면)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:345-449`
  - 상세: 함수 본문을 옛 위치(제거분)와 새 위치(추가분)로 직접 diff 대조한 결과 로직 변경은 0줄이었다(차이는 import 정리 · 헤더 주석 추가 · `export` 키워드 추가뿐). 저장소 전수 grep 으로 `.claude/hooks/**`, 다른 스크립트 어디에도 이 함수들을 소비하는 곳이 없음을 확인했다 — PR 자신이 plan 문서에 적은 "외부 소비처 0건" 주장과 일치한다. `export` 추가는 새 공개 표면이지만 현재 소비자가 없어 관측 가능한 영향은 없다.
  - 제안: 없음. `danglingSpecImpact` → `findDanglingSpecImpact` 개명도 저장소 전수 grep 으로 잔존 참조 0건을 확인했다.

새 **CRITICAL 은 없다.** `walkPlanMarkdown` 의 `recurse` 우선 순위(스킵 체크보다 먼저 `continue`), `collectApplicableSpecs` 의 `/` 정규화(POSIX 런타임에서는 무관측 — Windows 전용 버그 픽스), `parseFrontmatterSafe`/`matterNoCache` 의 캐시 우회 동작(그대로 보존, `toParsed` 래핑만 추가)은 전부 원래 동작과 동치임을 diff/직접 대조로 확인했다.

## 요약

이 PR 은 문서 가드 6종의 손수 DFS 를 `walkTree` 공용 함수로 합치면서 각 호출부 필터를 옵션으로 정확히 재현했다 — `recurse` 우선순위·`archive`/인덱스 제외·확장자 필터·basename vs relPath 판정 축이 원본과 diff 상 동치임을 확인했고, Gate C 판정 함수 8개의 파일 이동도 로직 0줄 변경으로 검증됐다. 유일하게 새로 생긴 표면은 (1) 아직 아무도 쓰지 않는 `path.isAbsolute(base)` 분기, (2) `collectMdxFiles` 의 정렬 방식이 ordinal → locale-aware 로 바뀐 것(실측상 순서 동일, 순서에 의존하는 소비처 없음), (3) `spec-frontmatter-parse.ts` 가 gray-matter 전역 캐시 쓰기를 제거한 것(문서화된 의도적 개선)이다. 셋 다 관측 가능한 회귀를 만들지 않으며, "조용한 스코프 변경 0" 이라는 PR 의 핵심 주장을 반증하는 증거를 찾지 못했다. 전역 변수·파일시스템·네트워크·이벤트/콜백 측면에서 의도치 않은 새 부작용은 없다.

## 위험도

LOW

STATUS: OK
