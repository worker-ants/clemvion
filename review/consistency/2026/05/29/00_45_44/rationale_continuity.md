# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-ai-error-output-fields.md`
검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-05-29

---

## 발견사항

### [INFO] W-1 defer — Principle 7 위반을 인식했으나 새 Rationale 없이 이연
- **target 위치**: `plan/in-progress/spec-draft-ai-error-output-fields.md §W-1 (deferred)`
- **과거 결정 출처**: `spec/conventions/node-output.md §Principle 7` — "NodeHandlerOutput.config 는 사용자가 설정한 원본(pre-evaluation) 값을 그대로 echo. **원본 config 필드명 그대로** 사용."
- **상세**: information-extractor 의 config 필드명은 `outputSchema` 이나 echo 시 `config.schema` 로 노출되어 Principle 7 (config echo 원칙) 를 위반한다. target 이 이 사실을 Warning 등급으로 인식하고 "Critical 2건과 무관, ~15곳 일괄 rename 은 별도 작업" 을 이유로 이연한다. 이 이유 자체는 합리적이나, (a) 이연을 결정하는 신규 Rationale 항목이 spec 의 `## Rationale` 섹션에 추가되지 않고 plan 문서 내 §W-1 에만 기술된다. (b) 향후 spec 독자가 Principle 7 위반을 재발견했을 때 이 이연 결정의 배경을 spec 에서 찾을 수 없다.
- **제안**: `spec/4-nodes/3-ai/3-information-extractor.md §8 Rationale` 에 다음 취지의 항목을 추가한다 — "config.schema 와 config.outputSchema 이름 불일치 (Principle 7 위반) 는 인식된 결함이나 ~15곳 일괄 rename 이 필요해 별도 작업으로 이연 (spec-update-ai-error-output-fields PR W-1)." plan 이연 메모만으로 충분하다고 판단한다면 INFO 수준에서 처리 가능. 결정 번복·invariant 위반은 아님.

---

## Rationale 연속성 관점의 전체 평가

target 문서 (`spec-draft-ai-error-output-fields.md`) 의 핵심 두 변경 — C-1 (`details.retryable` 필수 필드 보강) 과 C-2 (`status: "ended"` 누락 보완) — 은 기존 합의된 결정을 위반하거나 기각된 대안을 재도입하지 않는다. `retryable` 의 값 결정 (`LLM_CALL_FAILED` network timeout → `true`, `LLM_RESPONSE_INVALID` → `false`) 은 `ai-agent §10` 에러 코드 표 및 `node-output §3.2.1` 분류 규칙과 정확히 정합한다. `retryAfterSec` 의 `retryable === true` 일 때만 set 가능하다는 invariant 도 `node-output §3.2.1` SoT 를 그대로 인용한다. `status: "ended"` 추가는 Principle 0 의 5필드 컨트랙트 (`status?` 선택 필드 포함) 에서 information-extractor / ai-agent 가 이미 명시한 패턴에 text-classifier 를 맞추는 일관성 보강이다. 유일한 미비 사항은 W-1 이연 결정이 plan 문서에만 기록되고 해당 spec 의 `## Rationale` 에 반영되지 않은 점이다 (INFO 등급 — 차단 요소 없음).

---

## 위험도

LOW
