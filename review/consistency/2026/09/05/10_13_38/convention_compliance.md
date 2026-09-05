# 정식 규약 준수 검토 — `spec/conventions/{migrations,review-citations,spec-impl-evidence}.md` · `spec/data-flow/8-notifications.md`

검토 모드: `--impl-done`, scope=`spec/`, diff-base=`origin/main`. 실제 스코프 델타 4개 파일 + 구현 diff
`codebase/backend/migrations/README.md`(§5 "인덱스 교체는 DROP-먼저" 절 신설, `origin/main` 대비).

## 사전 확인 — 이 델타는 직전 라운드(`10_04_12`)의 RESOLUTION 그 자체다

`git log`으로 확인한 HEAD(`0509dff6a`)는 커밋 메시지 자체가 "--impl-done 10_04_12 BLOCK:NO ·
WARNING 2 + INFO 2 전부 조치"라고 선언하는 RESOLUTION 커밋이다. `10_04_12` 라운드가 검토한
시점(`1b6ce5f8a`)부터 지금까지 이 4개 파일 + README.md 에 가해진 변경은 그 라운드가 지적한
W1·W2·INFO#1·INFO#2 네 항목의 조치뿐이다. 아래는 그 조치가 실제로 반영됐는지 재확인 + 신규
관점 스캔이다.

### 직전 라운드(`10_04_12`) 지적의 반영 확인 — 전부 해소, 재발 없음

| 출처 | 지적 | 현재 상태 (직접 대조) |
|---|---|---|
| `10_04_12` W1 | `spec-impl-evidence.md` §2.1 이 "준수 예시" 재해석의 SoT 를 갱신하지 않음 | 반영 확인 — `spec-impl-evidence.md:477` `code` 필드 정의에 "예외 — 시행 코드가 없는 순수 문서형 convention" 각주 + `[review-citations.md](./review-citations.md)` 선례 링크 확인. 상대경로도 `spec/conventions/` 내부 파일 간 링크로 정확 |
| `10_04_12` W2 | `spec/data-flow/8-notifications.md` 가 "CREATE 후 DROP" 순서를 절차처럼 적어 신규 규약(DROP-먼저)과 모순 | 반영 확인 — `8-notifications.md:275-280` 에 ⚠️ 캐비엇 삽입, `migrations/README.md §5` 로 정정 위임. V056 자신은 append-only 원칙(같은 spec 의 `migrations.md §3`)상 소급 수정 대상 아님을 명시해 정합 |
| `10_04_12` INFO#1 | `review-citations.md` §3 표에 `spec/**` 행 누락 | 반영 확인 — §3 표에 `spec/**` 문서 = **적용**, "현재 위반 사례 0건" 행 존재 |
| `10_04_12` INFO#2 | `README.md` 내부 cross-reference가 "§인덱스 교체"라는 실체 없는 이름-기반 참조를 씀(문서의 숫자-전용 §표기 관례 이탈) | 반영 확인 — `README.md:127` "같은 절(§5) 아래 **인덱스 교체는 DROP-먼저** 에 있습니다"로 정정, 숫자 §5 참조 + 볼드 텍스트명 병기로 문서 관례에 맞춤 |

## 신규 관점 스캔 (금번 라운드 고유)

- **frontmatter/스키마**: `review-citations.md` frontmatter(`id: review-citations` / `status: implemented` /
  `code:` 2개 예시 파일)는 `spec-impl-evidence.md` §2 스키마·§3 라이프사이클을 충족. `code:` 가 가리키는
  두 파일(`roles.guard.spec.ts`, `sanitize-loader-error.ts`)을 실제로 열어 확인한 결과, 둘 다 본 규약이
  정한 "전체 경로" 형태(`review/code/2026/08/08/20_53_48`, `review/code/2026/05/26/12_10_38`)의 리뷰
  인용을 담고 있어 frontmatter 의 주장(이 규약을 실제로 지키는 예시)이 사실과 일치한다.
- **금지 패턴 자기 적용(dogfooding)**: `review-citations.md` 자신이 신설한 "bare `hh_mm_ss` 금지" 규칙을
  스스로도 어기지 않는지 diff 추가분 전체를 검사 — 등장하는 모든 시각 인용(`23_02_51`, `09_53_09`,
  `09_27_04`, `00_06_38`, `12_10_38`)은 전부 날짜 폴더 경로가 붙은 "전체 경로" 형태이고, 유일한 bare
  형태(`23_02_51`)는 §2 판정 표 안에서 "금지" 예시로 의도적으로 인용된 것이라 위반이 아니다.
