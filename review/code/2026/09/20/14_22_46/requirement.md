# Requirement Review — sched-recalc-unit

## 발견사항

- **[WARNING]** 새 happy-path 테스트 둘이 재계산 게이트(`dto.cronExpression || dto.timezone`)의 **음(-) 방향**(둘 다 없을 때 재계산이 일어나지 않아야 한다)을 여전히 미검증 — 게이트를 무력화한 뮤턴트가 스위트 전체를 통과한다(실측)
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:440`, `:475` (신규 두 테스트) — 대상 프로덕션 코드는 `codebase/backend/src/modules/schedules/schedules.service.ts` `update()` 메서드의 `if (dto.cronExpression || dto.timezone) { ... }` 블록(268행 부근)
  - 상세: 이 plan(`plan/in-progress/sched-recalc-unit.md`)의 명시 목적은 "재계산 조건은 `dto.cronExpression || dto.timezone` 이라 **두 항이 각각 표면**" 이라는 인식 아래 cron-only·timezone-only 두 양(+) 케이스를 결정적으로 고정하는 것이다. plan 의 "테스트" 절이 나열한 뮤턴트 셋(재계산 블록 삭제, `||`→`cronExpression`, 갱신 전 값으로 호출)은 모두 "**있어야 할 재계산이 없어짐/틀림**" 방향만 다룬다. 반대 방향 — "**있으면 안 되는 재계산이 생김**"(게이트가 상시 참으로 무너짐, 예: `name`/`isActive` 만 바꿔도 재계산이 도는 회귀) — 은 이 파일의 어떤 테스트도 검증하지 않는다. 실측: 이 워크트리에서 `update()` 의 가드를 `if (true)`로 바꾼 뮤턴트로 `npx jest schedules.service.spec.ts`를 돌리면 **29개 전부 GREEN**(신규 2건 포함). `nextRunAt` 을 단언하는 테스트는 파일 전체에서 세 개뿐이고(cron-only, timezone-only, 방어분기) 셋 다 DTO 에 `cronExpression`/`timezone` 중 하나가 있는 경우만 다뤄, 게이트가 사라져도 값이 여전히 "정답"으로 계산돼 버려 걸리지 않는다. e2e (`schedule-trigger.e2e-spec.ts`)도 name/isActive PATCH 케이스(G·H)에서 `is_active` 동기화만 보고 `nextRunAt` 불변은 보지 않아, 이 방향은 unit·e2e 어디에도 커버리지가 없다.
  - 제안: `dto.cronExpression`·`dto.timezone` 둘 다 없는 PATCH(예: `{ name: 'x' }` 또는 `{ isActive: false }`)에서 `saved.nextRunAt`이 갱신 전 값(`schedule.nextRunAt`)과 동일하게 유지됨을 단언하는 대조군 테스트를 추가한다. 이 plan 이 이미 채택한 "두 항이 각각 표면" 원칙을 완결하려면 `||`의 두 피연산자뿐 아니라 "둘 다 거짓"인 세 번째 분기도 표면이어야 한다.

- **[INFO]** 리뷰 도중 일시 관측: 어느 시점에 `codebase/backend/src/modules/schedules/schedules.service.ts`가 미커밋 상태로 수정돼 있었다(`if (dto.cronExpression || dto.timezone)` → `if (true)`, 그 시점 status 상 `M`). 이 리뷰가 만든 변경이 아니며(관측 당시 이미 존재), 위 WARNING 실측에 **읽기 전용으로 그대로 활용**했을 뿐 손대지 않았다 — 병렬 fan-out 중이던 다른 세션의 뮤테이션 검증 산출물로 추정된다. 이후 재확인 시점에는 해당 파일의 수정이 사라져 있어(소유 세션이 자체 원복한 것으로 보임) 리포트 작성 시점 기준 저장소는 clean 하고 `*.bak` 등 잔여물도 없다.

- **[INFO]** spec fidelity — `spec/2-navigation/2-trigger-list.md §2.3.1`(`nextRunAt`: "스케줄 생성·수정 시 + 각 실행 완료 직후 재계산"), `spec/data-flow/10-triggers.md §1.4/§3.2`, `codebase/backend/src/modules/schedules/dto/update-schedule.dto.ts`의 필드 설명("변경 시 nextRunAt이 재계산됨")을 직접 대조한 결과, 신규 두 테스트가 고정하는 "cron 변경 → 새 cron·기존 timezone으로 재계산", "timezone 변경 → 기존 cron·새 timezone으로 재계산" 동작은 spec·DTO 문서와 line-level 로 일치한다. `computeNextRuns` 호출 인자 순서(`cronExpression, timezone, count`)·반환 배열의 첫 원소만 사용하는 방식도 기존 방어분기 테스트(384행)·`create()`(187행)와 동일 패턴이라 괴리 없음. 앞선 5개 consistency checker(cross_spec/rationale_continuity/convention_compliance/plan_coherence/naming_collision) 산출물도 동일 결론이며 인용된 절 번호(§2.3.1, §1.4, §3.2 등)를 직접 열어 확인했다 — 조작·환각 흔적 없음.

- **[INFO]** TODO/FIXME/HACK/XXX 주석 없음. 신규 테스트 두 건의 시그니처(`function scheduleRow(overrides: Partial<Schedule> = {})`)는 파일 내 유일 선언이며 이름 충돌 없음. `jest.spyOn`이 `afterEach`로 복원되지 않지만, 각 테스트가 `beforeEach`에서 새 `Test.createTestingModule` 인스턴스를 받으므로(기존 384행 방어분기 테스트도 동일 패턴) spy 누출 위험 없음 — 기존 관행과 일치하는 비-이슈.

- **[INFO]** `plan/in-progress/sched-recalc-unit.md`의 서술("무엇이 비었나"·"할 것"·"비대상"·"테스트")과 실제 diff가 정확히 대응한다. 체크리스트 상태(`--impl-prep` 체크·테스트+뮤턴트 체크·TEST WORKFLOW 체크, `/ai-review`·`--impl-done`·트래커 이관 미체크)도 이번 리뷰 라운드 시점과 부합해 stale claim 없음. `spec_impact: none` 선언도 실제로 `spec/**` 미변경과 일치.

## 요약

신규 단위 테스트 2건은 plan이 표방한 목표(cron-only·timezone-only 재계산 happy-path를 시각 의존 없이 결정적으로 고정) 자체는 정확히 달성하며, 호출 인자·반환값 대입·spec 서술과의 line-level 일치도 확인됐다. 다만 plan이 스스로 채택한 "`||`의 각 항이 표면" 원칙을 놓고 볼 때 세 번째 표면 — 두 항이 모두 거짓일 때 재계산이 일어나지 않아야 한다는 음의 방향 — 을 검증하는 테스트가 빠져 있고, 실측(`if (true)` 뮤턴트로 스위트 전체 GREEN)으로 이 갭이 실재함을 확인했다. 이 갭은 이번 diff가 새로 만든 것이 아니라 기존부터 있던 것이지만, 이번 작업 자체가 "이 재계산 분기의 계약을 뮤턴트로 잠근다"를 목적으로 내세운 만큼 그 목적을 완결하려면 대조군 테스트 한 건을 더 추가하는 편이 좋다. 그 외 기능 완전성·에러 시나리오·spec 정합성 관점에서 발견된 결함은 없다.

## 위험도

LOW
