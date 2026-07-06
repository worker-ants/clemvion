# Plan 정합성 검토 — schedule 갭 plan 완료 이동 + FE-3 후속

- 대상 커밋: c75077ec5 (`feat(triggers): 스케줄→트리거 딥링크 소비(?triggerId=) + schedule spec 승격`)
- Diff 기준: `git diff origin/main...HEAD`
- 대상 plan: `plan/complete/spec-sync-schedule-gaps.md` (본 PR 로 `plan/in-progress/` 에서 이동)

## 발견사항

- **[INFO] "역방향 inbound 소비 범위 밖" follow-up이 in-progress plan 항목으로 등록되지 않음**
  - target 위치: `plan/complete/spec-sync-schedule-gaps.md` §"잔여" 마지막 줄 — "참고: 역방향(`/schedules?triggerId=` — triggers→schedule 링크)의 inbound 소비는 별도 잠재 갭으로 남음(본 PR 범위 밖)."
  - 관련 plan: 없음 (신규 in-progress 파일 미생성 — `git diff origin/main...HEAD --name-only` 확인 결과 이번 PR 이 건드린 `plan/` 항목은 `plan/complete/spec-sync-schedule-gaps.md` 하나뿐)
  - 상세: `/triggers?triggerId=` (스케줄→트리거) 는 이번 PR 로 inbound 소비가 구현됐다(`triggers/page.tsx` `useSearchParams().get("triggerId")` 초기 selection). 그러나 대칭 경로인 `/schedules?triggerId=` (트리거→스케줄, `2-trigger-list.md` §2.1 "스케줄 관리에서 편집" 딥링크, `triggers/page.tsx:782`)는 `schedules/page.tsx` 에 inbound 소비 로직이 없음을 코드로 확인(`grep triggerId schedules/page.tsx` — outbound 링크만 존재). 이 갭은 완료로 이동한 plan 문서 안에 텍스트 각주로만 남아, plan 파일이 `complete/` 로 이동한 뒤에는 in-progress 백로그 검색(`ls plan/in-progress/`)으로 발견되지 않는다. 완료 plan 은 향후 재조회 우선순위가 낮아 후속 누락 위험.
  - 제안: 경미한 후속이므로 CRITICAL/WARNING 은 아니나, 추적성을 위해 별도 `plan/in-progress/` 항목(예: 기존 dangling-갭 종류 백로그에 1줄) 등록을 권장. 지금 당장 막을 사안은 아님.

- **[INFO] spec 본문이 inbound 소비의 비대칭을 명시하지 않음**
  - target 위치: `spec/2-navigation/3-schedule.md` §2.1 (line 61, "트리거에서 보기" 항목), `spec/2-navigation/2-trigger-list.md` §2.1 (line 61, "스케줄 관리에서 편집" 항목)
  - 관련 plan: `plan/complete/spec-sync-schedule-gaps.md` §"잔여" 각주
  - 상세: 두 spec 문서 모두 "→ `/schedules?triggerId=…` 딥링크" / "→ `/triggers?triggerId=…` 딥링크"라고만 서술하고 도착측 소비 동작(자동 오픈 여부)을 명시하지 않는다. `2-trigger-list.md` §2.3 은 이번 PR 로 inbound 소비를 명확히 서술했지만(line 72), `3-schedule.md` 쪽에는 대응 서술이 없어 "스케줄 화면도 대칭적으로 동작하려니" 오인될 여지가 있다. 코드와 직접 모순되는 CRITICAL 은 아니다(모호성 정도) — 다만 향후 이 후속을 처리할 때 spec 갱신 지점을 찾기 쉽게 하려면 `3-schedule.md` 쪽에도 "미소비(Planned)" 한 줄을 남기는 편이 낫다.
  - 제안: 우선순위 낮음. 후속 PR 착수 시 함께 정리 가능.

## 확인된 정합 사항 (문제 없음)

- §2.1 메뉴/링크(더보기 ⋮, 트리거에서 보기, 워크플로 에디터 링크), §2.2 timezone UI(#827), §4 sort/order 는 모두 실제 코드 존재 확인 완료:
  - `schedules/page.tsx`: `DropdownMenu` + `TriggerHistoryDialog` + `/triggers?triggerId=` Link + `/workflows/{id}` Link 전부 존재.
  - `schedules.service.ts` whitelist 기반 `orderBy` — 별도 plan(`spec-sync-structural-followups.md` C-10)에도 "✅ FIXED (this PR)" 로 이미 별건 완료 마킹돼 있어 이중 확인됨(같은 갭을 두 plan 이 독립 추적하다 둘 다 해소, 모순 아님).
  - 워크스페이스 timezone 카드 — `workspaces.ts` getSettings/updateSettings 타입에 `timezone` 필드 존재(diff 로 직접 확인은 아니나 plan 서술과 #827 커밋 이력 일치).
- 이번 PR 의 spec 승격(`status: partial → implemented`, `pending_plans` 제거)은 실제 코드(위 항목 전부 구현 확인)와 정합 — 미완 항목을 완료로 오표기한 흔적 없음.
- `/triggers` 의 inbound `?triggerId=` 소비 구현이 `triggers/page.tsx` 에 실재(`useSearchParams` 도입, `selectedTriggerId` 초기값 lazy init) + 대응 spec(`2-trigger-list.md` §2.3) 갱신 정합.
- 다른 in-progress plan 이 `3-schedule.md` 의 `partial`/`Planned` 상태를 전제로 삼는 항목은 없음 — `plan/in-progress/spec-sync-structural-followups.md` C-10 이 유일하게 구 상태(`spec-sync-schedule-gaps.md` 라인 17, "미구현/Planned")를 근거로 인용하지만 해당 항목 자체가 이미 "✅ FIXED" 로 표기돼 있어 이번 승격으로 깨지는 전제가 아니다(오래된 인용문 텍스트만 stale, 실질적 결론 영향 없음).
- `plan/complete/trigger-schedule-reverse-sync.md`, `plan/complete/spec-update-trigger-schedule-sync.md` 등 과거 완료 plan 들과도 충돌 없음(역방향 `is_active` 동기화·cascade 삭제는 이번 PR 범위와 무관한 별개 축).

## 요약

이번 PR 은 schedule 갭 plan(`spec-sync-schedule-gaps.md`)의 모든 체크리스트 항목(§2.1 메뉴/링크, §2.2 timezone UI, §4 sort/order)이 실제로 구현 완료된 상태에서 spec 승격(`partial → implemented`)과 plan 이동(`in-progress → complete`)을 수행했으며, 완료로 오표기된 항목은 발견되지 않았다. 유일한 잔여 이슈는 plan 이 스스로 "범위 밖"으로 명시한 역방향(`/schedules?triggerId=`) inbound 미소비가 완료 plan 안의 각주로만 남아 별도 in-progress 추적 항목화되지 않은 점이며, 이는 결정 충돌이 아니라 추적성 저하 수준의 INFO 다. 다른 in-progress plan 이 이번 승격으로 깨지는 전제를 갖고 있지도 않다(유일한 인용처는 이미 자체적으로 완료 마킹됨).

## 위험도

NONE
