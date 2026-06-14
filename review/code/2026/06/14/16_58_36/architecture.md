# 아키텍처(Architecture) 리뷰

리뷰 대상: EIA terminal revoke reconciler — fresh ai-review (16_58_36)
변경 핵심: `TERMINAL_STATUSES` → `RECONCILE_TERMINAL_STATUSES` 상수 rename, `system-status.constants.ts` 큐 등록, e2e 목록 갱신, spec/data-flow 큐 카탈로그·R15 부팅정책 보강

---

## 발견사항

### [INFO] 상수 이름 rename — 책임 명확화 및 충돌 회피
- 위치: `interaction-token.service.ts` — `RECONCILE_TERMINAL_STATUSES` 상수 (구: `TERMINAL_STATUSES`)
- 상세: 이전 리뷰에서 지적된 `TERMINAL_STATUSES` 이름 충돌(같은 폴더 내 `interaction.service.ts`의 `ReadonlySet`과 동명)이 `RECONCILE_TERMINAL_STATUSES` prefix 추가로 해소되었다. 용도(`SQL IN 절용 배열`)와 스코프(`reconcileTerminalRevocations` 전용)가 이름에 반영되어 단일 책임 원칙을 더 명확히 표현한다. 새 주석에 타입 및 용도 차이(`ReadonlySet` vs `readonly[]`)까지 명시되어 있어 유지보수자 혼선이 제거되었다.
- 제안: 없음.

### [INFO] 큐 상수 위치 — `system-status.constants.ts` 임포트 경로가 서비스 구현 파일을 직접 참조
- 위치: `system-status.constants.ts` — `import { TERMINAL_REVOKE_RECONCILE_QUEUE } from '../external-interaction/terminal-revoke-reconciler.service'`
- 상세: `NOTIFICATION_WEBHOOK_QUEUE`는 `notification-dispatcher.types.ts`(별도 types 파일)에서 임포트되는 반면, `TERMINAL_REVOKE_RECONCILE_QUEUE`는 서비스 구현 파일에서 직접 임포트된다. `system-status.constants.ts`가 `terminal-revoke-reconciler.service`의 구현 전체에 링크되는 형태라 모듈 경계가 약간 느슨하다. 현재 상수가 파일 최상단에 export되므로 실질 결합도는 낮으나, 패턴 일관성 관점에서는 `terminal-revoke-reconciler.types.ts`를 별도 생성하는 것이 더 명확하다.
- 제안: 현 규모에서는 허용 범위. 향후 `terminal-revoke-reconciler.types.ts` 분리를 검토하거나 "소규모 worker는 서비스 파일 내 상수 허용"을 코드베이스 규약에 명시해 의도를 확정한다.

### [INFO] `MONITORED_QUEUES` 등록 — 레이어 책임 적절
- 위치: `system-status.constants.ts` — `TERMINAL_REVOKE_RECONCILE_QUEUE` 항목 추가 (`group: 'system', concurrency: 1`)
- 상세: 큐 모니터링 레지스트리(`MONITORED_QUEUES`)에 신규 큐를 등록하는 것은 인프라/운영 레이어의 책임이며, 서비스 구현 파일이 아닌 `system-status.constants.ts`에 배치된 것은 레이어 책임 분리 원칙에 부합한다. `concurrency: 1`이 `@Processor` 데코레이터 설정과 일치하여 모니터링 메타데이터가 실제 worker 설정을 정확히 반영한다.
- 제안: 없음.

### [INFO] e2e 목록 동기화 — 단일 진실 원칙 유지
- 위치: `test/system-status.e2e-spec.ts` — `EXPECTED_QUEUE_NAMES`에 `'terminal-revoke-reconcile'` 추가
- 상세: 이전 일관성 검토(naming_collision.md)에서 지적된 큐 카탈로그·`MONITORED_QUEUES`·e2e 목록 세 곳의 동기화 의무 중 `MONITORED_QUEUES`와 e2e 목록이 이번 diff에서 이행되었다. 세 레이어(spec 카탈로그 → 런타임 레지스트리 → 테스트 단언)가 동기화된 구조는 향후 큐 추가/삭제 시 누락을 컴파일/테스트 시점에 감지하는 방어망이 된다.
- 제안: 없음.

