# 정식 규약 준수 검토 — `pending-plan-is-plan` (impl-done)

## 검토 범위

이 PR 은 `spec/` 델타 0 개(코드 전용)다. 구현 diff 3개 파일 / 160줄:

- `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts` — 순수 술어 `isPendingPlanPath(relPath: unknown): boolean` + 모듈-local 상수 `PENDING_PLAN_DIRS` 신설
- `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.test.ts` — 위 술어 단위 테스트 8건
- `codebase/frontend/src/lib/docs/__tests__/spec-pending-plan-existence.test.ts` — 가드에 "plan 인가" 단언 추가 (기존 "실존하는가" 단언과 분리)

새 API endpoint·DTO·이벤트 페이로드·에러 코드·신규 spec 문서는 이 diff 에 없다. 따라서 점검 관점 2(출력 포맷)·4(API 문서/OpenAPI)는 해당 없음. 남는 관점은 1(명명)·3(문서 구조/SoT 인용 정합)·5(금지 항목)이며, 실질적으로는 이 변경이 `spec/conventions/spec-impl-evidence.md` 가 이미 선언한 계약(§2.1 `pending_plans` 행 · §4 가드 표)을 실제로 강제하도록 구현을 좁힌 것인지를 확인하는 작업이다.

## 발견사항

이 diff 자체가 정식 규약을 새로 위반하는 지점은 찾지 못했다. 아래는 등급을 매길 정도는 아니나 기록해 두는 INFO 관찰이다.

### [INFO] `PROJECT.md` L298 의 가드 설명이 새 동작을 반영하지 못함 (이 diff 이전부터 있던 간극, diff 가 넓힘)

- target 위치: PROJECT.md L298 — `spec-pending-plan-existence.test.ts` 행
- 위반 규약: 없음 (강제 규약이 아니라 설명 정확도 문제). 관련 SoT: `spec/conventions/spec-impl-evidence.md` §4 가드 표
- 상세: PROJECT.md 는 이 가드를 "spec frontmatter `pending_plans:` path 가 `plan/in-progress/` 실존 검증" 이라고만 적는다. 이 문구는 이 diff 이전에도 두 가지를 빠뜨리고 있었다 — (a) 가드는 `plan/in-progress/` 뿐 아니라 `plan/complete/` 도 본다(기존 로직), (b) 이번 diff 로 가드가 "실존" 단언 하나가 아니라 "plan 형태인가"(`isPendingPlanPath`) + "실존하는가" 두 단언으로 늘었다. (a)는 이 PR 과 무관한 선재 간극이라 이 PR 의 책임이 아니지만, (b)는 이 PR 이 만든 새 동작이라 간극이 한 단계 더 벌어졌다. `spec-impl-evidence.md` §4 표 자체는 관용적으로 짧은 요약행이라 위반은 아니고, PROJECT.md 쪽 서술만 더 상세하게 쓰다 보니 새로 벌어진 정도다.
- 제안: 강제 사항 아님. 다음에 이 표를 만질 때 "…`plan/in-progress/`·`plan/complete/` 아래 실재하는 plan(`isPendingPlanPath`)인지 검증" 정도로 한 구절만 보태면 실제 동작과 정합해진다. `--impl-done` 스코프가 `spec/`·`plan/`·`codebase/` 델타만 보므로 PROJECT.md(거버넌스 문서) 자체는 이 게이트 밖이라 지금 당장 고칠 의무는 없다.

### [INFO] `spec-impl-evidence.md` §4 표의 `spec-pending-plan-existence.test.ts` 행도 같은 이유로 요약이 얕아짐

- target 위치: `spec/conventions/spec-impl-evidence.md` §4 표 — `spec-pending-plan-existence.test.ts` 행 ("`pending_plans:` 의 모든 path 가 `plan/in-progress/` 또는 `plan/complete/`(in-progress→complete 치환) 에 실존")
- 위반 규약: 없음 — 오히려 이 문서 자체가 이 diff 의 SoT 이고, §2.1 `pending_plans` 필드 정의("plan 경로... 실존 의무")가 "plan 이어야 한다"는 요구를 이미 담고 있어 diff 의 새 동작(`isPendingPlanPath`)은 SoT 를 어긴 것이 아니라 SoT 를 늦게 따라잡은 것이다. diff 자체 주석도 "SoT: spec/conventions/spec-impl-evidence.md §2.1 (`pending_plans` row) 및 §4" 로 정확히 인용하고 있다(확인함 — 인용된 절·행이 실제로 존재).
- 상세: 다만 §4 표는 "실존" 이라는 한 단어로 요약돼 있어, 표만 읽으면 "형태(shape) 검증" 이 추가됐다는 사실이 드러나지 않는다. `spec/` 델타가 0(이 PR 은 spec 을 고치지 않는다)이므로 지금 이 표를 갱신할 의무는 없다 — §2.1 이 이미 "plan 경로" 라고 못박아 뒀으므로 이번 구현은 계약 확장이 아니라 계약 이행이다.
- 제안: 필요 시 별도 planner 턴에서 §4 표 해당 행에 "(및 그 path 가 `.md` 확장자를 가진 plan 위치인지 형태 검증)" 을 덧붙이는 정도. 이 PR 범위에서 강제하지 않는다.

