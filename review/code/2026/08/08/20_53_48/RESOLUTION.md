# RESOLUTION — 20_53_48

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | 코드 | `a53b88058` | `knowledge-base.controller.ts` `search` 에 누락된 `@ApiForbiddenResponse` 부착 |
| #2 | 코드 | `073bca08e` | viewer 하위호환성 파괴는 의도된 변경(spec §3.2 정합화, 코드 되돌리지 않음). FE 게이팅 실측 — edges/nodes CRUD 는 canvas 가 `saveCanvas`(기존 `editor` 가드)로 저장해 직접 호출부 없음, `triggers.rotateBotToken` 은 이미 `canEdit` 가드됨. 유일한 실 갭은 `executions.stop` — `editor-toolbar.tsx` Stop 버튼에 `canEdit` 가드 누락, viewer 에게 노출된 채 항상 403 이었다 → 가드 추가 + 회귀 테스트 + `CHANGELOG.md` Unreleased 항목 |
| #3 | 코드(plan) | `4e2118b7f`, `ccb7f26a1` | plan 체크리스트를 실제 반영 상태로 동기화(테스트 선작성·RolesGuard 재구성·403 코드 결정·mutation 15건 대조·회귀 가드·token-first 아님 명시·e2e·TEST WORKFLOW·`/ai-review` 전부 `[x]`) |
| #4 | 코드 | `7fb8a6c8c` | `workspace.decorator.ts:16` 주석을 `roles.guard.ts` 와 동일 수준("`@Roles()` 유무와 무관하게 항상")으로 정정 |
| #5 | 코드 | `2b1ffc24d` | `RolesGuard`/`WorkspaceId` 데코레이터의 워크스페이스 컨텍스트 해석을 `common/utils/workspace-context.util.ts` 공용 헬퍼로 통합 — 배열-헤더 정규화 불일치 구조적 위험 제거(데코레이터도 이제 중복 헤더 정규화) |
| #6 | 코드 | `fee24683d`, `039c490a9`, `c1142bfc3` | e2e(헤더 위조 → 403) 추가. **이 e2e 실행이 2차 실 회귀를 잡았다** — 아래 "e2e 결과" 참조 |
| #7 | 코드 | `8c16a2dc8` | `roles.guard.spec.ts` 의 `makeContext` 헬퍼 `headerWorkspaceId` 타입을 `string \| string[]` 로 넓혀 배열-헤더 테스트가 헬퍼를 재사용하도록 정리 |
| #8 | 코드 | `c435a2aa6` | `workspace-roles-attachment.spec.ts` 신설 — (1) `RolesGuard` 가 `APP_GUARD` 전역 등록 유지되는지, (2) 신규 부착 8곳의 `@Roles()` 메타데이터를 reflection 으로 직접 고정 |
| #9 | 코드 | `00262bf96` | `RolesGuard` docstring 의 DB round-trip 서술을 실제 OR 조건(멤버십 재검증 · 역할 계층 비교)으로 정정 |
| #10 | 코드+spec | `4c199813c`(코드), `a228d22bf`(spec draft) | (a) 이 diff 가 건드린 5개 컨트롤러의 `@WorkspaceId()`-only 라우트 12곳에 `@ApiForbiddenResponse` 부착 완료. (b) `spec/conventions/swagger.md §5-4` 규약 문구 확장은 `plan/in-progress/spec-fix-swagger-forbidden-response.md` draft 로 위임(developer 권한 밖) — planner 턴 + `/consistency-check --spec` 필요 |

