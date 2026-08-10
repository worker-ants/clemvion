# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건. WARNING 2건(신규 링크 스캐너가 기존 견고한 스캐너를 재사용하지 않아 향후 오탐 가능성 / 신설 게이트 규칙이 사람이 참조하는 이동 체크리스트에 반영 안 됨). forced(router_safety) 7명 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성 | 신규 `relativeLinkTargets` 정규식이 같은 디렉터리에 이미 존재하는 더 견고한 링크 스캐너(`spec-links.ts`의 `findBrokenLinksInFiles` — 코드펜스 제외, 타이틀 문법 처리 등)를 재사용하지 않고 더 약한 버전을 새로 작성함. 코드펜스 내부의 마크다운 링크까지 실제 검증 대상으로 취급해, 향후 plan 문서의 예시 스니펫에 존재하지 않는 경로를 적으면 false positive로 push가 막힐 수 있음(이번엔 `spec-fix-swagger-forbidden-response.md`의 펜스 내 링크가 우연히 유효 경로라 통과함, requirement 리뷰도 동일 지점을 INFO로 지적) | `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:89-99, 180-201` | `spec-links.ts`의 `findBrokenLinksInFiles(files, { checkSelfAnchors: false })`를 재사용하도록 리팩터링 — 펜스 제외·타이틀 처리를 공짜로 얻고 두 스캐너 간 동작 불일치를 제거 |
| 2 | 문서화 | 신설된 두 게이트 규칙(§4: 완료 plan `status` 종료값 강제, 살아있는 plan 상대링크 무결성)이 §4에만 추가되고, 사람이 직접 참조하는 "이동 commit 자가 점검" 체크리스트(§5)에는 반영되지 않음. 체크리스트만 보고 이동하는 사람은 여전히 두 항목을 놓칠 수 있음(테스트가 사후에 잡아주지만 실패 후에야 안다) | `.claude/docs/plan-lifecycle.md:97-107`(§5, 미갱신) / 신설 규칙은 `:79-90`(§4) | §5 체크리스트에 "status를 선언했다면 종료 상태(TERMINAL_STATUSES)로 갱신했는가" / "형제 plan을 가리키던 상대링크를 `../complete/<name>`으로 정정했는가" 두 항목 추가. 필요 시 §3에도 교차 참조 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | 신규 `status` 모순 가드가 `plan/complete/**`→`in-progress` 방향만 커버. 거울상(`plan/in-progress/**`에 있으면서 종료 status 선언)은 어떤 게이트도 보지 않음 | `plan-frontmatter.test.ts:214-237` | 후속으로 대칭 `it` 추가 검토(같은 `TERMINAL_STATUSES` 재사용) |
| 2 | 테스트 | `status` frontmatter가 문자열이 아니면 검증을 조용히 skip(예: `status: [complete]`) | `plan-frontmatter.test.ts:227` | 비-문자열 값도 위반으로 잡는 방안 고려(낮은 우선순위) |
| 3 | 테스트 | `relativeLinkTargets`가 루트-상대 링크(`](/spec/...)`)를 리터럴 파일시스템 절대경로로 오인할 수 있음(현재 0건, 실질 위험 없음) | `plan-frontmatter.test.ts:88-99` | 후속에서 `/`로 시작하는 target 필터링 또는 repo-root 기준 해석 명시 |
| 4 | 테스트 | 신규 헬퍼(`collectCompletedPlans`, `relativeLinkTargets`)에 fixture 기반 격리 단위 테스트가 없고 실제 저장소 콘텐츠로만 간접 검증됨 | `plan-frontmatter.test.ts:60-99` | 우선순위 낮음 — vacuity guard(하한 단언)로 현재 충분히 방어됨 |
| 5 | 문서화 | §2.1의 "build guard 강제범위 = `plan/in-progress/*.md`" 서술이 이번 PR 이후 3-필드 스키마 체크에 한정해서만 정확. 신규 두 검사(status/링크)는 `plan/complete/**`도 포함해 스코프가 넓어짐 | `plan-lifecycle.md:32` | "(3-필드 스키마 한정)" 등 괄호로 스코프 명시 보강 |
| 6 | 스코프 | 신규 ad-hoc frontmatter 필드 `merged_pr`(자유서술 `status: complete (PR #625 머지)`를 분리)이 `plan-lifecycle.md` §4 스키마 표에 등재되지 않음 | `plan/complete/c1-pr2-aiturn-blueprint.md:5` | §4에 "status는 순수 리터럴만; PR 번호 등 부가정보는 별도 필드로 분리" 한 줄 추가(선택) |
| 7 | 요구사항 | reference-style 링크(`[text][ref]` + `[ref]: target`)는 스캔 대상이 아님(의도된 스코프 축소, 현재 0건으로 실질 갭 아님) | `plan-frontmatter.test.ts:88` | 문서화된 한계, 해당 스타일 도입 시 재검토 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 코드 변경은 문서 가드 테스트 1건뿐, ReDoS·경로탐색·시크릿 노출 등 실질 위험 없음 |
| requirement | NONE | 신설 게이트 2종이 SoT 문서(plan-lifecycle.md)와 line-level 일치, 148/2822 테스트 통과 실측 확인 |
| scope | NONE | 실질 코드/문서 변경 2개 파일로 국한, 나머지 24개는 게이트가 요구하는 기계적 companion fix |
| side_effect | NONE | 순수 read-only 스캔, 프로덕션 코드·API·전역상태·시그니처 영향 없음 |
| maintainability | LOW | 기존 `spec-links.ts` 링크 스캐너를 재사용하지 않고 더 약한 버전을 새로 작성(WARNING #1) |
| testing | LOW | 신규 가드 2종의 커버리지 미세 갭(대칭방향 미검증, non-string skip 등), 현재 실제 데이터엔 무해 |
| documentation | LOW | §5 이동 체크리스트가 신설 두 규칙을 반영하지 않음(WARNING #2) |

## 발견 없는 에이전트

- **security** — 확인성 INFO 4건(ReDoS 안전, 경로탐색 안전, fail-open 의도적, 화이트리스트 안전) 모두 "문제 없음" 판정, 별도 조치 불요.
- **side_effect** — 확인성 INFO 3건(스캔 범위 확장은 read-only, frontmatter 갱신은 PR 의도대로, 시그니처 변경 없음) 모두 "문제 없음" 판정.

## 권장 조치사항
1. `relativeLinkTargets` + 인라인 존재확인 루프를 제거하고 `spec-links.ts`의 `findBrokenLinksInFiles`를 재사용하도록 리팩터링 — 코드펜스 오탐 가능성을 근본적으로 제거 (WARNING #1).
2. `.claude/docs/plan-lifecycle.md` §5 "이동 commit 자가 점검" 체크리스트에 status 종료상태 갱신 확인 / 형제 plan 상대링크 정정 확인 두 항목 추가 (WARNING #2).
3. (선택, 낮은 우선순위) INFO 항목 중 status 대칭 방향 가드 추가, non-string status 처리, `merged_pr` 필드 스키마 등재를 후속 plan에 등재해 두면 재발 방지에 도움.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 표 (7명, 개별 사유는 라우터가 별도 명시하지 않음 — 변경 범위(문서/plan 위주)에 비관련으로 판단된 것으로 추정)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 — 즉, 실행된 reviewer 전원이 router_safety 화이트리스트에 의해 강제 포함됨. forced 전원 결과 확보됨, 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 변경 범위(문서/plan frontmatter + read-only 테스트)에 성능 영향 표면 없음 |
  | architecture | 라우터 판단 — 아키텍처 변경 없음(단일 테스트 파일 내 헬퍼 추가) |
  | dependency | 라우터 판단 — 의존성 변경 없음 |
  | database | 라우터 판단 — DB 영역 무관 |
  | concurrency | 라우터 판단 — 동시성 영역 무관 |
  | api_contract | 라우터 판단 — API 계약 변경 없음 |
  | user_guide_sync | 라우터 판단 — 사용자 가이드 영향 없음(내부 harness 문서만 변경) |

---