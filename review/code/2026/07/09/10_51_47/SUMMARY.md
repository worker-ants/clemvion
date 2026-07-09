# Code Review 통합 보고서

대상: 슬러그 라우팅 하드닝 B (`buildExecutionHref` 헬퍼, `safe-path.ts` 공용 open-redirect 정규화, 타입 순환 제거) — 18개 변경 파일, 커밋 `f2fd9c61d`

## 전체 위험도
**MEDIUM** — Critical 발견은 없다. 순수 FE 리팩터로 대부분의 카테고리(DB/동시성/API계약/의존성/스코프)는 NONE~LOW 이나, 이 PR의 핵심 동기("slug 누락 latent broken-link" 회귀 수정)를 실제로 검증하는 컴포넌트 레벨 회귀 테스트가 다수 소비처에서 빠져 있고(vacuous pass 위험), 신규 guard 테스트도 자체 유효성 검증이 없으며, 헬퍼 JSDoc이 실재하지 않는 ESLint 룰을 근거로 서술하는 등 WARNING 3건이 있어 MEDIUM 으로 판정한다. 또한 report 파일 3건(performance/documentation/user_guide_sync)이 "success" 로 보고됐으나 실제로는 디스크에 존재하지 않아 해당 관점 검토 결과가 이번 통합에 반영되지 못했다(§비고 참조).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability | `buildExecutionHref` JSDoc이 실재하지 않는 ESLint 룰(`no-restricted-syntax`)을 enforcement 근거로 명시. 실제 가드는 `no-raw-execution-href.test.ts` 의 소스텍스트 스캔(같은 PR의 다른 파일 주석은 ESLint 접근을 명시적으로 기각했다고 서술)인데 href.ts 주석만 옛 설계를 반영 — 유지보수자가 "ESLint 가 막아준다"고 오인할 위험 | `codebase/frontend/src/lib/workspace/href.ts:29` | JSDoc을 실제 메커니즘(vitest 소스텍스트 guard, ESLint AST 매칭 취약성 회피 사유)에 맞게 정정 |
| 2 | Testing | 이 PR의 핵심 동기인 "slug 누락 latent broken-link" 3곳 수정에 대해, slug가 실제로 존재하는 상황을 재현하는 컴포넌트 레벨 회귀 테스트가 다수 소비처에 없음. `execution-list-page.test.tsx` 는 `useParams`/workspace-store 시딩 없이 slug=null 폴백과 우연히 일치하는 vacuous pass, `workflows-page.test.tsx` 는 "executions" 액션 자체가 트리거되지 않음, `dashboard/page.tsx`·`run-results-drawer.tsx` 는 테스트 파일 자체가 없음 | `dashboard/page.tsx`(테스트 없음), `execution-list-page.test.tsx:149-163`, `execution-detail-page.test.tsx`(prev/next 미검증), `workflows-page.test.tsx`(executions 케이스 미트리거), `run-results-drawer.tsx`(테스트 없음) | `rerun-modal.test.tsx:216-234` 패턴(workspace-store에 slug 시딩 후 `/w/<slug>/...` 단언)을 각 소비처에 최소 1개씩 추가 |
| 3 | Testing | `no-raw-execution-href.test.ts` guard가 "현재 저장소에 위반 0건"만 검증하고, regex 자체가 알려진 위반 문자열에 실제로 매치되는지 확인하는 self-test(true-positive fixture)가 없음 — regex가 이스케이프 실수 등으로 약화돼도 그 시점에 우연히 위반 코드가 없으면 guard 무력화가 조용히 통과됨. 문자열 연결 패턴은 애초에 탐지 못하고(known limitation), 주석 내 동일 backtick 패턴은 오탐 가능 | `codebase/frontend/src/lib/workspace/__tests__/no-raw-execution-href.test.ts:32-40` | 알려진 위반 문자열엔 `true`, 안전한 헬퍼 호출 문자열엔 `false` 를 반환한다는 regex 자체의 순수 unit 테스트 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `buildExecutionHref` 가 `workflowId`/`executionId` 를 인코딩/검증 없이 경로에 직접 삽입. 백엔드 발급 UUID 라 실질 위험 낮음, 빈 문자열 시 `/workflows//executions` 형태 가능하나 모든 호출부가 가드(필수 필드 또는 `workflowId &&`)되어 있음 | `lib/workspace/href.ts` (`buildExecutionHref`) | 현행 유지. 향후 신규 호출부 추가 시 인코딩/검증 고려 |
| 2 | Security/Architecture/Maintainability | `no-raw-execution-href.test.ts` guard 정규식이 백틱 템플릿 리터럴 패턴만 탐지 — 문자열 연결(`"/workflows/" + id + "/executions"`) 등 다른 조합 방식은 우회 가능(문서화된 의도적 트레이드오프) | `no-raw-execution-href.test.ts` | 필요 시 문자열 연결 패턴까지 포괄하는 보조 검사 또는 커스텀 ESLint 룰을 로드맵에 등재 |
| 3 | Security | 로그인 `?redirect=` 파라미터 **소비측**(로그인 성공 후 라우팅) 검증 로직이 이번 diff 범위 밖. **생성부**(`error-page.tsx`)는 `isSafeRedirectPath` 검증 후 안전하게 생성하나, 소비부가 별도로 동일 검증을 거치는지 미확인 | `components/ui/error-page.tsx`(생성부), 로그인 페이지(소비부, 범위 밖) | 로그인 페이지의 redirect 파라미터 소비 로직이 `isSafeInternalPath` 재검증을 거치는지 별도 확인 권장 |
| 4 | Architecture | B-4는 "런타임 순환 제거"라기보다 "잠재적 순환의 구조적 사전 차단"에 가까움(기존에도 `import type` 이라 런타임 순환은 없었음, 모듈 그래프상 역참조만 존재) | `resolve-fallback.ts`, `workspace-store.ts`, `types.ts`(신규) | 커밋 설명을 "구조적 순환 가능성 사전 차단"으로 표현 정정 고려(선택) |
| 5 | Architecture/Requirement | 타입 SoT 가 `types.ts`(정식 정의)와 `workspace-store.ts`(re-export 경유, 실질 소비 경로) 이중 구조인 과도기 상태. 코드 주석/plan의 "16 importer" 수치가 실측(15, resolve-fallback.ts 가 이번에 직접 import로 전환되어 -1)과 1 차이 | `lib/stores/workspace-store.ts:5,9`, `plan/in-progress/slug-routing-hardening.md` B-4 | 후속 plan 항목으로 "15개 importer를 `lib/workspace/types` 직접 import 로 전환 후 re-export 제거" 등록 + 수치 표현 정정(선택) |
| 6 | Architecture | `href.ts` 가 범용(`buildWorkspaceHref`)과 도메인 특화(`buildExecutionHref`) 헬퍼를 한 파일에 혼재 — 향후 도메인 헬퍼가 늘면 catch-all화 우려 | `lib/workspace/href.ts` | 헬퍼가 2~3개 더 늘면 `href/` 디렉터리 분리 고려(즉시 조치 불요) |
| 7 | Scope/Side-effect | B-2 순수 리팩터 커밋에 slug-누락 latent broken-link 3건(dashboard row-click, executions 목록 row-click, 상세 prev/next) 버그 수정이 함께 번들됨 — 커밋 메시지·plan 문서에 명시되어 은폐된 스코프 확장은 아님 | `dashboard/page.tsx`, `workflows/[id]/executions/page.tsx`, `workflows/[id]/executions/[executionId]/page.tsx` | 조치 불요(문서화됨) — 참고용 기록 |
| 8 | Side-effect | `isSafeRedirectPath` 가 이제 백슬래시/제어문자 포함 경로도 unsafe 로 판정(의도된 보안 강화) — 극히 드물게 그런 문자를 포함한 실제 경로에 의존하던 흐름이 있었다면 리다이렉트 목적지가 대시보드로 변경됨 | `components/ui/error-page.tsx` | 조치 불요(의도된 하드닝) |
| 9 | Maintainability | guard 테스트의 `SRC` 경로(`path.join(__dirname, "..", "..", "..")`)가 상대 경로 깊이에 암묵 결합 — 테스트 파일 위치가 바뀌면 조용히 fail-open(아무것도 못 찾고 통과) | `no-raw-execution-href.test.ts:16` | (선택) `SRC` 하위에 `lib/workspace/href.ts` 실존 여부 sanity assert 추가 |
| 10 | Dependency/Side-effect | 신규 guard 테스트가 매 실행마다 `src/` 트리 전체를 동기 `fs.readFileSync` 로 스캔 — 소스 파일 증가 시 테스트 시간 선형 증가(기능 문제 아님) | `no-raw-execution-href.test.ts` | 현재 규모에서 조치 불요, 트리가 크게 성장하면 스캔 대상 디렉터리 좁히기 고려 |
| 11 | Testing | `href.test.ts` 의 `buildExecutionHref` 스위트가 `buildWorkspaceHref` 대비 조합 커버리지가 얕음(undefined slug, executionId 없는 null-slug 목록 경로, 빈 문자열 executionId 미검증) | `lib/workspace/__tests__/href.test.ts:54-70` | `it.each` 로 3가지 경계 케이스 추가 |
| 12 | Testing | `error-page.test.tsx` 가 이번 PR로 강화된 백슬래시/제어문자 우회 케이스를 소비측 entry-point(`isSafeRedirectPath` export) 에서 직접 검증하지 않음(`safe-path.test.ts` 엔 커버되어 있으나 배선 자체는 미검증) | `components/ui/__tests__/error-page.test.tsx:10-21` | 백슬래시 케이스 최소 1개 추가해 delegate 배선 회귀 검증 |
| 13 | Maintainability | 이번 diff 로 손댄 `ReRunModal`/`RunResultsDrawer` 의 기존 책임과다는 이번 PR 범위 밖(변경은 import/href 호출 1~2줄뿐) | `rerun-modal.tsx`, `run-results-drawer.tsx` | 범위 밖 — 별도 백로그 후보로만 참고 |
| 14 | Requirement | `plan/in-progress/slug-routing-hardening.md` 의 TEST WORKFLOW 체크박스가 미완료 상태로 리뷰 요청됨(정상 진행 중, 허위 체크 아님) | `plan/in-progress/slug-routing-hardening.md:29` | 조치 불요 — 개발자가 이어서 완료하면 됨 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 인코딩 미검증(백엔드 UUID라 저위험)·guard 탐지범위 한계·로그인 redirect 소비부 범위 밖. 긍정: `isSafeRedirectPath` 백슬래시/제어문자 우회 갭을 `safe-path.ts` 공유로 해소 |
| performance | 재시도 필요 | 출력 파일 부재 (§비고) |
| architecture | LOW | 타입 이중 SoT 과도기·href.ts 향후 비대화 우려·guard 테스트의 정적 거버넌스 결합. 긍정: `safe-path.ts` 단일화로 보안 로직 drift 구조적 제거 |
| requirement | NONE | CRITICAL/WARNING 없음. spec(`14-execution-history.md`, `13-replay-rerun.md §10.14`)과 line-level 정합 확인, 142 unit 전부 통과 |
| scope | NONE | 18개 파일 전부 plan의 B-1~B-4에 정확히 매핑, 무관한 변경 없음. latent 버그 3건 번들은 문서화됨 |
| side_effect | NONE | 전역상태/네트워크/파일쓰기 등 고전적 부작용 없음. redirect 판정 강화·실행경로 목적지 변경은 모두 문서화된 의도적 변경 |
| maintainability | LOW | JSDoc의 ESLint 룰 오기재(WARNING) 외엔 guard 세부 한계·SRC 경로 결합 등 낮은 우선순위 |
| testing | MEDIUM | slug-존재 회귀 테스트 다수 소비처 부재(vacuous pass), guard self-test 부재 — 이 PR의 핵심 동기 자체가 재발 가능 |
| documentation | 재시도 필요 | 출력 파일 부재 (§비고) |
| dependency | NONE | 신규 외부 패키지 없음. 내부 의존 그래프 개선(순환 제거·safe-path 공유)만 |
| database | NONE | DB 접근 계층 변경 없음(해당 없음) |
| concurrency | NONE | 순수 함수/컴파일타임 변경뿐, 공유상태·비동기 로직 무변경 |
| api_contract | NONE | 백엔드 API 엔드포인트/스키마 변경 없음(해당 없음) |
| user_guide_sync | 재시도 필요 | 출력 파일 부재 (§비고) |