## 확인했으나 위반이 아닌 것 (기록용)

- `isPendingPlanPath`/`PENDING_PLAN_DIRS` 명명은 같은 파일의 기존 술어 `isApplicable`·상수 `INCLUDE_PREFIXES`/`EXCLUDE_BASENAMES`/`CATALOG_FIELD_FILE` 패턴과 일치 — 새 명명 규약 위반 없음(식별자 충돌 자체는 `naming_collision.md` 가 별도로 확인).
- `PENDING_PLAN_DIRS = ["plan/in-progress/", "plan/complete/"]` 는 `spec-impl-evidence.md` §2.1 `pending_plans` 행이 명시한 두 위치와 정확히 일치.
- `plan/research/` 를 의도적으로 거짓 처리하는 근거(완료 종착점 없음)는 CLAUDE.md "정보 저장 위치" 표의 `plan/research/` 정의와 정합 — 새로운 정의를 만들지 않고 기존 governance 문서를 그대로 따름.
- 접두 검사 전 `path.posix.normalize` 로 `..` 탈출을 막는 처리는 새 명명·출력 포맷 규약과 무관한 순수 방어 로직이라 규약 위반 소지 없음.
- 새로 작성된 `plan/in-progress/pending-plan-is-plan.md` 의 frontmatter(`title`/`status`/`owner`/`worktree`/`spec_impact`/`started`)는 plan-frontmatter 가드가 요구하는 필드를 모두 갖췄고, `spec_impact: none` 은 Gate C 가 허용하는 bare sentinel 형태(리스트나 빈 배열이 아님)와 일치.
- CHANGELOG.md 에 이 변경에 대한 항목이 추가돼 있어 "CHANGELOG 항목은 수정의 일부" 관례를 지킴. 같은 커밋 계열에 별도 PR(#1387)의 CHANGELOG 누락 백필 항목도 함께 포함돼 있으나 이는 이 diff 의 규약 준수와는 별개 사안(정직하게 별 항목으로 분리돼 있음).
- 이 diff 는 `spec/` 을 전혀 건드리지 않았고, 그것이 옳다 — SoT 문서(`spec-impl-evidence.md`)의 계약이 이미 올바르게 서술돼 있었고 구현만 더 넓게 허용하던 버그였으므로, CLAUDE.md 의 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 규칙도, "자기-반증형 소정정" 예외도 적용될 필요가 없는 순수 `codebase/` 스코프 작업이다.
- 출력 포맷(API 응답/이벤트/에러코드) 규약, API 문서(OpenAPI/Swagger 데코레이터) 규약은 이 diff 의 표면과 무관 — 위반 대상 자체가 없음.

## 요약

이번 diff 는 `spec/conventions/spec-impl-evidence.md` 가 이미 선언한 `pending_plans` 계약(허용 위치 두 곳, plan 경로여야 함)을 실제 가드가 "디스크에 존재하기만 하면 통과"로 느슨하게 구현하고 있던 간극을 메우는 순수 코드 수정이다. 새 식별자 명명은 기존 파일 관례와 일치하고, spec/plan 델타는 0(정당함)이며, 신설된 plan 문서 frontmatter 도 Gate C·plan-frontmatter 요구 필드를 만족한다. API 응답 포맷·API 문서 데코레이터·audit 액션 명명 등 다른 conventions 표면은 이 diff 가 건드리지 않아 검토 대상이 아니다. CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았고, PROJECT.md/§4 표의 요약 문구가 새 "형태 검증" 단계를 아직 담지 못한 것은 이 PR 이전부터 있던 얕은 요약이 한 단계 더 벌어진 정도의 INFO 사안으로, 이 PR 을 막을 이유가 되지 않는다.

## 위험도

NONE
