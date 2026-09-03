# Code Review 통합 보고서

## 전체 위험도
**LOW** — 9개 TypeORM 엔티티(30필드)의 nullable TS 타입 정합화 + `redact-stored-error.ts` 시그니처 확장으로, 런타임 동작·DB 스키마·API 계약에 실질 영향은 없음(9개 reviewer 전원 CRITICAL 0). 다만 `plan/in-progress/entity-nullable-column-type-mismatch.md` 문서 서술 오류 3건과 인접 테스트 파일의 낡은 주석 1건이 WARNING 으로 발견됨 — forced 화이트리스트(7명) 전원 결과 확보되어 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | plan 문서가 실제로 넓히지 않은 `NodeExecution.inputData` 를 "넓혔다"고 서술 — 실제 diff 는 `outputData`/`error` 2개만 넓혔고 `inputData` 는 여전히 non-null(`nullable: true` 자체 없음). `redact-stored-error.ts` 원래 전제 문구도 "두 컬럼" 이라 명시해 197행의 3개 나열과 모순 | `plan/in-progress/entity-nullable-column-type-mismatch.md:197`; 대조: `codebase/backend/src/modules/node-executions/entities/node-execution.entity.ts:69-70` | 197행을 `NodeExecution.outputData`/`error`(2개)로 정정하고 `inputData` 는 대상 아님을 명시 |
| 2 | 문서화 | plan 체크리스트가 두 헤딩(`## 할 일` vs 신규 `## 배치 2 — 비대칭 해소 (완료)`)으로 분산돼, `## 할 일` 만 훑는 독자가 배치 2/3 체크박스를 놓칠 수 있음 | `plan/in-progress/entity-nullable-column-type-mismatch.md:146`(`## 할 일`) / `:168`(신규 헤딩) / `:203-220`(신규 체크박스) | 배치 2 체크박스를 `## 할 일` 안으로 이동하거나 상호 참조 문구 추가 |
| 3 | 문서화 | `(d) Schedule.lastRunAt` 항목이 "완료"(204행)와 "미해결 후보"(210-211행, 배치 3 후보 목록에 취소선 없이 잔존) 양쪽에 동시 표기 — 배치 3 착수 시 재작업 대상으로 오인 가능 | `plan/in-progress/entity-nullable-column-type-mismatch.md:204` vs `:210-211` | 210-211행에 취소선 또는 "→ 배치 2에서 해소, 204행 참조" 주석 추가 |
| 4 | 테스팅 | `redact-stored-error.spec.ts` 주석이 이번 diff 가 프로덕션 JSDoc(`redact-stored-error.ts:128-135`)에서 이미 정정한 전제("정적으로는 null 도달 불가")를 그대로 참으로 서술 — 실측(캐스트 제거 후 `tsc --noEmit` 재실행, 오류 0건, 원복 완료)으로 해당 캐스트가 이제 불필요함을 확인 | `codebase/backend/src/shared/utils/redact-stored-error.spec.ts:294`(주석), `:305`(캐스트) — 이번 diff 미포함 인접 파일 | 주석을 "이제 정적으로도 null 도달 가능, 캐스트 불필요"로 정정하고 `:305` 이중 캐스트 제거/축소. `undefined` 분기는 별도 캐스트 필요 여부 재확인 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/부작용/DB/API | 타입 확장은 런타임 동작 불변 — DB 는 이미 `nullable: true`, `synchronize: false`(app.module.ts:112 등) 확인으로 자동 DDL 없음, `tsc --noEmit` 신규 에러 0건, 회귀 가드(`nullable-type-lie-cast.spec.ts`) 12/12 통과 | 9개 엔티티 파일 전체 | 없음(확인 목적) |
| 2 | 보안 | nullable 확장이 하류 호출부의 null-역참조 가능성을 넓힐 여지 — 이번 diff 범위 밖이라 실제 위반 여부 미확인. `oauthProviderId`/`endpointPath` 등 인가·라우팅 관련 필드 특히 주목 | `user.entity.ts:158,166`, `trigger.entity.ts:68` 등 | 별도 리뷰/`--impl-done` 에서 하류 호출부의 `!`/`as` 캐스트 우회 여부 확인 권장 |
| 3 | 부작용 | relation 필드(`trigger`/`executor`/`parentExecution`/`container`/`toolOwner`/`folder`)의 `\| null` 타입이 TypeORM 의 "관계 미-join 시 `undefined`" 경로까지는 표현 못함 — 이 diff 의 회귀는 아니고 기존 대비 개선, plan 이 relation `\| null` 관례로 이미 확정 | `execution.entity.ts:40,88,95`, `node.entity.ts:71,78`, `workflow.entity.ts:43` | 조치 불요(범위 밖). 소비 코드가 `=== undefined` 를 놓치는 자리 있는지는 별도 감사 대상 |
| 4 | 요구사항/스코프 | plan 문서의 "9파일 30필드(column 24·relation 6)" 수치를 diff 직접 셈으로 검증 — 정확히 일치 | 리뷰 대상 파일 1~9 | 없음(확인 완료) |
| 5 | 요구사항/DB/스코프 | 신규 `type:` 지정(4~7건)이 `migrations/V001__initial_schema.sql` 등 실제 컬럼 타입(`VARCHAR`/`INTEGER`)과 전수 일치. `@JoinColumn` 이 컬럼명을 공급하는 FK 필드(`triggerId`/`executedBy`/`parentExecutionId`)만 `type:` 면제되는 규칙도 9파일 전수 일관 | `execution.entity.ts` 등, `migrations/V001__initial_schema.sql:16,28,29,151,223,242` | 없음(확인 완료) |
| 6 | 요구사항 | `spec/1-data-model.md` 의 nullable 표기(`?` 접미사)와 line-level 대조 — 전부 일치, 코드가 spec 을 뒤늦게 따라잡는 정합 | `spec/1-data-model.md:62,74,75,118,159,235,343,465-476,549-555,727-732` | 없음 |
| 7 | 요구사항 | `Schedule.next_run_at` spec 표기(non-null) vs 실제(nullable) 불일치 확인 — 이번 diff 가 만든 게 아닌 선재 오류이며, plan 문서가 이미 "developer 권한 밖 — planner 턴 후속"으로 정확히 이월해 둠(SPEC-DRIFT 아님, 요구사항 리뷰어가 명시 배제) | `spec/1-data-model.md:260-261`, `plan/in-progress/entity-nullable-column-type-mismatch.md:151-158` | 없음 — 이미 이월됨 |
| 8 | 유지보수성/문서화 | 신규 H2 헤딩(`## 배치 2 — 비대칭 해소 (완료)`) 앞에 빈 줄 누락 — 문서 내 다른 헤딩과 형식 불일치 | `plan/in-progress/entity-nullable-column-type-mismatch.md:167-168` | 빈 줄 1개 추가 |
| 9 | 유지보수성 | `redact-stored-error.ts` `maskIfPresent` docstring 이 정정마다 계속 길어짐(코드:주석 비율 확대) — 결함 아닌 관찰, 프로젝트의 자기-반증형 소정정 관례에 부합 | `codebase/backend/src/shared/utils/redact-stored-error.ts` (`maskIfPresent` 상단) | 즉시 조치 불요. 정정이 누적되면 별도 문서 분리 검토 |
| 10 | 스코프 | 멀티라인 재포맷 4곳은 Prettier printWidth(80) 초과에 의한 기계적 결과로 실측 확인(재포맷 라인 81~86자, 유지 라인 79자) — drive-by 포맷팅 아님 | `notification.entity.ts`(resourceType), `trigger.entity.ts`(endpointPath), `user.entity.ts`(oauthProvider/oauthProviderId) | 없음 |
| 11 | 문서화 | 신규 확립된 TypeORM nullable 타이핑 2단계 규약이 `spec/conventions/` 에 아직 정식화되지 않고 repo-guard 코드와 plan 문서에만 존재 — plan 이 `complete/` 이동 시 발견성 저하 우려 | `spec/conventions/`(부재), 근거: `plan/in-progress/entity-nullable-column-type-mismatch.md:102-106` | 배치 3 완료/plan 종결 시점에 `spec/conventions/` 규약 문서 신설 검토 |
| 12 | 문서화 | `redact-stored-error.ts` docstring 자기정정(취소선 보존 + 반증 날짜·근거·정정 병기)은 CLAUDE.md 자기-반증형 소정정 관례에 정확히 부합하는 모범 사례 | `codebase/backend/src/shared/utils/redact-stored-error.ts:128-136` | 조치 불요 |
| 13 | 테스팅 | e2e(292건, 부팅 확인) 재실행은 본 세션에서 비용상 생략 — 직접 재현한 tsc/가드/redact-stored-error 유닛 테스트 결과와는 일치 | (커밋 메시지 주장치) | 없음(참고용 caveat) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 타입 확장 런타임 무영향 확인, downstream null-역참조는 범위 밖(INFO) |
| requirement | NONE | tsc/가드/spec 표기 line-level 대조 검증 통과, 수치 실측 일치 |
| scope | NONE | 변경 범위가 plan 선언 기준과 필드 단위로 완전 일치, drive-by 없음 |
| side_effect | LOW | relation `undefined` 경로 미표현(개선 여지, 회귀 아님), 그 외 무영향 |
| maintainability | LOW | 신규 헤딩 앞 빈 줄 누락, docstring 길이 증가 추세(둘 다 INFO) |
| testing | LOW | `redact-stored-error.spec.ts` 낡은 주석+불필요 캐스트(WARNING 1건) |
| documentation | LOW | plan 문서 서술 오류 1 · 체크리스트 분산 1 · 이중 표기 1 (WARNING 3건) |
| database | NONE | 마이그레이션 없음, `synchronize: false`, `type:` 대조 전수 일치 |
| api_contract | NONE | DTO 레이어가 이미 독립적으로 nullable 선언, wire 계약 영향 없음 |

## 발견 없는 에이전트

database, api_contract — 두 reviewer 모두 "발견사항: 없음" 명시.

## 권장 조치사항

1. `plan/in-progress/entity-nullable-column-type-mismatch.md` 정정 3건(WARNING 1-3): 197행 `inputData`→`outputData`/`error`, 체크리스트 위치 통합/상호참조, `(d) Schedule.lastRunAt` 이중 표기 정리.
2. `codebase/backend/src/shared/utils/redact-stored-error.spec.ts:294,305` 낡은 주석·불필요 캐스트 정리(WARNING 4).
3. (낮은 우선순위, INFO) 신규 헤딩 앞 빈 줄 추가, TypeORM nullable 타이핑 규약의 `spec/conventions/` 정식화는 배치 3 완료 시점에 함께 검토.

## 라우터 결정

- **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, database, api_contract (9명, routing=all)
- **제외**: 없음
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨, 누락 없음.

| 제외된 reviewer | 이유 |
|------------------|------|
| (없음) | — |