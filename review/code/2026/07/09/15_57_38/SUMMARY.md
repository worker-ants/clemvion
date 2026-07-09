# Code Review 통합 보고서

## 전체 위험도
**LOW** — 순수 테스트 전용 diff(3개 테스트 파일, production 코드 무변경). WARNING 1건(선행 완료 plan 문서의 defer 노트가 이번 커밋으로 stale) 외 실질 결함 없음. 나머지는 전부 INFO 수준.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | 완료된 plan `editor-slug-phase2.md` 의 "구현 노트"가 "triggers/page.tsx:716·usage-node-list.tsx·overview-card.tsx 3곳은 defer" 라고 명시했는데, 본 커밋이 정확히 그 3곳에 slug-present 회귀 테스트를 추가해 defer 를 해소했음에도 plan 문서 쪽에는 갱신/역참조가 없어, 향후 독자가 "여전히 미커버" 로 오인할 수 있음 | `plan/complete/editor-slug-phase2.md` § 구현 노트 | 해당 문단에 addendum 한 줄 추가 (예: "→ 후속 커밋 `9a7fb1644`(test: buildEditorHref 콜사이트 slug 회귀 테스트 3곳)에서 defer 해소, e2e 클릭-스루는 여전히 미포함") |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 스코프/요구사항 | 커밋 의도("defer 된 3개 콜사이트에 slug-present 회귀 테스트 추가, production 무변경")와 실제 diff·plan defer 근거가 line-level 로 완전히 일치. `git show --stat` 기준 96 insertions/0 deletions, 프로덕션/설정 변경 없음 | 커밋 전체 (`9a7fb1644`) | 조치 불필요 |
| 2 | 테스트 범위 | 3개 콜사이트 모두 "slug 존재" happy path 만 검증하고 slug-null 폴백(bare path 리턴)은 콜사이트 레벨에서 미검증 — 다만 `href.test.ts`/`use-workspace-slug.test.tsx` 단위 테스트에서 이미 커버됨 | 3개 신규/추가 테스트 전체 | 조치 불필요(회귀 가드 목적 달성); 완결성 원하면 콜사이트별 slug=null 케이스 저비용 추가 가능 |
| 3 | 테스트 범위 | `useWorkspaceSlug` 의 URL-우선/스토어-폴백 두 분기가 3파일에 걸쳐 2:1(우연히) 로 분산 커버됨 — 의도적 설계라기보다 기존 scaffold 재사용의 부산물로 보이나 결과적으로 두 분기 모두 실증됨 | `usage-node-list.test.tsx`/`overview-card.test.tsx`(URL-first) vs `triggers-page.test.tsx:353-360`(store-fallback) | 현행 유지로 충분; 후속 콜사이트 테스트 시 의식적 배분 권장 |
| 4 | 테스트 정밀도 | dialog variant 테스트가 href 배열에 기대값 "포함" 여부만 확인, 정확한 링크 개수는 미단언(현재 fixture 1개라 실질 위험 낮음) | `usage-node-list.test.tsx:77-83` | 필요 시 `toEqual([...])` 로 강화(선택적) |
| 5 | 테스트 정밀도 | 단일 항목(usages length=1) fixture 만 사용 — 다중 workflow 시 각 항목이 독립적으로 자신의 workflowId 로 링크를 만드는지는 미검증(구조 단순해 실질 리스크 낮음) | `usage-node-list.test.tsx:61-68` | 선택적으로 2개 이상 항목 fixture 추가 |
| 6 | 유지보수성 | `next/navigation` mock + "URL slug 이 SoT" 설명 주석이 2개 신규 파일에 토씨 하나 다르지 않게 반복 — 향후 문구 수정 시 한쪽만 갱신되는 drift 위험 | `usage-node-list.test.tsx:53-56`, `overview-card.test.tsx:574-577` | 현재 2곳뿐이라 즉시 조치 불요; 3번째 유사 콜사이트 추가 시 `mockWorkspaceSlugParam(slug)` 헬퍼 추출 고려 |
| 7 | 유지보수성 | `closest("a")` → `toHaveAttribute("href", ...)` href 단언 패턴이 파일마다 개별 구현(3회 반복) | `usage-node-list.test.tsx`(2회), `overview-card.test.tsx`(1회) | 즉시 리팩터 불필요; 4번째 유사 테스트 추가 시 공용 단언 헬퍼(`expectLinkHref`) 고려 |
| 8 | 유지보수성 | 신규 slug-렌더링 테스트가 RBAC 관점 `describe("TriggersPage — RBAC")` 블록 안에 배치되어 다른 테스트들(권한별 UI 노출)과 관점이 다소 어긋남 — 기존 헬퍼 재사용 목적으로 보임 | `triggers-page.test.tsx:161-168` | 기능상 문제 없음; 유사 콜사이트 테스트가 늘면 별도 `describe` 분리 권장 |
| 9 | 부작용 | 전역 Zustand store(`useWorkspaceStore`) 를 `setState` 로 직접 변경 — Vitest 파일 격리 및 기존 `reset()`/단일 `describe` 구조 덕에 파일 간·테스트 간 오염 위험 없음 | `overview-card.test.tsx:601-609`, `triggers-page.test.tsx:352-359` | 조치 불필요; `overview-card.test.tsx` 에 `describe` 가 늘어나면 `afterEach(() => useWorkspaceStore.getState().reset())` 추가 권장 |
| 10 | 부작용 | `next/navigation` partial mock(`useParams` 만 스텁, `useRouter`/`usePathname`/`useSearchParams` 미제공) — 실제 컴포넌트 의존 표면(해당 컴포넌트들이 쓰는 것은 `useParams` 뿐) 과 일치해 안전, 코드베이스 기존 관례 | `usage-node-list.test.tsx:54-56`, `overview-card.test.tsx:575-577` | 조치 불필요; 향후 `useRouter`/`usePathname` 사용 추가 시 mock 확장 |
| 11 | 문서화 | 인라인 주석(URL-first vs store-fallback 설명)이 실제 `useWorkspaceSlug` 구현(`fromUrl ?? fromStore`)과 정확히 일치 — 긍정 기록 | `usage-node-list.test.tsx:5`, `overview-card.test.tsx:8`, `triggers-page.test.tsx:353` | 조치 불필요 |
| 12 | 문서화 | CHANGELOG/README/API 문서/설정 문서 — production 변경이 없어 갱신 대상 아님(적절) | 해당 없음 | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 발견 없음 — 테스트 전용, 인젝션/시크릿/인가 우회 등 해당 없음 |
| requirement | NONE | 커밋 의도·diff·plan defer 근거 line-level 일치, 18 tests 실행 통과, INFO 3건(스코프 의도 확인용) |
| scope | NONE | 변경 범위가 정확히 3개 테스트 파일에 국한, 프로덕션/설정/리팩터링 없음 |
| side_effect | NONE | 전역 store setState·partial mock 모두 안전 확인(INFO 2건) |
| maintainability | LOW | mock/주석 중복, href 단언 패턴 반복, describe 배치 뉘앙스(모두 INFO, 즉시조치 불요) |
| testing | NONE | 18/18 테스트 통과 확인, happy-path 위주 커버리지 갭은 기존 단위 테스트로 보완됨(INFO 4건) |
| documentation | LOW | 완료된 plan 의 defer 노트가 이번 커밋으로 stale — WARNING 1건, 나머지 문서화 상태는 양호 |

