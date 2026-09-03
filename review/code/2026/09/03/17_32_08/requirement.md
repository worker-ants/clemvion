# 요구사항(Requirement) 리뷰 — entity nullable 타입 정합 배치 2 (3라운드째, 최종 확인)

## 검증 방법 (저장소 트리 뮤테이션 없음 — read-only 실행만)

이전 두 라운드(`16_45_35`, `17_09_06`)와 consistency-check(`17_09_09`)에서 이미 WARNING 6건이
발견·조치됐고, 그 결과가 이번 diff(`파일 1~14`)에 반영돼 있다. 이번 라운드는 그 조치가 실제로
적용됐는지, 그리고 새로 놓친 것이 없는지 독립적으로 재검증했다.

- `cd codebase/backend && npx tsc --noEmit -p tsconfig.json` 직접 실행 → 전체 198건 에러 전부
  `.spec.ts` (`error TS` 헤더 라인을 `\.ts\([0-9]+,[0-9]+\): error TS` 로 매칭해 `.spec.ts` 제외
  집계) — **비-spec 소스 에러 0건** 재확인.
- `npx jest src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts src/shared/utils/redact-stored-error.spec.ts` →
  **46/46 PASS**.
- `Read`/`grep` 으로 `codebase/backend/src/modules/hooks/hooks.service.spec.ts:149`,
  `codebase/backend/src/modules/schedules/schedule-runner.service.spec.ts:83,211` 을 직접 열어
  라운드 2 WARNING 2·3(`lastTriggeredAt`/`lastRunAt` 이중 캐스트)이 실제로 제거됐음을 확인.
- `sed -n` 으로 `plan/in-progress/entity-nullable-column-type-mismatch.md:170-171` 을 직접 열어
  라운드 2 WARNING 1(신규 H2 헤딩 앞 빈 줄 누락)이 실제로 삽입됐음을 확인.
- `spec/1-data-model.md` 를 이번 diff 가 넓힌 **모든** 필드(30개 전부: Execution 10·
  NodeExecution 5·Node 3·Notification 3·Schedule 1·Trigger 2·User 3·Workflow 2·
  KnowledgeBase 1)에 대해 grep 으로 직접 대조 — 전부 spec 의 nullable 표기(`?`)와 line-level 로
  일치.
- `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:96-125` 를 직접
  열어 "관계가 타입을 공급하는 컬럼은 `type:` 예외" 규칙(`@JoinColumn` 이름 대조)이 실제 코드로
  구현돼 있음을 확인.
- `git status --short` — 검증 전후 저장소 변경 없음(원복 불요, mutation 자체가 없었음).

## 발견사항

