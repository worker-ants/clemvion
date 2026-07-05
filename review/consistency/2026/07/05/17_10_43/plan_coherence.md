# Plan 정합성 검토 결과

## 검토 범위
- 검토 모드: `--impl-done`, scope=`spec/2-navigation/`, diff-base=`origin/main`
- 실제 diff(`origin/main` 대비 누적, HEAD=`bef267c17`): V-05 리팩터(`page.tsx` 노드 서브탭을 에디터 `ResultDetail` 재사용으로 교체) + 이번 회차에 추가된 후속 커밋 `bef267c17`("ai-review CRITICAL 조치 — Input/startedAt 매핑 + dry-run 배지 복원"). 이번 회차 신규 변경분은 `toNodeResult()` 의 `inputData`/`startedAt` 매핑 추가, `ResultDetail` 의 `executionDryRun` prop 복원, 회귀 테스트 2건, CHANGELOG/mdx 갱신, 그리고 `review/code/2026/07/05/16_49_52/**` + `review/consistency/2026/07/05/16_49_52/**` (직전 회차 산출물). **`spec/` 파일 변경은 이번 회차도 0건.**
- 근거 plan: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` V-05(체크박스 `[x]`, 완료 기록 존재)
- 참고: 직전 회차 산출물 `review/consistency/2026/07/05/16_49_52/plan_coherence.md`(위험도 NONE) 및 같은 배치의 `review/code/2026/07/05/16_49_52/{requirement,cross_spec,maintainability}.md` + `RESOLUTION.md`를 함께 대조했다 — 이번 회차의 커밋(`bef267c17`)이 그 RESOLUTION 의 조치 항목을 실제로 이행했는지 확인하기 위함.

## 발견사항

### [WARNING] RESOLUTION #6 "후속 이관(planner)" 항목이 `plan/in-progress/` 어디에도 기록되지 않음
- target 위치: `spec/2-navigation/14-execution-history.md` §3.3 ("서브 탭(노드 레벨): Preview / Input / Output / LLM Usage(AI 노드에서만) / Config / Error")
- 관련 plan: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` (V-05 항목, §"결정 옵션" 섹션) — 또는 그 자매 파일 `plan/in-progress/spec-sync-structural-followups.md` §B ("cross-spec 정리, planner" 섹션, 유사 성격 항목이 이미 존재)
- 상세: 직전 회차 code-review(`review/code/2026/07/05/16_49_52/cross_spec.md`)가 WARNING 으로 지적한 내용은 다음과 같다 — `ResultDetail` 컴포넌트(이번 diff 로 변경되지 않은 기존 코드)는 실제로 `meta`/`port`/`status`/`references` 4종 탭을 조건부로 노출하는데, V-05 리팩터로 실행 상세 페이지(`14-execution-history.md` EH-DETAIL-03·§3.3)가 이 컴포넌트를 그대로 위임하면서 그 선재(pre-existing) spec-doc 갭(에디터 spec `3-execution.md §10.6.1` 에도 있던 갭)이 실행 내역 spec 에도 그대로 확산됐다. 이에 대해 `review/code/2026/07/05/16_49_52/RESOLUTION.md` #6 은 "**후속 이관(planner)** — spec-doc 완전성... project-planner 트랙"이라고 명시적으로 결론지었다. 그러나 이번 회차(`bef267c17`)의 diff·plan 문서 어디에도 이 항목이 새 plan 항목이나 기존 plan(`spec-code-cross-audit-2026-06-10.md`, `spec-sync-structural-followups.md §B`)의 체크리스트 추가로 기록되지 않았다 — RESOLUTION.md 자체는 review 산출물(리뷰 이력)일 뿐 `plan/in-progress/` 의 추적 대상이 아니므로, "이관하겠다"고 선언한 후속 조치가 실제로는 어느 plan 파일에도 착지하지 못한 상태다. 이 항목은 "target(spec) 이 코드 현실보다 좁게 서술돼 있다"는 순수 spec-doc 갭(cross_spec.md 원문 제안: `3-execution.md §10.6.1` 탭 표에 References/Meta/Port/Status 추가 + `14-execution-history.md` 를 그 SoT 참조로 축약)이라 CRITICAL 은 아니지만, 추적 누락 자체가 plan 정합성 문제다.
- 제안: `plan/in-progress/spec-sync-structural-followups.md §B`(cross-spec 정리, planner 섹션 — 이미 유사 항목 1건 보유)에 신규 체크박스로 "`14-execution-history.md §3.3` + `3-execution.md §10.6.1` References/Meta/Port/Status 탭 문서화 격차"를 추가하거나, `spec-code-cross-audit-2026-06-10.md` V-05 항목 하단에 "후속: spec-doc 완전성(§B 트랙)" 각주를 남겨 추적 가능하게 할 것. `developer` 스킬 규약(구현 중 spec 변경 필요 시 project-planner 위임)에 따라 실제 위임(항목 등록)이 이번 커밋에서 빠졌다.

