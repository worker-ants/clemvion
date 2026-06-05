# Rationale 연속성 검토 — `summaryModel` / `extractionModel` 도입

STATUS: OK

---

## 발견사항

### [INFO] §12.12 Rationale 번복이 적절히 기록됨 — 보완 제안만

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §12.12` (worktree 버전, 제목 "요약·추출 전용 LLM 모델 옵션")
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md §12.12` (origin/main 버전 — "요약·추출 LLM 콜이 노드 model 을 재사용하는 근거"), `spec/5-system/17-agent-memory.md §3` 65번째 줄 ("별도 추출 모델 필드 신설 없음 — scope-freeze"), `AGM-04` 요구사항 정의
- **상세**: v1 기각 근거 3가지 (a) config surface 최소화·scope-freeze, (b) provider/credential 단일 재사용, (c) 동일 품질 보장 모두가 **새 §12.12 의 "과거 결정" 단락에 그대로 인용**되고, 번복 근거 (1)비용 절감 (2)품질 요구 분리 정당성 (3)하위호환 fallback 체인이 대응 반론으로 명시됐다. 핵심 우려 (a)(b) 해소 여부도 상세히 서술됐다.
- **제안**: 정식 Rationale 갱신은 완료됐으나 한 가지 정합 누락이 있다. origin/main §12.12 가 "저비용 전용 모델 옵션은 v2 로드맵으로 유보" 하며 `conversation-thread §7` 의 항목과 `17-agent-memory.md §3` 추출 모델 행을 참조한다고 적고 있다. 실제 `conversation-thread.md §7` (origin/main) 에는 "요약/추출 전용 저비용 모델" 이라는 명시적 항목이 존재하지 않았다(참조가 유령 참조). 따라서 이번 변경과 관계 없는 기존 오류이며 target 이 초래한 문제는 아니다. 다만 번복 근거에서 "v2 로드맵에서 실현" 했다는 맥락을 conversation-thread §7 에도 작은 주석으로 남기면 추적성이 더 높아진다 — 필수는 아님.

---

### [INFO] `17-agent-memory.md §3` 및 `AGM-04` 갱신 확인

- **target 위치**: `spec/5-system/17-agent-memory.md §3` 65번째 줄, `AGM-04` 요구사항 비고
- **과거 결정 출처**: 동일 파일 origin/main 65번째 줄 "별도 추출 모델 필드 신설 없음 — scope-freeze"
- **상세**: `scope-freeze` 문구가 제거되고 fallback 체인 전문으로 교체됐다. `AGM-04` 요구사항 정의도 "노드 model 재사용" 에서 "추출 모델 = `extractionModel ?? 노드 model ?? llmConfig 기본`" 으로 갱신됐다. 정합 완료.
- **제안**: 없음.

---

### [INFO] conversation-thread §7 v2 로드맵의 관련 항목 미갱신

- **target 위치**: `spec/conventions/conversation-thread.md §7` (워크트리 버전)
- **과거 결정 출처**: origin/main `spec/4-nodes/3-ai/1-ai-agent.md §12.12` — "저비용 전용 모델 옵션은 v2 로드맵으로 유보" 참조 대상
- **상세**: origin/main §12.12 는 v2 유보 항목으로 `conversation-thread §7` 를 링크하지만 실제 `§7` 에는 해당 항목이 존재하지 않았다(유령 참조). 이번 변경이 그 항목을 "실현됨" 처리하거나 삭제하지 않았으나, 애초에 §7 에 항목 자체가 없었으므로 회귀가 아니다. 다만 `17-agent-memory.md §6 남은 로드맵` 에도 해당 내용이 없으므로 v2 유보 항목이 어디에도 명시적으로 "완료" 처리되지 않은 채 묻혔다. 추적성만의 문제다.
- **제안**: 17-agent-memory.md §6 남은 로드맵 또는 conversation-thread §7 에 "~~요약/추출 전용 저비용 모델~~ ✅ A3 실현" 1행 추가로 완결할 수 있다. 강제 요구사항은 아님.

---

## 요약

이번 변경은 `spec/4-nodes/3-ai/1-ai-agent.md §12.12` 에서 과거 "summaryModel/extractionModel 별도 필드를 기각한다(scope-freeze)" 는 결정을 명시적으로 번복한다. 번복은 무근거가 아니며, (a) config surface 증가 우려 → fallback 체인 + optional 필드로 기존 동작 100% 보존, (b) credential UI 추가 우려 → llmConfigId 는 노드 것을 그대로 재사용하고 신규 필드는 모델 ID expression 문자열 1개씩, (c) 품질 동일 보장 제약 → 품질 요구가 서로 다름을 들어 의도적 완화로 대응하는 3-레이어 반론이 새 §12.12 Rationale 에 체계적으로 기술됐다. `17-agent-memory.md §3` 의 "scope-freeze" 문구와 `AGM-04` 정의도 정합하게 갱신됐다. 코드 구현의 fallback 체인(`extractionModel || model || llmConfig.defaultModel`, `summaryModel || model`)도 Rationale 약속과 일치한다. 발견사항은 모두 INFO 등급(추적성 보완 제안)이며, CRITICAL/WARNING 급 위반은 없다.

## 위험도

NONE

---

BLOCK: NO
