### 발견사항

- **[INFO]** `visibleWhen` DSL 타입 확장 — 하위 호환성 유지됨
  - 위치: `node-component.interface.ts`, `types.ts`
  - 상세: `visibleWhen`이 `{ field, equals }` 단일 shape에서 `notEquals`, `oneOf` 변형을 포함하는 union 타입으로 확장됨. `equals` shape는 그대로 유지되어 기존 직렬화된 스키마는 파싱 가능. 단, `GET /nodes/definitions` 응답 캐시가 존재한다면 `notEquals`를 모르는 구버전 프론트엔드가 `userPrompt`의 visibility를 항상 `true`로 처리할 수 있음.
  - 제안: 특별한 조치 불필요. 단, 응답 캐시 TTL이 긴 경우 배포 순서(백엔드 → 프론트엔드)를 보장할 것.

- **[INFO]** `UiHint`에 새 필드 추가 (`itemDefault`, `group`, `collapsible`, `clearFields`)
  - 위치: `node-component.interface.ts`, `types.ts`
  - 상세: 모두 additive 추가. `GET /nodes/definitions`의 JSON Schema 응답에 새 메타데이터가 포함되지만, 이를 모르는 클라이언트는 무시하므로 하위 호환성 파괴 없음.
  - 제안: 해당 없음.

- **[INFO]** `button-list`, `table-grid` 위젯 타입 신규 추가
  - 위치: `widget-registry.ts`, `types.ts`
  - 상세: 새 widget identifier가 백엔드 스키마와 프론트엔드 레지스트리에 동시 추가됨. 동기화 정상. 다른 소비자(모바일 앱 등)가 존재한다면 unknown widget에 대한 fallback 처리 필요.
  - 제안: 해당 없음 (웹 전용 프론트엔드만 존재하는 구조로 보임).

- **[INFO]** `ai_agent`, `carousel` 노드의 config 스키마 — 데이터 구조 무변경
  - 위치: `ai-agent.schema.ts`, `carousel.schema.ts`
  - 상세: 변경 내용은 전부 `ui` 메타데이터(`label`, `placeholder`, `hint`, `group`, `order`)와 필드 정렬 순서. 실제 zod 타입 정의(`z.string()`, `z.enum(...)`, `.default(...)`)는 변경 없음. 저장된 config 데이터의 파싱/검증에 영향 없음.
  - 제안: 해당 없음.

---

### 요약

이번 변경은 REST API 엔드포인트 추가/삭제/수정이 없으며, 실질적인 데이터 계약 변경도 없다. `GET /nodes/definitions`가 반환하는 JSON Schema의 `ui` 메타데이터 구조가 확장(additive)되었고, `visibleWhen` DSL에 `notEquals`/`oneOf` 변형이 추가되었으나 기존 `equals` 형식은 유지된다. 백엔드와 프론트엔드가 동시에 업데이트되어 동기화 상태이므로 실질적인 호환성 위험은 없다.

### 위험도

**LOW**