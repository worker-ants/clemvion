# Rationale 연속성 검토 — spec-draft-rotate-conflict.md

## 발견사항

- **[INFO]** `@VersionColumn` 기각 근거에 이미 있는 코드베이스 선례를 인용하지 않았다
  - target 위치: `plan/in-progress/spec-draft-rotate-conflict.md` L73-76 (`⑤ Rationale` 새 항목의 "기각한 대안 — `@VersionColumn` 낙관적 잠금")
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` L1488 "기존 패턴의 일반화" — "optimistic claim 은 §1.3 `_retryState` 소비('affected=1 인 쪽만 진행')로 이미 확립된 패턴의 일반화이지 새 동시성 프레임워크 도입이 아니다"
  - 상세: target 은 "컬럼 신설(마이그레이션) 대신 이미 있는 컬럼을 조건에 넣는다" 는 결정을 **이 항목에서 새로 발견한 절충안**처럼 서술한다. 그런데 정확히 같은 기법(조건부 UPDATE + affected 로 레이스를 판정하는 "optimistic claim")이 실행엔진 Rationale 에 이미 **일반화된 정책**으로 못박혀 있고, 거기서도 "concurrency=1 전제 유지" 같은 대안을 기각하며 "새 동시성 프레임워크(예: 버전 컬럼 계열) 도입" 을 배제하는 동일한 논리를 쓴다. target 자신이 "한 엔티티에만 버전 컬럼을 두면 다음 사람이 «왜 여기만»을 묻는다" 고 우려하는데, 그 질문에 대한 가장 강한 답은 "이 컬럼 신설 회피가 Integration 만의 임시방편이 아니라 이 코드베이스가 이미 여러 곳(§1.3 `_retryState`, §7.5 재개 claim)에서 채택한 표준 패턴을 rotate 에 적용한 것" 이라는 사실인데, 그 답이 target 에 없다.
  - 제안: L73-76 뒤에 한 줄 추가 — "이 판단은 즉흥이 아니다: [실행엔진 §Rationale '기존 패턴의 일반화'](../../spec/5-system/4-execution-engine.md#기존-패턴의-일반화) 가 이미 조건부 UPDATE(affected 기반 optimistic claim)를 새 락 메커니즘 도입보다 우선하는 정책으로 확립해 두었다 — rotate 는 그 정책을 다른 엔티티에 적용하는 사례일 뿐이다." (BLOCK 대상 아님, Rationale 강화 제안.)

- **[INFO]** advisory lock 대안이 검토 목록에서 누락 — 단, 같은 문서 안에 이미 있는 기각 논리로 그대로 방어된다
  - target 위치: `plan/in-progress/spec-draft-rotate-conflict.md` L73-76 (검토된 대안이 `@VersionColumn` 하나뿐)
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "BullMQ `cafe24-token-refresh` 큐 — 멀티 인스턴스 race 해소" 의 "검토 후 배제한 대안 — PostgreSQL advisory lock": "lock 보유 중 HTTP 요청(Cafe24 endpoint)을 transaction 안에 묶어야 해 DB 커넥션 점유 시간이 늘고 ... 운영 부담이 더 큼"
  - 상세: rotate 도 "연결 테스트(Database·HTTP, 실제 접속이라 **수 초**)" 를 커밋 전에 수행하는 동일한 모양의 문제(락을 잡은 채 느린 외부 I/O 를 기다려야 하는 경우)다. `acquireTriggerConfigLock` 류의 advisory lock 이 이 코드베이스에 실재하는 만큼, 다음 리뷰어가 "왜 advisory lock 을 안 썼나" 를 물을 여지가 있다. 다행히 그 질문에 대한 답은 이미 같은 spec 문서 안(BullMQ Rationale)에 있으므로 **새로 만들 필요는 없지만**, target 이 그 답을 rotate 문맥으로 끌어와 명시하지 않으면 사후에 "advisory lock 을 검토 안 하고 놓쳤다" 는 오해를 산다.
  - 제안: 같은 자리에 "advisory lock 은 검토하지 않았다 — 연결 테스트가 수 초짜리 외부 I/O 라 락 보유 중 DB 커넥션을 묶는 비용은 이미 [BullMQ cafe24-token-refresh Rationale 의 advisory lock 기각](../../spec/2-navigation/4-integration.md#bullmq-cafe24-token-refresh-큐--멀티-인스턴스-race-해소) 이 같은 이유로 배제한 것과 동형이다" 정도의 한 문장을 추가하면 향후 재제안을 선제 차단한다.

- **[INFO]** `updated_at` 술어 유예 판단은 기존 Rationale 방법론(측정 우선)과 정합 — 인용만 비어 있음
  - target 위치: L77-81
  - 과거 결정 출처: 특정 단일 Rationale 항목은 아니나, `spec/2-navigation/4-integration.md` 전반의 Rationale 서술 패턴(예: "`§9.1` 표 비고" 항의 "*그 반증 근거를 `--spec` 이 잡아냈다*" 식 실측-우선 서술, `autoRefresh` 항의 "옛 attention 술어가 왜 거짓 양성이었는지" 실측 우선 서술)과 같은 결이다
  - 상세: 지적 사항이라기보다 확인 — `updated_at` 을 구현 술어로 확정하지 않고 "아직 검증하지 않은 의심" 으로만 남긴 것은 이 문서군이 반복해 온 "확인 안 된 주장을 사실처럼 적지 않는다" 원칙과 일치한다. 위반 없음, 참고로만 기록.

## 요약

target(`spec-draft-rotate-conflict.md`)이 새로 쓰는 `## Rationale` 항목 "«rotate 동시 실행을 first-writer-wins 로»"은 기존 spec 의 어떤 Rationale 도 뒤집거나 기각된 대안을 재도입하지 않는다. 오히려 `@VersionColumn`(신규 마이그레이션) 대신 기존 컬럼 조건부 `update` 를 택한 결정은 `spec/5-system/4-execution-engine.md` 가 이미 "optimistic claim = 확립된 패턴의 일반화, 새 동시성 프레임워크 도입 아님" 으로 명문화해 둔 정책과 방향이 정확히 일치하고, advisory lock 을 배제한 (암묵적) 판단도 같은 문서 안의 BullMQ cafe24-token-refresh Rationale 이 이미 세워 둔 "락 보유 중 느린 외부 I/O 를 묶지 않는다" 는 원칙과 부합한다. 다만 target 은 이 두 선례를 명시적으로 인용하지 않아, 정합성 자체는 유지되지만 "왜 이 설계가 임시방편이 아니라 확립된 패턴의 적용인가" 를 다음 독자에게 스스로 증명하지 못하는 약점이 있다 — Rationale 강화(인용 추가) 를 권고한다. `updated_at` 술어를 사실로 단정하지 않고 유예한 판단은 기존 문서의 실측-우선 서술 관행과 일치한다. Critical/Warning 급 충돌은 발견되지 않았다.

## 위험도
LOW
