# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건. 확인 가능했던 4개 reviewer(security/architecture/requirement/documentation) 전부 병합을 막을 결함 없음(테스트 중복·주석 stale·CHANGELOG 누락 등 유지보수성 WARNING 4건). 단, **scope/side_effect/maintainability/testing/user_guide_sync 5개 reviewer 는 manifest 상 `success` 이나 output 파일이 디스크에서 확인되지 않아 내용을 통합하지 못함** — 재확인 전까지 이 5개 영역(스코프 크립·부작용·유지보수성·테스트 커버리지·사용자 가이드 정합)은 미검증 상태로 남는다.

## Critical 발견사항

없음(확인된 4개 reviewer 기준).

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | `WorkspaceSlugGate` 로 게이트 로직을 공용 컴포넌트로 추출했으나, 정작 컴포넌트 자체를 겨냥한 단위 테스트가 없고 동일 행위 테스트(4케이스)가 두 layout 테스트 파일에 복붙 중복 | `codebase/frontend/src/app/(main)/w/[slug]/__tests__/layout.test.tsx` ↔ `codebase/frontend/src/app/(editor)/w/[slug]/__tests__/layout.test.tsx` | `lib/workspace/__tests__/workspace-slug-gate.test.tsx` 신설해 게이트 행위 검증을 한 곳으로 모으고, 두 layout 테스트는 "게이트가 실제로 배선되는지"만 확인하는 얇은 wiring 테스트로 축소 |
| 2 | Architecture | `no-raw-editor-href.test.ts`(신규) 가 기존 `no-raw-execution-href.test.ts` 의 스캐너 스캐폴딩(`collectSourceFiles`, exemption 판정, self-test 구조)을 그대로 복붙 재구현 | `codebase/frontend/src/lib/workspace/__tests__/no-raw-editor-href.test.ts`, `no-raw-execution-href.test.ts` | 공통 스캐닝/exemption 골격을 `__tests__/href-guard-utils.ts` 공유 헬퍼로 추출, 각 guard 는 자신의 regex + exemption 목록만 유지 |
| 3 | Requirement | `use-workspace-slug.ts` 주석("slug 세그먼트가 없는 라우트(editor 등)에서는 store 폴백")이 phase 2 이후 사실과 어긋남 — 에디터도 이제 slug 세그먼트를 가짐. plan S5 범위에서 이 파일만 주석 갱신 누락(기능 영향 없음, 문서적 괴리만) | `codebase/frontend/src/lib/workspace/use-workspace-slug.ts:10` | "editor 등" 예시 제거 또는 "docs 등"으로 교체 |
| 4 | Documentation | 직전 phase 1(#865) 이 세운 CHANGELOG.md 갱신 관행(및 최근 병합 커밋들의 일관된 패턴)을 이번 phase 2 가 따르지 않음 — 라우트 구조·링크 헬퍼·spec 서술을 다수 바꾸는 사용자 가시적 변경인데 항목 누락 | `CHANGELOG.md` | phase 1 항목과 대칭되는 "Unreleased" 섹션(또는 갱신)에 에디터 slug 편입·`buildEditorHref` 도입·구 bare 경로 catch-all 흡수 요약 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 에디터 로더가 API 에러(`err.message`)를 가공 없이 화면에 렌더 — 기존 코드 이동일 뿐 신규 로직 아님, 위험 낮음 | `codebase/frontend/src/app/(editor)/w/[slug]/workflows/[id]/editor-loader.tsx:539-542` | 별도 대응 불요(기존 패턴 유지), 향후 손댈 때 `translate()` 고정 문구 + 로깅 분리 고려 |
| 2 | Security | `WorkspaceSlugGate` 는 인가 경계가 아니며 이는 설계 의도이자 정확히 문서화됨 — 실제 인가는 여전히 backend `X-Workspace-Id`→토큰 클레임→`RolesGuard` (긍정 확인) | `codebase/frontend/src/lib/workspace/workspace-slug-gate.tsx`, `(editor)/w/[slug]/layout.tsx` | 없음 |
| 3 | Security | `buildEditorHref`/`buildWorkspaceHref` 는 기존 open-redirect 방어(`toSafeInternalPath`) 재사용, 새 회귀 없음 | `codebase/frontend/src/lib/workspace/href.ts`, `safe-path.ts` | 없음 |
| 4 | Security | raw-href guard 테스트는 문자열 연결(`"/workflows/" + id`) 형태를 탐지하지 못함을 스스로 문서화(알려진 한계, 직접 취약점 아님) | `no-raw-editor-href.test.ts:1936` | 향후 ESLint AST 규칙 보강 여지, 이번 범위 필수 아님 |
| 5 | Architecture | 무효-slug fallback 목적지(`/dashboard`)가 하드코딩 — 세 번째 소비 컨텍스트 생기면 파라미터화 필요할 수 있음 | `workspace-slug-gate.tsx:34-39` | 당장 불필요, 필요 시 `fallbackPath?: string` prop 화 |
| 6 | Architecture | 계층 분리·순환 의존성 부재(긍정) — `WorkspaceSlugGate` 는 route group 을 전혀 모름, 76줄→1줄 위임으로 중복 제거 | `workspace-slug-gate.tsx`, 양쪽 `layout.tsx` | 없음 |
| 7 | Architecture | `buildEditorHref` 는 `buildExecutionHref` 패턴을 대칭 계승해 OCP 부합 확장(긍정) | `href.ts:41-52` | 없음 |
| 8 | Architecture | 에디터 로더(`useEffect`+수동 fetch)와 같은 diff 의 `ExecutionListPage`(`useQuery`)가 데이터 패칭 패턴 상이 — 기존 부채, 이번 변경 무관 | `(editor)/w/[slug]/workflows/[id]/editor-loader.tsx` | phase 2 이후 후속 리팩터 후보(react-query 통일), 이번 PR 차단 사유 아님 |
| 9 | Requirement | `sidebar.tsx` 활성-메뉴 판정 주석도 동일 계열 stale 문구("editor 등 slug 밖") — 실동작엔 영향 없음(vacuous) | `codebase/frontend/src/components/layout/sidebar.tsx:442` | 주석에서 에디터 언급 제거 또는 무시 가능 |
| 10 | Requirement | `[SPEC-DRIFT] 아님` — spec 일부 문장("(main)/w/[slug] layout 이 slug 를 해소")이 좁게 읽힐 여지(다음 문장에서 공유 게이트 명시라 오도 없음), CRITICAL 대상 아닌 회색지대 | `spec/2-navigation/9-user-profile.md §3`, `spec/data-flow/12-workspace.md` | 원하면 "WorkspaceSlugGate(공용) 가 해소"로 표현 확장, 필수 아님 |
| 11 | Requirement | 긍정 확인 — spec fidelity(plan S7 체크리스트 전체 반영, stale "에디터=slug 밖" 문구 0건), 하위호환(구 라우트 git mv 완전 제거, catch-all 흡수), guard 실효성(스코핑 누락 2곳 실제 발굴) 모두 재검증 완료 | 다수 spec 문서, 소비 사이트 전수 | 없음 |
| 12 | Documentation | e2e 스위트(`slug-routing.spec.ts`) 상단 docstring 이 신규 에디터 시나리오 2건을 명시적으로 나열하지 않음(개별 테스트엔 인라인 주석 존재) | `codebase/frontend/e2e/workspaces/slug-routing.spec.ts:85-94` | 상단 docstring 에 "에디터 canvas 흡수·deep-link(phase 2)" 한 줄 추가 |
| 13 | Documentation | `usage-node-list.tsx` JSDoc 이 실제 href 형태(slug 포함)를 반영 안 함 | `(main)/w/[slug]/integrations/[id]/usage-node-list.tsx:849-853` | "buildEditorHref 로 slug 프리픽스 포함" 한 문구 보강 |
| 14 | Documentation | `WorkflowEditorLoader` 컴포넌트 JSDoc 부재(이동 전부터 기존 결함, 회귀 아님) | `(editor)/w/[slug]/workflows/[id]/editor-loader.tsx:16` | 후속 작업으로 책임 요약 JSDoc 추가 권장(필수 아님) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 전부 INFO(확인/긍정) — 인가경계 무변경, open-redirect 방어 재사용, 신규 취약점 없음 |
| architecture | LOW | WorkspaceSlugGate/guard 테스트 복붙 중복(WARNING 2), fallback 하드코딩(INFO) 외 계층 설계 건전 |
| requirement | LOW | plan S1-S7 전 항목 반영·spec fidelity 확인, diff 밖 stale 주석 2건(WARNING/INFO)만 잔존 |
| documentation | LOW | JSDoc/spec flip 대부분 우수, CHANGELOG 누락(WARNING) + 사소한 docstring 갭 3건(INFO) |
| scope | 확인 불가 | manifest=success 이나 `scope.md` 파일이 디스크에 없음 — 재시도 필요 |
| side_effect | 확인 불가 | manifest=success 이나 `side_effect.md` 파일이 디스크에 없음 — 재시도 필요 |
| maintainability | 확인 불가 | manifest=success 이나 `maintainability.md` 파일이 디스크에 없음 — 재시도 필요 |
| testing | 확인 불가 | manifest=success 이나 `testing.md` 파일이 디스크에 없음 — 재시도 필요 |
| user_guide_sync | 확인 불가 | manifest=success 이나 `user_guide_sync.md` 파일이 디스크에 없음 — 재시도 필요 |

## 발견 없는 에이전트

- **security** — 발견된 4건 전부 INFO(긍정 확인/기존 패턴 재사용), 조치 필요한 신규 이슈 없음.

## 권장 조치사항

1. **(최우선, 프로세스)** `scope`, `side_effect`, `maintainability`, `testing`, `user_guide_sync` 5개 reviewer 재실행 — manifest 는 `success` 로 보고했으나 output 파일이 세션 디렉터리에서 발견되지 않아 실제 리뷰 내용이 이번 통합에서 누락됨. 재실행 후 본 SUMMARY 재통합 전까지 이 5개 관점(특히 테스트 커버리지·부작용·유지보수성)은 미검증 상태.
2. `CHANGELOG.md` 에 phase 2("에디터 slug 편입") 항목 추가 — 직전 phase 1(#865) 관행과의 비일관 해소.
3. `use-workspace-slug.ts:10` 및 `sidebar.tsx:442` 의 stale 주석("editor 등 slug 밖") 정정 — 기능 영향 없으나 다음 개발자 오도 방지.
4. `lib/workspace/__tests__/workspace-slug-gate.test.tsx` 신설해 `WorkspaceSlugGate` 행위 검증을 단일화하고, 두 layout 테스트는 wiring 확인으로 축소.
5. (낮은 우선순위) `no-raw-editor-href.test.ts`/`no-raw-execution-href.test.ts` 공통 스캐닝 골격을 공유 헬퍼로 추출.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync` (9명)
  - **제외**: 표 (5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 이번 변경은 FE 라우팅/링크 헬퍼·spec 문서 편집으로 성능 영향 경로(쿼리·렌더 비용 등) 해당 없음 |
  | dependency | 라우터 판단 — 신규 패키지/버전 변경 없음 |
  | database | 라우터 판단 — DB 스키마/쿼리 변경 없음(순수 FE 라우팅) |
  | concurrency | 라우터 판단 — 동시성/레이스 조건 관련 로직 변경 없음 |
  | api_contract | 라우터 판단 — 백엔드 API 계약 변경 없음(FE 라우팅·인가 SoT 불변) |