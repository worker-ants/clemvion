# 요구사항(Requirement) 리뷰

## 범위 요약

이번 라운드(`18_13_45`)는 이전 라운드(`17_55_50`) SUMMARY 의 WARNING 5건에 대한 fix 커밋
(`15374b657`)을 포함한다. 실질 코드 변경은:

1. `ai-turn-orchestrator.service.ts` — `assertLinkedTransitionApplied` 의 `markNodeCancelled`
   호출을 `try/catch` 로 감싸, 마킹 실패(reject)가 `ExecutionCancelledError` 를 삼키지 않게 함.
2. `execution-engine.service.ts` — `executeSync` timeout catch 가 `updateExecutionStatus` 의
   반환값(`persisted`)을 소비해 동시 cancel 선점 시 warn 로그를 남김.
3. `retry-turn.service.ts` — `markSpawnedRowFailed`/`prepareSuccessTermination` 헬퍼 추출,
   `completeRetryExecution` 성공 종결 시 `error` 를 명시적으로 null 처리.
4. `execution.entity.ts` — `error` 필드 타입을 `Record<string, unknown> | null` 로 정정
   (DB `nullable: true` 와 정합).
5. 이전 라운드 WARNING 5건에 대한 정정: JSDoc 위치 이동(W1), 관측 로그 2건에 대한 spy 단언
   추가(W2·W3), `executions.service.ts` JSDoc 갱신(W4), CHANGELOG 추가(W5).
6. `plan/in-progress/*.md` 2건 — C-4 처분 근거 등재, worktree 필드 갱신.
7. `review/code/2026/09/01/17_55_50/*` — 이전 라운드 리뷰 산출물 커밋(RESOLUTION/SUMMARY 등).

## 검증 방법 (본 라운드 독립 실측)

- `npx jest retry-turn.service.spec.ts ai-turn-orchestrator.service.spec.ts execution-engine.service.spec.ts`
  → **3 suites / 595 tests 전부 PASS** (직접 실행 확인).
- **W1 (JSDoc orphan) 직접 대조**: `retry-turn.service.ts:711-782` 를 `Read` 로 열어 확인 —
  `completeRetryExecution` 의 21줄 JSDoc(`@internal … defensive fallback 에서만 호출`)이 이제
  `:757-769`, 실제 선언(`:777`) 바로 위에 있고, `markSpawnedRowFailed`(:711-721)·
  `prepareSuccessTermination`(:736-750) 은 각자 올바른 JSDoc 을 갖는다. 이전 라운드가 지적한
  orphan 이 실제로 해소됨을 확인.
- **W2 대조**: `execution-engine.service.ts:4313-4322` — `persisted` 반환값을 `if (!persisted)`
  로 소비해 warn 로그. 대응 테스트(`execution-engine.service.spec.ts:3823-3832`)가
  `expect(warnSpy).toHaveBeenCalledWith(...)` 로 실제 단언함을 확인.
- **W3 대조**: `ai-turn-orchestrator.service.ts:409-432` 의 `try/catch` 가 실제로 `err` 를
  삼키지 않고 `logger.error` 로 `nodeExec.id`+원본 에러 메시지를 실은 뒤 정상적으로
  `ExecutionCancelledError` 를 throw 함을 코드로 확인. 대응 테스트가 두 페이로드를 모두
  `stringContaining` 으로 단언.
- **독립 뮤테이션 재현 (본 세션 1건)**: `assertLinkedTransitionApplied` 의 `catch (err) {`
  블록 최상단에 `throw err;` 를 주입해 종전 버그(원본 예외 재-throw)를 재현 →
  `ai-turn-orchestrator.service.spec.ts` 신규 테스트가 **RED**
  (`Expected constructor: ExecutionCancelledError / Received constructor: Error`),
  나머지 88 테스트는 그대로 PASS. RESOLUTION.md 의 뮤테이션 주장(load-bearing)을 독립
  재현으로 확인. 원복은 저장소 밖 사본이 아니라(스크립트 중단으로 소실) 주입한 정확한
  한 줄(`417: throw err;`)을 `sed -i '' '417d'` 로 정밀 제거해 처리 — `git diff` 로
  변경분 0 확인, `git status --short` 로 저장소가 이 세션 출력 디렉터리 외 clean 함을 확인.
  (규약상 저장소 밖 scratch 사본을 우선해야 하나, 이번엔 `mktemp -d` 로 만든 사본 경로가
  bash 세션 간 환경변수 비영속으로 유실됐다 — 대신 주입 내용을 정확히 알고 있어 라인
  단위 정밀 제거로 동등하게 원복했음을 명시한다.)
