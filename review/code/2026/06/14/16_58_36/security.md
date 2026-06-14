# 보안(Security) 리뷰 결과

## 발견사항

### [INFO] RECONCILE_TERMINAL_STATUSES 상수 rename — SQL 인젝션 위험 없음 (개선 확인)
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` — `TERMINAL_STATUSES` → `RECONCILE_TERMINAL_STATUSES` rename, QueryBuilder `.where('e.status IN (:...terminal)', { terminal: RECONCILE_TERMINAL_STATUSES })`
- 상세: 이번 diff 의 핵심 코드 변경은 상수명 rename 뿐이다. TypeORM named parameter binding(`:...terminal`)을 사용해 코드 상수 배열이 직접 SQL에 합성되지 않는다. SQL 인젝션 위험 없음. rename 자체는 동일 파일 내 `interaction.service.ts` 의 `TERMINAL_STATUSES: ReadonlySet<ExecutionStatus>` 와의 이름 충돌을 해소한 일관성 개선으로, 보안 관점에서 중립·긍정적이다.
- 제안: 없음.

### [INFO] TERMINAL_REVOKE_RECONCILE_QUEUE 모니터링 레지스트리 등록 — 보안 가시성 향상
- 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts` — `MONITORED_QUEUES` 배열에 `{ name: TERMINAL_REVOKE_RECONCILE_QUEUE, group: 'system', concurrency: 1 }` 추가
- 상세: 이 변경으로 `terminal-revoke-reconcile` 큐가 시스템 상태 모니터링 레지스트리에 등재된다. 큐 이름이 시스템 상태 엔드포인트를 통해 노출될 수 있으나, 이 엔드포인트는 인증된 관리자 전용 경로이며 큐 이름 자체가 공격 표면을 확장하지 않는다. 오히려 revoke 큐의 운영 가시성이 확보되어 이상 동작 탐지가 용이해지는 보안 개선이다. 이전 리뷰(15_59_50 W1)에서 지적된 revoke 실패 메트릭/알람 미수집 문제에 대한 부분적 보완이다.
- 제안: 없음.

### [INFO] e2e 테스트 큐 이름 추가 — 런타임 보안 영향 없음
- 위치: `codebase/backend/test/system-status.e2e-spec.ts` — `EXPECTED_QUEUE_NAMES` 에 `'terminal-revoke-reconcile'` 추가
- 상세: 테스트 파일의 기대 목록 갱신이며 런타임 동작에 영향이 없다. 큐 등록 정합을 강제하는 검증 코드로 인프라 설정 누락을 조기에 탐지하는 역할을 한다. 보안 관점에서 중립.
- 제안: 없음.

### [INFO] JWT fallback secret 하드코딩 — 선존(pre-existing) 항목, 본 diff 미변경
- 위치: `interaction-token.service.ts` — `this.secret = envSecret ?? 'interaction-fallback'` (이번 diff 에서 변경 없음)
- 상세: 이전 리뷰(15_59_50 W1, 16_17_36 W1)에서 동일하게 지적된 선존 항목이다. production `NODE_ENV==='production'`에서는 fail-closed throw 가드가 존재하므로 운영 직접 위협은 없으나 dev/test 환경의 예측 가능한 secret 위험이 잠재한다. 본 diff는 이 코드를 변경하지 않으므로 신규 위험을 도입하지 않는다. 별도 보안 백로그 처리 권고(기존 판단 유지).
- 제안: 별도 보안 백로그에서 처리. `crypto.randomBytes(32).toString('hex')` ephemeral secret 또는 dev 환경 `.env.local` 필수화.

### [INFO] 큐 이름 public export 및 Redis ACL — 인프라 수준 항목 (선존)
- 위치: `terminal-revoke-reconciler.service.ts` — `export const TERMINAL_REVOKE_RECONCILE_QUEUE` (이번 diff 에서 변경 없음, 단 `system-status.constants.ts` 에서 신규 import)
- 상세: `system-status.constants.ts` 가 `TERMINAL_REVOKE_RECONCILE_QUEUE` 를 import 함으로써 큐 이름이 한 곳 더 참조된다. 큐 이름 노출 자체가 직접 보안 위협은 아니나 Redis 직접 접근 권한이 있는 공격자에게 이론적 큐 주입 경로가 될 수 있다. 이 위험은 Redis ACL 제어 수준의 인프라 문제이며 본 diff 특유의 신규 위험이 아니다. 이전 리뷰(16_17_36)에서도 INFO 수준으로 분류됨.
- 제안: Redis ACL 로 BullMQ 전용 사용자 권한을 큐별 제한하는 운영 강화. 본 diff의 범위 외.

---

## 요약

이번 diff의 코드 변경은 세 가지로 국한된다: (1) `interaction-token.service.ts` 의 `TERMINAL_STATUSES` → `RECONCILE_TERMINAL_STATUSES` 상수 rename, (2) `system-status.constants.ts` 에 `TERMINAL_REVOKE_RECONCILE_QUEUE` 모니터링 등록, (3) e2e 테스트 큐 목록 갱신. 세 변경 모두 보안 취약점을 도입하지 않는다. SQL 인젝션은 TypeORM named parameter binding으로 차단되어 있으며, 상수 rename은 이름 충돌만 해소할 뿐 쿼리 동작에 영향이 없다. 모니터링 레지스트리 등록은 revoke 큐 가시성을 높여 보안 이벤트 탐지를 돕는 긍정적 변경이다. 이전 리뷰에서 지적된 JWT fallback secret(W1) 및 revoke 실패 메트릭 미수집(W2)은 본 diff 에서 변경이 없으며 동일 처리 판단(선존 dismiss / defer)이 유지된다. 신규 도입된 외부 공격 표면, 인증·인가 경로 변경, 하드코딩 시크릿 추가는 없다.

---

## 위험도

NONE