## 발견 없는 에이전트

- database — DB 접근 계층 변경 없음(순수 FE 리팩터)
- concurrency — 공유 자원/락/비동기 흐름 변경 없음
- api_contract — 백엔드 API 계약 변경 없음

## 권장 조치사항

1. (최우선, WARNING #2) `rerun-modal.test.tsx:216-234` 의 slug 시딩 패턴(`useWorkspaceStore.setState({ workspaces: [...], currentWorkspaceId })`)을 재사용해 dashboard·executions 목록/상세 prev-next·workflows "executions" 메뉴·run-results-drawer 각각에 slug-존재 회귀 테스트를 최소 1개씩 추가 — 이 PR이 고친 latent broken-link 회귀가 재발해도 잡을 수 있도록.
2. (WARNING #3) `no-raw-execution-href.test.ts` regex 자체의 self-test(알려진 위반 문자열 → true, 안전한 호출 → false)를 추가해 guard 무력화를 조기 감지.
3. (WARNING #1) `href.ts` 의 `buildExecutionHref` JSDoc에서 실재하지 않는 ESLint 룰 언급을 실제 enforcement 메커니즘(vitest 소스텍스트 guard)에 맞게 정정.
4. (INFO, 선택) href.test.ts 경계 케이스 보강(undefined slug/빈 executionId), error-page.test.tsx에 백슬래시 케이스 추가, "16→15 importer" 수치 정정, guard SRC 경로 sanity assert.
5. performance/documentation/user_guide_sync reviewer 결과 파일이 "success" 로 보고됐으나 디스크에 없어 이번 통합에서 누락됨 — 해당 3개 리뷰를 재실행하고 결과를 SUMMARY에 반영할 것을 권장(§비고).

## 비고 — 출력 파일 누락 3건

`performance`, `documentation`, `user_guide_sync` 세 reviewer 는 prompt 상 `status=success` 로 보고됐으나, 지정된 `output_file` 경로(`.../performance.md`, `.../documentation.md`, `.../user_guide_sync.md`) 가 실제 디렉터리에 존재하지 않아(디렉터리 리스팅으로 확인) 내용을 Read 할 수 없었다. 이 3개 관점(성능·문서 정합·사용자 가이드 동기화)의 검토 결과가 이번 통합 보고서에 반영되지 못했으므로, 전체 위험도 판정은 나머지 11개 관점의 결과를 기준으로 한다. 재실행을 통해 실제 출력을 확보한 뒤 본 보고서를 갱신할 것을 권장한다.

## 라우터 결정

- routing 값: `fallback-all` (router 미사용 — 라우팅 미완료/생략으로 전체 reviewer fallback 실행)
- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명)
- **제외**: 없음 (0명)
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 사유: 소스 코드 변경(6종) + 문서 파일 변경(documentation)

| 제외된 reviewer | 이유 |
|------------------|------|
| (없음) | — |