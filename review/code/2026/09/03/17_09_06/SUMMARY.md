# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. 엔티티 9개 nullable 타입 정합화(30필드)와 `redact-stored-error.ts` 시그니처 확장은 순수 컴파일 타임 변경으로 런타임 영향이 없으며(전 reviewer `tsc --noEmit` 신규 오류 0 재확인), WARNING 3건은 모두 기능에 영향 없는 문서/테스트 부채다. forced whitelist(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 7명 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | `RESOLUTION.md`가 "INFO#8(신규 H2 헤딩 앞 빈 줄 누락)을 W2 정정에 포함해 해결했다"고 기록했으나, `git blame`/`git show`로 실측하면 해당 fix 커밋(`a7b9667bc`)은 이 줄을 전혀 건드리지 않았고 빈 줄은 지금도 없다. 검증 없이 "고쳤다"고 기록된 허위 완료 주장이며, 다음 세션이 이를 근거로 재확인을 건너뛸 위험이 있다. (requirement·maintainability·documentation 3명 중복 지적) | `plan/in-progress/entity-nullable-column-type-mismatch.md:170-171`(실제 미수정) / `review/code/2026/09/03/16_45_35/RESOLUTION.md:54`(허위 주장) | `:170`-`:171` 사이에 빈 줄 1개 삽입 + `RESOLUTION.md` 서술을 "미조치로 재확인, 후속 라운드에서 처리"로 정정 |
| 2 | 테스트 부채 | 이번 diff가 `Schedule.lastRunAt`을 `Date \| null`로 넓혔으나, 같은 fixture 안의 인접 필드(`nextRunAt`)는 이미 캐스트 없이 `null`을 직접 대입하는 반면 `lastRunAt`은 이중 캐스트(`null as unknown as Date`)가 그대로 남아있다. `tsc --noEmit` 실측(캐스트 제거 후 오류 0건, 즉시 원복 확인)으로 불필요함을 확인. `nullable-type-lie-cast.spec.ts` 가드는 `.spec.ts`를 명시적으로 제외해 이 자리를 구조적으로 못 본다 | `codebase/backend/src/modules/schedules/schedule-runner.service.spec.ts:83`, `:211` | `lastRunAt: null as unknown as Date,` → `lastRunAt: null,` |
| 3 | 테스트 부채 | `Trigger.lastTriggeredAt`도 동일 패턴 — `Date \| null`로 넓혀졌으나 이중 캐스트가 잔존. `tsc --noEmit` 실측(캐스트 제거 후 오류 0건, 즉시 원복 확인)으로 불필요함을 확인 | `codebase/backend/src/modules/hooks/hooks.service.spec.ts:149` | 캐스트 제거(`lastTriggeredAt: null,`) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | `spec/1-data-model.md`의 `Schedule.next_run_at` 표기(non-null) vs 실제 DB/코드(`nullable: true`) 불일치는 이 diff가 만든 것이 아닌 선재 spec 오류이며, plan 문서에 "developer 권한 밖 — planner 턴 후속"으로 정확히 이월돼 있고 이 diff는 그 필드를 건드리지 않음 | `plan/in-progress/entity-nullable-column-type-mismatch.md:151-158` | 조치 불요(planner 턴에서 후속) |
| 2 | 부작용/요구사항 | `redactNodeExecutionRowForResponse` 제네릭 제약이 이번 diff가 실제로 넓히지 않은 `inputData`(엔티티 자체는 non-null 유지)까지 `Record<string, unknown> \| null`로 표기 — 구조적 서브타이핑으로 컴파일·런타임 모두 문제없지만, 향후 이 제약만 보고 "inputData도 null 가능"으로 오독할 소지 | `codebase/backend/src/shared/utils/redact-stored-error.ts:178` vs `node-execution.entity.ts:69-70` | 정밀화하려면 제약에서 `inputData`를 non-null로 되돌려 실제 엔티티 계약과 1:1 일치 |
| 3 | 부작용 | TypeORM `design:type` 리플렉션 boot-time 부작용(`nullable` 확장 시 `DataTypeNotSupportedError`로 부팅 실패) 회피 메커니즘이 이번 diff에서 정확히 적용됨을 가드 테스트(12/12 PASS)와 전체 `tsc --noEmit`(비-spec 소스 오류 0)로 검증 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` 등 7개 필드에 `type:` 명시 | 조치 불요 |
| 4 | 부작용/범위 | 직전 리뷰 라운드(`16_45_35`) 산출물(SUMMARY/RESOLUTION/각 reviewer `.md`/`_retry_state.json` 등 13파일)이 신규 파일로 diff에 포함 — `review/code/**` 저장 관례 및 과거 다수 선례와 일치, 이례적 포함 아님 | `review/code/2026/09/03/16_45_35/*` | 조치 불요 |
| 5 | 유지보수성 | `redact-stored-error.ts`의 `maskIfPresent` docstring이 라운드를 거듭하며 반증 이력 문단이 누적돼 길어짐 — 자기-반증형 소정정 관례엔 부합하나, 배치 3 종결 시점에 반증 이력을 plan 문서(단일 진실)로 옮기는 정리를 고려할 만함 | `codebase/backend/src/shared/utils/redact-stored-error.ts` (`maskIfPresent` JSDoc) | 조치 불요(배치 3 완료 시 재검토) |
| 6 | 유지보수성 | 신규 다중 라인 `@Column` 데코레이터의 `nullable`/`length` 키 순서가 파일마다 혼재 — 이 diff 이전부터 저장소 전역에 이미 혼재해 있던 기존 약한 컨벤션의 답습, 강제 린트 없음 | `notification.entity.ts:40-45`, `trigger.entity.ts:62-67`, `user.entity.ts:152-158` | 이번 PR 범위 조치 불요. TypeORM nullable 타이핑 규약 정식화 시 함께 고려 |
| 7 | 문서화 | 9개 엔티티 파일의 인라인 주석·JSDoc 전수 대조 — stale comment 없음, nullable 확장 필드와 관련 서술이 일치하거나 애초에 서술이 없어 갱신할 대상 자체가 없음 | 9개 엔티티 파일 | 조치 불요 |
| 8 | 문서화 | `redact-stored-error.ts`/`.spec.ts`의 자기-반증형 소정정(원문 취소선 보존 + 반증 날짜·근거 병기)은 CLAUDE.md 관례에 정확히 부합하는 모범 사례로 확인 | `redact-stored-error.ts:128-135`, `redact-stored-error.spec.ts:294-305` | 조치 불요 |
| 9 | 문서화 | plan 문서 §배치 2 수치("9파일 30필드, column 24/relation 6")를 diff에서 직접 재검산해 정확히 일치 확인. `(d) Schedule.lastRunAt` 이중 표기(W3)도 취소선으로 정상 해소 | `plan/in-progress/entity-nullable-column-type-mismatch.md:176-221` | 조치 불요 |
| 10 | 문서화 | CHANGELOG.md 미기재는 결함 아님 — 내부 정적 타입 정합화이며 동일 이니셔티브 배치 1 커밋도 CHANGELOG를 건드리지 않은 선례와 일관 | `CHANGELOG.md`(변경 없음) | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션·시크릿·인증/인가·마스킹 로직·webhook 라우팅(`endpointPath`) 소비처까지 직접 추적 — 발견 없음 |
| requirement | LOW | WARNING#1(RESOLUTION 허위 완료 주장); 그 외 spec 정합성(line-level 대조) 전부 일치 |
| scope | NONE | plan 선언 범위(9파일 30필드)와 diff 필드 단위 완전 일치, drive-by 변경 없음 |
| side_effect | LOW | INFO만 — nullable 확장의 boot-time 회귀 클래스를 가드로 회피 검증, 런타임 부작용 없음 |
| maintainability | LOW | WARNING#1(dup) + docstring 누적·`@Column` 키 순서 혼재(둘 다 조치 불요) |
| testing | LOW | WARNING#2·#3(신규 nullable 필드의 스펙 fixture 이중 캐스트 잔존, 가드 사각지대) |
| documentation | LOW | WARNING#1(dup) — RESOLUTION.md의 미검증 완료 주장; 그 외 문서화 전반 양호 |

## 발견 없는 에이전트

- security
- scope

## 권장 조치사항

1. `plan/in-progress/entity-nullable-column-type-mismatch.md:170-171` 사이에 빈 줄 1개 삽입하고, `review/code/2026/09/03/16_45_35/RESOLUTION.md`의 "INFO#8 W2 정정에 포함됐다" 서술을 "미조치로 재확인"으로 정정 — 검증 없는 완료 주장이 다음 세션의 재확인을 막지 않도록.
2. `schedule-runner.service.spec.ts:83,211`의 `lastRunAt` 이중 캐스트 제거(`null as unknown as Date` → `null`).
3. `hooks.service.spec.ts:149`의 `lastTriggeredAt` 이중 캐스트 제거.
4. (선택) `redact-stored-error.ts`의 `redactNodeExecutionRowForResponse` 제네릭 제약에서 `inputData`를 non-null로 되돌려 실제 엔티티 계약과 1:1 일치시키는 정밀화 고려.

## 라우터 결정

- `routing_status=skipped` (router 미사용, `routing=all` 명시) — forced whitelist 전원 실행: **실행**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명). **제외**: 없음. **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 미이행 없음).

| 제외된 reviewer | 이유 |
|------------------|------|
| (없음) | — |