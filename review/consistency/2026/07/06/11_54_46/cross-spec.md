# Cross-Spec 일관성 검토 — schedule spec 승격 + triggers 딥링크 명문화

- 대상 커밋: c75077ec5 (`git diff origin/main...HEAD`)
- 대상 문서: `spec/2-navigation/3-schedule.md`, `spec/2-navigation/2-trigger-list.md`
- 검토자: cross-spec-reviewer

## 발견사항

### [INFO] 딥링크 왕복 비대칭 — 의도적이나 서술 격차가 있어 재확인 권장
- target 위치: `spec/2-navigation/3-schedule.md` §2.1 (`더보기(⋮)` 안내문, "트리거에서 보기" 항목) / `spec/2-navigation/2-trigger-list.md` §2.3 (inbound `?triggerId=` 명문화)
- 충돌 대상: `spec/2-navigation/2-trigger-list.md` §2.1 (`더보기(⋮)` 4항목 드롭다운, "스케줄 관리에서 편집" → `/schedules?triggerId=…`) / §2.3.1 (`cronExpression`/`timezone` 행, "스케줄 관리에서 편집 링크 → Schedule 화면으로 이동")
- 상세: schedule → triggers 방향은 이번 diff 로 "①URL 딥링크 ②drawer 자동 오픈"까지 완전히 명문화되고 구현도 그에 맞춰 landing 시 drawer 를 자동 오픈한다 (`triggers/page.tsx` `useSearchParams().get("triggerId")`). 반면 triggers → schedules 방향(§2.1 "스케줄 관리에서 편집", §2.3.1)은 여전히 "Schedule 화면으로 이동"이라고만 서술되어 있고, `/schedules?triggerId=…` 를 실제로 소비(자동 선택/드로어 오픈 등)하는 서술이나 구현이 없다(`schedules/page.tsx` 에 `triggerId` 쿼리 소비 코드 없음 확인). 두 spec 문서 자체는 서로 모순되지 않는다 — trigger-list 쪽 서술 수준("이동"만)이 schedule 쪽 실제 미소비 상태와 정합적이기 때문이다. 다만 두 문서를 나란히 읽으면 "같은 `?triggerId=` 딥링크 패턴인데 한쪽만 상세 UI 를 자동으로 여는" 비대칭이 사용자에게 불명확할 수 있다.
- 근거: `plan/complete/spec-sync-schedule-gaps.md` §"잔여" 항목이 이 비대칭을 이미 인지하고 "역방향(`/schedules?triggerId=`)의 inbound 소비는 별도 잠재 갭으로 남음(본 PR 범위 밖)"이라고 명시적으로 스코프-아웃했다. 즉 계획된 후속 갭이며 이번 PR 의 결함이 아니다.
- 제안: 현재 상태로 CRITICAL/WARNING 은 아니다. 다만 `spec/2-navigation/2-trigger-list.md` §2.1 / §2.3.1 의 "스케줄 관리에서 편집" 문구 옆에 "(현재는 페이지 이동만, drawer/필드 자동 포커스는 미구현)" 같은 1줄 명시를 추가하면 두 방향의 비대칭이 문서만 보고도 명확해진다. 향후 후속 plan 으로 `/schedules` 도 inbound `triggerId` 를 소비(해당 행 하이라이트 또는 편집 다이얼로그 자동 오픈)하게 만들 경우 본 spec 쌍을 동시 갱신.

### [INFO] in-progress plan 이 이미 해소된 schedule sort/order 갭을 오픈으로 추적
- target 위치: 해당 없음 (target 문서 자체는 문제 없음 — 부수 발견)
- 충돌 대상: `plan/in-progress/spec-sync-structural-followups.md` L176-181 (C 항목, "spec/2-navigation/3-schedule.md §4 라인 126 (GET /api/schedules의 sort/order 미구현/Planned 명시)" 를 근거로 인용)
- 상세: `spec/2-navigation/3-schedule.md` 는 (이번 diff 이전인 2026-06-10 자 Rationale 기준) 이미 sort/order "미구현/Planned" 마커를 제거했고 `plan/complete/spec-sync-schedule-gaps.md` 에서도 해당 항목을 완료 처리했다. 그런데 `plan/in-progress/spec-sync-structural-followups.md` 는 여전히 같은 이슈를 열려 있는 작업 항목으로 인용하고 있어, plan 문서가 spec 의 현재 상태와 어긋난 채 stale 하다. 이번 diff 가 만든 문제는 아니지만(더 이전 시점부터의 불일치), schedule spec 을 정독하는 이번 검토 과정에서 발견됨.
- 제안: `spec/` 자체의 문제는 아니므로 이번 target 문서 수정 대상은 아니다. `plan/in-progress/spec-sync-structural-followups.md` 담당자(project-planner)가 해당 C 항목을 재검증해 필요시 이미-해소로 제거/갱신할 것을 권고(plan lifecycle 상의 별도 정리 항목).

## 요약

target 두 문서의 핵심 딥링크 계약(schedule §2.1 "트리거에서 보기" → `/triggers?triggerId=` ↔ trigger-list §2.3 inbound `?triggerId=` → drawer 자동 오픈)은 방향·경로·동작 서술이 서로 정확히 대응하며 모순이 없다. 반대 방향(triggers → `/schedules?triggerId=`)의 서술 수준이 낮아(단순 "이동"만) 비대칭이 존재하지만, 이는 spec 간 모순이 아니라 실제 구현 상태를 정확히 반영한 것이며 관련 plan 문서가 이미 "본 PR 범위 밖"으로 명시적으로 스코프-아웃한 알려진 잔여 갭이다. `3-schedule.md` frontmatter 의 `status: implemented` 승격과 Planned 마커 제거는 실제 코드 상태(⋮ 메뉴·워크플로 링크·timezone UI 전부 구현됨, PR #827)와 부합하며, 다른 spec(execution-history, data-flow/10-triggers, config 등)에서 schedule 을 "미구현"으로 잘못 참조하는 stale 링크는 발견되지 않았다. 부수적으로 발견한 in-progress plan 의 stale 추적 항목은 spec 자체 문제가 아니라 plan 위생 문제로 별도 트랙 권고 사항이다.

## 위험도

NONE — Critical 없음.
