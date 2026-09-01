# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `executeSync` timeout catch 의 `persisted` 반환값 소비(이번 diff 의 존재 이유 그 자체)를 검증하는 테스트가 없다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4313-4322`
    (신규 `const persisted = await this.updateExecutionStatus(...)` + `if (!persisted) { this.logger.warn(...) }`)
  - 상세: 이 hunk 의 주석 자체가 명시한다 — "동작은 양쪽 다 정확하지만 관측이 갈리면 … 로그로
    추적할 수 없다". 즉 이 diff 가 바꾸는 유일한 **관측 가능한 차이**는 `persisted===false` 일 때
    `logger.warn(...)` 이 새로 호출된다는 것뿐이고(그 뒤로는 무조건 `throw err` 로 빠져나가 다른
    분기가 없다), 그런데 이 새 로그 호출을 검증하는 테스트가 하나도 없다.
    `execution-engine.service.spec.ts:3782` (`'timeout 경로 — reload 이후 guarded UPDATE 를 동시
    cancel 이 선점하면(0행) naked save 로 폴백하지 않는다 (실제 race)'`)가 정확히 이 전제조건
    (`mockExecutionRepo.query.mockResolvedValueOnce([])` → guarded UPDATE 0행 → `persisted=false`)을
    이미 세팅해 두고도 `save` 미호출만 확인하고 `logger.warn` 호출 여부는 단언하지 않는다. 같은
    파일에 `jest.spyOn(logger, 'warn')` 패턴이 여러 곳(예: 3599-3601)에 이미 존재해 관용구가
    없는 것도 아니다. `if (!persisted) { this.logger.warn(...) }` 블록을 통째로 지워도 이 changeset
    안의 어떤 테스트도 RED 로 안 떨어진다 — 이 PR 전체가 지켜 온 "가드 제거 시 RED 확인"
    관행에서 이 hunk 만 빠져 있다.
  - 제안: 위 3782 테스트(또는 신규 테스트)에 `const warnSpy = jest.spyOn((service as unknown as
    {logger:{warn:jest.Mock}}).logger, 'warn');` 을 추가하고
    `expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('동시 cancel 이 이미 terminal'))`
    같은 단언을 붙인다.

- **[WARNING]** `assertLinkedTransitionApplied` 의 신규 `catch` 블록이 남기는 `logger.error` 관측 로그가 검증되지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:416-431`
    (신규 `catch (err) { this.logger.error(...) }`) / 대응 테스트:
    `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.spec.ts:267-294`
    (`'markNodeCancelled 가 실패해도 ExecutionCancelledError 로 종결한다…'`)
  - 상세: 이 fix 의 핵심 동작(`ExecutionCancelledError` 가 여전히 던져진다, `markNodeCancelled` 가
    실제로 호출됐다)은 신규 테스트가 잘 고정했다 — 대조군·[전제] 단언·`.rejects.not.toThrow` 까지
    포함해 완성도가 높다. 다만 그 catch 블록의 주석이 스스로 밝히는 처방은 "마킹 실패 자체는
    여전히 문제다 … **관측**(어느 짝 row 가 non-terminal 로 잔류하는지 로그)" 인데, 정작 그 로그
    (어느 `nodeExec.id`, 어느 `phase`, 어느 원본 에러 메시지가 실리는지)는 어떤 테스트도 확인하지
    않는다. 같은 spec 파일 안에 `jest.spyOn(logger, 'error').mockReturnValue(undefined)`(1640행)
    관용구가 이미 있어 실행 비용이 낮다. plan 체크리스트(`ie-resume-turn-boundary-cancel.md`)가
    이 항목을 "뮤턴트(try/catch 제거) → RED 1" 로 종결 표시했는데, 그 RED 1은 **재throw 여부**만
    검증한 것이지 로그 페이로드 자체는 아니다 — try/catch 를 완전히 제거하는 뮤턴트는 잡히지만,
    `this.logger.error(...)` 호출부만 지우거나 메시지에서 `nodeExec.id`/`phase`/`err.message` 를
    빠뜨리는 더 미세한 뮤턴트는 RED 로 떨어지지 않는다.
  - 제안: 신규 테스트에 `jest.spyOn(orchestrator['logger'], 'error')` 를 추가해 최소한
    "실패한 `nodeExec.id` 와 원본 에러 메시지가 로그에 실린다" 정도는 단언한다.

- **[INFO]** `retryLastTurn` atomic-consume 의 unit 회귀가 여전히 mock query-builder 경계 안쪽만 본다 — e2e 부재는 plan 이 이미 등재한 기지 갭
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts` 신규
    `'원자 consume 이 jsonb_exists 가드와 JSONB 키 제거로 구성된다'` 테스트
  - 상세: 이 테스트 자체는 매우 정밀하다(`set`/`andWhere` 인자를 실제로 캡처해 SQL 텍스트를
    문자 그대로 단언, 가드 제거 뮤턴트로 나머지 46개 테스트 전부 GREEN 이었다는 사실까지 실증) —
    새로 지적할 결함은 아니다. 다만 이 unit 은 query builder 를 mock 하므로 원리적으로 실제
    Postgres 의 `jsonb_exists`/`-` 연산자 유효성은 검증 못 한다. 이 갭은 `retry-turn-terminal-guard.md`
    C-4 처분 표에 "COALESCE 실 DB 검증 | e2e 인프라가 필요하다" 로 이미 스스로 등재·유예해
    뒀으므로 새 발견으로 카운트하지 않는다 — 참고용으로만 남긴다.

## 요약

이번 changeset 의 정정 로직 자체(취소 오분류 방지, 짝 row FAILED 헬퍼 통합, 성공 종결 시
`error` 초기화, atomic-consume SQL 가드)는 뮤테이션 테스트 규율이 매우 높다 — 각 fixture 가
실제로 그 분기를 가르는 값인지 의식적으로 설계했고([전제] 단언, `NOT_CALLED` sentinel 로
vacuous 통과를 차단하는 패턴, 호출부별 독립 뮤테이션 고정 등), 신규 edge-case 3건
(`!nodeExec`/`retryAfterSec` fallback/양쪽 타임스탬프 부재)도 각각 실제로 분기를 가르는
값으로 구성돼 있다. 반면 이번 diff 에는 두 곳에서 **"관측(로그)이 이 변경의 존재 이유"라고
스스로 밝히면서 정작 그 로그 자체는 테스트하지 않는** 동일 패턴의 결함이 반복된다
(`execution-engine.service.ts` 의 `persisted` warn, `ai-turn-orchestrator.service.ts` 의 catch
`logger.error`) — 둘 다 기능적으로는 안전하지만(핵심 분류/재throw 는 검증됨), 로그 문구 자체를
지우거나 훼손하는 뮤턴트는 이 changeset 의 어떤 테스트로도 잡히지 않는다. 같은 파일들에
`jest.spyOn(logger, 'warn'|'error')` 관용구가 이미 존재해 추가 비용은 낮다.

## 위험도

LOW
