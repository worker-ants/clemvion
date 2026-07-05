# Rationale 연속성 검토 결과

## 검토 대상
- target: `plan/in-progress/spec-draft-g1-withdraw-ws-start-gate.md`
- 모드: spec draft 검토 (`--spec`)
- 대조 spec: `spec/5-system/4-execution-engine.md`(§11, Rationale), `spec/5-system/6-websocket-protocol.md`(§4.2, Rationale), `spec/3-workflow-editor/3-execution.md`(§8.2, §9, Rationale), `spec/5-system/2-api-convention.md`(§10.3, Rationale), `spec/data-flow/3-execution.md`, `plan/in-progress/execution-engine-residual-gaps.md`, `plan/in-progress/spec-sync-websocket-protocol-gaps.md`

## 사실관계 검증 (target 인용의 정확성)

target 이 인용한 아래 사실들을 실제 spec 파일에서 직접 확인했다 — 전부 일치:

- `spec/5-system/6-websocket-protocol.md` §4.2 (line 195-224): `execution.start`/`execution.stop`/`execution.continue`/`execution.step`/`execution.start.ack` 모두 `_(계획·미구현 WS 경로)_` 로 명시. line 197: "구현 현실 — 실행 시작/중단은 REST" 명시 박스.
- 같은 문서 `## Rationale`(line 945 이하) "전송 계층 정정" 항(line 953-960): raw-WS 프로토콜 전제가 폐기되고 Socket.IO 구현에 맞춰 정정됐으며, `execution.start`/`stop`/`start.ack` WS 경로는 "미구현 (Planned) 으로 분리한 약속" 목록에 명시적으로 포함 — **삭제가 아니라 표기 분리가 의도적 결정**임을 스스로 기록.
- `spec/3-workflow-editor/3-execution.md` §8.2(line 309-311): "실행 **시작**은 WS 명령이 아니라 REST … WS 명령은 채널 구독·입력 대기 상호작용에 한정" — REST-only 확정, 명령 표(line 313-322)에 `execution.start`/`stop` 없음.
- 같은 문서 §9(line 330): `POST /api/workflows/:id/execute` body `input.fromNodeId` 로 부분 실행 — 이미 동작.
- `spec/5-system/4-execution-engine.md` §11 line 1226, 1228: target 이 지적한 정확히 그 문구(WS `execution.start` 를 활성 gate 대상 나열, `3-execution.md §8.2` cross-ref, "Phase 2 에서 WS handler 신설 시 동일 gate 추가 예정") 확인.
- `spec/5-system/2-api-convention.md` §10.3 line 278: `execution.start/stop/continue` 를 Planned 표기 없이 나열 — 확인.
- `plan/in-progress/execution-engine-residual-gaps.md` G1 항목(line 31-43): "⛔ BLOCKED" 상태이며, 차단 사유 자체가 "`execution.start` 핸들러 신설은 net-new 기능… spec 확정 전 developer 단독 구현 불가"로 이미 2026-05-30 시점에 이 gap 이 실체 없는 net-new 기능(gap 아님)임을 암시.
- `plan/in-progress/spec-sync-websocket-protocol-gaps.md`(2026-06-03): `execution.start`/`stop` WS 명령 + ack 을 "미구현 항목"으로 이미 별도 추적 중 — WS-protocol spec Rationale 과 완전히 정합.
- `spec/5-system/3-error-handling.md` line 116: `SERVER_SHUTTING_DOWN` 코드 설명이 이미 "**HTTP 진입점**은 503 으로 표기"라고만 서술 — WS 언급 없음. 즉 인접 spec 은 이미 target 이 주장하는 "HTTP 전용" 현실과 정합돼 있고, 오히려 engine §11 line 1226 쪽이 outlier(stale) 였음을 뒷받침.

## Rationale 연속성 판단

target 의 핵심 주장 — "G1 은 gap 이 아니라 engine §11 의 stale 서술"과 "WS `execution.start` 는 이미 6-websocket-protocol.md §4.2 Rationale 에서 Planned 로 의도적으로 분리됐다" — 는 기존 Rationale 을 **뒤집는 것이 아니라 그대로 인용·존중**하는 방향이다. 6-websocket-protocol.md 의 "전송 계층 정정" Rationale 은 스스로 "삭제하지 않고 _(계획·미구현)_ 로 표기 분리"를 의도적 결정이라 못박았고, target 은 이 결정을 engine §11 에도 일관되게 반영하는 조치일 뿐이다. 새로운 대안을 도입하거나 과거에 기각된 설계를 되살리는 부분은 발견되지 않았다.