- **atomic-consume SQL 대조**: `retry-turn.service.ts:215-230` 을 직접 읽어
  `jsonb_exists(output_data, '_retryState')` 가드 + `output_data - '_retryState'` 키 제거식이
  신규 테스트(`retry-turn.service.spec.ts:245-264`)의 단언과 문자 그대로 일치함을 확인.
- **guarded UPDATE `error` 컬럼 대조**: `execution-engine.service.ts:8737`
  (`error = $8::jsonb`)가 `execution.error == null ? null : JSON.stringify(execution.error)`
  를 그대로 쓴다는 커밋 메시지·JSDoc 주장을 코드에서 직접 확인 — `prepareSuccessTermination`
  이 `error=null` 을 세팅하지 않으면 이전 시도의 `error` 가 성공 종결에도 영속되는 것이
  사실임을 검증.
- `execution.entity.ts:80-81` 의 `@Column({ type: 'jsonb', nullable: true }) error` 는
  타입 변경 전부터 `nullable: true` 였음을 확인 — TS 타입만 DB 와 어긋나 있었다는 주장과
  일치.

## 발견사항

- **[INFO]** `markSpawnedRowFailed` JSDoc 에 `@param spawnedRow` 태그가 누락돼 있다(다른 두
  파라미터 `logContext`/`errorMessage` 는 있음). 저장소 관행상 필수 위반은 아니며 이미
  본 세션 SUMMARY(INFO 11)에서 동일하게 지적됨 — 신규 발견 아님, 조치 불요 수준.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` (게이트
    657~665, `markSpawnedRowFailed` 선언부).

- **[INFO]** spec fidelity — `spec/1-data-model.md:325` (`error | JSONB? | 실패 시 에러 요약`)
  는 이번 fix(성공 종결 시 `error` 를 명시적으로 null 처리)의 근거와 방향이 일치한다
  ("실패 시" 요약이라는 서술이 성공 종결에는 `error` 가 없어야 함을 암묵 전제). `retry_last_turn`
  atomic-consume 의 SQL 형태(`spec/5-system/4-execution-engine.md:238`, "동일 트랜잭션에서
  `_retryState` 키 제거(소비) + 새 NodeExecution row spawn … 키 제거가 affected=1 인 쪽만
  진행해 동시 retry 중복 spawn 차단")도 신규 테스트가 고정한 실제 SQL(`jsonb_exists` 가드 +
  `output_data - '_retryState'`)과 line-level 로 부합한다. `markNodeCancelled` 실패 시 처리
  (catch 후 관측·재-throw)를 규정하는 spec 본문은 없음(`spec/conventions/node-cancellation.md`
  §2.4 는 "마킹한 뒤 전파" 까지만 서술하고 마킹 실패 시 동작은 침묵) — 회색지대이며
  SPEC-DRIFT 아님(코드가 spec 의도를 더 정교화한 것이지 spec 서술과 어긋나는 것이 아님).
  `plan_impact` 가 `spec/` 미변경과 일치.

- **[INFO]** 이전 라운드가 지적한 WARNING 5건 전부가 이번 diff 에서 실제로 해소됐음을 코드
  직접 대조 + 테스트 실행 + 1건 독립 뮤테이션 재현으로 확인. 새로운 CRITICAL/WARNING 없음.

## 요약

이번 fix 커밋은 이전 라운드 SUMMARY 의 WARNING 5건(JSDoc orphan, 관측 로그 2건 미검증,
`executions.service.ts` JSDoc drift, CHANGELOG 누락)을 모두 정확히 겨냥해 해소했다. 세 핵심
동작 처방(취소 마킹 실패 시 분류 유지, timeout guarded UPDATE 반환값 로깅, 성공 retry 종결
시 옛 `error` 클리어) 모두 코드·테스트가 spec/plan 서술과 line-level 로 일치하며, 신규 테스트는
vacuous 하지 않음을 본 세션에서 독립적으로(전체 스위트 실행 + 1건 뮤테이션 재현) 재확인했다.
`markSpawnedRowFailed` 의 `@param` 누락 1건만 사소한 INFO 로 남는다. 관련 spec 본문
(`spec/1-data-model.md`, `spec/5-system/4-execution-engine.md §7.9`,
`spec/conventions/node-cancellation.md §2.4`)과의 불일치는 발견되지 않았다.

## 위험도

NONE