### [INFO] spec R15 부팅정책 보강 — fail-fast/fail-open 비대칭 의도 명문화
- 위치: `spec/5-system/14-external-interaction-api.md` R15 부팅정책 단락 추가
- 상세: `onModuleInit` 실패 시 fail-fast(서버 부팅 차단)와 매 tick reconcile 실패 시 fail-open(swallow·다음 tick 재시도)의 비대칭이 spec에 명문화되었다. 이는 이전 일관성 검토(rationale_continuity.md)에서 INFO 수준으로 제안된 내용이 반영된 것이다. 아키텍처 관점에서 부팅 가드(fail-closed)와 런타임 경로(fail-open)의 의도적 비대칭을 spec으로 공식화한 것은 추상화 수준 적절성 측면에서 긍정적이다.
- 제안: 없음.

### [INFO] spec 큐 카탈로그 갱신 — 단일 진실 원칙 충족
- 위치: `spec/data-flow/0-overview.md` — `terminal-revoke-reconcile` 큐를 카탈로그(16개)에 추가, 섹션 4 표에도 항목 추가
- 상세: 큐 카탈로그 SoT(`data-flow/0-overview.md §4`)가 신규 큐를 등재함으로써 spec → 코드 traceability가 완성되었다. 이전 일관성 검토에서 제기된 카탈로그 동기화 누락이 해소되었으며, EIA §3.4/§9.3 R15 cross-link도 포함되어 있어 spec 내 계층 간 참조가 완결적이다.
- 제안: 없음.

### [INFO] DIP — 구체 클래스 직접 주입 패턴 잔존
- 위치: `terminal-revoke-reconciler.service.ts` constructor (InteractionTokenService 직접 주입) — 이번 diff 미변경
- 상세: 이전 리뷰 기록(16_17_36 architecture.md)과 동일한 사항. `TerminalRevokeReconcilerService`가 `InteractionTokenService` 구체 클래스를 직접 주입받는 구조는 이번 diff에서 변경되지 않았다. 소비 메서드가 `reconcileTerminalRevocations` 하나뿐이어서 실질 결합도는 낮고, 현 규모에서 허용 범위임은 이전 리뷰와 동일한 판단이다.
- 제안: 현 수준 유지. 향후 `InteractionTokenService`가 비대해질 경우 `ITerminalRevokeSource` 인터페이스 추출 검토.

---

## 요약

이번 변경 세트는 이전 일관성 검토(16_28_07, 16_43_08)에서 제기된 아키텍처·모듈 경계 관련 이슈들을 체계적으로 해소하였다. `RECONCILE_TERMINAL_STATUSES` 상수 rename으로 같은 폴더 내 동명 상수 충돌이 제거되고 책임이 명확해졌으며, `MONITORED_QUEUES` 등록과 e2e 큐 목록 갱신으로 인프라 모니터링 레이어가 완비되었다. spec 큐 카탈로그 갱신과 R15 부팅정책 명문화로 아키텍처 결정의 단일 진실 원칙이 충족되었다. 순환 의존성 없음, 레이어 책임 분리 유지, spec-code traceability 완결. 남은 INFO 수준 포인트는 (1) 큐 상수 위치 패턴 불일치(`terminal-revoke-reconciler.service.ts` 직접 import vs 별도 types 파일 관례)와 (2) DIP 구체 클래스 직접 주입(이전 리뷰와 동일, 현 규모 허용) 두 가지이며, 아키텍처적 차단 요소는 없다.

---

## 위험도

LOW
