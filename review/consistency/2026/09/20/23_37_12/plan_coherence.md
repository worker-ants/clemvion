# Plan 정합성 검토 — spec/2-navigation (--impl-prep)

## 발견사항

- **[WARNING]** `IntegrationsService.remove()` 중복 감사 결함의 후속 등재가 plan 체크리스트에 없다 — 봉인 시 유실 위험
  - target 위치: `spec/2-navigation/4-integration.md` (Integration 삭제 API 계약 영역 — 본문은 이번 번들에서 컨텍스트 예산으로 생략됐으나 grep 으로 직접 확인)
  - 관련 plan: `plan/in-progress/schedule-dup-delete.md` (본문 25~30행) · `plan/in-progress/spec-draft-nullable-notation-followups.md` (트래커, 전수 grep)
  - 상세: `schedule-dup-delete.md` 는 서두에서 동일 결함 클래스의 다섯 번째 자리로 `IntegrationsService.remove()`(`INTEGRATION_DELETED`)를 지목하며 "이 PR 에 끼우지 않고 **트래커에 등재한다**" 고 명시한다. 그러나 (1) `spec-draft-nullable-notation-followups.md` 전체(5177줄)를 `IntegrationsService.remove\|INTEGRATION_DELETED` 로 grep 하면 **0건** — 아직 등재되지 않았다. (2) `spec/2-navigation/4-integration.md` 자체에도 삭제 동시성·감사 중복에 관한 서술이 없다(§ 386, § 778 은 DELETE 엔드포인트를 언급할 뿐). (3) `schedule-dup-delete.md` 의 `## 체크리스트` 7개 항목 중 "트래커에 등재" 를 실행하는 항목이 없다 — "트래커 항목 해소" 체크박스는 *이 plan 자신의* 트래커 항목(`SCHEDULE_DELETED`)을 닫는 것만 가리킨다. **이 프로젝트가 스스로 문서화한 실패 패턴과 정확히 같은 모양이다**: 같은 트래커 4456~4460·4486~4489행이 "조건부·후속 처분은 봉인되는 `complete/` 말고 살아 있는 트래커에 적는다" 는 교훈을 남긴 것은, 선행 plan(`trigger-config-lost-update.md`)이 후속 항목을 본문에만 적고 트래커에 옮기지 않은 채 `complete/` 로 봉인되어 근거가 묻혔기 때문이다. `schedule-dup-delete.md` 도 동일하게 "트래커에 등재한다" 는 **의도**만 prose 로 남기고 실행을 체크리스트 밖에 두면, `complete/` 이동 시 같은 방식으로 유실될 수 있다 — 이미 이 결함 클래스에서만 "마지막이라고 적을 때마다 리뷰가 남은 자리를 찾아냈다" 는 패턴이 3회 반복됐다(plan 서두 자백).
  - 제안: `plan/in-progress/schedule-dup-delete.md` 체크리스트에 "`spec-draft-nullable-notation-followups.md` 에 `IntegrationsService.remove()` 항목 등재" 를 **명시적 체크박스**로 추가하거나, 이번 검토를 계기로 **지금 바로** 그 트래커 항목을 등재해 prose 약속을 실물로 바꿀 것. `plan/complete/` 이동 전에 반드시 실행돼야 한다.

- **[WARNING]** 3-schedule.md 가 "동시 삭제 → 두 번째 404" 문서화 격차 tracker 항목의 스코프에서 빠져 있다
  - target 위치: `spec/2-navigation/3-schedule.md` §4 API (`DELETE /api/schedules/:id` 행 — 현재 아무 동시성 서술 없음, 전수 grep 확인)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4785` (열린 `[ ]` planner 항목)
  - 상세: 트래커 4785행은 "`1-workflow-list.md §2.6` · `data-flow/12-workspace.md §1.10` 에 «동시 삭제 → 두 번째 404» 서술이 없다" 고 열어 둔 채(`--impl-prep` 세 라운드 연속 비차단으로 이월) planner 몫으로 남겨 뒀다. 그런데 이 항목의 스코프는 workflow·workspace 두 문서만 열거하고 **`3-schedule.md` 는 포함하지 않는다**. `schedule-dup-delete.md` 가 의도한 대로 `SchedulesService.remove()` 를 고치면 스케줄 삭제도 동일하게 "패자 쪽 두 번째 요청 = 404" 계약을 갖게 되는데, `3-schedule.md` 는 (2-trigger-list.md §4.4 와 달리) 이 계약을 어디에도 적지 않는다. 이미 트리거·워크플로 두 자리에서 "이번이 마지막" 이라 적을 때마다 리뷰가 빠진 자리를 찾아낸 전력이 있고, 이 문서화 격차 항목 자체도 그 패턴의 연장선(트리거만 문서화돼 있던 비대칭)이므로, 스케줄이 세 번째로 누락되는 것은 같은 결함의 반복이 될 것이다.
  - 제안: `schedule-dup-delete.md` 를 닫을 때(또는 이번 세션 안에) 트래커 4785행의 스코프 목록에 `3-schedule.md §4` 를 추가해, 다음에 이 planner 항목이 처리될 때 스케줄 축이 빠지지 않게 할 것.

## 요약

이번 세션이 착수하려는 `schedule-dup-delete.md`(spec_impact: none) 자체는 트래커(`spec-draft-nullable-notation-followups.md:4773`)가 명시적으로 요구한 선행 실측("스케줄 자신을 위한 새 lock key 가 필요한지부터 확인")을 §B 에서 실제로 수행했고, 판정 기준(트리거 삭제의 `affected` 를 보는 것이지 스케줄 행의 `affected` 가 아니다)도 CASCADE 함정을 정확히 짚어 트래커의 요구와 정합한다. 또한 "공용 헬퍼 추출은 트래커의 «네 자리 공용 형태» 설계 항목이 받는다" 는 위임도 실재하는 열린 항목(4501행)을 정확히 가리켜 근거가 있다. target(`spec/2-navigation`) 의 기존 서술과 직접 충돌하는 미해결 결정은 발견되지 않았다 — 구현 착수를 막을 CRITICAL 사유는 없다. 다만 이 plan 자신이 만들어 낸 두 개의 후속 약속(IntegrationsService 트래커 등재, 스케줄 문서화 격차 반영)이 실행 메커니즘(체크리스트·트래커 스코프) 없이 prose 로만 존재해, 이 결함 클래스에서 이미 세 번 반복된 "후속 항목 유실" 패턴이 네 번째로 재발할 위험이 있다.

## 위험도
MEDIUM
