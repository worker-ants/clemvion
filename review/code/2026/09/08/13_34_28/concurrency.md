# 동시성(Concurrency) 코드 리뷰

## 발견사항

- **[INFO]** 전역 예외 필터의 unique-violation 판정이 SoT(`pg-error.ts`)로 통합되어 race-window 처리가 더 견고해짐
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts:70` (`isPostgresUniqueViolation(exception)`), 헬퍼 정의는 `codebase/backend/src/common/db/pg-error.ts:28`
  - 상세: 이 분기는 "애플리케이션 단 사전 체크 후 동시 두 요청이 모두 통과해 DB UNIQUE 제약이 최종 결정자가 되는" race window 를 409 로 번역하는 자리다. 종전 로컬 `isUniqueViolation` 은 `err instanceof QueryFailedError` 를 먼저 요구해 TypeORM 이 wrap 하지 않은 raw 표면(`err.code`)의 unique 위반을 놓쳐 500 으로 마스킹했다. 새 `isPostgresUniqueViolation`/`pgErrorCode` 는 `err.code ?? err.driverError?.code` 두 표면을 모두 검사한다(순수 함수, 공유 가변 상태 없음). `GlobalExceptionFilter` 자체도 인스턴스 필드가 `logger` 하나뿐이고 요청마다 지역 변수(`status`/`code`/`message`)만 쓰므로 요청 간 공유 상태·경쟁 지점이 없다. 이 변경은 race-condition 처리의 **정확도를 개선**하는 방향이며 새로운 동시성 위험을 만들지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `integration-oauth.service.ts` 의 cafe24/makeshop "pre-check + INSERT + unique-violation catch" TOCTOU 패턴 — 리팩터 후에도 동작 동일, 패턴 자체는 올바름
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` 함수 내부 `catch (err) { ... isPostgresUniqueViolation(err) && pgErrorConstraint(err) === STORE_IDENTIFIER_UNIQUE_CONSTRAINT ... }` 블록 2곳(cafe24 begin 경로·makeshop install 경로)
  - 상세: 두 자리 모두 `err.constraint ?? err.driverError?.constraint` 를 손으로 반복하던 것을 `pgErrorConstraint()` 단일 호출로 교체한 순수 리팩터다(추출 로직 동일, 동작 변화 없음). 이 패턴은 "in-memory `find()` 사전 체크 → 통과 시 INSERT → DB UNIQUE 제약이 동시 요청 경쟁을 최종 차단 → catch 에서 도메인 409 로 번역" 구조로, TOCTOU 를 애플리케이션 레벨 락 없이 DB 제약에 위임하는 정석적인 접근이다. 사전 체크만으로 원자성을 보장하려 하지 않고 DB 제약을 최종 소스로 쓰므로 두 동시 요청이 모두 사전 체크를 통과해도 안전하다. 리팩터는 이 구조를 건드리지 않았다.
  - 제안: 조치 불요.

- **[INFO]** 신규 AST 정적 가드(`endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`/fixture) — 동시성 코드 자체는 없음(단일 파일 AST 동기 스캔), 회귀 방지 구조는 긍정적
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` 전체(`findTriggerRepositorySaves`), `endpoint-path-conflict-wrap.spec.ts`
  - 상세: `fs.readFileSync` + `ts.createSourceFile` 기반의 순수 동기 정적 분석이며 async/await·공유 가변 상태·재진입 대상이 없어 동시성 관점에서 위험이 없다. 다만 목적 자체가 `(workspace_id, endpoint_path)` UNIQUE 제약이 걸린 `triggerRepository.save()` 호출이 향후 새로 추가될 때 race-window 백스탑(`.catch(...rethrowEndpointPathConflict...)`)이 빠지는 것을 구조적으로 막는 래칫이라, 위 두 항목이 다루는 race-condition 방어 패턴을 미래 회귀로부터 지키는 역할을 한다.
  - 제안: 조치 불요.

- **[INFO]** `webhook-trigger.e2e-spec.ts` B4 — 실제 DB UNIQUE 제약을 밟아 409 를 확인하지만, 두 요청은 순차적이라 진짜 동시(concurrent) 요청 타이밍은 검증하지 않음
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts` 함수 `it('B4. ...')`
  - 상세: `createWebhookTrigger` 로 첫 트리거를 만든 뒤 `await` 로 완료를 기다리고 나서 같은 `endpointPath` 로 두 번째 요청을 보낸다 — 두 요청이 실제로 동시에 도착하는 시나리오(진짜 race window)는 아니다. 다만 이 테스트가 검증하는 것은 "DB UNIQUE 제약이 최종 결정자다" 라는 불변식이고, 그 제약은 요청 타이밍과 무관하게 두 번째 INSERT 시점에 항상 발동하므로, 순차 요청으로도 같은 코드 경로(제약 위반 → catch → 409 번역)를 정확히 재현한다. 실제 동시 요청을 만드는 테스트는 결과가 어느 쪽이 먼저 성공할지 비결정적이라 오히려 flaky 해지므로, 현재 방식이 더 안정적인 회귀 테스트다.
  - 제안: 조치 불요 — 다만 "진짜 동시 요청" 케이스(예: `Promise.all` 로 두 요청을 동시에 발사해 정확히 하나만 201, 하나만 409 인지)를 원한다면 별도 항목으로 추가할 수 있다(이번 diff 의 필수 사항은 아님).

