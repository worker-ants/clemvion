# Rationale 연속성 검토 결과

대상: `plan/in-progress/spec-draft-webchat-execution-residuals.md` (A: single-flight coalesce webhook 드레인 / B: idle waiting GC)

검토 방법: target 이 인용하는 과거 결정 문구를 실제 spec 파일(`spec/5-system/4-execution-engine.md`, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md`, `spec/7-channel-web-chat/1-widget-app.md`, `spec/7-channel-web-chat/3-auth-session.md`, `spec/7-channel-web-chat/2-sdk.md`)에서 직접 재확인. target 이 이미 자체 수행한 `consistency-check`(C1/C2/W1-W3/I1-I2, 2026-07-11 16:45:01) 결과도 원문 대조로 재검증했다.

## 발견사항

- **[WARNING]** B-2 "주기 스캐너 예외" 근거가 job-based 대안 미검토 상태로 확정
  - target 위치: `## Rationale` R-B2 (b) 문단, `## 변경안` (3) execution-engine.md 편집안
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §Rationale "크래시/재시작 RUNNING 세그먼트 제어된 re-drive" 기각 대안 (b) (L1352: "recovery loop 주기적 스캔 추가 — 부팅 트리거로 재시작 resume 은 성립하고 운영 중 크래시는 PR4 stalled 가 본령이라 범위 밖") + "orphan pending backstop"(L1597: "같은 함수·트리거 재사용(별도 스캐너·주기 tick 없음) … §7.1/§7.4 가 반복 확정한 'heartbeat → stalled-job 일원화, 신규 주기 스캐너 미도입' 원칙 유지")
  - 상세: 두 인용 모두 정확히 원문과 일치한다(날조 아님 — target 의 "stalled 가 본령" 인용도 verbatim). target 은 "park 는 BullMQ job 이 애초에 없어(§4.x/§7.4) 두 기각의 전제('stalled 재배달이 본령')가 구조적으로 성립하지 않는다"는 논거로 원칙 예외를 정당화한다. 이 구분 자체는 타당하지만, 두 기각의 더 근본적인 동기는 "하트비트/스캐너 같은 별도 인프라 대신 BullMQ job 상태를 liveness/스케줄의 SoT 로 삼는다"는 더 일반적인 아키텍처 선호다. B-2 는 이 선호를 그대로 지킬 수 있는 job-based 대안 — 예: `refresh-token` 성공마다 재스케줄되는 execution 당 delayed BullMQ job(만료+grace 시점 자동 발화, 이미 §8 admission-gate 의 delayed 재큐 job·EIA-RL-06 reconciler 가 쓰는 것과 같은 계열) — 을 검토·기각한 흔적 없이 곧바로 "주기 스캔 + 원칙 예외"로 직행한다. 이 대안이 다중 jti의 `max(exp_at)` 추적·refresh 때마다 재스케줄이라는 비용 때문에 주기 스캔보다 더 무겁다는 판단이 실제로 맞을 수 있으나, 그 판단 자체가 R-B2 본문에 없어 "원칙 예외"가 다소 성급해 보인다.
  - 제안: R-B2 (b)에 "job-based 대안(토큰 발급/갱신마다 delayed job 재스케줄)을 검토했으나 다중 jti 추적·매 refresh 재스케줄 비용이 주기 스캔보다 크다고 판단해 기각"이라는 한 문장을 추가하거나, 최소한 아래 INFO 항목의 EIA-RL-06 선례를 인용해 "engine 원칙에 대한 예외"보다 "EIA 계층 기존 패턴의 확장"으로 재프레이밍할 것을 권한다. 어느 쪽이든 `spec/5-system/4-execution-engine.md` Rationale 예외 문구(변경안 (3))에도 동일 근거가 반영돼야 한다.

- **[INFO]** EIA-RL-06(terminal-revoke-reconciler) 선례 미인용 — "원칙 예외"보다 "기존 패턴 확장"으로 재프레이밍 가능
  - target 위치: (B-2) "메커니즘 — 주기 회수 + 원칙 예외" 문단, 변경안 (3)
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` §9.3 "Terminal token revoke 의 at-least-once"(EIA-RL-06) — "`execution_token` 기반 reconciliation sweep(BullMQ repeatable scheduler · 멀티 인스턴스 전역 1회)이 terminal execution 의 잔존 토큰을 주기적으로 회수" (`terminal-revoke-reconciler.service.ts` 이미 구현)
  - 상세: B-2 가 도입하려는 "주기 scheduled job(cron/BullMQ repeatable)"은 메커니즘 형태상 같은 EIA 도메인에 이미 채택·구현된 EIA-RL-06 reconciler와 동일 계열이다(둘 다 "terminal 판정 가능한 execution/token 을 주기적으로 쓸어담는 backstop"). 이는 target 이 강조하는 "execution-engine 원칙에 대한 구조적 예외"보다 훨씬 직접적이고 강한 continuity 근거인데, target 은 이를 인용하지 않아 예외 프레이밍이 실제보다 더 큰 원칙 위반처럼 읽힌다.
  - 제안: R-B2 및 execution-engine Rationale 예외 문구에 "EIA-RL-06(§9.3)이 이미 같은 계층에서 BullMQ repeatable scheduler 패턴을 채택한 선례"를 인용해 문서 간 정합성을 강화.

- **[INFO]** §1.1 상태 전이표의 기존 "타임아웃" 카테고리 미인용
  - target 위치: 변경안 (3), "불변식과의 관계" 섹션
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §1.1 Execution 상태 전이표, `waiting_for_input → cancelled` 행: "사용자 취소, **타임아웃**, 또는 rehydration 실패의 단말 케이스"
  - 상세: 전이표는 이미 "타임아웃"을 `waiting_for_input → cancelled`의 정당한 사유 중 하나로 명시해 두고 있었다(구체 메커니즘은 그동안 미정의 상태). B-2 는 이 미구체화 카테고리를 채널 idle-wait timeout 으로 처음 구현하는 것으로 읽을 수 있어, "새 원칙 예외"라기보다 "기존에 이미 예약돼 있던 전이 사유의 최초 구현"으로 안전하게 재서술할 수 있다.
  - 제안: 변경안 (3)·R-B2 에 §1.1 전이표의 "타임아웃" 문구를 cross-ref 로 인용해 CHANNEL_IDLE_TIMEOUT 이 그 자리를 채우는 것임을 명시.

- **[INFO]** widget-app.md 기존 R6 "방치 세션 정리" 서술과 B 설계의 정합 갱신 누락
  - target 위치: 변경안 (1) widget-app.md 편집 목록(§3.1 행 + §R7 + 신규 §R9)
  - 과거 결정 출처: `spec/7-channel-web-chat/1-widget-app.md` §R6("…패널 open 은 사실상 대화 의도이며, **방치 세션은 토큰 TTL/idle 만료로 정리된다**", eager-start 채택, 2026-06-06) vs 같은 문서 §3.1 "새 대화" 행("이전 execution 은 … `waiting_for_input` 로 잔존 … 위젯 측 **토큰만** TTL/idle 로 만료된다")
  - 상세: R6 는 "방치 세션은 … 정리된다"고 서술해 서버측 정리가 이미 일어나는 것처럼 읽히지만, 같은 문서의 §3.1 행은 정확히 "토큰만" 만료되고 execution 자체는 잔존한다고 명시하며, target 문서의 배경(§B)도 이 서버측 정리가 실제로는 미구현이었음을 전제로 B-2 를 신설한다. B-2 구현 후에는 R6 의 낙관적 서술이 (부분적으로) 사실이 되지만, target 의 변경안 (1)은 §3.1 행·§R7·신규 §R9 만 갱신 대상으로 잡고 R6 는 언급하지 않아, R6 의 "정리된다"는 문구가 여전히 근거 없는 낙관으로 남는다.
  - 제안: 변경안 (1)에 R6 각주 1줄 추가 — "방치 세션 정리"의 구체 메커니즘은 이전에는 토큰 실효뿐이었고 execution 회수는 EIA-RL-07/B-2 backstop 이 신규로 제공함을 cross-ref.

## 검증 결과 요약 (재확인된 항목 — 문제 없음)

- `cancelledBy: "user" | "system" | "timeout"` 닫힌 3값 union은 `spec/5-system/14-external-interaction-api.md:646`·`spec/5-system/6-websocket-protocol.md:179` 양쪽에서 실측 확인. C1 반영(`'timeout'` 재사용 + 신규 `error.code='CHANNEL_IDLE_TIMEOUT'`)은 실제로 enum 을 확장하지 않아 과거 결정과 정합.
- §7.4 carve-out 원문("노드별 `formConfig.timeout` 등 워크플로우 정의된 별도 timeout")은 `4-execution-engine.md:930`에서 정확히 확인됨 — target 의 "신규 확장(소급 아님)" 서술(W2 반영)이 원문과 일치.
- auth-session §3 시퀀스 7의 proactive refresh(`4-execution-engine.md` 아님, `3-auth-session.md:54`)와 §3.1 의 reload-401 optimistic refresh "미구현(Planned)" 캐비엇(`3-auth-session.md:62`)은 모두 원문과 정확히 일치 — W1 반영 타당.
- EIA §5.5 refresh-token 401 조건("execution 종료됨, 또는 expiresAt 까지 30분 이상 남음") + `Authorization: Bearer <expiring_iext_jwt>` 요구는 "완전 만료 토큰은 guard 가 선차단"이라는 target 의 핵심 논거(R-B2 신호 부분)를 뒷받침 — 확인됨.
- widget-app.md §3.1·§R7 현재 원문("이전 execution 은 명시 종료 명령을 보내지 않으므로…", "알려진 제약(Planned): … host-API 측 가드/드레인은 backlog")은 target 이 교체 대상으로 인용한 문구와 정확히 일치 — 날조 없음.
- EIA §7.1/§7.4 원칙 문구("`waiting_for_input` 은 job 이 없으므로 stalled/재큐/만료에 절대 걸리지 않음")도 verbatim 일치.

## 요약

target 문서는 자체 1차 `consistency-check`에서 CRITICAL(C2: "신규 주기 스캐너 미도입" 원칙 재도입)로 지적된 항목을 "폐기"가 아니라 "구조적 예외 명문화 + 양쪽 spec Rationale 동시 갱신"으로 해소하는 전략을 택했고, 이는 본 재검토 기준(과거 결정을 뒤집을 때 새 Rationale 동반)에 부합한다. 인용된 모든 과거 결정 문구(engine §7.1/§7.4/§1.1, EIA §5.4/§5.5/§9.3, widget-app §R6/§R7/§3.1, auth-session §3/§3.1)를 원문 대조한 결과 날조·왜곡은 발견되지 않았다. 다만 "신규 주기 스캐너 미도입" 원칙에 대한 예외를 확정하기 전에 job-based 대안(토큰 갱신마다 재스케줄되는 delayed job)을 명시적으로 검토·기각한 흔적이 없다는 점(WARNING)과, 예외를 뒷받침할 수 있는 기존 선례(EIA-RL-06 reconciler, §1.1 전이표의 "타임아웃" 카테고리)를 인용하지 않아 근거가 실제보다 약하게 읽힌다는 점(INFO 3건)이 남아 있다. 이들은 모두 target 의 결정을 뒤집을 필요는 없고, R-B2·변경안 (3)의 문구를 보강하면 해소되는 수준이다.

## 위험도

LOW
