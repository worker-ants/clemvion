## Documentation Code Review — `includeEvidence` Feature

---

### 발견사항

**[WARNING]** `textClassifierNodeOutputSchema` 구조가 spec 문서의 `result` wrapper와 불일치
- **위치**: `text-classifier.schema.ts:95-108` vs `spec/4-nodes/3-ai-nodes.md:505-521`
- **상세**: 핸들러는 `output.result.evidence`에 값을 담고, 테스트도 `(data.result as any).evidence`로 접근하며, spec도 `result` wrapper를 명시한다. 그러나 `textClassifierNodeOutputSchema`는 `evidence`를 최상위(flat)에 정의한다. 어댑터가 `result.*`를 평탄화한다면 스키마가 맞지만, 그 동작이 어디에도 문서화되어 있지 않다. 워크플로우 작성자는 `$node["X"].output.evidence`와 `$node["X"].output.result.evidence` 중 어느 경로를 써야 하는지 알 수 없다.
- **제안**: 스키마 파일의 JSDoc에 "handler-output adapter flattens `output.result.*` into `output.*`" 동작을 한 줄 추가하거나, spec 예시 하단에 `$node["X"].output.evidence` 접근 예시를 명시한다.

---

**[INFO]** spec 출력 예시에 필요한 config 플래그가 명시되지 않음
- **위치**: `spec/4-nodes/3-ai-nodes.md` Single-label / Multi-label 예시 블록
- **상세**: 예시 JSON이 `confidence`와 `evidence`를 모두 포함하고 있지만, 이 예시가 `includeConfidence: true, includeEvidence: true`일 때의 출력임이 명시되어 있지 않다. 하단 불릿 설명으로 보완되어 있으나, 예시 블록 상단에 짧은 전제 조건 표기가 있으면 더 명확하다.
- **제안**: 예시 블록 앞에 `# config: includeConfidence: true, includeEvidence: true` 형태의 한 줄 주석을 추가한다.

---

**[INFO]** `includeConfidence` UI 기본값과 spec 문서 불일치 (기존 문제가 spec 업데이트로 표면화)
- **위치**: `frontend/src/components/editor/settings-panel/node-configs/ai-configs.tsx:65` vs `spec/4-nodes/3-ai-nodes.md:433`
- **상세**: UI 코드는 `?? true`(체크된 상태로 시작), schema는 `default(false)`, 이번 spec 업데이트는 `(기본: false)`로 명문화했다. 이 변경으로 세 소스 간 불일치가 더 가시화됐다.
- **제안**: UI 코드의 `?? true`를 `?? false`로 수정하거나, 의도적인 UI UX 선택이라면 spec에 "UI 기본 체크: true, 스키마 기본값: false" 주석을 추가한다.

---

**[INFO]** `sanitizeEvidence` 함수에 문서 없음
- **위치**: `text-classifier.handler.ts:421-424`
- **상세**: 프로젝트 규약("Default to writing no comments")에 따라 생략이 정당하다. 함수명으로 의도가 전달된다.
- **제안**: 현상 유지. (기록용 INFO)

---

**[INFO]** CHANGELOG 미업데이트
- **위치**: 리포지토리 루트
- **상세**: 프로젝트에 CHANGELOG 파일이 없거나 관리하지 않는 것으로 보이며, spec 문서가 변경 기록 역할을 대체하고 있다. 정책이 명확하다면 무시해도 된다.

---

### 요약

`includeEvidence` 기능 추가에 따른 문서화는 전반적으로 잘 갖춰져 있다 — spec 테이블·예시 갱신, i18n 키 추가(EN/KO), 스키마 UI 메타데이터, 테스트 케이스의 인라인 설명 주석 모두 일관되고 충분하다. 다만 `textClassifierNodeOutputSchema`가 flat 구조를 취하는 반면 spec은 `result` wrapper를 명시하는 구조적 불일치가 있으며, 어댑터 평탄화 동작이 어디에도 문서화되지 않아 워크플로우 작성자가 올바른 출력 접근 경로를 파악하기 어려울 수 있다.

### 위험도

**LOW**