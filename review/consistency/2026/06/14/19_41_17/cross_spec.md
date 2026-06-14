# Cross-Spec 일관성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done)
대상: `spec/5-system/14-external-interaction-api.md` (EIA) + `spec/5-system/16-system-status-api.md` (SystemStatus)

---

## 발견사항

### [WARNING] `terminal-revoke-reconcile` 큐가 `16-system-status-api.md` 레지스트리 표에 누락
- **target 위치**: `spec/5-system/14-external-interaction-api.md` §Rationale R15 마지막 문장 — "본 큐는 `system-status` 모니터링 레지스트리(`MONITORED_QUEUES`, group `system`)에 등재되어 운영 가시성을 확보한다"
- **충돌 대상**: `spec/5-system/16-system-status-api.md` §1 대상 큐 레지스트리 표 (15행, `terminal-revoke-reconcile` 행 없음)
- **상세**: EIA spec 이 `terminal-revoke-reconcile` 큐를 `system-status` 레지스트리에 등재할 것을 명시하고, 실제 구현 코드(`system-status.constants.ts` line 75)에도 이미 반영되어 있다. 그러나 `16-system-status-api.md` 의 §1 모니터링 큐 목록 표에는 해당 행이 없다. `data-flow/0-overview.md` §4 카탈로그에는 정상 등재되어 있다. 세 소스(EIA spec 약속 + code + data-flow)와 단 하나의 소스(16-system-status 표)가 불일치.
- **제안**: `spec/5-system/16-system-status-api.md` §1 표에 `| terminal-revoke-reconcile | system | 1 (기본) | repeatable cron (1분) — EIA RL-06 token sweep |` 행 추가.

### [INFO] `external-interaction.module.ts` diff 에서 참조하는 `terminal-revoke-reconciler.types` 파일이 미생성
- **target 위치**: git diff 의 `external-interaction.module.ts` hunk — `import { TERMINAL_REVOKE_RECONCILE_QUEUE } from './terminal-revoke-reconciler.types';`
- **충돌 대상**: 실제 파일시스템 — `codebase/backend/src/modules/external-interaction/` 에 `terminal-revoke-reconciler.types.ts` 가 존재하지 않음. 상수 `TERMINAL_REVOKE_RECONCILE_QUEUE` 는 현재도 `terminal-revoke-reconciler.service.ts` 에 위치.
- **상세**: diff 는 상수를 별도 `.types.ts` 파일로 분리하는 리팩터를 시사하지만, 해당 타입 파일이 diff 에 포함되지 않았거나 아직 생성되지 않은 상태다. `system-status.constants.ts` 도 여전히 `terminal-revoke-reconciler.service` 에서 직접 import 하고 있어 (`system-status.constants.ts` line 10), 빌드 단계에서 `.types` 파일이 없으면 컴파일 에러 발생 가능성이 있다. spec 차원 모순은 아니나 계층 책임 분리 측면에서 주의 필요.
- **제안**: `terminal-revoke-reconciler.types.ts` 파일 생성 여부를 확인하고, 생성 시 `system-status.constants.ts` import 경로도 함께 갱신.

### [INFO] dev 환경 fallback secret 표기 — spec 의 "비보안 placeholder" vs 구현의 "ephemeral random"
- **target 위치**: `spec/5-system/14-external-interaction-api.md` §8.3 Token 일반 규약 — "셋 다 미설정이면 dev 는 **비보안 placeholder** 로 떨어지지만"
- **충돌 대상**: 동일 파일 + `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` diff — `const DEV_EPHEMERAL_SECRET = randomBytes(32).toString('hex')` (모듈 로드 시 1회 생성하는 ephemeral random, 하드코딩 `'interaction-fallback'` 제거)
- **상세**: spec 은 "비보안 placeholder" (고정값 암시)라고 표현하지만, 구현은 프로세스당 ephemeral random secret 으로 교체했다. 이는 보안 측면에서 더 나은 방향이나, spec 의 표현과 구현 실체가 달라 독자에게 오해를 줄 수 있다 ("비보안 placeholder" 는 예측 가능한 고정 문자열처럼 읽힘). 기능적 의미(prod fail-closed)는 동일하므로 CRITICAL/WARNING 은 아니다.
- **제안**: `spec/5-system/14-external-interaction-api.md` §8.3 의 "비보안 placeholder" 를 "프로세스 시작 시 생성되는 임시 random 키(재시작마다 무효화)" 또는 동등한 표현으로 갱신해 구현 실체를 반영.

---

## 요약

본 구현 변경은 EIA spec (§14) 및 SystemStatus spec (§16) 전반과 대체로 정합한다. 핵심 data model(execution_token 테이블, InteractionTokenService 검증 경로, MONITORED_QUEUES 등록)과 API 계약(상태 코드, 에러 코드 네임스페이스, 토큰 family 분리)은 기존 spec 과 직접 모순을 일으키지 않는다. 다만 `terminal-revoke-reconcile` 큐가 EIA spec 과 코드에서 모두 `MONITORED_QUEUES group=system` 으로 선언되어 있음에도 `16-system-status-api.md` §1 표에만 누락된 점이 WARNING 수준의 동기화 갭이다. 나머지 두 발견사항(`.types` 파일 참조 문제, spec 표현 vs 구현 불일치)은 INFO 수준이며 기능 정합성에는 영향이 없다.

---

## 위험도

LOW
