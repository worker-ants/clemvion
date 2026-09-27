# 신규 식별자 충돌 검토 — spec-draft-review-citations-class-jsdoc

## 검토 범위

target draft(`plan/in-progress/spec-draft-review-citations-class-jsdoc.md`)가 적용 대상으로 삼는
`spec/conventions/review-citations.md` §3 표·`## Rationale` 변경안에서, 새로 도입되는 식별자를
추출해 기존 사용처와 대조했다. 이 draft 는 **새 엔티티·DTO·API endpoint·이벤트명·ENV
var·spec 파일 경로를 만들지 않는다** — 순수하게 기존 규약 문서 한 곳의 표 행을 둘로 가르고
`## Rationale` 절 하나를 추가하는 문서 편집이다. 그래서 대조 대상은 두 가지로 좁혀진다:

1. §3 표의 새 행 레이블 두 개 — "DTO 필드 · 컨트롤러의 `/** */` JSDoc", "응답 DTO 클래스의 `/** */` JSDoc"
2. 새 Rationale 헤더(앵커) — `### §3 — 응답 DTO 클래스 JSDoc 도 인용을 쓰지 않는다 (2026-09-27)`

## 발견사항

### [INFO] 새 Rationale 헤더가 기존 헤더와 겹치지 않음 — 확인만
- target 신규 식별자: `### §3 — 응답 DTO 클래스 JSDoc 도 인용을 쓰지 않는다 (2026-09-27)` (앵커: `#3--응답-dto-클래스-jsdoc-도-인용을-쓰지-않는다-2026-09-27`)
- 기존 사용처: `spec/conventions/review-citations.md` 의 기존 `## Rationale` 헤더 5개(`code:` 가 "구현 경로"…, 왜 PR 번호로…, 왜 소급 정리를…, `spec/**` 을 "위반 0건"…, 이 수치를 처음 셀 때…) — 실측(`grep -n '^#'`) 결과 동일·유사 슬러그 없음
- 상세: 같은 파일 안에서 앵커 중복이 없어 GitHub 의 `-1` 접미 충돌도 발생하지 않는다. 저장소 전체에서 `review-citations.md#` 형태로 이 문서의 특정 앵커를 참조하는 곳도 없어(`grep -rn "review-citations.md#"` 0건) 기존 링크가 새 헤더 삽입으로 깨질 위험도 없다.
- 제안: 없음 — 충돌 아님, 기록용 확인.

### [INFO] `§3` 레이블이 `swagger.md` 와 겹치지만 파일 스코프가 달라 문제 없음
- target 신규 식별자: Rationale 헤더의 `§3` (review-citations.md 자신의 §3 "적용 범위" 절을 가리킴)
- 기존 사용처: `spec/conventions/swagger.md` 의 `### §3 DTO 길이는 왜 강제가 아닌가`, `### §3 보안·정책 캐비엇 — …` (line 353, 387 부근) — 이쪽 `§3` 은 swagger.md 자신의 "3) 주석/설명 톤" 절을 가리킨다
- 상세: 두 문서가 각자 다른 의미의 "§3" 을 이미 쓰고 있는 기존 관행이며, target draft 는 이 관행을 그대로 따를 뿐 새로 만들지 않는다. 두 문서를 나란히 열지 않는 한 혼동 가능성은 낮고, 이미 선례가 있어 이번 draft 로 새로 생기는 위험은 아니다.
- 제안: 없음 — 기존 컨벤션 그대로 따름. 향후 두 문서를 교차 인용할 일이 생기면 `review-citations.md §3` 처럼 문서명을 명시하는 관행(이미 이 draft 자신도 본문에서 `review-citations.md §3` 로 명시함)을 유지 권장.

### [INFO] 새 표 행 레이블은 기존 "응답 DTO 클래스" 용어와 일관됨
- target 신규 식별자: 표 행 "응답 DTO 클래스의 `/** */` JSDoc"
- 기존 사용처: `spec/conventions/swagger.md` §5-1 "**응답 DTO 클래스명은 저장소 전체에서 유일해야 합니다**"(line 420), §5 표제 "5) 응답 DTO 규약"
- 상세: "응답 DTO 클래스" 라는 용어를 이미 swagger.md 가 쓰고 있고, review-citations.md 자신의 `code:` frontmatter 주석도 "§3 의 **응답 DTO** 축"(line 8) 이라 적어 같은 의미로 쓴다. target 은 이 기존 용어를 재사용할 뿐 다른 의미로 전용하지 않는다.
- 제안: 없음 — 충돌 아님.

### [INFO] 위임 대상 plan 파일 경로는 아직 미생성, 명명 컨벤션과 일치
- target 신규 식별자: `plan/in-progress/dto-class-jsdoc-citation.md` (draft 의 "구현 위임" 절이 가리키는 developer 몫 plan)
- 기존 사용처: 없음 — `find plan -iname "*dto-class-jsdoc*"` 0건. worktree 이름(`dto-class-jsdoc-citation`)과 일치하는 파일명이라 `plan/in-progress/<name>.md` (frontmatter `worktree` 명시) 관례에 부합한다.
- 상세: 이 draft PR 은 `spec/` 변경만 다루고 이 plan 파일 자체를 생성하지는 않는다(생성은 developer 턴에서 이뤄질 것으로 보인다). 현재로선 실재하지 않는 경로를 가리킬 뿐이라 다른 의미로 이미 쓰이는 충돌은 없다.
- 제안: developer 가 이 plan 을 만들 때 파일이 실제로 없는지 다시 한번 확인(경쟁 세션이 먼저 같은 이름을 썼을 가능성 배제) — 이 시점 기준으로는 충돌 없음.

## 요약

target draft 는 새 엔티티·DTO·API endpoint·이벤트명·ENV var·spec 파일을 도입하지 않고, 기존
`spec/conventions/review-citations.md` §3 표의 행 하나를 둘로 가르고 `## Rationale` 헤더 하나를
추가하는 순수 문서 편집이다. 새로 생기는 표 행 레이블과 Rationale 헤더 앵커 모두 같은 파일·
인접 문서(`swagger.md`)의 기존 용어·번호 관행과 일관되며, 실측(`grep`) 결과 앵커 중복·교차
참조 파손·용어 이중 의미 사용 사례는 발견되지 않았다. 신규 식별자 충돌 관점에서는 지적할
CRITICAL/WARNING 사항이 없다.

## 위험도
NONE