## 발견 없는 에이전트

- security — 발견사항 전무("없음"), 위험도 NONE

## 권장 조치사항

1. `plan/complete/editor-slug-phase2.md` 의 "구현 노트" 문단에 본 커밋(`9a7fb1644`) 을 역참조하는 addendum 한 줄 추가 — defer 해소 사실을 명시해 stale 오인 방지 (WARNING 유일 항목).
2. (선택, 저비용) 콜사이트별 slug=null 폴백 케이스 1건씩 추가하면 완결성 향상되나 현재도 회귀 가드 목적은 충족.
3. (선택) 3번째 이상 유사 콜사이트 테스트가 추가되는 시점에 `next/navigation` mock+주석 중복, `closest("a")` href 단언 패턴을 공용 헬퍼로 추출 고려.
4. (선택) `triggers-page.test.tsx` 의 신규 slug 렌더링 테스트를 RBAC describe 블록에서 분리해 관점을 명확히 하는 것을 고려.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — router 가 선택한 7명 전원이 router_safety 에 의해 강제 포함됨(안전 최소셋)
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 테스트 전용 diff, 런타임 성능 영향 경로 없음 |
  | architecture | 구조/아키텍처 변경 없음(테스트 파일 추가만) |
  | dependency | 신규 의존성 추가 없음(기존 vitest/RTL/react-query 재사용) |
  | database | DB 관련 코드 변경 없음 |
  | concurrency | 동시성 관련 코드 변경 없음 |
  | api_contract | API 계약(엔드포인트/DTO) 변경 없음 |
  | user_guide_sync | 사용자 가이드 문서 대상 변경 아님(내부 회귀 테스트) |