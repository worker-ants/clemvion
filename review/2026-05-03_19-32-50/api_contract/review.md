## 발견사항

### [INFO] `meta.turnDebug[i]` 스키마 additive 확장
- **위치**: `ai-agent.handler.ts` 라인 291, 419, 626, 731; `spec/4-nodes/3-ai-nodes.md`
- **상세**: `turnDebug` 배열 항목에 `ragSources?` / `ragDiagnostics?` 두 필드가 추가됨. spec 업데이트(`ragSources?`, `ragDiagnostics?` — 물음표 명시)와 일치하며, 이전 페이로드를 읽는 기존 consumer는 해당 필드를 단순히 무시하게 됨. 프론트엔드 `extractTurnDebug` 는 필드 부재 시 `[] / null` fallback을 제공하므로 하위 호환 처리 완료.
- **제안**: 이상 없음. 스펙과 구현이 일치함.

---

### [WARNING] `NodeDetailTabs` 컴포넌트 props 계약 변경 (required 추가)
- **위치**: `result-detail.tsx` `NodeDetailTabsProps` interface 및 `NodeDetailTabs` 함수 시그니처
- **상세**: `activeTab`, `onActiveTabChange`, `highlightTurnIndex`, `aiMetadata` 4개 props가 **optional 없이 required**로 추가됨. 내부 컴포넌트 API의 breaking change. 현재 유일한 호출처인 `ResultDetail`은 동일 파일 내 갱신이 완료되어 런타임 영향 없음. 그러나 테스트 코드나 스토리북 등 별도 render 코드가 있다면 타입 에러 발생 가능.
- **제안**: 현재 호출처가 하나뿐이라면 문제 없음. 다른 render 코드(테스트, 스토리북)가 존재하면 `activeTab` 등에 기본값을 제공하거나 optional로 변경 검토.

---

### [INFO] `extractAiMetadata` 반환 타입에 `turnDebug` 필드 추가
- **위치**: `output-shape.ts` `AiMetadata` interface
- **상세**: `turnDebug: TurnDebugEntry[]` 가 required 필드로 추가됨. 런타임에는 항상 배열(빈 배열 포함)이 반환되어 null-check 없이 사용 가능. `AiMetadata` 를 직접 타입 참조하는 코드가 있다면 재컴파일 필요하나, 동작 파괴는 아님.
- **제안**: 이상 없음.

---

### [INFO] `RagReferencesSection` 노출 위치 이동
- **위치**: `result-detail.tsx` `OutputTabContent`, `MetaTabContent` — 기존 렌더 코드 제거; `ReferencesTabContent` 신설
- **상세**: Output·Meta 탭에서 `RagReferencesSection` 렌더 블록이 제거되고 References 탭으로 통합됨. 사용자 진입점은 바뀌었으나 데이터 자체는 동일한 `aiMetadata.ragSources` / `ragDiagnostics`를 사용하므로 정보 손실 없음.
- **제안**: 이상 없음. UX 이동이지 계약 변경이 아님.

---

## 요약

이번 변경은 HTTP REST API 엔드포인트를 신설·수정하지 않으며, 노드 실행 결과의 `meta.turnDebug[i]` 에 선택적 필드(`ragSources?`, `ragDiagnostics?`)를 추가하는 additive 확장이다. 백엔드 응답 스키마는 하위 호환 방식으로 확장되었고, 프론트엔드는 누락 필드에 대한 fallback을 정확히 구현했다. 컴포넌트 내부 API(`NodeDetailTabs` required props)에 변경이 있으나 현재 유일한 호출처가 동시에 갱신되었으며, 스펙 문서도 구현과 일치하도록 갱신되었다.

## 위험도

**LOW**