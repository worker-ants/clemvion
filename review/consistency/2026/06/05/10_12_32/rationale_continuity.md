# Rationale 연속성 검토 결과

검토 모드: --impl-done, scope=spec/5-system/, diff-base=origin/main
검토 대상: `spec/5-system/` (1-auth.md, 10-graph-rag.md, 11-mcp-client.md) + plan `exec-park-durable-resume.md` 연관 spec 변경

---

## 발견사항

### [INFO] spec §7.4 Worker 동작 행 — fast-path 서술이 Rationale 의 "Sticky fast-path 제거" 결정과 표면 불일치

- **target 위치**: `spec/5-system/4-execution-engine.md` §7.4 표 "Worker 동작" 행 (line 822) 및 §7.5 case 1 (lines 870-871)
- **과거 결정 출처**: 동 파일 `## Rationale` > "Sticky fast-path 제거 — '항상 publish' 원칙 보존" (line 1206-1208)
- **상세**: Rationale 은 "채택안에서는 sticky fast-path 를 제거하고 '항상 BullMQ enqueue' 로 통일한다"고 명시한다. 그러나 spec body §7.4 "Worker 동작" 행은 여전히 "로컬 `pendingContinuations` 에 키가 있으면 즉시 resolve (in-instance fast path)"를, §7.5 diagram 도 "case 1: 로컬 pendingMap 키 있음 → 즉시 resolve() (fast path)"를 현행 설계로 기술하고 있다. 이는 #468 구현 이후 코드 현실과 Rationale 의 "제거" 결정이 spec body 에 아직 반영되지 않아 생긴 이중 진술 상태다. plan `exec-park-durable-resume.md` 도 이 상황을 "consistency W5/I2"로 인지해 Phase B 완료 시 동기 갱신을 예고하고 있으나, 갱신 전까지는 spec 본문에 두 개의 상충하는 모델이 공존한다.
- **제안**: Phase B spec 갱신 시 §7.4 "Worker 동작" 행에서 fast-path 분기 서술을 제거하거나 "순수 최적화(의존 금지)" 로 격하하고, §7.5 diagram 에서 case 1/case 2 이분법을 "항상 rehydration" 단일 흐름으로 수정. plan line 92-93 의 spec 변경 항목이 이를 이미 포함하고 있으므로, Phase B PR 에서 일괄 반영하면 됨.

---

### [INFO] `conversation-thread.md §4` — "신규 DB 컬럼 없음" 전제 번복이 §8.4 Rationale 에 명시돼 있으나 §4 본문의 옛 문구 잔재 여부

- **target 위치**: `spec/conventions/conversation-thread.md` §4 영속화 표 및 §8.4 (line 209-213, 330-340)
- **과거 결정 출처**: 동 파일 §4 옛 문구 / 실행 엔진 §6.2 L725 "신규 DB 컬럼 없음" 원칙
- **상세**: `spec/conventions/conversation-thread.md §8.4` 는 "'신규 컬럼 없음' 원칙과의 정합"을 명시적으로 설명하며, "원칙의 번복이 아니라 적용 범위 분리"임을 Rationale 에 기록한다. plan `exec-park-durable-resume.md` D1 항목도 "conversation-thread §4/§7/§8.4 세 앵커 동기 갱신 완료"를 표기하고 있다. 실제 §4 영속화 표(line 209)와 §8.4(line 330-340)은 채택 결정 + 대안 기각 이유가 충분히 기록돼 있어 Rationale 연속성은 유지됨. 이 항목은 완료 상태로 기록만 남긴다.
- **제안**: 없음 (이미 정합화 완료).

---

### [INFO] `spec/5-system/1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md` — 관련 Rationale 충돌 없음

- **target 위치**: 위 세 파일 전체
- **과거 결정 출처**: 각 파일 내 `## Rationale` 섹션
- **상세**: 검토 범위 내 auth(1.4.A~1.4.I, 1.5.A~1.5.C), graph-rag, mcp-client 의 Rationale 기록과 본문 설계 사이에 기각된 대안의 재도입, 합의된 원칙 위반, 무근거 번복, invariant 우회 사항이 발견되지 않았다. 특히:
  - auth §1.4.D — WebAuthn 등록 사용자에게 TOTP fallback 자동 제공 금지: 본문과 Rationale 일치.
  - auth §1.4.E — counter 역행 시 suspend 아닌 삭제: 본문과 Rationale 일치.
  - graph-rag — KB 모드 사후 변경 불가, 추출 LLM 분리: 본문과 Rationale 일치.
  - mcp-client §2.1 — stdio 미지원: 본문과 Rationale 일치.
  - mcp-client Rationale "Sticky fast-path 제거"는 실행 엔진 §7.4 범위이며 mcp-client 자체에는 적용 없음.
- **제안**: 없음.

---

## 요약

검토 대상 `spec/5-system/` 문서군에서 Rationale 연속성 위반에 해당하는 CRITICAL·WARNING 수준의 항목은 발견되지 않았다. 유일한 주목 지점은 `spec/5-system/4-execution-engine.md §7.4/§7.5` 본문이 Rationale 의 "Sticky fast-path 제거" 결정을 아직 반영하지 않아 본문과 Rationale 사이에 기술 불일치가 존재한다는 것으로, 이는 plan `exec-park-durable-resume.md` Phase B 의 예정된 spec 갱신(consistency W5/I2) 항목으로 이미 추적 중이다. `conversation-thread.md §8.4` 의 "신규 컬럼 없음" 원칙 번복은 Rationale 에 근거와 기각 대안이 충분히 기록돼 정합화가 완료된 상태이며, auth/graph-rag/mcp-client spec 은 Rationale 기록과 본문 설계 사이에 충돌이 없다.

## 위험도

LOW