- **API 문서 규약 cross-check**: `review-citations.md` §3 이 DTO/컨트롤러 JSDoc 을 배제하며 인용한
  `swagger.md §3`("JSDoc 은 공개 OpenAPI 로 나간다 — 내부 서사를 담지 않는다", 2026-09-05 규약화)를
  직접 열어 대조 — 문구·날짜·요구사항(내부 서사는 `//` 주석에)이 정확히 일치. `swagger.md` 는 이번
  스코프에 없지만(변경 없음, `origin/main` 기준 diff 0) 인용이 실제로 존재하는 절을 정확히 가리킨다.
- **링크 무결성**: 이번 델타가 신설·수정한 in-repo 링크(`spec-impl-evidence.md → review-citations.md`,
  `migrations.md/8-notifications.md → codebase/backend/migrations/README.md`) 전부 상대경로 실측 —
  타깃 파일 존재, `../../` 단계 수 정확. `spec-link-integrity.test.ts` 가 검사하는 두 도메인(spec 본문,
  codebase 소스) 중 spec 본문 쪽에 해당하며 깨진 링크 없음.
- **문서 구조**: `review-citations.md` 는 `Overview (제품 정의)` → 본문 §1~4 → `Rationale` 3섹션 구조를
  그대로 유지(`spec-impl-evidence.md`/`user-guide-evidence.md` 와 동형). `migrations.md`/
  `8-notifications.md` 의 이번 추가분은 각각 기존 절차 섹션(§5)·기존 Rationale 하위 항목 안에 삽입돼
  섹션 구조 자체를 건드리지 않는다.
- **번호 체계**: `migrations.md` 신규 5줄은 `## 5.` 의 번호 있는 절차 목록(1~6) 뒤에 별도 불릿으로
  삽입돼 있어 번호 재부여가 필요 없고, append-only 원칙(§3)과도 무관(신규 산문 텍스트일 뿐 기존
  V-파일 수정 아님).

## 정합성 확인 (위반 아님)

- `spec/conventions/` 는 `spec-area-index.test.ts` 에서 flat reference 로 명시 제외돼 있어 신규 파일
  (`review-citations.md`) 에 area-index 갱신 의무 없음.
- `spec/data-flow/**` 는 `spec-impl-evidence.md` §1 에서 frontmatter 의무 대상에서 명시 제외돼 있어
  `8-notifications.md` 가 frontmatter 없이 남아 있는 것은 위반이 아니다(기존 상태 유지, 이번 diff 도
  frontmatter 를 건드리지 않음).
- 신규 convention(`review-citations.md`)에 대응하는 build-time 가드가 없는 것은 위반이 아니라 의도된
  설계 — `spec-impl-evidence.md` §2.1 각주와 `review-citations.md` 자체 Rationale("`code:` 가 '구현
  경로'가 아니라 '준수 예시'를 가리키는 이유")이 그 이유를 명시적으로 밝힌다. 따라서 `PROJECT.md §자동
  가드 표` 에 신규 row 를 추가하지 않은 것도 이 라운드 기준 위반이 아니다(가드가 없으므로 등재할 가드도
  없음).
- `spec-impl-evidence.md` R-1~R-10 Rationale 목록에 이번 신규 예외를 위한 전용 R-11 항목이 없는 것은
  누락이 아니라, 09_42_13 라운드에서 이미 확립한 "전문 중복 대신 단방향 SoT + cross-link" 원칙을 그대로
  따른 결과다 — 전체 Rationale 은 `review-citations.md` 쪽에 있고 `spec-impl-evidence.md` 는 각주 +
  링크만 갖는다.

## 발견사항

없음 — 직전 라운드가 지적한 WARNING 2건·INFO 2건이 전부 올바르게 반영됐고, 이번 라운드의 신규
관점 스캔(frontmatter 진실성 실측, 금지 패턴 자기적용, API 문서 cross-check, 링크 무결성)에서도
CRITICAL/WARNING/INFO 급 신규 위반을 찾지 못했다.

## 요약

이번 target 은 `10_04_12` 라운드의 RESOLUTION 커밋 그 자체이며, 그 라운드가 발견한 모든 항목(WARNING
2건 + INFO 2건)이 코드·문서 양쪽에서 실측 확인 결과 정확히 반영돼 있다. 추가로 frontmatter 의 `code:`
예시 파일이 실제로 신설 규약을 지키는지, 신설 규약이 스스로의 "bare 시각 금지" 를 어기지 않는지,
cross-reference 한 `swagger.md §3` 문구가 실제로 일치하는지를 직접 대조했고 전부 정합했다. `spec/`
영역의 명명·frontmatter·문서 3섹션 구조·API 문서 규약·금지 패턴 어느 관점에서도 CRITICAL/WARNING 급
위반이 없다.

## 위험도

NONE
