# Rationale 연속성 검토 결과

검토 모드: --impl-done (V-02 AI 노드 override UI 누락 해소)
검토 일시: 2026-06-11

---

## 발견사항

### [WARNING] spec §2.6.3 트랙 배정 현황이 구현과 불일치 — Rationale 갱신 없이 override 잔존 목록 유지

- **target 위치**: `codebase/frontend/src/components/editor/settings-panel/node-configs/override-registry.ts` — `text_classifier`, `information_extractor` 두 항목이 OVERRIDE_REGISTRY에서 제거됨 (ai-configs.tsx 삭제 포함)
- **과거 결정 출처**: `spec/3-workflow-editor/1-node-common.md §2.6.3` + `## Rationale R-2`
  - §2.6.3 트랙 배정 현황: `override 잔존` 목록에 `text_classifier`, `information_extractor` 가 명시됨 (`"override 잔존 ... text_classifier, information_extractor, ..."`)
  - R-2(2026-06-10) 는 §2.6 를 시스템 SoT 로 신설하며 이 목록을 최신 상태로 관리하겠다고 명문화함
- **상세**: 구현은 두 노드를 override 트랙에서 auto-form 트랙으로 이행 완료했으나, spec §2.6.3 의 `override 잔존` 목록에는 두 노드가 여전히 남아 있고 `auto-form 이행 완료` 목록에도 추가되지 않음. R-2 가 "트랙 배정 현황을 한 곳에서 관리한다" 고 명시했으므로 이 목록이 SoT 다. 구현 변경과 동시에 spec 현황 갱신이 이루어지지 않아 Rationale 에서 약속한 단일 진실 원칙이 깨진 상태.
- **제안**: spec §2.6.3 을 아래와 같이 갱신한다.
  - `auto-form 이행 완료` 목록에 `text_classifier`, `information_extractor` 를 추가
  - `override 잔존` 목록에서 두 항목 제거
  - 갱신 이유를 R-2 하위 또는 R-3 항목으로 기록: "text_classifier·information_extractor 의 zod 스키마가 field-array·llm-config-selector 등 auto-form 지원 위젯으로 충분히 표현됨을 cross-audit V-02 에서 확인해 bespoke 폼을 폐기하고 auto-form 으로 이행 (2026-06-11)"

---

### [INFO] override-registry.ts 주석이 근거를 담았으나 spec Rationale 에는 부재

- **target 위치**: `override-registry.ts` 변경 diff 의 인라인 주석 — `"Their zod schemas emit full ui hints (conversation-context · agent-memory · system-context · field-array examples/enumValues), so the bespoke forms were redundant (cross-audit V-02)"`
- **과거 결정 출처**: `spec/3-workflow-editor/1-node-common.md § Rationale R-2`
- **상세**: 이행 근거(어떤 위젯 힌트가 보강됐는가, V-02 audit 결과)가 코드 주석에는 기록됐으나 spec Rationale 에는 반영되지 않았다. R-2 가 SoT 를 명문화한 섹션이므로 그 섹션의 연속성 보완이 좋다.
- **제안**: WARNING 항의 spec 갱신 시 함께 처리. 별도 추가 작업 불필요.

---

## 요약

이번 구현(V-02)은 `text_classifier`·`information_extractor` 를 override 트랙에서 auto-form 트랙으로 이행한 것으로, 이는 spec §2.6 이 "노드를 override → auto-form 으로 이행하려면 registry 에서 항목을 제거하고 backend 스키마에 충분한 ui 힌트를 보강하면 된다" 고 명시한 정규 절차를 따른 것이다. 기각된 대안을 재도입하거나 합의된 invariant 를 위반한 흔적은 없다. 다만 spec R-2 가 §2.6.3 트랙 배정 현황을 SoT 로 명문화하겠다고 약속했음에도, 구현과 동시에 해당 목록이 갱신되지 않아 WARNING 수준의 연속성 간극이 발생했다. spec §2.6.3 의 두 목록(`auto-form 이행 완료` / `override 잔존`)을 구현 현실에 맞게 동기화하고 변경 근거를 Rationale 에 한 항 추가하는 것으로 해소된다.

## 위험도

LOW
