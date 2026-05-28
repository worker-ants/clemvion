# 요구사항(Requirement) 리뷰 결과

## 리뷰 대상 커밋

`840db52d` — fix(external-interaction): terminal jti revoke 를 notification config 게이트 위로 hoist

---

## 발견사항

### [WARNING] notification-fanout.service.ts — triggerId 없는 terminal event 에서 revoke 미수행 (설계 결정이나 spec 과의 gap 확인 필요)

- 위치: `notification-fanout.service.ts` `handle()` — triggerId guard 직후, revoke 블록 앞 (라인 81–90 / commit 840db52)
- 상세: `payload.triggerId` 가 없으면 (수동 실행 등) 함수가 early-return 한다. 이 시점은 revoke 블록보다 앞이므로, `triggerId` 가 없는 webhook 기반 execution 이 terminal 상태로 종료될 때도 revoke가 호출되지 않는다. spec EIA-AU-04 는 "per_execution 토큰은 execution 종료(completed/failed/cancelled) 시 즉시 invalidate" 이며, 이 조항에 `triggerId` 존재 여부를 조건으로 달지 않는다. 현재 구현은 `triggerId` 가 payload 에 실렸을 때만 revoke가 동작한다.
  - 반론(구현 측 주석 관점): 코드 주석은 "webhook 이 시작한 execution 만 trigger 가 알려진다"고 설명하며, 수동 실행(`triggerId` 없음)은 `interaction.enabled=false` 로 토큰 자체가 없으므로 revoke 대상이 아닐 수 있다. 그러나 `routing context 미등록`으로 triggerId가 누락된 webhook-triggered execution 도 같은 경로로 skip 되며, 그 경우 `per_execution` 토큰이 존재함에도 revoke가 발생하지 않는다.
  - spec §9.1 의 처리 흐름(단계 13)은 "종료 시: TX commit 후 notification + SSE 둘 다 발송 → SSE 종료, 토큰 invalidate"라고 기술한다. notificationFanout 에서만 revoke를 담당하고 있으므로, 이 경로가 막히면 다른 invalidation 경로가 없다.
- 제안: triggerId early-return 위로도 terminal + iext 토큰 존재 케이스에서 revoke를 호출하거나, 혹은 revoke 책임을 ExecutionEngine 종료 트랜잭션 측으로 이동해 NotificationFanout의 guard 순서에 종속되지 않도록 한다. 최소한 "routing context 미등록 시 webhook terminal event 에서 revoke 미발생" 케이스를 테스트로 명시하고 TODO로 추적해야 한다.

---

### [WARNING] notification-fanout.service.spec.ts — 'triggerId 없는 terminal' 케이스에서 revoke 미호출이 의도적인지 테스트가 명확하지 않음

- 위치: `notification-fanout.service.spec.ts` — "triggerId 없는 manual 실행 terminal → revoke 미호출" 테스트 (라인 517–522)
- 상세: 테스트 이름에 "manual 실행"이라고 명시되어 있고, 그 의도는 불필요 쿼리 회피. 그러나 위 WARNING에서 설명한 대로 webhook-triggered execution 이 routing context 미등록으로 triggerId가 없을 경우에도 동일 경로로 revoke가 skip 된다. 테스트가 "manual 실행에 한정한 정상 skip"을 검증하고 있는지, 아니면 "webhook execution 에서도 허용 가능한 skip"으로 의도되었는지가 불분명하다.
- 제안: 테스트 설명에 "per_execution token 없는 경우만 해당 — routing context 미등록 webhook execution 은 별도 TODO"와 같은 context 를 추가하거나, 해당 엣지 케이스를 별도 테스트로 분리해 추적한다.

---

### [INFO] interaction.guard.spec.ts — TOKEN_REVOKED 케이스의 HTTP 상태 코드 미검증

- 위치: `interaction.guard.spec.ts` — 신규 테스트 "blacklisted reason → TOKEN_REVOKED 401" (라인 57–75 of diff)
- 상세: 테스트가 `response.error.code === 'TOKEN_REVOKED'` 와 `X-Refresh-Token-Url` 헤더를 검증한다. spec EIA-AU-06은 "토큰 무효/만료 시 `401`"을 요구하는데, NestJS `UnauthorizedException`이 자동으로 HTTP 401을 반환하는 것은 맞으나 단위 테스트 레벨에서 `status: 401`을 직접 assert하지 않는다. 기존 다른 테스트와 일관된 패턴이므로 치명적이지 않다.
- 제안: 기존 테스트 스타일에 맞추되, 필요 시 통합 테스트에서 HTTP 401 상태 코드까지 검증하는 테스트를 추가한다.

---

### [INFO] spec EIA-AU-06 에서 정의한 에러 코드 목록과 guard 매핑의 완전성

