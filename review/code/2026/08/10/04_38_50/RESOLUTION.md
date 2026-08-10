# RESOLUTION — 04_38_50 (수렴)

리뷰 결과: RISK=LOW · Critical 0 · WARNING 3 · reviewer 6종(강제 5종 전원 포함)

## W1 — Gate C 가 망가진 `started` 를 조용히 면제했다 (requirement·maintainability) → **반영**

**동작 결함이다.** `startedDate()` 가 이 PR 이 `isIsoDate` 에 넣은 하드닝을 재사용하지 않아,
완료 plan 의 `started` 가 망가지면 `spec_impact` 요구를 **통째로 면제**받았다. 실측:

| `started` | 종전 결과 | Gate C |
|---|---|---|
| `"2026-13-32"` | `Invalid Date` → `null` | **미강제** |
| `2026-00-10` | js-yaml 이 `2025-12-10` 으로 굴림 | **미강제**(컷오프 이전) |

`plan/complete/**` 는 `checkPlanFrontmatter`(in-progress 전용)의 보호를 받지 못해 이 파일이
**유일한 방어선**이다. 내가 하드닝한 그 클래스인데 자매 함수에는 적용하지 않았다 — 이 PR 의
"절반만 고침" 세 번째다.

조치:
- `startedDate`/`isGateCEnforced` 가 **frontmatter 원문 블록**을 받도록 바꾸고
  `rawScalar` + `isIsoDate` 로 판정(파싱 결과로는 위 두 경로를 구분할 수 없다)
- `hasMalformedStarted` 신설 + 전용 `it` — 무효를 **조용히 넘기지 않고 표면화**한다.
  "판정 불가"(선언 없음)와 "무효"(선언했는데 달력에 없음)를 가른다
- 실데이터 357건 전수 확인: 달력상 무효 **0건** → 게이트를 켜도 안전

**뮤테이션 P1·P2·P3 전부 RED.** 다만 P3(`isIsoDate` 필터 제거)는 처음에 **생존**했다 —
fixture 의 날짜들이 롤오버해도 전부 컷오프 이전이라(`2026-02-30` → 3/2) 두 구현이 같은
답을 냈기 때문이다. 롤오버 결과가 컷오프를 **넘는** `2026-06-31`(→ 7/1)을 넣어 갈랐다.
분기가 있다고 관측되는 게 아니라 **입력이 그 분기를 가르는 값이어야** 관측된다.

## W2 — `hasValidSpecImpact` 가 죽은 함수였다 (testing·maintainability) → **반영(부분 관측)**

표면적으로는 "미사용 predicate" 지만 실제로는 **또 하나의 fail-open** 이었다. 실제 게이트는
"비어있지 않은 문자열" 이면 통과시켜 `spec_impact: maybe` 같은 아무 문자열이나 지나갔는데,
predicate 는 `none`/`없음`/`n/a`/`na` 만 인정한다 — **게이트가 문서화된 계약보다 느슨했고**
그 사실이 predicate 가 단위 테스트에서만 불려서 드러나지 않았다.

실데이터 실측(none류 72 · 리스트 233 · 그 외 **0건**) 후 실제 게이트를 predicate 에 배선.

> **정직하게 남긴다 — 이 배선은 뮤테이션으로 관측되지 않는다.** 되돌리는 뮤턴트(Q1)가
> 생존했다. 실데이터에 `none` 아닌 bare 문자열이 없어서다. 실데이터 경로의 호출부 배선은
> 실데이터가 더러워져야 드러나므로 만들어낼 수 있는 관측이 아니다 — 억지 테스트를 만들지
> 않았다. predicate 자체는 Q2(RED)로 덮여 있고, 이 변경이 없애는 것은 **구조적 발산**이다.

## W3 — 내 헤더 주석이 산술적으로 모순이었다 (documentation) → **반영**

"네 벌(plan 트리 walker)이 모였다" 와 "남은 walker 둘은 `spec-links.ts` 에 있다" 를 이어
붙여, spec/codebase 를 보는 walker 가 마치 그 "네 벌" 의 일부인 것처럼 읽혔다 —
`docs-guard-walker-dedup.md` 가 방금 정정한 바로 그 혼동의 재발이다. 괄호 문단으로 분리해
**별 문제**임을 명시했다.

## INFO 11건

조치 불요로 판단. #1(`danglingSpecImpact` 테스트가 실 저장소 파일 존재에 결합)은 실제로
`spec-impl-evidence.md` 를 쓰는데, 이 PR 이 그 파일을 편집 대상으로 삼고 있어 사라질 위험이
낮다. #4(주석의 "enforced set 이 비어 있다" 가 낡음 — 실측 263/375)는 W1 리팩터에서 해당
문장을 함께 정리했다.

## 수렴 판정

발견의 성격이 **동작(W1) → 구조(W2) → 문서(W3)** 로 갈렸고, 동작 결함은 뮤테이션으로 관측을
확인했다. 남은 것은 선재 개선(등재됨)과 본질적으로 관측 불가능한 배선뿐이라 여기서 닫는다.

## 검증

- 문서 가드 19파일 / **2862 tests PASS** · tsc clean
- 뮤테이션 P1·P2·P3 RED · Q2 RED · **Q1 생존(위에 사유 기록)**
- e2e — 이 커밋 후 재실행
