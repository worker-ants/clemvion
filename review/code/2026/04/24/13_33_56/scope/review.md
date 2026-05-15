## 발견사항

### [INFO] spec 문서에서 출력 구조 래퍼 수정 포함
- **위치**: `spec/4-nodes/3-ai-nodes.md` — Single-label / Multi-label 출력 예시 JSON
- **상세**: `includeEvidence` 추가와 동시에, 기존 flat 구조(`{ "category": ... }`)를 `result` 래퍼 포함 구조(`{ "result": { "category": ... } }`)로 수정했습니다. 실제 핸들러는 이미 `result` 래퍼를 사용하고 있었으므로 스펙 문서가 잘못된 상태를 수정하는 것이 맞지만, 기술적으로는 `includeEvidence` 기능 추가와 독립적인 수정입니다.
- **제안**: 범위 일탈이라기보다 기회 수정(opportunistic fix)에 해당하므로 그대로 유지해도 무방합니다. 단, 커밋 메시지나 PR 설명에 "spec output example was using flat structure but handler already uses result wrapper" 사유를 명시하면 이력 추적에 도움됩니다.

---

### [INFO] `includeConfidence` 기본값 명시 추가 (spec)
- **위치**: `spec/4-nodes/3-ai-nodes.md` 설정 테이블
- **상세**: 기존 `includeConfidence | Boolean | 신뢰도 점수 포함 여부`에 `(기본: false)` 주석을 추가했습니다. `includeEvidence` 신규 항목을 같은 형식으로 맞추기 위한 정렬 수정으로, 실질적 변경은 없습니다.
- **제안**: 무해합니다.

---

### [INFO] `multiLabel` UI order 값 7→8 변경
- **위치**: `text-classifier.schema.ts`, `multiLabel` 필드 `order` 메타
- **상세**: `includeEvidence`가 `order: 7`로 삽입되어 `multiLabel`이 8로 밀렸습니다. 의도된 연쇄 변경입니다.
- **제안**: 정상입니다.

---

## 요약

8개 파일 모두 `includeEvidence` 기능 추가에 직결된 변경입니다. 핸들러 로직, 스키마, 프론트엔드 UI, i18n, 테스트가 일관되게 함께 수정되었고 불필요한 리팩토링·무관한 파일 수정·과잉 엔지니어링은 없습니다. 유일하게 주목할 점은 스펙 문서에서 기존에 잘못 기술된 출력 구조(flat JSON)를 실제 구현에 맞게(`result` 래퍼) 수정한 것이 포함되어 있으나, 이는 구현과 스펙의 정합성을 높이는 기회 수정으로 수용 가능합니다.

## 위험도

**NONE**