- 위치: `interaction.guard.ts` `mapReason()` + spec §5.1 에러 표
- 상세: spec §5.1 에러 표는 `TOKEN_INVALID` / `TOKEN_EXPIRED` 를 명시한다. 구현에는 `TOKEN_REVOKED` / `TOKEN_SCOPE_MISMATCH` / `TOKEN_AUDIENCE_MISMATCH` 도 추가로 존재한다. spec 본문에 `TOKEN_REVOKED` 는 명시적 코드로 정의되지 않으며(§5.1 에러 표에 없음), `TOKEN_SCOPE_MISMATCH`는 `SCOPE_MISMATCH`로 표기되어 있다(403, not 401). 구현의 `reason: 'scope_mismatch'` → `TOKEN_SCOPE_MISMATCH` + 401 은 spec의 `SCOPE_MISMATCH` + 403과 HTTP 상태 코드가 다를 수 있다.
- 제안: spec §5.1 에러 표와 guard의 에러 코드/HTTP 상태 코드 매핑을 line-level로 정합 확인. `TOKEN_REVOKED` 코드를 spec §5.1 에러 표에 추가하는 것을 `project-planner`에 위임. 현재 테스트가 guard 내부 동작만 검증하므로 HTTP 상태 코드 분기가 의도대로인지 통합 테스트로 검증 필요.

---

### [INFO] spec EIA-AU-04 — "즉시 invalidate" 보장 범위: NotificationFanout 단일 경로 의존

- 위치: `notification-fanout.service.ts` + spec §3.3 EIA-AU-04 + spec §9.1 단계 13
- 상세: EIA-AU-04 는 "execution 종료 시 즉시 invalidate"를 요구하며, 본 fix가 notification gate 위로 revoke 블록을 이동시켜 interaction-only 트리거에도 적용되도록 수정한 것은 올바르다. 그러나 `revokeAllForExecution`의 단일 호출 경로가 `NotificationFanout.handle()` 뿐이며, 이 service는 `WebsocketService.executionEvents$` 구독 기반이다. RxJS 구독이 drop되거나 process 재시작 시 in-flight terminal event가 소실될 경우 revoke 가 누락될 가능성이 있다. spec은 이 신뢰성 요건에 대해 침묵한다.
- 제안: 이 신뢰성 gap을 spec §3.4 또는 §9.3에 명시하거나, execution 종료 트랜잭션 자체에서 revoke를 호출하는 outbox/after-commit 방식을 검토하도록 `project-planner`에 위임한다.

---

### [INFO] notification-fanout.service.ts — JSDoc 주석이 commit 840db52 기준으로 올바르게 업데이트됨 (긍정 확인)

- 위치: `notification-fanout.service.ts` 클래스 상단 JSDoc (라인 31–42 of diff 기준)
- 상세: 이전 주석("v1 은 jti 추적 인프라가 없어 fail-open으로 진행")이 제거되고 "outbound notification config 유무와 독립"으로 올바르게 업데이트됨. 의도와 구현이 일치한다.

---

## Spec Fidelity 점검

### spec 참조: `spec/5-system/14-external-interaction-api.md`

| spec 요구사항 | 구현 상태 |
|---|---|
| EIA-AU-04: execution 종료 시 즉시 invalidate (필수) | 부분 충족 — notification config gate 위로 이동해 interaction-only 트리거 케이스는 해결. 단 triggerId 없는 terminal event 케이스는 여전히 skip (상세 WARNING 참조) |
| EIA-AU-06: TOKEN 무효/만료 시 401 + X-Refresh-Token-Url 헤더 | 충족 — guard deny() + setHeader 검증 테스트 포함 |
| §5.1 에러 코드 TOKEN_REVOKED | spec §5.1 표에 TOKEN_REVOKED 코드가 명시적으로 없음 — spec 결함 의심. `project-planner` 위임 필요 |
| §5.1 에러 코드 SCOPE_MISMATCH → 403 | 구현은 TOKEN_SCOPE_MISMATCH + 401. spec의 403과 불일치 가능 — 추가 확인 필요 |
| EIA-NX-02 fanout 이벤트 화이트리스트 | FANOUT_EVENTS set 과 일치 |
| §3.3 EIA-AU-04 "outbound notification config 유무와 독립" | 구현 위치가 notification gate 위로 이동 — 충족 |

---

## 요약

이번 fix의 핵심 의도 — revoke 블록을 notification config 게이트 위로 이동해 interaction-only 트리거(notification 미설정)에서도 terminal event 시 `revokeAllForExecution`이 호출되도록 하는 것 — 는 구현에 정확히 반영되어 있으며, spec EIA-AU-04 의 "notification config 유무와 독립" 요건을 충족한다. 신규 단위 테스트(fanout 8케이스 + guard blacklisted 케이스)는 버그 경로를 결정적으로 커버하며, 회귀 방지 관점에서 충분하다. 다만 두 가지 WARNING 이 남는다: (1) `payload.triggerId` 가 없는 terminal event(routing context 미등록 webhook execution 포함)에서는 여전히 revoke가 skip되는 경로가 존재하며, 테스트도 "manual 실행" 한정으로만 설명되어 webhook execution 에서의 skip 의도가 불명확하다. (2) spec §5.1 에러 표에 `TOKEN_REVOKED` 코드가 누락되어 있고 `SCOPE_MISMATCH` 의 HTTP 상태 코드(403 vs 401)가 구현과 불일치할 수 있다 — spec 결함으로 `project-planner` 위임이 필요하다.

## 위험도

MEDIUM