### [INFO] RESOLUTION #1·#2·#3 (CRITICAL/WARNING 코드 결함)은 이번 커밋으로 정확히 조치·회귀 테스트로 잠금 확인
- target 위치: `spec/2-navigation/14-execution-history.md §3.3`(Input 탭 요구사항), `spec/5-system/13-replay-rerun.md §7.4/§9.2`(dry-run 배지)
- 관련 plan: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` V-05 (spec 변경 불요로 기 기록됨)
- 상세: `review/code/2026/07/05/16_49_52/requirement.md` CRITICAL ①②(`toNodeResult()` 의 `inputData`/`startedAt` 미매핑)와 WARNING(dry-run 배지 execution-level fallback 상실)은 이번 diff(`page.tsx`+9줄, `result-detail.tsx` `executionDryRun` prop 추가, 회귀 테스트 2건)로 정확히 해소됐다. 이 조치는 spec 문언을 바꾸지 않고 **코드를 spec(§3.3 Input 탭 명시, §9.2 노드 레벨 `_dryRun` 마커 판정)에 맞추는 방향**이라 "미해결 결정 우회"에 해당하지 않는다. plan(V-05) 이 이미 "spec 변경 불요"로 기록해 둔 전제와도 어긋나지 않는다.
- 제안: 없음 — 정합.

### [INFO] maintainability RESOLUTION #5·architecture #7 도 미기록이나 저위험 — 실질 추적 압박은 #6에 집중
- target 위치: 해당 없음(코드 구조 이슈)
- 관련 plan: 없음(신규 plan 부재)
- 상세: RESOLUTION #5(`useResultDetailProps` 류 공용 hook 추출)와 #7(`components/editor/run-results` 폴더 rename)도 "후속 이관"으로 명시됐으나 plan 미기록은 동일하다. 다만 이 둘은 순수 코드 구조 개선(스펙 문서 정합성과 무관, maintainability/architecture 레이어)이라 본 checker 의 1차 관점(미해결 결정 충돌·선행 plan 미해소·spec 대상 후속 항목 누락)에서 #6 보다 낮은 우선순위로 판단한다. 다만 셋 다 같은 RESOLUTION.md 에서 "별도 리팩터 plan 후보"라 선언된 채 어떤 plan 파일에도 등록되지 않은 공통 패턴이라, 한 번에 등록하는 편이 효율적이다.
- 제안: 위 WARNING 조치 시 §B 항목에 3건(spec-doc 완전성, hook 추출, 폴더 rename)을 함께 등록해도 무방.

### [INFO] `plan/in-progress/spec-code-cross-audit-2026-06-10.md` V-05 자체 서술은 이번 커밋과 정합
- target 위치: 해당 없음(plan 자체 점검)
- 관련 plan: 동일 파일 L36
- 상세: V-05 체크박스 서술("spec 변경 불요(EH-DETAIL-03·§3.3/§3.4 이미 ✅)")은 이번 회차 커밋에서도 유지되며 실제로 spec 변경이 없다. 커밋 메시지의 "후속 이관: store→props 공용 hook 추출(maintainability)·§3.3 탭 열거+Config viewer Rationale 노트(planner)·run-results 폴더 rename(저우선)" 서술은 RESOLUTION.md 내용을 그대로 요약한 것으로 커밋 메시지 자체는 정확하다 — 문제는 이 요약이 plan 파일로 승격되지 않았다는 점(위 WARNING과 동일 사안).
- 제안: 없음(위 WARNING 에 흡수).

## 요약
이번 회차(`bef267c17`)는 직전 `/ai-review`(16_49_52)가 지적한 CRITICAL 2건(Input 탭 placeholder·시작 시각 소실)과 WARNING 1건(dry-run 배지 execution-level fallback)을 코드 레벨에서 정확히 조치했고, 이는 spec 을 바꾸지 않고 기존 spec(§3.3, §9.2)에 코드를 맞추는 방향이라 plan 의 미해결 결정을 우회하지 않는다. 다만 같은 리뷰 배치가 `RESOLUTION.md`에 "project-planner 트랙"으로 명시한 spec-doc 완전성 항목(`ResultDetail` 이 실제 지원하는 References/Meta/Port/Status 탭이 `14-execution-history.md §3.3`·`3-execution.md §10.6.1` 어디에도 열거되지 않은 선재 갭, 이번 리팩터로 실행 내역 spec 쪽에도 확산)이 이번 커밋에서도 어떤 `plan/in-progress/` 파일에도 착지하지 못했다 — RESOLUTION.md 자체는 review 산출물일 뿐 plan 추적 대상이 아니므로, "이관"이 선언과 실제 등록 사이에서 누락된 상태다. CRITICAL 급 충돌은 아니지만(spec 대 코드 불일치가 새로 생긴 것이 아니라 기존 갭의 노출 범위 확대일 뿐), 후속 항목 누락 관점에서 WARNING 으로 기록한다.

## 위험도
MEDIUM
