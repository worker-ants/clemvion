# Rationale 연속성 검토

## 검토 범위 확인 (실측)

- `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`.
- prompt 번들의 `## 구현 변경 사항` 본문이 예산 절단으로 비어 있어(`⚠️ 본문 생략됨`), 워킹트리를 절대경로로 직접 재확인했다: `git diff origin/main --numstat -- codebase/` → 3파일 · 총 diff 248줄 일치.
  - `codebase/backend/src/modules/websocket/websocket-events.types.ts` (+10/-0)
  - `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` (+101/-0)
  - `codebase/backend/src/modules/websocket/websocket.gateway.ts` (+40/-14)
- `origin/main` 은 이미 `af41a3c6e`(change-password 코드 정렬) 까지 포함하고 있어, 이번 diff 는 **`auth/change-password` 작업이 아니라 그 이후의 WS `auth.token_expired` 타이머 하드닝 3커밋**(`69aad5d5d` → `b75e6a76b` → `80ac92668`, 코드리뷰 1R/2R 반영)이다.
- 이 코드가 근거하는 spec Rationale 은 단 하나의 SoT 로 수렴한다: [`spec/5-system/6-websocket-protocol.md#Rationale` — `R-ws-socket-lifetime-binds-token`](../../../../../spec/5-system/6-websocket-protocol.md) (2026-09-02 결정, 소켓 수명을 토큰 수명에 종속).

## 발견사항

발견 없음 — CRITICAL/WARNING 0건.

### 대조 결과 (참고용, 위반 아님)

- **기각된 대안 재도입 여부**: `R-ws-socket-lifetime-binds-token` 이 명시적으로 기각한 대안은 (1) emit 만 하고 disconnect 하지 않는 안, (2) 명령마다 재검증(guard)만 하는 안, (3) won't-do. 이번 diff 는 세 커밋 모두 **emit + disconnect 유지**를 전제로 재무장(rearm) 시 타이머 누수만 닫는 것이라 세 대안 중 어느 것도 재도입하지 않는다.
- **범위 이탈 여부**: Rationale 의 "닫지 않는 것 (범위 명시)" — 명시적 revoke(비번 변경 등) 는 본 결정이 다루지 않는다는 경계, 그리고 "타이머의 내성 범위: 프로세스에 로컬" 이라는 전제를 diff 가 그대로 유지한다. 새 코드(`clearExpiryTimers`, 재무장 시 선제 해제)는 **같은 프로세스 내 같은 `client.id` 재사용** 케이스만 다루며 다중 인스턴스 상태 정합(R10/R15/R19 클래스)에는 손대지 않는다 — 범위 확장 없음.
- **`.unref()` 추가와 graceful shutdown 계약 충돌 여부**: `spec/5-system/4-execution-engine.md §11`(SIGTERM drain, `ShutdownStateService.registerInFlight`, 30초 grace, `SERVER_INTERRUPTED`)은 **Execution/NodeExecution 데이터 정합성**을 위한 별도의 무거운 drain 계약이다. WS 만료 타이머는 그 추적 대상이 아니고(소켓 알림용 휘발성 타이머, DB 상태 없음) `unref()` 는 오히려 "이 타이머가 프로세스 종료를 붙잡지 않는다" 는 반대 방향의 성질이라 두 계약은 서로 다른 레이어를 다루며 충돌하지 않는다. 개발자가 이 트레이드오프(그레이스풀 셧다운 중 통지 유실 가능성)를 `80ac92668`(2R) 커밋에서 스스로 짚고 **런북 항목을 실제로 신설**해 재개 신호("관측되면 unref 를 걷고 명시 해제로 바꾼다")까지 적었다 — 무근거 결정이 아니라 트레이드오프를 인지·기록한 상태다.
- **결정 번복 없이 새 Rationale 누락 여부**: 이번 diff 는 기존 결정(`R-ws-socket-lifetime-binds-token`)의 **내용을 바꾸지 않고** 구현 견고성(재무장 누수 차단·optional 타입 좁히기·unref·메시지 상수화)만 보강한다. 이 결정 자체를 뒤집는 부분이 없으므로 새 spec Rationale 항목이 필요한 "결정 번복" 에 해당하지 않는다 — 이 저장소의 기존 관례(내부 구현 강건성 보강은 커밋 메시지·plan 문서에 근거를 남기고 spec Rationale 은 제품/계약 레벨 결정에만 신설)와 정합적이다. 근거는 커밋 메시지 3건 전체와 `plan/complete/ws-token-expired-socket-lifetime-impl.md`(재발·재수정 사이클 교차 참조 포함)에 상세히 남아 있다.
- **암묵적 invariant 우회 여부**: `expiryTimers` 맵을 `{ notice?, cutoff? }` → `{ notice, cutoff }` 로 non-optional 좁힌 것은 "둘은 항상 함께 만들어지고 함께 해제된다" 는 **기존에 이미 주석으로 명시돼 있던 invariant** 를 타입으로 승격한 것이지, 새 invariant 를 만들거나 기존 것을 우회한 것이 아니다.

## 요약

이번 diff(3파일/248줄, WS `auth.token_expired` 타이머 재무장·unref·상수화 하드닝)는 `spec/5-system/6-websocket-protocol.md` 의 `R-ws-socket-lifetime-binds-token` 결정이 정한 계약(emit+disconnect, 자연 만료 경로 한정, 프로세스-로컬 타이머)을 그대로 유지한 채 구현 견고성만 보강하며, 그 결정이 명시적으로 기각한 세 대안 중 어느 것도 재도입하지 않는다. `unref()` 추가가 실행 엔진의 graceful shutdown drain 계약(§11)과 표면적으로 인접해 보이지만 대상 레이어(휘발성 소켓 알림 vs Execution 데이터 정합)가 달라 충돌이 아니며, 그 트레이드오프는 개발자가 자체 발견해 런북 항목으로 문서화했다. spec/5-system 델타가 0인 것도 이 diff 가 결정 자체를 바꾸지 않는 내부 하드닝이라는 판단과 일치한다. Rationale 연속성 관점에서 문제 없음.

## 위험도

NONE
