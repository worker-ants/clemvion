# 부작용(Side Effect) 리뷰 — `InteractionService.getStatus()` 2단계 컬럼 projection

- **대상**: `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`getStatus()`, line 245-381)
- **diff base**: `origin/main...HEAD`
- **관점**: 의도치 않은 상태 변경 / 전역 변수 / 파일시스템 / 시그니처 / 인터페이스 / 환경 변수 / 네트워크 / 이벤트-콜백

## 발견사항

- **[INFO]** `Promise.all` 도입으로 stage-2 실패 지점이 1개→2개로 증가, 에러 reject 순서가 비결정적
  - 위치: `interaction.service.ts:281-294`
  - 상세: 종전엔 `waiting_for_input` 분기에서 실제 DB I/O 가 `nodeExecutionRepository.findOne` 한 곳뿐이었다(`conversationThread`는 이미 로드된 전체 `execution` 엔티티의 필드라 추가 쿼리가 없었음). 변경 후엔 `threadRow` 재조회 쿼리가 신설되어, `waiting_for_input` 분기 안에서 실패 가능 지점이 2곳(`threadRow` 쿼리 / `nodeExec` 쿼리)으로 늘었다. `Promise.all`은 두 프라미스 중 먼저 reject 하는 쪽의 사유로 reject 하므로, 두 쿼리가 동시에 실패하는 극단적 상황(예: 커넥션 풀 고갈)에서 어느 쪽 에러 메시지가 표면화될지는 실행 시점 타이밍에 좌우된다.
  - 상세(추가): 두 에러 모두 이 코드 경로에서 별도 처리(catch) 없이 그대로 컨트롤러까지 전파되어 NestJS 기본 예외 필터가 처리하는 generic 500 이 되므로, 클라이언트에 노출되는 에러 코드/메시지 형태 자체는 종전과 동일(`error.code`/`message` 매핑이 없는 raw 500)하다. 즉 **외부에서 관찰 가능한 회귀는 없음** — 서버 로그에 잡히는 예외 스택트레이스의 출처(어느 쿼리였는지)만 비결정적으로 달라질 수 있는 정도.
  - 제안: 별도 조치 불요. 필요 시 diagnostic 목적으로 두 쿼리를 `Promise.allSettled` 로 감싸 실패 출처를 명확히 로깅할 수도 있으나, 현재 리스크 크기 대비 과잉이라 판단됨.

- **[INFO]** `waiting_for_input` 분기의 DB 왕복 수 증가 (2회 → 3회), 순간 동시 커넥션 점유 패턴 변화
  - 위치: `interaction.service.ts:251-294`
  - 상세: 종전: (1) 전체 컬럼 `execution` 조회 1회 → (2) `nodeExecutionRepository.findOne` 1회 = 총 2회 순차. 변경 후: (1) 얇은 `execution` 조회 1회 → (2) `threadRow`+`nodeExec` 를 `Promise.all` 로 동시 2회 = 총 3회, 그중 2회는 동시 발사. `waiting_for_input` 요청 처리 순간 커넥션 풀에서 동시에 2개의 커넥션을 점유하는 시점이 새로 생긴다. `DB_POOL_MAX` 기본값 10(`common/config/database.config.ts:14`)이고 EIA `getStatus` 는 폴링성 엔드포인트라 다수의 `waiting_for_input` 요청이 몰리면 이론상 풀 점유가 이전보다 약간 더 빨리 포화될 수 있다.
  - 상세(완화 근거): 각 쿼리는 PK(`id`) 단건 조회라 매우 짧게 끝나 커넥션 점유 시간이 극히 짧고, `non-waiting`(running/pending/completed/failed/cancelled) 상태 — 즉 EIA 폴링의 대다수 — 는 오히려 쿼리 1회로 **줄었다**(컬럼만 얇아진 게 아니라 이전에도 1회였음, 변화 없음). 실질적으로 커넥션 부담이 늘어나는 경우는 `waiting_for_input` 상태로 폴링되는 좁은 케이스에 한정.
  - 제안: 별도 조치 불요. 프로덕션에서 `waiting_for_input` 동시 폴링 규모가 커지면 모니터링 지표(커넥션 풀 사용률)로 확인 권장.

- **[INFO]** partial entity(선택 컬럼만 채워진 `Execution` 인스턴스)의 외부 누출 경로 없음 — 확인 완료
  - 위치: `interaction.service.ts:245-381` (`getStatus()` 전체), `interaction.controller.ts:184-190`
  - 상세: `execution`(stage-1), `threadRow`/`nodeExec`(stage-2) 세 인스턴스 모두 `getStatus()` 내부 지역 변수로만 쓰이고, 함수 리턴값은 새로 조립한 `ExecutionStatusDto` 리터럴이다. `getStatus()`의 유일한 호출자는 `InteractionController.getStatus`(단일 진입점, `interaction.controller.ts:184-190`) 뿐이며 그 외 어떤 서비스/캐시/이벤트 emit 경로도 `getStatus()`를 호출하지 않는다(`InteractionService` 를 주입하는 `hooks.service.ts` 는 `interact()`만 호출, `getStatus()` 미사용). TypeORM 0.3 은 identity map 을 쓰지 않아(`Repository.findOne` 매 호출마다 새 인스턴스 생성) 같은 요청 내 다른 코드가 partial entity 를 재사용할 위험도 없다.
  - 제안: 없음(문제 없음 확인).

- **[INFO]** `select` 컬럼명 오기(camelCase↔snake_case) 위험 — 코드 확인 결과 정확
  - 위치: `interaction.service.ts:253-260`, `interaction.service.ts:284`
  - 상세: `Execution` 엔티티는 `@Column({ name: 'workflow_id' })`/`@Column({ name: 'started_at' })`/`@Column({ name: 'finished_at' })`/`@Column({ name: 'output_data' })`/`@Column({ name: 'conversation_thread' })` 로 매핑되지만 TypeORM `select` 배열은 엔티티 프로퍼티명(camelCase)을 요구한다(`execution.entity.ts:28,56,59,77,164`). diff 의 `select: ['id','status','workflowId','startedAt','finishedAt','outputData']` 및 `select: ['id','conversationThread']` 는 전부 camelCase 로 정확히 기재되어 있다. 이 문제는 이미 `review/consistency/.../SUMMARY.md` W2 로 지적됐고 fallback 침묵 회귀(`updatedAt` → `new Date()`) 가드 테스트(`interaction.service.spec.ts` "updatedAt — finishedAt 우선…")로 고정됨.
  - 제안: 없음(문제 없음 확인). 향후 이 파일에 `select` 를 추가하는 사람을 위해 선례로 남겨 둘 가치는 있음(이미 JSDoc 코멘트로 문서화됨).

- **[INFO]** `getStatus()` 외 동일 파일 메서드(`interact`/`cancel`/`refreshToken`/`loadAndAssertAlive`) 변경 없음 — 확인 완료
  - 위치: `interaction.service.ts` 전체 diff
  - 상세: `git diff origin/main...HEAD -- interaction.service.ts` 상 변경 hunk 는 `getStatus()` 본문(JSDoc 포함) 한 곳뿐이다. `interact()`(82-163), `cancel()`(165-173), `refreshToken()`(175-220), `loadAndAssertAlive()`(383-402) 는 diff 에 나타나지 않으며 기존 `select: ['id','status']` 패턴 그대로 유지된다.
  - 제안: 없음.

- **[INFO]** 시그니처/공개 인터페이스 변경 없음 — 확인 완료
  - 위치: `interaction.service.ts:245`
  - 상세: `getStatus(ctx: InteractionRequestContext): Promise<ExecutionStatusDto>` 시그니처 그대로. 응답 wire shape(`ExecutionStatusDto`)도 무변경 — `select` 는 순수 내부 DB 조회 최적화. `interaction.controller.ts` 호출부(`return this.interactionService.getStatus(ctx);`)도 무변경.
  - 제안: 없음.

- **[INFO]** `plan/`·`review/` 문서 변경은 코드 동작과 무관
  - 위치: `plan/in-progress/eia-getstatus-column-projection.md`, `plan/complete/spec-sync-external-interaction-api-gaps.md`(line-range 인용 정정 W3), `review/consistency/2026/07/10/22_25_21/*`
  - 상세: 순수 문서 산출물. 런타임 코드 경로에 영향 없음.
  - 제안: 없음.

- **[INFO]** 1단계-2단계 사이 TOCTOU 간극(상태 변경 race) — 기존과 동일 위험 클래스, 신규 아님
  - 위치: `interaction.service.ts:276-301`
  - 상세: stage-1 조회와 stage-2 조회 사이에 execution 상태가 바뀌거나(`waiting_for_input` → 다른 상태로 resume) row 가 갱신될 수 있다. 그러나 응답은 항상 특정 시점 스냅샷이고, `threadRow`가 `null`이면 기존 "durable thread 없음" graceful 경로(`conversationThread` 키 미동봉)로 흡수된다(테스트 "2단계 재조회가 null(조회 간 row 소멸)이면 conversationThread 키 미동봉"로 커버). 종전 코드도 `execution` 스냅샷 이후 `nodeExecutionRepository.findOne` 을 별도 쿼리로 호출하는 동일 패턴의 race 를 이미 갖고 있었다.
  - 제안: 없음(기존 위험과 동급, 신규 부작용 아님).

## 요약

`getStatus()` 만 변경됐고, 신규로 조립된 `ExecutionStatusDto` 를 반환하므로 partial entity(select 로 인해 일부 필드가 `undefined`인 `Execution` 인스턴스)가 함수 밖으로 유출되는 경로는 없음을 코드·호출 그래프(`interaction.controller.ts` 단일 진입점, `hooks.service.ts` 는 `interact()`만 사용)로 확인했다. `select` 컬럼명은 전부 정확한 camelCase 이며 DTO 조립에 쓰이는 필드 전부를 커버한다. `Promise.all` 도입으로 stage-2 의 에러 reject 출처가 비결정적으로 바뀌지만 두 경로 모두 동일하게 미가공 500 으로 전파되어 외부 관찰 가능한 차이는 없고, DB 왕복 증가(`waiting_for_input` 분기 한정 2회→3회, 그중 2회 동시)도 PK 단건 조회라 커넥션 풀 부담 증가는 미미하다. 시그니처·wire 계약·타 메서드(`interact`/`cancel`/`refreshToken`/`loadAndAssertAlive`)에는 변경이 없으며, `plan/`·`review/` 문서 변경은 런타임과 무관하다. Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도

NONE
