# 변경 범위(Scope) 리뷰 — patch-omit-undefined (2R, 병합 후 전체 diff)

대상: `origin/main...HEAD` 33개 파일 (`git diff --stat origin/main...HEAD` 로 프롬프트의 33개 파일과 정확히 일치 확인). 1라운드
scope 리뷰(`review/code/2026/09/27/13_50_41/scope.md`)가 이미 검토한 핵심 fix(3개 서비스에 `omitUndefined` 배선)에 더해, 그
리뷰가 지적한 Critical/Warning 을 처리한 후속 커밋(`edd79ca40`·`e16a35beb`·`a4f57aeb0`·`1a9d9b414`)까지 포함된 최종 상태를 본다.

## 발견사항

- **[INFO]** 노드 PATCH 가 표제 결함 클래스와 다른 결함(정보 과다노출)도 같은 작업에서 고침 — 1라운드에서 이미 WARNING 으로 지적·격리·처분 완료, 재차단 사유 아님
  - 위치: `codebase/backend/src/modules/nodes/nodes.service.ts` 함수 `NodesService.update()` (반환 타입 `Promise<Omit<Node, 'workflow'>>` 변경 지점, `const { workflow: _workflow, ...response } = saved;` 신설 지점)
  - 상세: 1라운드 scope 리뷰(`review/code/2026/09/27/13_50_41/scope.md`)가 이미 "별개 결함이 같은 작업에 번들됨"으로 WARNING 을 냈고, `review/code/2026/09/27/13_50_41/RESOLUTION.md` SUMMARY #2 가 "같은 라우트의 계약 대조가 드러낸 결함이라 별도 커밋(`814a99605`)·단위·뮤턴트(N1)·plan 절로 격리해 이 PR 에서 닫았다. 코드 조치 없음"으로 명시적으로 처분했다. 이번 라운드에서 재확인한 결과 그 격리(별도 커밋·별도 테스트·plan `## 첫 TEST WORKFLOW 가 드러낸 것` 절의 발견 경위 기록)는 여전히 유효하고, 후속 커밋 4개(`edd79ca40` 등) 중 이 경계를 다시 허무는 변경은 없다. 이미 처분된 항목을 다시 차단 사유로 올리는 것은 오탐이므로 INFO 로 하향한다.
  - 제안: 조치 불요 — 처분 유지.

- **[INFO]** 1라운드 Critical(설정 null 회귀) 수정 커밋(`edd79ca40`)이 표제 스코프(설정 병합 가드)에 정확히 국한됨
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` (게이트 255~262, `if (settings != null) { … }` 가드)
  - 상세: `git show --stat edd79ca40` 로 대조한 결과 변경 파일은 `omit-undefined.ts`(JSDoc 보강 3줄) · `workflows.service.spec.ts`(회귀 케이스 2건) · `workflows.service.ts`(가드 한 줄) · `patch-partial-body.e2e-spec.ts`(e2e B 확장) 넷뿐이다. 1라운드 requirement 리뷰어가 지적한 정확히 그 지점(`settings !== undefined` → `settings != null`)만 고쳤고, 다른 두 호출부(`nodes`/`auth-configs`)나 무관 파일은 건드리지 않았다 — 자기 회귀를 스코프 안에서 정정한 모범적 케이스.
  - 제안: 조치 불요.

- **[INFO]** 후속 docs/test 커밋(`e16a35beb`·`a4f57aeb0`·`1a9d9b414`) 모두 각자의 단일 목적에 국한
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.spec.ts`(캐스트 제거 1줄), `plan/in-progress/patch-omit-undefined.md`(1R 처분 기록), `review/code/2026/09/27/13_50_41/*`(SUMMARY·RESOLUTION 등 12개 신규 파일)
  - 상세: `e16a35beb` 는 `nullable-type-lie-cast` lint 가드가 잡은 불필요한 캐스트 한 줄만 제거했다(`git show` 로 diff 1줄 확인). `a4f57aeb0`·`1a9d9b414` 는 plan/리뷰 문서만 추가하고 코드 변경이 없다. 세 커밋 모두 커밋 메시지가 근거(가드 이름·리뷰 세션 경로)를 명시해 드라이브바이 정리가 아님이 확인된다.
  - 제안: 조치 불요.

