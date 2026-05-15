### 발견사항

- **[INFO]** `pendingUserConfig` 응답 shape의 additive 확장
  - 위치: `detect-pending-user-config.ts`, `frontend/src/lib/api/assistant.ts`
  - 상세: `PendingUserConfigField`에 `candidates: CandidateEntry[]` (required)와 `integrationServiceType?: string` (optional) 필드가 추가됨. 서버가 항상 `candidates: []` 이상을 보내므로 구 클라이언트는 unknown 필드를 무시하는 표준 JSON 파싱으로 영향 없음. 단, 서버 측 TypeScript 인터페이스에서 `candidates`가 required로 선언되어 있어 직접 타입을 참조하는 내부 코드(예: 테스트용 fixture)에서 컴파일 오류 발생 가능성이 있음 — `review-workflow.spec.ts`의 기존 fixture는 업데이트됨.
  - 제안: 필드 목적과 추가 시점을 OpenAPI spec 또는 해당 dto/interface에 `@since ED-AI-39`형태로 문서화하면 향후 클라이언트 통합 시 맥락이 명확해짐.

- **[INFO]** `review-workflow.ts`의 legacy row 처리 — backward compatible 설계
  - 위치: `review-workflow.ts:656–677`
  - 상세: `!Array.isArray(f.candidates) || f.candidates.length === 0` 조건으로 `candidates` 속성이 없는 구 row는 "mention 강제" 기존 동작을 유지함. 하위 호환성 측면에서 올바른 처리이나, 이 경로는 서버가 항상 `candidates: []`를 초기화해 내려보내므로 런타임에서 `candidates` 미존재 경우는 메시지 DB에 이미 저장된 구 레코드(배포 전 데이터)에서만 발생함. 향후 데이터 마이그레이션 또는 DB 스키마 defaultValue 설정으로 영구 제거 가능.
  - 제안: 해당 조건에 `// TODO(ED-AI-39): remove once all legacy rows are backfilled` 주석 추가 권장.

- **[WARNING]** `CandidateLookupService` 에러 silent degradation → picker가 잘못된 신호를 줄 수 있음
  - 위치: `candidate-lookup.service.ts:78–88`
  - 상세: DB 장애나 통신 오류 시 `candidates: []`로 degrade하여 프런트에 "사용 가능한 리소스 없음" amber 박스를 보여줌. 사용자가 실제로는 등록된 Integration이 있음에도 "Settings에서 먼저 등록해 주세요"라는 안내를 받게 됨. 이는 transient 오류와 "진짜 미등록" 상태를 구분할 방법이 없음.
  - 제안: `candidates`에 `fetchError?: boolean` 플래그 추가 또는 `pendingUserConfig[i]` 레벨에 `candidateFetchFailed?: true`를 포함해 프런트가 fetch 오류와 빈 목록을 구분하는 UI(예: "목록을 불러올 수 없어요. 새로고침하거나 직접 설정 화면에서 연결해 주세요")를 렌더할 수 있도록 하는 방안 검토.

- **[WARNING]** `integrationServiceType` 힌트가 string 타입으로 열려 있음 — 오타 위험
  - 위치: `detect-pending-user-config.ts:47–54`, `send-email.schema.ts`, `http-request.schema.ts`, `database-query.schema.ts`
  - 상세: `integrationServiceType`이 `'email'` / `'http'` / `'database'` 세 값만 쓰이지만 타입이 `string`으로 열려 있어, 새 노드에서 오타(`'Email'`, `'smtp'`)가 들어와도 컴파일 오류 없이 필터가 조용히 실패함. `ListIntegrationsQueryDto.serviceType`이 내부적으로 enum 배열을 받는다면 타입 불일치가 런타임에서만 발견됨.
  - 제안: `IntegrationServiceType = 'email' | 'http' | 'database'` literal union을 공통 파일에 정의하고 `JsonSchemaLike.integrationServiceType`과 `PendingUserConfigField.integrationServiceType` 양쪽에 적용.

- **[INFO]** Picker confirm이 editor-store에만 반영되고 서버 API를 호출하지 않음
  - 위치: `assistant-message.tsx:258–265`, `editor-store.ts:469–496`
  - 상세: 사용자가 picker에서 Confirm하면 `updateNodeConfigField`로 클라이언트 상태만 갱신됨. 워크플로 저장(명시적 Save 또는 auto-save)이 발생해야 DB에 반영됨. 이는 기존 에디터의 dirty-save 패턴과 일치하지만, 선택 후 페이지를 이탈하면 데이터가 손실될 수 있음. `isDirty: true`가 설정되므로 unsaved changes 경고는 작동하나, SSE `tool_call` 이벤트 기반 rehydrate 시 이미 저장된 node config와 picker UI 상태 동기화 로직이 별도로 존재하지 않으면 새로고침 후 picker가 다시 "미설정" 상태로 보일 수 있음.
  - 제안: `CandidatePicker`의 `currentValue`가 이미 채워져 있는 경우 confirmed 상태로 진입하는 rehydrate 로직(`isFilled(currentValue)` 초기화)이 이미 구현되어 있어 올바른 방향. 다만 이 경로가 실제로 동작하는지 확인하는 통합 테스트(세션 rehydrate 후 picker 상태 검증)가 없음.

- **[INFO]** `WorkflowAssistantModule`에 `IntegrationsModule`, `KnowledgeBaseModule` 추가로 cross-module 의존성 증가
  - 위치: `workflow-assistant.module.ts:35–38`
  - 상세: 두 모듈이 이미 `TypeOrmModule.forFeature([Integration, KnowledgeBase])`로 entity 직접 주입 중이었고, 이제 서비스도 주입됨. `Integration`, `KnowledgeBase` entity가 이미 imports에 있었으므로 순환 의존 위험은 낮으나, `LlmConfigModule`이 "이미 위에 있다"는 주석만으로 처리된 반면 다른 두 모듈은 명시적으로 추가됨. 일관된 모듈 구조 주석 권장.
  - 제안: 주석에 각 모듈이 어떤 서비스를 export하는지 간략히 명시.

---

### 요약

이번 변경은 `pendingUserConfig` 응답에 `candidates` 필드를 additive하게 추가한 것으로, legacy row 처리(Array.isArray 가드)와 서버 측 빈 배열 초기화로 하위 호환성이 잘 설계되어 있다. HTTP API 엔드포인트·경로·인증 구조에는 변경이 없으며, SSE `tool_call` 이벤트 payload 확장만 발생한다. 주요 리스크는 candidate lookup 실패 시 사용자에게 잘못된 "미등록" 안내를 줄 수 있는 silent degradation 처리와, `integrationServiceType` 힌트가 untyped string으로 관리되어 미래 오타 오류에 취약하다는 점이다. 전반적으로 API 계약 안전성은 양호하다.

### 위험도
**LOW**