INFO 항목(#1~#8)은 자동 수정 대상이 아니며 아래 "보류·후속 항목" 에 추적 목록으로만 기록. 단 INFO #7(403 error code 결정 상태 불일치)은 SUMMARY#3 의 plan 동기화 작업에 포함해 함께 반영했다(main 이 사전 확정한 결정: `FORBIDDEN` 유지).

## TEST 결과

- lint : **선재 결함으로 전체 게이트 유예** — `origin/main` backend eslint 가 79파일/224건 실패(별 PR `backend-lint-gate-broken-on-main.md` 로 분리, 사용자 결정). 이 세션이 변경한 backend 13파일 + frontend 2파일은 `npx eslint <paths>` **전부 exit 0**(targeted 실행, 근거는 각 커밋 로그).
- unit : **통과** — backend `pnpm --filter backend test` 416 suites / 8463 tests(1 skipped) 전부 통과. frontend 전체 unit 은 이 브랜치와 무관한 pre-existing 1건 실패(`Gate C spec_impact` — `plan/complete/harness-review-gate-ci-backstop.md` frontmatter 누락, `cdf3b6832` 에서 유입, 이 diff 가 만들지도 건드리지도 않음) — 이 세션이 변경한 frontend 2파일의 대상 테스트(`editor-toolbar-stop.test.tsx` 등)는 개별 실행으로 통과 확인.
- build : **통과** — `nest build`(tsc) e2e docker 빌드 단계에서 확인. 최초 1회 `handlerConsumesWorkspaceId` 파라미터 타입 에러(`Function` vs 좁은 함수 타입, eslint 는 못 잡고 tsc 만 잡음)를 `c1142bfc3` 로 수정.
- e2e : **통과** — backend 46 suites/261 tests + frontend playwright 51 tests, 전부 통과. 로그: `_test_logs/e2e-20260808-215248.log`.

### e2e 진행 기록 (3회 재시도, 전부 근본 원인 해소 후 최종 통과)

1. `_test_logs/e2e-20260808-213416.log` — **인프라 차단**: docker daemon 미기동. `open -a Docker` 로 기동 후 재시도.
2. `_test_logs/e2e-20260808-213450.log` — **인프라 차단**: docker VM 디스크 부족(`No space left on device`, postgres initdb 실패). `docker builder prune -af`(41.54GB 회수, volume prune 은 하지 않음) 후 `make e2e-down` 으로 잔여 컨테이너 정리, 재시도.
3. `_test_logs/e2e-20260808-213732.log` — **실 테스트 실패 1건**: `system-status.e2e-spec.ts` "X-Workspace-Id 유무가 큐 집합에 영향 없음" — `@Roles()` 도 `@WorkspaceId()` 도 안 쓰는 전역 API 인데 헤더가 토큰과 다르면 403. 원인: `RolesGuard` 가 라우트의 실제 `@WorkspaceId()` 소비 여부와 무관하게 헤더가 실리면 항상 멤버십을 재검증했고, FE `apiClient`(`lib/api/client.ts`)가 모든 요청에 `X-Workspace-Id` 를 습관적으로 붙이는 탓에 워크스페이스와 무관한 엔드포인트까지 영향을 받았다 — plan 의 "워크스페이스 컨텍스트가 없는 라우트는 종전대로 통과" 불변식 위반. `039c490a9` 로 수정(`ROUTE_ARGS_METADATA` reflection 기반 `handlerConsumesWorkspaceId` 도입), 관련 유닛 테스트 갱신(기존 `undecorated()` 핸들러로는 실제 데코레이터 사용 여부를 reflection 할 수 없어 새 early-return 에 vacuous 하게 걸릴 뻔한 기존 테스트 5건을 `WorkspaceScopedTarget` 으로 교체 + `GlobalRouteTarget` 신규 회귀 가드 3건 추가).
4. `_test_logs/e2e-20260808-215104.log` — **build 실패**: `nest build` tsc 에러(`handlerConsumesWorkspaceId` 파라미터 타입이 `context.getHandler(): Function` 과 불일치, eslint 단독으론 미검출). `c1142bfc3` 로 타입 완화.
5. `_test_logs/e2e-20260808-215248.log` — **최종 통과**: backend 46 suites/261 tests + frontend playwright 51 passed.

## 보류·후속 항목

- spec draft 위임: `plan/in-progress/spec-fix-swagger-forbidden-response.md` — `swagger.md §5-4` 규약을 "`@Roles()` 또는 `@WorkspaceId()` 를 소비하는 엔드포인트" 로 확장(현재 `@Roles()` 만 전제). planner 턴 + `/consistency-check --spec` 필요. 반영 후 이 저장소 전체 73건 중 이 diff 밖 ~61개 라우트에 `@ApiForbiddenResponse` 부착하는 후속(코드모드 후보)도 함께 남김.
- INFO #1 (`app.module.ts:203` stale 주석 "`@Roles` 없으면 default-allow") — 종전 취약 동작을 서술하는 세 번째 자리. 이번 세션에서 미수정(INFO 는 자동 수정 대상 아님). 후속 권장.
- INFO #4 (`CHANGELOG.md` 갱신) — SUMMARY#2 처리에 포함해 이미 반영함(중복 아님, 위 표 #2 참조).
- INFO #6 (`knowledge-base.controller.ts` 컨트롤러 spec 파일 부재) — 블로킹 아님, 미신설.
- INFO #8 (`spec-draft-workspace-header-membership-invariant.md` Rationale "2파일"→"3파일" 오탈자) — 사소, 미수정.
- 저장소 전체 lint 게이트 파손(79파일/224건) — 별도 트래킹 `plan/in-progress/backend-lint-gate-broken-on-main.md` (이번 세션 이전에 이미 사용자 결정으로 분리됨, 이 세션에서 추가 조치 없음).
- 발견(비-SUMMARY, 이번 세션 e2e 로 신규 실측): frontend 전체 unit 스위트에 이 브랜치와 무관한 pre-existing 실패 1건 — `plan/complete/harness-review-gate-ci-backstop.md` 가 frontmatter `spec_impact` 를 선언하지 않아 `Gate C`(`spec-plan-completion.test.ts`) 가 실패. `cdf3b6832`(harness 리뷰 게이트 백로그, 이 브랜치 시작 전 이미 main 에 있었음)에서 유입된 것으로 실측 확인. 1줄 frontmatter 추가로 해결 가능하나 이 보안 PR 의 diff 범위 밖이라 미수정 — 별도 후속 권장.