- **[INFO]** `review/code/2026/09/27/13_50_41/**` (12개 파일) · `review/consistency/2026/09/27/13_11_33/**` (8개 파일) 전량이 diff 에 포함 — 스코프 이탈 아님, 프로젝트 필수 절차 산출물
  - 위치: 파일 14~33 (프롬프트 목록 기준)
  - 상세: 이 저장소 규약상 `review/` 는 gitignore 대상이 아니며 `/ai-review`·`--impl-prep` 실행 결과는 커밋되는 것이 정상 절차다(CLAUDE.md "코드 리뷰 산출물" 표, 1라운드 scope 리뷰도 같은 판단을 `review/consistency` 산출물에 이미 적용). 이번 diff 가 이 20개 파일을 새로 추가한 것은 "지금 이 diff 를 만든 리뷰·컨시스턴시 체크 자체의 증거"이지 무관한 영역 수정이 아니다. 문서 내용을 표본 대조해도(`api_contract.md`·`security.md`·`requirement.md` 등) 모두 이번 patch-omit-undefined 작업 자체를 다루며 다른 무관 주제가 섞여 있지 않다.
  - 제안: 조치 불요.

- **[INFO]** 트래커(`spec-draft-nullable-notation-followups.md`)에 이 PR 과 무관한 새 백로그 항목 추가 — 명시적으로 라벨링되어 오귀속 위험 없음
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (Schedule 타임존 fallback drift 항목, 새 최상위 체크박스)
  - 상세: `--impl-prep` consistency-check(cross_spec W1)가 발견한, 이 PR 의 코드와 무관한 기존 spec drift(`1-data-model.md` vs `3-schedule.md` 타임존 기본값 불일치)를 항목 제목에 "그 PR 과 무관한 기존 drift" 라고 못박아 planner 백로그로 등재했다. 코드 변경 없이 발견 사실만 기록한 것이라 이 PR 자체의 스코프에는 영향이 없다.
  - 제안: 조치 불요.

- **[INFO]** `omit-undefined.ts` 타입 제약(`NotArray<T>`) 추가·`folders.service.spec.ts` 주석 정정 — 1라운드에서 이미 "비차단 손질(plan 예고)"로 판정, 이번 라운드 재확인 결과 동일 결론
  - 위치: `codebase/backend/src/common/utils/omit-undefined.ts` (게이트 6, 21~23) · `codebase/backend/src/modules/folders/folders.service.spec.ts` (게이트 116)
  - 상세: 두 변경 모두 `plan/in-progress/patch-omit-undefined.md` §방향 4 항목 (8)·(11)에 사전 예고돼 있고, 전용 테스트(`@ts-expect-error` 캐너리)·뮤턴트(T1)로 회귀 보호까지 갖춰 기능 확장이 아니라 계약 강화·주석 정확도 개선이다.
  - 제안: 조치 불요.

## 요약

핵심 fix(workflows·nodes·auth-configs 세 서비스에 `omitUndefined` 배선)는 원 요청 범위와 정확히 일치하고, 1라운드 리뷰가 이미 지적한 Critical(`settings: null` 500 회귀)·Warning(노드 응답 `workflow` 제거의 별개 결함 번들)에 대한 후속 커밋은 각각 자신이 고치는 문제에만 국한되어 새로운 스코프 이탈을 만들지 않았다. `omit-undefined.ts` 타입 제약·`folders.service.spec.ts` 주석 정정 등 소폭 곁가지 손질은 모두 plan 문서가 사전에 예고·근거를 남긴 항목이고, 대량으로 포함된 `review/code`·`review/consistency` 산출물은 이 저장소가 요구하는 필수 워크플로(리뷰·컨시스턴시 체크) 자체의 증거 파일이라 스코프 이탈로 볼 수 없다. 트래커에 추가된 무관 백로그 항목(Schedule 타임존 drift)도 "이 PR 과 무관"이라고 스스로 명시해 오귀속 위험이 없다. 포맷팅 전용 변경·미사용 임포트·설정 파일 변경·불필요한 주석 삭제 등 전형적 스코프 이탈 패턴은 이번 라운드에서도 발견되지 않았다. CRITICAL/WARNING 급 신규 스코프 문제는 없다.

## 위험도

LOW