- **[INFO]** `.claude/test-stages.sh` 의 `_cmd_typecheck_ratchets()` — 두 Python 스크립트를 `&&` 로 순차 실행, 병렬화하지 않음(의도된 결정)
  - 위치: `.claude/test-stages.sh` 함수 `_cmd_typecheck_ratchets()`
  - 상세: `python3 check-backend-typecheck-ratchet.py && python3 check-frontend-typecheck-ratchet.py` 는 셸 빌드 스크립트이고 애플리케이션 런타임 동시성과 무관하다. 이전 라운드(`review/code/2026/09/08/12_53_08/performance.md`)가 병렬 실행을 제안했으나, 같은 라운드의 `RESOLUTION.md` INFO#5 가 "병렬화하면 두 프로세스의 stderr 가 섞여 어느 쪽이 깨졌는지 진단이 나빠진다" 는 근거로 won't-do 처리했다. 진단 가능성을 성능보다 우선한 합리적 결정이며, 순차 실행 자체에는 경쟁 조건이 없다.
  - 제안: 조치 불요 — 기존 결정 유지.

- **[INFO]** `workspaces.service.ts` `listMembers` DB `select` 투영 전환, `workflow-versions.service.ts` 타입 개명 — 둘 다 동시성 표면 없음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` (`listMembers`), `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (`WorkflowVersionDetailProjection`)
  - 상세: 전자는 단일 읽기 전용 쿼리(`relations`+`select` 조합, 단일 JOIN 유지)의 컬럼 범위만 좁힌 변경이고 트랜잭션·락·비동기 흐름을 건드리지 않는다. 후자는 순수 타입 이름 변경으로 런타임 코드가 전혀 없다.
  - 제안: 조치 불요.

## 요약

이번 diff 에서 동시성과 실질적으로 관련된 코드는 세 갈래다 — (1) `GlobalExceptionFilter` 의 unique-violation 판정을 SoT(`pg-error.ts`)로 통합해 race window 에서 발생하는 raw 표면 23505 가 500 으로 새던 것을 409 로 바로잡았고(순수 함수, 공유 상태 없음, 개선 방향), (2) `integration-oauth.service.ts` 의 cafe24/makeshop TOCTOU 백스탑(사전 체크→INSERT→DB UNIQUE 제약→catch 번역) 패턴은 리팩터 전후 동작이 동일하며 원래부터 애플리케이션 락 없이 DB 제약에 원자성을 위임하는 올바른 설계다, (3) 신규 AST 정적 가드와 e2e/unit 테스트들은 이 race-condition 방어 패턴이 향후에도 깨지지 않도록 잠그는 회귀 방지 장치로, 그 자체는 동기·단일 스레드 코드라 동시성 위험이 없다. 그 외(`select` 투영, 타입 개명, 빌드 스크립트 순차 실행)는 동시성 표면이 없거나 이미 근거를 갖춘 순차 실행 결정이다. CRITICAL/WARNING 급 경쟁 조건·데드락·동기화 누락·async/await 오용은 발견되지 않았다.

## 위험도

NONE
