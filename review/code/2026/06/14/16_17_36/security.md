# 보안(Security) 리뷰 결과

## 발견사항

### [WARNING] JWT fallback secret 하드코딩 — dev/test 환경 비보안 서명 가능
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` L123
  `this.secret = envSecret ?? 'interaction-fallback';`
- 상세: `INTERACTION_JWT_SECRET` 및 `JWT_SECRET` 환경변수 모두 미설정 시 고정 문자열 `'interaction-fallback'` 으로 HS256 서명이 수행된다. production 에서는 throw 하는 fail-closed 가드(L112–117)가 존재하므로 운영 환경 직접 위협은 없다. 그러나 (1) dev/test 환경에서 발급된 토큰이 예측 가능한 secret 으로 서명되어 해당 토큰을 재사용·위조할 수 있는 위험이 잠재한다. (2) Docker Compose `NODE_ENV=development` 스택이 실수로 외부 노출되거나 staging 이 production 환경변수 누락 상태로 배포될 경우 공격 표면이 된다. 본 PR(reconciler)이 도입한 코드가 아니라 선존(pre-existing) 동작이다.
- 제안: `'interaction-fallback'` 대신 부팅 시 `crypto.randomBytes(32).toString('hex')` 로 ephemeral secret 을 생성해 재시작 간 재사용을 차단하거나, dev 환경에서도 `.env.local` 필수화 후 코드 내 하드코딩을 제거한다. 단기적으로는 선존 항목이므로 별도 보안 백로그 처리 권고.

### [WARNING] reconcile 실패 시 메트릭·알람 미수집 — 보안 이벤트 미관측
- 위치: `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.service.ts` L74–79 (`catch` 블록), `interaction-token.service.ts` L186–191 (`Promise.allSettled` 실패 핸들러)
- 상세: `reconcile()` 의 catch 블록과 `reconcileTerminalRevocations` 내부의 per-execution 실패는 `logger.error`/`logger.warn` 로그만 남기고 카운터·알람 wiring 이 없다. 토큰 revoke 는 보안 필수 작업이므로 실패가 반복·누적될 경우 운영자가 인지하지 못한 채 blacklist 등록 누락이 장시간 지속될 수 있다. 설계 상 R15 가 후속 항목으로 명시한 observability 이나 보안 위험도로 분류한다.
- 제안: fail-open 실패 카운터(`revoke_reconcile_fail_total` 등)를 Prometheus counter 또는 이에 상응하는 메트릭으로 증분하고, 임계치 초과 시 알람을 연결한다. 후속 plan 항목으로 추적.

### [INFO] batchLimit 입력 clamp — 인증된 내부 호출 경로로 위험도 낮음
- 위치: `interaction-token.service.ts` L144–147
- 상세: `reconcileTerminalRevocations(batchLimit)` 은 외부 HTTP 요청에 노출되지 않고 BullMQ 내부 잡 프로세서(`TerminalRevokeReconcilerService.process`)만 호출한다. `Math.floor` + `Math.min/Math.max` clamp 는 Infinity, NaN, 음수 등 이상 입력을 방어한다. 이번 PR 에서 신규 도입된 방어 코드로 올바르다.
- 제안: 없음.

### [INFO] TypeORM QueryBuilder 파라미터 바인딩 — SQL 인젝션 위험 없음
- 위치: `interaction-token.service.ts` reconcileTerminalRevocations QueryBuilder
  `.where('e.status IN (:...terminal)', { terminal: TERMINAL_STATUSES })`
- 상세: `TERMINAL_STATUSES` 는 코드 내 상수 배열이며, TypeORM named parameter binding 을 사용해 사용자 입력이 SQL 에 직접 합성되지 않는다. SQL 인젝션 위험 없음.
- 제안: 없음.

### [INFO] 에러 메시지 노출 범위 — logger 경유, 외부 미노출
- 위치: `interaction-token.service.ts` reconcile 실패 핸들러, `terminal-revoke-reconciler.service.ts` catch 블록
  `err instanceof Error ? err.message : String(err)`
- 상세: 에러 메시지가 NestJS Logger 를 통해 서버 로그에만 기록되고 HTTP 응답·클라이언트에는 노출되지 않는다. `String(err)` 는 Error 가 아닌 객체가 throw 될 경우 예상치 못한 내용을 포함할 수 있으나, BullMQ 잡 내부 경로라 외부 노출 경로가 없다.
- 제안: 없음.

### [INFO] Redis blacklist 키 — jti 가 예측 불가 랜덤값으로 구성
- 위치: `interaction-token.service.ts` (`randomBytes(16).toString('hex')`, `BLACKLIST_KEY_PREFIX = 'iext:blacklist:'`)
- 상세: jti 는 128-bit cryptographically secure random 값이므로 blacklist 키(`iext:blacklist:<jti>`) 에 대한 열거·충돌 공격이 실질적으로 불가능하다. Redis key prefix 고정으로 namespace 분리도 적절하다.
- 제안: 없음.

### [INFO] reconcile() public 가시성 — 내부 모듈 한정 위험 낮음
- 위치: `terminal-revoke-reconciler.service.ts` L71 (`async reconcile(): Promise<void>`)
- 상세: `reconcile()` 이 public 이라 NestJS DI 로 주입받은 코드에서 임의 호출이 가능하다. 그러나 (1) 메서드 자체가 멱등하고 fail-open 이며, (2) 해당 서비스는 외부 HTTP 경로로 노출되지 않고 동일 모듈 내에서만 소비된다. 실질적인 보안 위협은 낮다.
- 제안: 테스트 외 용도로 외부 호출 가능성이 생길 경우 `protected` 로 좁히는 것을 권고하나, 현재 설계에서 보안 위험 없음.

### [INFO] BullMQ 큐 이름 상수 public export — 내부 모듈 소비 한정
- 위치: `terminal-revoke-reconciler.service.ts` L6 `export const TERMINAL_REVOKE_RECONCILE_QUEUE`
- 상세: 큐 이름 문자열이 public export 로 노출되어 있으나 동일 모듈 내 `BullModule.registerQueue`·`@InjectQueue` 에서만 소비된다. 큐 이름 노출 자체가 직접적인 보안 위험은 아니지만, Redis 직접 접근 권한을 가진 공격자가 큐에 임의 잡을 주입할 수 있는 이론적 경로가 된다. 이는 Redis 접근 제어 수준의 문제다.
- 제안: Redis ACL 로 BullMQ 전용 사용자의 권한을 `LPUSH`/`RPOP` 대상 큐로 한정하는 운영 강화를 권고한다(큐 이름 변경과 무관한 인프라 설정).

---

## 요약

이번 변경은 EIA terminal token revoke 의 at-least-once 보장을 위한 BullMQ repeatable 스케줄러(`TerminalRevokeReconcilerService`)와 내부 sweep 메서드(`reconcileTerminalRevocations`) 를 추가한다. 보안 관점에서 신규 도입된 코드는 대체로 안전하다 — TypeORM 파라미터 바인딩으로 SQL 인젝션이 차단되고, jti 는 128-bit CSPRNG 값으로 blacklist 키 열거가 불가능하며, batchLimit clamp 로 과대 입력 방어가 추가되었다. 주목할 두 가지 경고는 모두 선존하거나 설계 상 후속으로 분류된 항목이다: (W1) `'interaction-fallback'` 하드코딩 secret 은 production fail-closed 가드가 존재하나 dev/test 위험이 잠재하며, (W2) revoke 실패에 대한 메트릭·알람 wiring 부재는 보안 이벤트 미관측 위험이다. 신규 코드가 도입한 외부 공격 표면은 없으며, 인증·인가 경로 변경도 없다.

---

## 위험도

MEDIUM
