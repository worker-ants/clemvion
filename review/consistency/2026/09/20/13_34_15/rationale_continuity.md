# Rationale 연속성 검토 — spec/2-navigation (impl-done)

## 검토 개요

- diff base: `origin/main`
- scope: `spec/2-navigation/` (spec 델타 0개 파일 — 코드 전용 PR, 정상)
- 구현 diff: `codebase/backend/test/schedule-trigger.e2e-spec.ts` 1개 파일(테스트 D "PATCH cron → nextRunAt 재계산"의 비교 로직 교체 + JSDoc 주석 추가)
- 관련 plan: `plan/in-progress/schedule-cron-flake.md` (`spec_impact: none`)
- 관련 트래커 항목: `plan/in-progress/spec-draft-nullable-notation-followups.md` (cron 재계산 happy-path 결정적 단위 테스트 잔여, 신규 등재)

diff 는 실제로 워킹트리에서 `git diff origin/main -- codebase/backend/test/schedule-trigger.e2e-spec.ts` 로 직접 확인했다 (prompt 번들이 컨텍스트 예산으로 diff 본문을 잘랐기 때문). 변경 내용: 스케줄 생성 cron 을 `0 10 * * *` → `0 0 1 1 *` 로, PATCH 후 재계산 판정을 `not.toBe(originalNext)` (옛 값과의 차이 비교) → "요청 시각 기준 1분 안 + 초 자리 0" (새 cron 이 만드는 값인가) 로 교체했다. 순수 e2e 어서션 변경이며 `schedules.service.ts` 등 서비스 코드는 건드리지 않는다.

## 발견사항

없음 — 아래 관점 4개 모두 위반을 찾지 못했다.

1. **기각된 대안의 재도입**: 없음. 오히려 diff 는 과거 2차 리뷰(`review/code/2026/09/20/12_17_18` W1)에서 기각된 대안("옛 값과 비교하지 않고 생성 cron 값이 창 밖임을 단언")을 **다시 채택하지 않고** 최종 형태(새 cron 기준 창 판정)만 남겼다. plan 파일이 `~~생성 cron 의 값은 그 창 밖임을 함께 단언한다~~ — 폐기` 로 취소선 처리해 이력을 보존한다.
2. **합의된 원칙 위반**: 없음. `spec/data-flow/10-triggers.md §3.2` ("`next_run_at` 은 UI 표시용 정보성 컬럼, cron 생성/수정 시 `computeNextRuns` 로 재계산")·`spec/2-navigation/3-schedule.md §4` (PATCH 재계산 계약) 모두 이 diff 가 검증하는 동작과 일치하며, 새 어서션이 이 계약을 더 정밀하게 고정할 뿐 계약 자체를 바꾸지 않는다.
3. **결정의 무근거 번복**: 없음. 이 diff 자체가 결정 번복(비교 방식 교체)이지만, 새 Rationale 없이 이뤄진 것이 아니라 (a) 테스트 파일 내 JSDoc 주석에 왜 옛 비교가 거짓 실패를 냈는지·왜 새 비교로 바꿨는지·남는 잔여가 무엇인지 상세히 기록했고, (b) `plan/in-progress/schedule-cron-flake.md` 가 동일 결정 과정을 실제 리뷰 라운드 ID(`09_35_16`, `11_54_10`, `12_17_18`)를 인용해 재구성 가능한 이력으로 남겼다. `spec_impact: none` 은 순수 테스트 픽스이므로 타당하다 (behavior 변경 없음).
4. **암묵적 가정 충돌**: 없음. `spec/2-navigation/2-trigger-list.md` R-17 ("이 축의 캐너리가 고정하는 것은 구현이지 계약이 아니다")·`3-schedule.md §4` 註의 "e2e 가 네 응답 형태를 양성 3 + 생성 음성 대조 1 로 고정한다" 는 이 diff 가 건드리지 않는 별도 어서션(`assertMatchesContract`/`expectNarrowedScheduleTriggerRef`)을 가리키며, 손대지 않았다. `spec/1-data-model.md` 의 `(workspace_id, next_run_at)` 인덱스 Rationale 도 무관(DB 성능 결정, 이 diff 는 값 계산 로직을 바꾸지 않음).

## 참고 — 정보성 관찰 (비차단)

- diff 주석과 plan 이 명시하는 잔여 "반대 방향 좁은 창"(연말 ~2분, 재계산 없이도 통과하는 거짓 통과 가능성)은 은폐되지 않고 `spec-draft-nullable-notation-followups.md` 에 별도 항목으로 등재되어 있다 — Rationale 연속성 관점에서 바람직한 처리(추후 결정적 단위 테스트로 닫을 계획을 남김)이며 추가 조치 불필요.

## 요약

이번 diff 는 `spec/2-navigation` 영역의 어떤 spec 파일도 바꾸지 않았고(정상 — 코드 전용 PR), 유일한 구현 변경은 스케줄 cron 재계산을 검증하는 e2e 어서션 1건의 판정 로직 교체다. 과거 리뷰 라운드에서 기각된 대안(옛 값 비교의 두 변형)을 다시 들여오지 않았고, 오히려 그 기각 이력을 코드 주석과 plan 문서 양쪽에 실제 리뷰 세션 ID를 인용해 정확히 남겼다. `spec/data-flow/10-triggers.md §3.2`·`spec/2-navigation/3-schedule.md` 의 next_run_at 재계산 계약, `2-trigger-list.md` R-17 의 "캐너리=구현 고정" 원칙 모두 이 변경과 충돌하지 않는다. 결정 번복에 새 근거를 동반하지 않은 사례, 기각된 대안의 무단 재도입, 합의 원칙 위반, 암묵적 invariant 우회 — 4개 관점 어디에서도 CRITICAL/WARNING 대상을 찾지 못했다.

## 위험도

NONE
