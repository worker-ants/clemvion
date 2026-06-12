# Rationale 연속성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/5-system/)
검토 대상: spec/5-system/ 전체 (1-auth.md, 10-graph-rag.md, 11-mcp-client.md, 15-chat-channel.md 등)

---

## 발견사항

### [WARNING] CCH-CV-03 (b) 분기 현재 구현이 R9 기각 결정을 위반 중

- **target 위치**: `spec/5-system/15-chat-channel.md` §3.2 CCH-CV-03 (b) 분기 `미구현 (Planned)` 주석
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md ## Rationale R9` — "`running`/`pending` 케이스에서 사용자 메시지를 큐에 적재했다가 `waiting_for_input` 도달 시 재발사하는 안을 기각". 더 구체적으로 R9 는 즉시 안내 + update 무시(큐 미적재)를 확정 채택 결정으로 기록한다.
- **상세**: CCH-CV-03 (b) 의 spec 의도는 `running`/`pending` 상태에서 즉시 안내 발송 + update 무시이다. 그런데 CCH-CV-03 (b) 주석은 "현재 `HooksService.isActiveExecution` 이 비-terminal 상태를 `active` 로 collapse 하고 active 면 무조건 인터랙션 forwarding 한다" 며 R9 가 명시적으로 우려했던 input-sequence 충돌이 코드에 존재한다고 시인한다. 이 상태는 R9 가 기각한 대안("큐잉 또는 forwarding 지속")이 실질적으로 적용되고 있는 상태다. Spec 은 R9 결정("즉시 안내 + 무시")을 명시하지만 구현은 반대(forwarding 지속)를 유지하고 있다.
- **제안**: 구현 착수 전 단계이므로, CCH-CV-03 (b) 미구현을 해소하는 구현 계획에 R9 결정을 명시적으로 따라야 함을 확인한다. 구현 시 `isActiveExecution` 이 `waiting_for_input` / `running` / `pending` 을 구분하도록 수정하여 R9 결정과 정합시켜야 한다. 이미 spec 에 "R9 가 우려한 input-sequence 충돌이 현재 코드에 존재" 라고 명시되어 있으므로 별도 Rationale 갱신은 불필요하며 구현에서 R9 를 실현해야 한다.

---

### [INFO] CCH-NF-03 큐잉 정책과 R9 "큐 미적재" 결정의 표면적 긴장

- **target 위치**: `spec/5-system/15-chat-channel.md` §3.6 CCH-NF-03 ("초과분은 어댑터의 chat 단위 큐에 적재")
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md ## Rationale R9` — R9 는 `running` 케이스에서 "대기 큐 미적재"를 명시적으로 채택하고 큐잉 안을 기각했다.
- **상세**: R9 는 CCH-NF-03 의 rate limit 큐와 CCH-CV-03 의 execution lifecycle 큐가 다른 맥락임을 명시하므로 ("전자는 외부 사용자 폭주 방어, 후자는 execution life-cycle 정합") 내용상 충돌은 없다. 다만 CCH-NF-03 의 큐 적재 정책이 CCH-CV-03 (b) 미구현 상황에서 동작 시 rate limit 큐를 통해 `running` 케이스에 메시지가 축적되는 간접 경로가 생길 수 있다. 구현 시 두 큐의 적용 대상을 명확히 분리해야 한다.
- **제안**: 구현 시 CCH-NF-03 의 rate limit 큐 적재가 CCH-CV-03 (b) 의 R9 결정("running 상태에서는 update 무시")과 충돌하지 않도록 인터랙션 핸들러 내에서 순서(rate-limit 큐 → lifecycle 상태 검사 → 분기)를 명확히 정의할 것을 권장한다. Spec 보강보다는 구현 시 유의사항이다.

---

### [INFO] R-CC-18 의 `WORKSPACE_REQUIRED` → `WORKSPACE_ID_REQUIRED` 변경 — error-codes.md §5 등재 확인 권장

- **target 위치**: `spec/5-system/15-chat-channel.md ## Rationale R-CC-18` (마지막 Rationale 항목)
- **과거 결정 출처**: `spec/conventions/error-codes.md §2` "이름 정확성 향상만을 위한 rename 은 하지 않는다" + `§5 Rename 이력(retired codes)` 정책. R-CC-18 본문이 "옛 `WORKSPACE_REQUIRED` 는 [`error-codes.md §5 Rename 이력`](../conventions/error-codes.md#5-rename-이력-retired-codes) 에 등재 — user-docs 목록에만 노출됐고 client 하드코딩 분기가 없어 breaking 영향은 0 이다" 고 주장한다.
- **상세**: rename 절차(§5 등재)가 필요하다고 R-CC-18 스스로 명시하고 있다. 본 분석은 error-codes.md §5 의 실제 등재 여부를 별도로 확인하지 않았으나, R-CC-18 이 "등재" 를 선언한 만큼 구현 착수 전에 해당 파일에 실제로 등재되어 있는지 확인해야 한다. 등재가 누락된 경우 error-codes.md §2 의 rename 정책과 정합하지 않는 상태다.
- **제안**: `spec/conventions/error-codes.md §5` 에 `WORKSPACE_REQUIRED → WORKSPACE_ID_REQUIRED` rename 이력이 실제로 존재하는지 검증한다. 미등재 시 프로젝트 플래너가 추가하거나 R-CC-18 의 "등재" 주장을 "등재 필요" 로 수정한다.

---

### [INFO] 1-auth.md §1.5.1 초대 토큰 raw 저장 — R1.5.D 정합 확인

- **target 위치**: `spec/5-system/1-auth.md §1.5.1` "저장 형태: DB 에는 토큰 자체를 저장"
- **과거 결정 출처**: `spec/5-system/1-auth.md ## Rationale 1.5.D` — 초대 토큰 raw 저장의 정당화가 명시적으로 기록되어 있다 ("토큰 단독으로는 권한 획득 불가 + 이메일 일치 강제 + 단일 사용 + 7일 만료").
- **상세**: §1.1 의 "이메일 인증 토큰·비밀번호 재설정 토큰은 SHA-256 해시로만 저장" 정책과 §1.5.1 의 raw 저장이 다른데, 1.5.D 가 그 이유를 명시적으로 기록하고 있어 Rationale 연속성 이슈는 없다. 다만 구현자가 SHA-256 해시 정책(§1.1)을 초대 토큰에도 잘못 적용할 가능성이 있으므로 구현 시 1.5.D 를 명시적으로 확인해야 한다.
- **제안**: 구현 착수 전 확인 사항으로만 기록. 별도 spec 변경 불필요.

---

## 요약

`spec/5-system/` 전체에서 Rationale 연속성 관점의 주요 이슈는 한 건이다. `15-chat-channel.md` 의 CCH-CV-03 (b) 미구현 상태가 Rationale R9 ("running 케이스에서 큐잉 기각, 즉시 안내 + update 무시 채택")를 명시적으로 위반하는 구현을 인정하고 있다. Spec 은 이를 "미구현(Planned)" 으로 표시했으나 R9 가 기각한 대안("인터랙션 forwarding 지속")이 실질적으로 동작 중이다. 이는 WARNING 수준의 결정 번복이며 — R9 결정 자체를 뒤집은 것이 아니라 구현이 R9 를 이행하지 않은 상태다. 기각된 대안을 재채택한 새 Rationale 없이 구현이 방치된 상태라 구현 착수 시 반드시 R9 를 실현해야 한다. 나머지 발견사항(INFO 2건)은 구현 시 유의사항 수준이며 Rationale 연속성을 직접 위반하지는 않는다.

## 위험도

MEDIUM

STATUS: SUCCESS
