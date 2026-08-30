# Code Review 통합 보고서

## 전체 위험도
**LOW** — 프로덕션 코드(`updateExecutionStatus` else 분기 트랜잭션화 + JSDoc 정정)는 9개 reviewer 전원이 실질 결함 없음(NONE/LOW)으로 판정했다. 유일한 WARNING 은 코드가 아니라 **거버넌스 감사 추적 갭**(spec 갱신을 정당화한 project-planner draft 산출물이 git 이력에 존재하지 않음)이며, 이 때문에 전체 등급을 LOW 로 유지한다. forced reviewer 9명 전원 결과 확보 완료 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 거버넌스/문서 | `project-planner` 거버넌스 턴의 근거 산출물 `plan/in-progress/spec-draft-else-branch-transaction.md` 가 git 이력에 한 번도 커밋된 적이 없다(`git log --all` 0건). 그런데 커밋 `519671792` 메시지, `review/code/2026/08/30/17_36_15/RESOLUTION.md:29-31`, `requirement.md:11`, `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md:691` 등 6곳 이상이 이 파일을 근거로 인용한다. `review/consistency/2026/08/30/17_49_59/meta.json` 의 5개 checker 가 이 파일의 구체 구조(frontmatter·`## Rationale` 서브섹션)를 상세 인용하고 있어 검토 시점엔 실재했을 가능성이 높으나, 지금은 워킹트리·untracked 어디에도 없다. 이 저장소의 `spec-draft-*` 관례(`plan/complete/` 에 30개 이상 전례)는 예외 없이 영속하는데 이번 건이 유일한 이탈이다. spec 콘텐츠 자체는 코드와 line-level 로 정확히 일치함을 확인했으므로 결과물이 틀린 것은 아니지만, `developer` 가 `spec/` 을 직접 못 고치는 CLAUDE.md 경계를 정당화하는 유일한 증거가 사라졌다. | `plan/in-progress/spec-draft-else-branch-transaction.md`(부재), 커밋 `519671792` 메시지, `review/code/2026/08/30/17_36_15/RESOLUTION.md:29-31`, `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md:691` | `plan/complete/spec-draft-else-branch-transaction.md`(또는 원래 경로)를 반영 내용 그대로 복원해 커밋하거나, 복원 불가 시 위 4곳 이상의 참조를 "산출물 미보존, `519671792`/`17_49_59` 리뷰 기록이 유일한 근거"로 정정. 재발 방지로 `--spec` 오케스트레이터가 draft 파일을 `git add` 하는 단계 점검. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성/보안/유지보수 | self-deadlock 방지가 런타임 가드가 아니라 JSDoc 서술 + 호출부 20곳(파일 내 11 + `EngineDriver` 경유 9) **어휘적(lexical) 범위** 대조에만 의존한다. 이번 라운드가 정확도를 11→20으로 높이고 "어휘적 확인" 이라는 한계까지 명시했으나, 호출 스택 상위에서 트랜잭션을 연 caller 여부는 여전히 미확인 — mock 기반 unit 테스트로는 구조적으로 잠글 수 없는 갭. (testing/concurrency/security/side_effect/maintainability 공통 지적) | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8565-8582` | 조치 불요(현재 트리거 없음, 5개 reviewer 독립 재실측으로 정확성 확인). 향후 `EngineDriver` 소비 서비스가 자체 트랜잭션 안에서 이 메서드를 호출하도록 바뀌는 PR 에서는 이 JSDoc 문구를 그 PR 이 재검증해야 함을 명시적으로 인지. |
| 2 | DB/동시성 | else 분기 트랜잭션 래핑으로 단발 autocommit UPDATE(1왕복) 가 BEGIN+UPDATE+COMMIT/ROLLBACK(3왕복)으로 늘어 hot path 커넥션 풀 점유 시간이 증가한다 — shape 위반 시 롤백 보장이라는 목적이 비용을 상회한다고 3개 reviewer(concurrency/database/security) 공통 판정. | `execution-engine.service.ts:8710-8745` | 조치 불요. 부하 테스트/모니터링에서 커넥션 풀 사용률을 관찰 대상에 포함하는 정도로 충분. |
| 3 | 테스트 | 신규 회귀 테스트 2건이 `describe('admitExecutionOrDefer / markQueueWaitTimeout (PR2b §8)', ...)` 블록 안에 위치해 내용과 무관 — 3라운드째 미해결이나 이전 라운드에서 "급하지 않음"으로 명시 처분됨. | `execution-engine.service.spec.ts:4491, 4812, 4842` | 이번 라운드에서 새로 요구하지 않음. 다음에 이 영역을 손댈 때 하위 `describe` 분리 권장. |
| 4 | 문서 | 리뷰 산출물 sub-agent 프로토콜 헤더(`STATUS=…`/`===REPORT_MARKDOWN_BELOW===`) 누출이 이 PR 자신이 만든 1개 파일(`plan_coherence.md`)에서는 정정됐으나, 저장소 전체 824개 파일에는 동일 결함이 남아 있다 — 이미 `plan/in-progress/backend-lint-gate-broken-on-main.md` 「후속」 섹션에 백로그로 등재됨. | `review/consistency/2026/08/30/17_49_59/plan_coherence.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md` | 조치 불요(이미 별도 plan 항목으로 추적 중). 다음 처리 시 824 수치 재실측할 것. |
| 5 | 유지보수성 | `updateExecutionStatus` 함수가 169줄로 여전히 길다. `finishStatusTransition` 추출은 중복 제거가 목적이었지 길이 축소가 목적이 아니었음(168→169로 오히려 소폭 증가). 다만 분기점은 `if (linkedNodeExec)` 하나뿐이고 절반 이상이 근거 주석이라 구조 자체는 선형적. | `execution-engine.service.ts:8584-8752` | 즉시 조치 불필요. 다음에 손댈 기회가 있으면 "트랜잭션 열기→분기별 로직→공통 종결부" 골격 자체를 상위 헬퍼로 승격하는 리팩터를 후보로 남겨둠. |
| 6 | 유지보수성 | 신규 테스트 2건이 `mockTxManagerQuery.mock.calls.filter(...)` 형태의 3줄짜리 UPDATE 필터링 로직을 거의 동일하게 반복한다(파일 전역 `/UPDATE execution/` 매칭 이미 22곳). | `execution-engine.service.spec.ts:4836-4839, 4860-4863` | 이번 diff 범위 밖, 즉시 조치 불필요. 유사 단언이 더 늘면 공유 헬퍼(`getTxUpdateCalls`) 추출 고려. |
| 7 | 범위 | 원 fix 커밋(`1a12088f2`)에 목적과 무관한 stale 체크박스 정정("전역 raw-query 감사")이 동반됨 — 이미 `17_36_15` scope 라운드가 지적·수용 완료, 이후 재발 없음. | `plan/in-progress/backend-lint-gate-broken-on-main.md:1314` | 조치 불요(기존 처분 유지). |
| 8 | 확인(개선사항) | `finishStatusTransition` 헬퍼 추출이 직전 WARNING(형제 분기 종결부 4줄 손복제)을 정확히 해소했음을 3개 reviewer(scope/maintainability/side_effect) 가 독립 재확인 — 두 분기 모두 트랜잭션 commit **이후**에만 헬퍼를 호출해 롤백된 쓰기에 대한 부작용 유출 없음. | `execution-engine.service.ts:8665, 8746, 8768-8779` | 없음(새 결함 아님, 확인 기록). |
| 9 | 확인 | JSDoc 호출부 수치("20곳 = 파일 내 11 + `EngineDriver` 경유 9")를 5개 reviewer(requirement/concurrency/documentation/side_effect/maintainability) 가 각각 독립적으로 `grep` 재검산해 정확함을 확인. `retry-turn.service.ts` 유일한 트랜잭션 블록도 driver 호출 지점보다 앞서 닫혀 self-deadlock 트리거 경로 없음. | `execution-engine.service.ts:8565-8582` | 없음(새 결함 아님, 확인 기록). |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | LOW | 프로덕션 코드·spec 콘텐츠는 정확히 일치·정확. 유일한 WARNING: project-planner draft 산출물이 git 이력에 없어 거버넌스 감사 추적 갭. |
| testing | NONE | 이번 라운드 델타는 JSDoc-only, 테스트 변경 없음. 456/456 재실행 확인. INFO 2건(self-deadlock 미고정, describe 배치)은 재확인만. |
| concurrency | LOW | self-deadlock JSDoc 정정(11→20) 독립 재검증으로 정확함 확인. 새 race 없음. |
| database | NONE | DB 코드(쿼리/트랜잭션/스키마) 변경 없음 — 이번 커밋은 JSDoc 정정뿐. |
| documentation | NONE | JSDoc·spec·CHANGELOG·plan 전부 코드와 일치, 낡은 서술 없음. |
| scope | NONE | 세 커밋 전부 단일 결함 수정 + 그 리뷰 대응으로 수렴. 목적 밖 확장 없음. |
| security | NONE | SQL 인젝션/시크릿/인가 신규 취약점 없음. self-deadlock JSDoc 의존은 INFO. |
| side_effect | NONE | 함수 시그니처·트랜잭션 배선·부작용 순서 변경 없음(JSDoc 정정뿐). |
| maintainability | LOW | WARNING 해소(중복 제거·수치 정정) 확인. 함수 길이 169줄·테스트 중복 3줄은 INFO. |

## 발견 없는 에이전트

없음 — 9개 reviewer 전원이 최소 1건 이상의 INFO/확인 기록을 남겼다(Critical/Warning 없이 "문제 없음"만 보고한 곳은 없음).

## 권장 조치사항

1. **(WARNING 처리)** `plan/complete/spec-draft-else-branch-transaction.md`(또는 원래 있어야 할 경로)를 실제 반영 내용대로 복원해 커밋하거나, 최소한 이를 인용하는 4곳 이상(커밋 메시지 재작성은 불가하므로 plan/RESOLUTION 문서만)을 "산출물 미보존" 으로 정정한다. `--spec` 오케스트레이터가 draft 파일을 `git add` 하는 단계가 있는지 점검.
2. self-deadlock 방지 JSDoc 제약을 다음에 `EngineDriver` 소비부가 늘어날 때 재검증 대상으로 리뷰 체크리스트에 남긴다(선택: dev-only `EntityManager` 존재 감지 assert 고려).
3. 리뷰 산출물 프로토콜 헤더 누출 824건 백로그는 이미 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 등재돼 있으므로 별도 조치 불요 — 계속 추적만.
4. (여유 있을 때) `updateExecutionStatus` 트랜잭션 개시부 공통화 리팩터, 신규 테스트 `describe` 재배치, 테스트 필터 헬퍼 추출은 이번 diff 범위 밖 후보로 남겨둔다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `requirement, testing, concurrency, database, documentation, scope, security, side_effect, maintainability` (9명)
  - **제외**: 없음 (0명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing, concurrency, database` (9명 전원, 전원 결과 확보됨 — 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | — |