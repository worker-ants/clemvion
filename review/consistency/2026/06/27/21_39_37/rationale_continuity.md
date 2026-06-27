# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done)
Diff base: `8c5fdf257c7d4a49e5d715e5414ccf643cfdc9f6`
Target: `spec/5-system/`

---

## 발견사항

### [WARNING] information-extractor spec 의 watermark 키 이름 미동기

- **target 위치**: `spec/5-system/17-agent-memory.md` §3 본문 및 `## Rationale > 증분 추출 watermark (AGM-08)` — 키를 `_resumeState.memoryState.lastExtractionTurnSeq` 로 확정 (I12)
- **과거 결정 출처**: `spec/5-system/17-agent-memory.md` (base `8c5fdf2`) `## Rationale > 증분 추출 watermark (AGM-08)` — `_resumeState.lastExtractionTurnSeq` 를 watermark 키로 확정
- **상세**: 이번 변경은 watermark 저장 키를 `_resumeState.lastExtractionTurnSeq`(평면 키)에서 `_resumeState.memoryState.lastExtractionTurnSeq`(sub-namespace 키)로 바꾸면서 I12 근거(평면 키 오염 방지·향후 확장)와 하위호환 폴백을 agent-memory spec 에 명기했다. 그러나 동일한 키를 참조하는 `spec/4-nodes/3-ai/3-information-extractor.md` 의 두 지점이 갱신되지 않아 여전히 구 평면 키 이름을 사용한다:
  - 163번째 줄: `증분 watermark(\`lastExtractionTurnSeq\`) 는 multi-turn state 로 운반`
  - 684번째 줄: `증분 watermark(\`lastExtractionTurnSeq\`) 는 multi-turn state 로 운반`

  이 두 참조는 새로 확정된 canonical 키 이름(`memoryState.lastExtractionTurnSeq`)과 충돌하며, 구현자가 어느 spec 이 SoT 인지 판단할 때 혼란을 줄 수 있다. 하위호환 폴백이 있어 런타임 동작에 즉각 영향은 없으나, spec 내부 단일 진실 원칙이 깨진 상태다.
- **제안**: `spec/4-nodes/3-ai/3-information-extractor.md` 의 위 두 지점에서 `lastExtractionTurnSeq` → `memoryState.lastExtractionTurnSeq` 로 갱신하고, 폴백 표기(`구 평면 키로 폴백`)를 annotation 으로 추가해 spec 전체가 일관된 canonical 키를 가리키도록 한다.

---

### [INFO] Rationale 갱신이 "키 이름 교체" 결정을 명시적으로 선언하지 않음

- **target 위치**: `spec/5-system/17-agent-memory.md` `## Rationale > 증분 추출 watermark (AGM-08)` — I12 근거가 인라인으로 삽입됨
- **과거 결정 출처**: 동일 섹션 (base `8c5fdf2`) — `_resumeState.lastExtractionTurnSeq` 를 watermark 키로 결정한 단락
- **상세**: 기존 Rationale 단락이 인라인 I12 주석을 포함하는 형태로 교체됐으나, "기존 `_resumeState.lastExtractionTurnSeq` → `_resumeState.memoryState.lastExtractionTurnSeq` 로 이름을 변경한다"는 명시적 전환 선언이 없다. 현재 단락 읽기 만으로는 새 키 이름이 처음부터의 결정인지 기존 결정을 번복한 것인지 불분명하다. 기각된 대안 재도입이나 핵심 원칙 위반은 아니지만, 결정 이력 추적 가독성이 떨어진다.
- **제안**: Rationale 단락 첫 문장에 "기존 평면 키 `_resumeState.lastExtractionTurnSeq` 를 `_resumeState.memoryState.lastExtractionTurnSeq` 로 이동(I12)" 한 줄을 명시하거나, `## 결정` 소항으로 키 이름 교체 선언을 분리해 추적 가독성을 높인다.

---

## 요약

이번 변경(diff-base `8c5fdf2` → HEAD)은 `spec/5-system/17-agent-memory.md` 에서 watermark 키를 `_resumeState.lastExtractionTurnSeq`(평면)에서 `_resumeState.memoryState.lastExtractionTurnSeq`(sub-namespace)로 이동하고 그 근거(I12)와 하위호환 폴백을 함께 명기했다. Rationale 의 핵심 watermark 불변식(seq 단조 증가·enqueue 된 snapshot 으로만 전진·single-turn 예외)은 그대로 보존되어 기각된 대안 재도입이나 합의 원칙 위반은 없다. 단, 동일한 키를 참조하는 `spec/4-nodes/3-ai/3-information-extractor.md` 두 지점이 구 평면 키 이름을 유지한 채 갱신되지 않아 cross-spec 단일 진실이 깨진 상태이며, 이 점이 Rationale 연속성 관점에서 주된 리스크다. 런타임 영향은 하위호환 폴백이 커버하지만 spec 수준 정합 보완이 권장된다.

## 위험도

LOW
