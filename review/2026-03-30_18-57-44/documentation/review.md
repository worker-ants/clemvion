### 발견사항

**[WARNING] `GET /users/me` 엔드포인트 — Swagger/OpenAPI 데코레이터 누락**
- 위치: `users.controller.ts:8-29`
- 상세: JWT 인증이 필요한 엔드포인트임에도 `@ApiTags`, `@ApiBearerAuth`, `@ApiOperation`, `@ApiResponse` 데코레이터가 없음. API 소비자가 인증 요구사항을 문서에서 확인 불가.
- 제안: Phase 1에서 Swagger 미사용이라면 RESOLUTION.md에 기록된 대로 유지 가능. 단, 해당 결정을 컨트롤러 주석으로 명시 권장.

**[WARNING] `AuthProvider` — 세션 복원 동작 미문서화**
- 위치: `auth-provider.tsx:20-47`
- 상세: `initAttempted` ref를 통한 중복 실행 방지, refresh 실패 시 `/login`으로 redirect 등 비자명한 로직이 주석 없이 구현됨. 특히 `isAuthenticated || initAttempted.current` 조건의 의도가 불명확.
- 제안:
  ```tsx
  // Prevent duplicate initialization on re-renders.
  // Once attempted (success or fail), skip subsequent effects.
  if (isAuthenticated || initAttempted.current) return;
  ```

**[WARNING] `V003__add_trigger_category.sql` — 롤백 불가 주의사항 미문서화**
- 위치: `V003__add_trigger_category.sql:1`
- 상세: PostgreSQL enum 값은 추가 후 삭제 불가. 현재 주석은 변경 목적만 설명하고 운영 제약사항을 누락.
- 제안:
  ```sql
  -- NOTE: PostgreSQL does not support removing enum values once added.
  -- Rollback requires recreating the enum type with full data migration.
  ```

**[INFO] `editor-store.ts` — `onNodesChange` 복잡한 로직에 인라인 주석 부재**
- 위치: `editor-store.ts:58-103`
- 상세: manual_trigger 삭제 방지, undo 스택 처리, 연결된 엣지 자동 제거 등 3가지 부작용이 하나의 함수에 결합되어 있으나 주석 없음. 추가된 JSDoc 주석은 기존 코드의 것으로 변경된 로직을 반영하지 않음.
- 제안: 각 처리 블록에 의도를 설명하는 짧은 주석 추가 (이미 `workflow-canvas.tsx`에서는 이를 실천함).

**[INFO] `UserProfile` 인터페이스 — JSDoc 누락**
- 위치: `frontend/src/lib/api/users.ts:3-9`
- 상세: `locale`, `theme` 필드의 허용값이나 `avatarUrl`의 optional 의미에 대한 문서 없음. 백엔드 기본값(`'ko'`, `'light'`)과의 연관성이 불명확.
- 제안: 최소한 `locale`/`theme` 필드에 `// Default: 'ko' / 'light' when null` 주석 추가.

**[INFO] `NodeConfigRenderer` — 지원 노드 타입 목록 미문서화**
- 위치: `node-configs/index.tsx:47-115`
- 상세: 30개 이상의 노드 타입을 지원하지만 파일 상단에 지원 목록이나 추가 방법에 대한 문서 없음. 새 노드 타입 추가 시 이 파일을 반드시 수정해야 한다는 것이 불명확.
- 제안: 파일 상단에 간단한 주석 블록 추가:
  ```tsx
  // NodeConfigRenderer maps node types to their config form components.
  // To add a new node type: (1) create a config component, (2) add a case here.
  ```

**[INFO] `workflow-canvas.tsx` — `onNodesDelete` 콜백 의도 주석 양호**
- 위치: `workflow-canvas.tsx:65-70`
- 상세: `// Handle delete via ReactFlow's onNodesDelete — ReactFlow calls this after its internal delete-key handling...` 주석이 잘 작성되어 있어 의도가 명확함. 긍정적 사례.

**[INFO] `spec/` API 문서 업데이트 필요성**
- 위치: 프로젝트 수준
- 상세: `GET /users/me` 신규 엔드포인트가 `spec/` 경로 API 스펙 문서에 반영되었는지 확인 필요. RESOLUTION.md에서 "추후 일괄 처리" 예정으로 기록되어 있으나 누락 상태.
- 제안: `spec/` 문서에 엔드포인트 명세 추가 (인증 방식, 요청/응답 구조, 오류 코드 포함).

**[INFO] `shared.tsx` — `CheckboxField`의 id 생성 방식 주석 부재**
- 위치: `shared.tsx:120`
- 상세: `const id = \`cb-${label.replace(/\s+/g, "-").toLowerCase()}\`` — 레이블 기반 id 생성 로직이 label 충돌 가능성을 내포하지만 주석이 없어 의도 불명확.
- 제안: `// id is derived from label; ensure labels are unique within a form` 주석 추가.

---

### 요약

전반적으로 코드 자체의 가독성은 양호하나, 문서화 측면에서 세 가지 주요 갭이 있습니다. 첫째, `GET /users/me`에 Swagger 데코레이터가 없어 API 소비자가 인증 요구사항을 문서에서 파악할 수 없습니다(Phase 1 정책으로 의도적 미적용이라면 컨트롤러 주석으로 명시 필요). 둘째, `AuthProvider`의 세션 복원 흐름과 `editor-store.ts`의 복합 `onNodesChange` 로직처럼 비자명한 동작에 인라인 주석이 부족합니다. 셋째, `V003` 마이그레이션의 PostgreSQL enum 비가역성 경고가 SQL 파일 자체에 문서화되지 않아 운영 리스크가 있습니다. `workflow-canvas.tsx`의 `onNodesDelete` 주석은 좋은 선례로, 같은 수준의 문서화를 다른 복잡한 로직에도 적용하길 권장합니다.

### 위험도
**LOW**