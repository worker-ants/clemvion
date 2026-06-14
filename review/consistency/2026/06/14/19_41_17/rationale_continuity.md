# Rationale 연속성 검토 결과

## 발견사항

- **[INFO]** `TERMINAL_REVOKE_RECONCILE_QUEUE` 상수 분리 — `.types` 파일로 추출
  - target 위치: `external-interaction.module.ts` import 변경 (diff lines 1202–1206)
  - 과거 결정 출처: `14-external-interaction-api.md §Rationale R15` — `execution_token` outbox 패턴, `TerminalRevokeReconcilerService` 설계 원칙
  - 상세: `TERMINAL_REVOKE_RECONCILE_QUEUE` 상수를 `terminal-revoke-reconciler.service.ts` 에서 `terminal-revoke-reconciler.types.ts` 로 분리한 것은 코드 모듈 응집도 개선(순환 의존 차단) 목적의 순수 리팩토링이다. 설계 원칙·인터페이스 계약·동작 변경이 없다.
  - 제안: Rationale 갱신 불필요. 현행 R15 기술 범위(설계 결정) 밖의 구현 세부.

- **[INFO]** `DEV_EPHEMERAL_SECRET` — 하드코딩 fallback 대체
  - target 위치: `interaction-token.service.ts` diff (lines 1271–1278), `const DEV_EPHEMERAL_SECRET = randomBytes(32).toString('hex')`
  - 과거 결정 출처: `14-external-interaction-api.md §8.3 Token 일반 규약` — "미설정 시 dev 는 비보안 placeholder 로 떨어지지만 `NODE_ENV=production` 에서는 `InteractionTokenService` 생성자가 throw 해 서버 부팅을 차단(fail-closed)". 구 코드 주석 `'interaction-fallback'` 이 과거 고정 문자열이었음을 시사.
  - 상세: 프로덕션 fail-closed 보장은 변경 없다. dev fallback 을 고정 문자열(`'interaction-fallback'`)에서 **프로세스 시작 시 1회 생성하는 랜덤 32바이트**로 교체한 것이다. 이로써 (a) 버전 이력에 예측 가능한 secret 이 노출되지 않고, (b) 재시작마다 dev 토큰이 무효화돼 "고정 dev secret 을 prod 에서도 쓰는" 실수를 구조적으로 차단한다. §8.3 의 fail-closed 원칙을 강화하는 방향이라 Rationale 와 충돌하지 않는다.
  - 제안: §8.3 에 "dev fallback 은 ephemeral random(재시작마다 변동)" 한 문장 보완 시 완전한 문서화가 된다. 필수는 아니나 INFO 로 기록.

- **[INFO]** 만료 `execution_token` row 도 `repo.delete` 로 정리 — 테스트 assertion 추가
  - target 위치: `interaction-token.service.spec.ts` diff (lines 1258–1259): `expect(repo.delete).toHaveBeenCalledWith({ executionId: 'exec-1' })`
  - 과거 결정 출처: `14-external-interaction-api.md §Rationale R15` — "revoke 는 idempotent(jti blacklist SET·row DELETE 재실행 무해)", `execution_token` 이 durable outbox 역할
  - 상세: 기존 테스트는 만료된 jti(ttl≤0)에 대해 Redis blacklist SET 이 호출되지 않음만 검증했다. 신규 assertion 은 ttl≤0 이더라도 `execution_token` row 가 `delete` 되어야 함을 추가 검증한다. R15 의 "execution_token 이 durable outbox" 원칙에서 "row 가 잔존하면 sweep 이 매 tick 마다 동일 행을 재처리하는 낭비 발생" 이라는 암묵적 요건이 있었는데, 이번 테스트가 그 불변조건을 명시적으로 고정한다. Rationale 에 이미 내포된 의미를 테스트로 가시화한 것으로, 결정 번복이 아니다.
  - 제안: Rationale 갱신 불필요. 기존 R15 의 "row DELETE 재실행 무해" 기술이 이미 커버.

- **[INFO]** `RECONCILE_CONCURRENCY(20)` 초과 시 다중 청크 처리·집계 정확성 테스트 신설
  - target 위치: `interaction-token.service.spec.ts` diff (lines 1229–1248)
  - 과거 결정 출처: `14-external-interaction-api.md §Rationale R15` — reconciliation sweep 의 at-least-once 보장
  - 상세: 25건 row 를 20-concurrency 청크로 나눠 처리할 때 집계(`swept`/`revoked`)가 청크 경계에서 누락되지 않음을 검증하는 새 테스트다. R15 의 "idempotent + at-least-once" 보장 요구를 구현 레벨에서 검증하는 확장이며, 설계 결정 위반이 아니다.
  - 제안: Rationale 갱신 불필요.

- **[INFO]** System Status API — `recentFailed` 주 지표화 + `recentFailedCapped` boolean
  - target 위치: `16-system-status-api.md` §2 QueueStatusDto, §3 health 규칙 3, §Rationale R-5
  - 과거 결정 출처: `16-system-status-api.md §Rationale R-2` — 과거 "상수 비용" 관찰 문구 존재 가능성, R-5(신규) 에서 명시 번복
  - 상세: health 규칙 3 의 비교 대상이 `failed`(누적 보관) → `recentFailed`(최근 윈도우)로 바뀌고, `getJobCounts` 단독 호출(상수 비용)에서 `getFailed()` 스캔 추가(비선형 비용)로 구현이 변경됐다. 이 번복은 R-5 를 신설해 "상수 비용 관찰은 설계 원칙이 아니었다"·"현재 상태 반영 우선 + 스캔 캡으로 비용 상한 보장"·"운영자는 설정값 재검토 필요" 를 명시했다. `SYSTEM_STATUS_FAILED_THRESHOLD` 의 비교 대상 변경 운영 영향도 R-5 에 경고로 포함됐다. 무근거 번복이 아니다.
  - 제안: Rationale 연속성 관점 추가 조치 불필요. R-5 자체가 해당 번복의 근거 문서.

---

## 요약

검토 범위(EIA spec `14-external-interaction-api.md`, System Status API `16-system-status-api.md`, 관련 구현 diff)에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 우회하는 변경은 발견되지 않았다. 코드 변경은 (a) 상수 추출 리팩토링, (b) dev fallback 보안 강화, (c) 기존 R15 에 내포된 불변조건의 테스트 가시화, (d) R-5 로 근거가 명시된 지표 주/부 분화로 구성된다. System Status API 의 "상수 비용" 전제 변경은 R-5 신설로 Rationale 연속성이 유지된다. 외부 WebSocket 채널 보류(R5), 단일 sink 정책(R10), 전용 outbox 미신설(R15), 403 대신 401 통일(R14) 등 핵심 기각 결정은 모두 현행 구현에서 유지되고 있다.

## 위험도

NONE
