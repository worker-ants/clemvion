# Plan 정합성 검토 — spec/2-navigation/ (impl-prep, folder-depth-cycle-guard)

## 검토 배경

target 스코프(`spec/2-navigation/`)와 worktree 이름(`folder-depth-cycle-guard`)을 대조한 결과, 이번 구현 착수는 `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 의 **V-04 [major] 폴더 깊이·cycle 검증 (update 경로)** 항목을 해소하려는 작업으로 판단된다. 현재 코드(`codebase/backend/src/modules/folders/folders.service.ts`)를 확인한 결과 plan 이 기술한 갭이 그대로 남아 있다: `create()` 에는 `getDepth` 기반 깊이 검사가 있으나 `update()` 는 `parentId` 를 깊이·cycle·workspace 검증 없이 `Object.assign` 저장하고, `getDepth` 자체도 방문 집합/상한 가드가 없어 cycle 발생 시 무한루프 위험이 있다.

## 발견사항

- **[INFO]** target 구현은 미해결 plan 항목(V-04)의 두 옵션 중 하나를 실행하는 것 — 결정이 이미 "권장" 형태로 문서화되어 있으나 formal 채택(사용자 확정)은 plan 상 "결정 대기"로 남아 있음
  - target 위치: `spec/2-navigation/1-workflow-list.md` §3.1 (폴더 관리 API) — "엔티티·제약 ... 최대 중첩 깊이 5 의 SoT 는 데이터 모델 §2.5 Folder"라고 참조만 하고 있어 이 spec 문서 자체에는 update 경로 검증 규칙이 서술되어 있지 않음
  - 관련 plan: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` §"결정 옵션 (2026-06-13)" > V-04
  - 상세: plan 은 V-04 를 "major — 결정 대기" 항목으로 분류하고 "코드 구현"을 권장하지만, 다른 major 항목(V-05, V-09)과 마찬가지로 **사용자의 명시적 채택 커밋은 아직 plan 파일에 체크되어 있지 않다**(`[x]` 표시 없음 — V-01/V-02/V-03/V-06/V-07/V-08/V-11/V-15/V-16/V-17/V-19 는 체크되어 완료 처리된 반면 V-04/V-05/V-09~V-14/V-18 은 미체크). 즉 plan 문서만 보면 "권장안이지 최종 결정은 아님" 상태다. 이 자체가 CRITICAL 한 "충돌"은 아니다 — 권장안과 실제 구현 방향(코드 구현 = update() 에 깊이/cycle/workspace 검증 추가)이 일치하기 때문. 다만 구현 완료 후 plan 파일의 V-04 항목을 `[x]` 로 갱신하고 "코드 구현 채택" 근거를 남기지 않으면, 이 부분만 미체크 상태로 방치되어 추후 audit 재실행 시 "아직 미해결"로 재검출될 여지가 있다.
  - 제안: target 코드 변경과 함께 `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 의 V-04 항목에 `[x]` 처리 + 채택 근거(코드 구현, PR 번호)를 기록할 것. 다른 완료 항목(V-01/V-02/V-03 등)과 동일한 서술 패턴을 따르면 된다.

- **[INFO]** spec 본문에 update 경로 검증 규칙이 아직 명문화되어 있지 않음 — 구현 후 spec 동반 갱신 필요
  - target 위치: `spec/2-navigation/1-workflow-list.md` §3.1, `spec/1-data-model.md` §2.5 Folder "제약 조건"
  - 관련 plan: 동 V-04 항목 — "권장: 코드 구현...spec §2.5 가 SoT"
  - 상세: `spec/1-data-model.md §2.5` 는 "중첩 깊이 제한: 최대 5단계"라고만 되어 있어 create/update 어느 경로에 적용되는지 명시하지 않는다(모호하게 전체에 적용되는 것으로 읽힘). 코드가 update() 에도 깊이+cycle 검증을 추가하면 이 스펙 문장과 완전히 정합해지지만, 현재는 코드가 spec 의 암묵적 약속에 미달한 상태였다(이번 구현으로 해소됨). `spec/2-navigation/1-workflow-list.md §3.1` PATCH 관련 서술("폴더 수정 — 이름·부모·정렬 순서 부분 수정")도 update 시 깊이/cycle 검증이 적용된다는 사실을 명시하지 않는다.
  - 제안: 구현 완료 후 (a) `spec/2-navigation/1-workflow-list.md §3.1` 의 `PATCH /api/folders/:id` 행에 "부모 변경 시 깊이(≤5)·cycle(self/자손 금지)·workspace 일치 검증, 위반 시 400 VALIDATION_ERROR" 를 명시하고, (b) 필요하면 `spec/1-data-model.md §2.5` 제약 조건에 "생성·수정 양쪽에 적용"이라는 단서를 추가해 모호성을 제거할 것. 이 project 의 impl-prep 관례상 developer 는 spec 을 직접 못 고치므로(spec/ read-only), 이 갭은 구현 후 project-planner 위임이 필요하다는 점을 인지해야 함.

- **[INFO]** 다른 in-progress plan 과의 folders 모듈 경합 없음 확인
  - 상세: `plan/in-progress/**` 전체를 대상으로 `folders.service|FoldersService|folder.*depth` 를 검색한 결과 V-04 항목 외에 `folders` 모듈을 다루는 진행 중 plan 은 없다. `spec-sync-workflow-list-gaps.md` 는 폴더 "필터 UI"(frontend 잔여) 를 별도 후속 항목으로 추적 중이나 이는 서버 depth/cycle 검증과 무관한 독립 트랙이라 충돌하지 않는다.

## 요약

이번 구현(`folder-depth-cycle-guard`)은 `spec-code-cross-audit-2026-06-10.md` V-04 에서 이미 분석되고 "코드 구현" 권장까지 나온 항목을 실행하는 작업으로, 미해결 결정을 일방적으로 우회하는 것이 아니라 plan 이 제시한 권장 경로를 그대로 따르는 것으로 보인다. `spec/1-data-model.md §2.5` 의 "중첩 깊이 최대 5단계" 제약이 SoT 이며 현재 구현(update() 미검증)이 이 SoT 에 미달한 상태이므로, 코드 구현 방향은 spec 과 충돌하지 않는다. 다만 (1) plan 파일의 V-04 항목이 아직 `[x]` 로 체크되지 않아 구현 후 갱신이 누락되기 쉽고, (2) `spec/2-navigation/1-workflow-list.md §3.1` 과 `spec/1-data-model.md §2.5` 양쪽 모두 update 경로의 깊이/cycle 검증을 명문화하고 있지 않아 구현 후 spec 동기화(project-planner 위임)가 필요하다. 두 사항 모두 진행을 막을 정도는 아니며 후속 갱신으로 처리 가능한 수준이다.

## 위험도
LOW