engine §11 자체의 forward-ref("Phase 2 에서 WS handler 신설 시 동일 gate 추가 예정")에 대해서도, target 은 그 의도를 삭제하지 않고 변경 2 의 대체 문구("그 Planned WS 시작 경로가 향후 도입되면 동일한 SIGTERM 503 gate 를 함께 적용한다")에 명시적으로 보존한다 — "무근거 번복"이 아니라 조건부 커밋을 정확한 조건(Planned 승격 시점)으로 재서술한 것이다.

### 발견사항

- **[INFO]** §11 변경 2 의 "Phase 1/Phase 2" 프레이밍 완전 제거 시 인접 항목(§11 항목 4의 "Phase 1 구현 범위" 노트, G2 plan)과의 용어 정합 재확인 필요
  - target 위치: 변경 2 (line 64-67)
  - 과거 결정 출처: `4-execution-engine.md` §11 line 1237 "Phase 1 구현 범위… `continue` 정책 분기는 Phase 2 의 `execution-continuation` BullMQ 큐가… 추가 예정" (G2 관련, 아직 살아있는 문구)
  - 상세: target 은 line 1228 의 "Phase 1 구현 범위" 문구를 "REST 전용이라 이 두 진입점으로 시작 gate 가 완결된다"는 표현으로 교체하면서 "Phase 1/Phase 2" 어휘를 걷어낸다. 이는 G1 문맥에서는 타당하나(더 이상 미래 Phase 로 미룰 대상이 없으므로), 바로 아래(line 1237, target 미변경 대상)의 §11 항목 4 는 여전히 "Phase 1 구현 범위… Phase 2 의 `execution-continuation` 큐"라는 동일 어휘를 G2 관련 서술로 유지한다. 같은 §11 절 안에서 항목 1(변경됨, Phase 어휘 제거)과 항목 4(미변경, Phase 어휘 유지)가 나란히 다른 스타일로 남는 점은 오독 위험이 낮지만 문서 일관성 관점에서 완전하지 않다.
  - 제안: 변경 4(plan G1 WITHDRAWN 처리) 커밋 시, §11 항목 4의 "Phase 1/Phase 2" 문구는 G2 소관이므로 본 draft 범위 밖임을 plan/spec 어딘가에 한 줄로 명시(예: "§11 항목 4의 Phase 1/2 어휘는 G2 관할, 본 변경 범위 아님")해 두면 향후 읽는 사람이 "왜 항목 1 만 정리됐는가"를 바로 파악할 수 있다. 선택적 보완이며 필수 차단 사유는 아니다.

- **[INFO]** spec_impact 목록에 `6-websocket-protocol.md`/`3-workflow-editor/3-execution.md`/plan 파일 누락 (읽기 참조뿐이라 낮은 우선순위)
  - target 위치: frontmatter `spec_impact` (line 26-28)
  - 과거 결정 출처: 해당 없음 (Rationale 위반이 아니라 문서 완결성 관점)
  - 상세: 변경 2 는 `6-websocket-protocol.md §4.2` 로의 상대경로 cross-ref 를 수정하지만 그 문서 자체는 편집 대상이 아니므로 spec_impact 미기재가 틀린 것은 아니다. 다만 변경 4(plan 파일 WITHDRAWN 처리)는 `plan/in-progress/execution-engine-residual-gaps.md` 를 직접 편집하므로, 이 plan 파일도 넓은 의미의 "영향받는 문서"로 체크리스트나 커밋 계획에 명시돼 있는지 확인 권장(현재 변경 4 항목에 이미 명시돼 있어 실질 누락 아님 — 정보성으로만 기록).
  - 제안: 조치 불요. 현재 변경 4 서술로 충분히 커버됨.

## 요약

target 의 결론(G1 은 gap 이 아니라 engine §11 의 stale 서술이며 WS `execution.start` 시작 경로는 REST-only 확정 + WS 는 Planned)은 `6-websocket-protocol.md`, `3-workflow-editor/3-execution.md`, `3-error-handling.md`, 그리고 두 개의 관련 plan 문서(`execution-engine-residual-gaps.md`, `spec-sync-websocket-protocol-gaps.md`)에 이미 기록된 명시적·정합적 결정들을 그대로 인용하고 있으며, 어떤 문서에서도 이를 뒤집는 반대 결정은 발견되지 않았다. WS `execution.start` 를 "삭제가 아니라 Planned 표기로 분리"한 결정은 6-websocket-protocol.md 자체 Rationale 이 이미 확정한 것이고, target 은 그 결정의 파급을 engine §11 에 뒤늦게 반영할 뿐이다. §11 의 "Phase 2 에 WS gate 추가 예정"이라는 과거의 조건부 커밋도 삭제되지 않고 "Planned 경로 도입 시 동일 gate 적용"으로 정확히 재서술돼 보존된다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 사례는 모두 발견되지 않았다. 위에 기록한 2건은 INFO 수준의 문서 완결성 제안이며 병합을 막을 사유가 아니다.

## 위험도

NONE