- **[INFO]** `redactNodeExecutionRowForResponse` 의 제네릭 제약이 `inputData` 까지
  `Record<string, unknown> | null` 로 넓게 적어 실제 `NodeExecution.inputData`(non-null,
  `default: {}`)보다 느슨하다 — 라운드 2 에서 이미 발견·판단 보류된 항목의 재확인
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:178`(제네릭 제약)
    vs `codebase/backend/src/modules/node-executions/entities/node-execution.entity.ts:69-70`
    (`inputData: Record<string, unknown>;`, `nullable: true` 없음 — 직접 `Read` 로 재확인)
  - 상세: 구조적 서브타이핑상 `NodeExecution`(narrower)은 그 제약(wider)을 항상 만족하므로
    컴파일·런타임 모두 안전하고, `tsc` 비-spec 오류도 0건이다. 다만 이 함수 시그니처만 보면
    "`inputData` 도 null 이 올 수 있다"로 오독할 여지가 남는다. plan 문서(`:198-208`)가 이미 이
    괴리를 정확히 서술하고(`inputData` 는 대상이 아니었다는 W1 정정과 함께) RESOLUTION
    (`17_09_06/RESOLUTION.md` INFO#2)이 "배치 3 에서 `inputData` 가 대상이 되는지 먼저 보고
    그때 정밀화" 로 명시적으로 유예했다 — 근거가 실측(구조적 서브타이핑 안전성)에 기반해
    타당하므로 이번 라운드에서 등급을 올릴 근거가 없다.
  - 제안: 조치 불요(유예 유지). 배치 3 착수 시 재평가 대상으로 이미 등재돼 있음.

- **[INFO]** `spec/1-data-model.md:260` `Schedule.next_run_at` 이 non-null(`Timestamp`)로
  표기돼 있으나 실제 DB/코드는 `nullable: true`/`Date | null` — 선재 spec 오류, 이 diff 무관
  - 위치: `spec/1-data-model.md:260` vs `codebase/backend/src/modules/schedules/entities/schedule.entity.ts`
    의 `nextRunAt: Date | null`(배치 1 에서 이미 넓혀짐, 이번 diff 대상 아님)
  - 상세: 3개 reviewer(라운드 1 requirement, 라운드 2 requirement, consistency-check
    cross_spec)가 이미 동일하게 확인했고, `plan/in-progress/entity-nullable-column-type-mismatch.md:169-176`
    가 "developer 권한 밖 — planner 턴 후속" 으로 정확히 등재해 뒀다. 이번 diff 는 `next_run_at`
    필드 자체를 건드리지 않으므로 이 diff 의 요구사항 충족 여부와 무관하다.
  - 제안: 조치 불요 — 다음 `project-planner` 턴에서 spec 정정.

- **[INFO]** 재검증 결과 라운드 2 WARNING 3건 전부 실제로 조치됨(허위 완료 주장 재발 없음)
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:170-171`(빈 줄 삽입 확인),
    `codebase/backend/src/modules/hooks/hooks.service.spec.ts:149`,
    `codebase/backend/src/modules/schedules/schedule-runner.service.spec.ts:83,211`(캐스트 제거 확인)
  - 상세: 이 저장소는 "고쳤다고 적었는데 실제로는 안 고쳤다" 패턴이 같은 작업 세션에서 3회
    반복된 이력이 있어(plan 문서 자체가 표로 기록) 특히 주의해 재검증했다. 이번엔 세 건 모두
    실제 소스에서 대조되었다 — 허위 주장 없음.
  - 제안: 조치 불요(확인 완료).

## 요약

3라운드에 걸쳐 이미 CRITICAL 0 · WARNING 6건(발견 즉시 조치)으로 수렴한 작업이며, 이번 라운드는
그 조치의 실측 재확인과 새 결함 탐색을 목적으로 독립 수행했다. `tsc --noEmit` 비-spec 소스 오류
0건, 관련 가드·유닛 테스트 46/46 PASS 를 직접 재실행해 확인했고, 이번 diff 가 넓힌 30개 필드
전부를 `spec/1-data-model.md` 와 line-level 로 대조해 예외 없이 일치함을 확인했다(특히
`NodeExecution.inputData` 가 유일하게 non-null 로 남는 것까지 spec·코드·테스트 세 곳 모두
일관됨을 직접 확인). 라운드 2 가 발견한 WARNING 3건(신규 헤딩 빈 줄 누락, `lastRunAt`/
`lastTriggeredAt` spec fixture 의 불필요해진 이중 캐스트)이 실제로 코드에 반영됐는지 소스를 직접
열어 재확인했고, 전부 정확히 조치돼 있었다 — "고쳤다고 적고 실제론 안 고쳤다" 는 이 세션의
반복 결함 패턴이 이번엔 재발하지 않았다. TODO/FIXME 류 미완성 표식 없음, 모든 반환 경로가
테스트로 커버됨, 비즈니스 규칙(FK 가 타입을 공급하는 컬럼은 `type:` 면제)이 가드 코드로 정확히
구현돼 있음을 직접 확인했다. 새로 발견된 결함은 없으며, 남은 두 INFO 는 모두 이 diff 이전부터
있던 항목이고 이미 올바르게 후속(배치 3 재평가 / planner 턴)으로 이월돼 있다.

## 위험도

NONE
