# RESOLUTION — 사용자 가이드(/docs) 무한 중첩 라우팅 fix

대상 SUMMARY: `./SUMMARY.md` (위험도 LOW, Critical 0, Warning 6)

## 조치 항목

| SUMMARY # | 카테고리 | 판정 | 조치 | commit |
| --- | --- | --- | --- | --- |
| W#1 | SPEC-DRIFT | **위임** | 코드 유지(리뷰어도 "코드가 옳고 spec 이 못 따라간 케이스"로 판정). developer 는 `spec/` 쓰기 권한이 없어 직접 반영 불가 → project-planner 위임 draft `plan/in-progress/spec-update-catch-all-terminal-contract.md` 작성(제안 1·2·3 의 구체 문안 포함). 본 PR 은 차단 사유 아님 — `11-error-empty-states.md §1.3` 과 모순 없고 오히려 그 정책 준수 | (draft) `9a1c9f0` |
| W#2 | Scope | **수용(현행 유지)** | 무관 plan 의 Gate C 보정은 이미 별도 원자적 커밋(`89c4b1f6b`)으로 분리되어 있고 커밋 메시지에 "본 PR 과 무관" 명시됨 — 리뷰어도 "컨벤션상 허용된 예외이므로 차단 사유 아님"으로 판정. **별도 PR 로 재분리하지 않는 이유**: 이 보정 없이는 `unit` 스테이지가 main 에서 이미 실패해 본 PR 의 TEST WORKFLOW 자체가 통과 불가하다(선후 의존). 분리 시 본 PR 이 그 PR 머지까지 블록된다 | (변경 없음) |
| W#3 | Maintainability | **fix** | `WORKSPACE_ROUTE_SEGMENT = "w"` 를 `lib/workspace/href.ts` 에 신설하고 생성부(`buildWorkspaceHref`)와 판별부(`(main)/[...rest]` catch-all)가 공유. 두 곳이 어긋나면 무한 중첩이 재발한다는 결합을 상수+docstring 으로 명시. `rest.length === 2` 는 상수화하지 않고 주석 보강만 — 그 값은 "세그먼트 2개 = `/w/<slug>`" 라는 **구조의 직접 표현**이라 이름을 붙이면 오히려 한 겹 우회가 된다(리뷰어도 "필수는 아님"으로 표기) | `9a1c9f0` |
| W#4 | Testing/Maintainability | **후속 이관** | `sidebar-nav-href.test.tsx` ↔ `sidebar.test.tsx` mock 중복. 두 리뷰어 모두 "이번 PR 차단 아님 / 후속 정리 대상"으로 명시. **본 PR 에서 하지 않는 이유**: 공유 헬퍼 추출은 본 버그와 무관한 기존 `sidebar.test.tsx` 를 함께 수정해야 해, 같은 리뷰의 W#2(범위 오염)와 정면으로 상충한다. 별도 후속 task 로 이관 | (후속) |
| W#5 | Testing | **fix** | e2e `stale /w/<slug>/docs` 테스트가 URL 세그먼트 개수만 봐서 "조용한 blank 렌더"도 통과하던 약한 가드 — 정확한 지적. `getByRole("heading", {name: /페이지를 찾을 수 없습니다\|Page not found/})` 의 `toBeVisible()` + 404 시 사이드바 유지(`11-error-empty-states §1.3`) assertion 추가. 실행 결과 통과 → `notFound()` 가 실제로 not-found 바운더리를 태운다는 것이 증명됨 | `9a1c9f0` |
| W#6 | Documentation | **fix** | `CHANGELOG.md` 에 `## Unreleased — 사용자 가이드(/docs) 진입 시 워크스페이스 slug 무한 중첩 fix` 절 추가(원인 2단·수정 4항목·검증 근거). 리뷰어 지적대로 이 저장소는 사용자 가시 fix 마다 Unreleased 절을 남기는 관행이 확립돼 있고(슬러그 라우팅 phase 1·2 포함), `PROJECT.md` 매트릭스에는 그 행이 없어 4단계에서 놓쳤다 | `9a1c9f0` |

INFO 8건은 모두 "조치 불요/선택"으로 리뷰어가 명시했고, 본 PR 의 결함이 아니므로 미조치.
단 INFO#8(체크리스트 항목 10 미완료)은 W#1 위임 draft 작성으로 해소.

## TEST 결과

review fix(`9a1c9f0`) 반영 후 TEST WORKFLOW 전 단계 재수행 — 1단계부터:

- **lint**: 통과 (`stage=lint status=PASS`)
- **unit**: 통과 (`stage=unit status=PASS`, 5502 tests)
- **build**: 통과 (`stage=build status=PASS`)
- **e2e**: 통과 — backend 256/256 + **playwright 51/51**(신규 5건 포함, 강화된 404 렌더 assertion 통과).

> **e2e 는 `make e2e-test-full` 로 수행.** 표준 wrapper(`.claude/tools/run-test.sh e2e` → `cmd_e2e()` → `make e2e-test`)는 **backend e2e runner 만** 실행하고 playwright 를 건너뛴다(`Makefile:58` vs `:73`). 본 변경은 순수 frontend 라우팅이라 playwright 가 본질적 검증 계층이며, 유닛은 `useParams` 를 mock 하므로 실제 Next 라우트 매칭·클라이언트 `notFound()` 실동작을 원리적으로 증명할 수 없다. 이 wrapper 사각지대 자체는 본 PR 범위 밖이라 사용자에게 보고하고 별도 task(`task_7072eb4a`)로 이관했다.

## 보류·후속 항목

| 항목 | 이관처 | 사유 |
| --- | --- | --- |
| W#1 spec 본문 반영 (`_layout.md` §2.2 각주 · `9-user-profile.md` §3) | `plan/in-progress/spec-update-catch-all-terminal-contract.md` → project-planner | developer 는 `spec/` 쓰기 불가 (CLAUDE.md §Skill 체계). draft 에 반영 문안까지 작성 완료 |
| W#4 sidebar 테스트 mock 공유 헬퍼 추출 | 후속 task | 기존 무관 파일 수정 필요 → W#2(범위 오염)와 상충 |
| TEST WORKFLOW e2e 단계가 playwright 미실행 | `task_7072eb4a` (사용자 보고 완료) | `.claude/test-stages.sh` / Makefile 인프라 판단 — 본 PR 범위 밖. 프론트 전용 변경이 브라우저 검증 없이 통과하는 사각지대 |
