## 보안 코드 리뷰

### 발견사항

---

**[WARNING] 버전 복원 시 워크스페이스 소유권 검증 미흡**
- 위치: `workflows.controller.ts` — `restoreVersion` 엔드포인트
- 상세: `restoreVersion`은 `workspaceId`를 `WorkspaceId` 데코레이터로 받지만, 내부적으로 `saveCanvas`를 재호출하면서 `workspaceId`가 재검증된다. 그러나 `workflowVersionsService.findOne(workflowId, versionId)`에서는 해당 `versionId`가 현재 워크스페이스에 속하는지 확인하지 않고 `workflowId`와의 매칭만 확인한다. 공격자가 다른 워크스페이스의 `workflowId`에 존재하는 버전을 복원 시도하면, `findById`에서 막히지만 워크플로우 소유권 체크 후 버전 소유권 체크는 별도로 수행되지 않는다. 현재 구조상 `findById`가 워크스페이스 격리를 담당하므로 직접적 취약점은 아니나, 코드 흐름이 이 의존성에 암묵적으로 기대고 있어 방어 깊이가 부족하다.
- 제안: `workflowVersionsService.findOne`에 워크스페이스 ID를 함께 전달하거나, 조회 후 반환된 버전의 `workflowId`와 검증된 워크플로우 ID 일치 여부를 명시적으로 확인

---

**[WARNING] `settings` 필드에 대한 크기 제한 없음**
- 위치: `update-workflow.dto.ts` — `settings?: Record<string, unknown>`
- 상세: `@IsObject()`만 선언되어 있고, 키/값 개수나 총 페이로드 크기에 대한 제한이 없다. 악의적인 클라이언트가 수백 MB의 중첩 JSON 객체를 전송하면 DB의 `jsonb` 컬럼에 저장되거나, 직렬화 과정에서 메모리 압박이 발생할 수 있다.
- 제안: 애플리케이션 레벨에서 페이로드 크기 제한 미들웨어를 적용하거나, `settings` 스키마를 구체적인 허용 키 목록으로 제한

---

**[WARNING] `ImportNodeDto`의 `config` 필드 — 스냅샷으로 직접 영속화되는 임의 객체**
- 위치: `import-workflow.dto.ts` — `config?: Record<string, unknown>`, `workflow-versions.service.ts` — `buildSnapshot`
- 상세: 임포트 시 수신된 노드의 `config`가 검증 없이 DB에 저장되고, 이후 스냅샷에 그대로 포함된다. `config` 내부에 노드 실행 시 평가되는 expression/script 등이 있을 경우 서버사이드 인젝션 표면이 될 수 있다. 현재 실행 엔진이 `config`를 어떻게 소비하는지에 따라 심각도가 결정된다.
- 제안: `config` 내 허용 키와 값 타입을 노드 타입별로 스키마 검증, 또는 실행 엔진에서 `config` 소비 시 이스케이프/샌드박스 처리

---

**[WARNING] `description` 필드에 `MaxLength` 제한 없음**
- 위치: `create-workflow.dto.ts`, `update-workflow.dto.ts` — `description?: string`
- 상세: `name`에는 `@MaxLength(255)`가 있으나 `description`에는 길이 제한이 없다. `text` 타입 컬럼이므로 DB 수준 제한은 없어 대용량 데이터 삽입에 취약하다.
- 제안: `@MaxLength(10000)` 등 적절한 길이 제한 추가

---

**[WARNING] `tags` 배열 크기 및 개별 태그 길이 제한 없음**
- 위치: `create-workflow.dto.ts`, `update-workflow.dto.ts`, `import-workflow.dto.ts` — `tags?: string[]`
- 상세: `@IsArray()` + `@IsString({ each: true })`만 선언되어 있고, 배열 최대 항목 수와 개별 문자열 최대 길이가 제한되지 않는다.
- 제안: `@ArrayMaxSize(50)`, `@MaxLength(100, { each: true })` 등 추가

---

**[WARNING] 버전 생성 시 레이스 컨디션 — 중복 버전 번호 가능**
- 위치: `workflow-versions.service.ts` — `createVersion`
- 상세: 최신 버전을 조회한 후(`getOne`) `+1`하여 저장하는 패턴은 동시 요청 시 레이스 컨디션으로 동일 `(workflowId, version)` 쌍이 두 번 삽입될 수 있다. DB 레벨 `UNIQUE` 제약이 있어 두 번째 삽입은 실패하지만, 사용자에게 500 에러로 노출된다.
- 제안: DB 시퀀스, `SELECT ... FOR UPDATE`, 또는 `INSERT ... ON CONFLICT` 패턴으로 원자적 버전 번호 할당

---

**[INFO] `snapshot` 필드 타입 캐스팅 — `as` 강제 변환**
- 위치: `workflows.service.ts` — `restoreVersion`
- 상세: `target.snapshot as { name?: string; nodes?: unknown[]; edges?: unknown[] }`로 타입 단언 후 `as SaveCanvasDto['nodes']`로 재캐스팅한다. 런타임 검증 없이 DB에서 읽어온 jsonb를 신뢰하고 직접 `saveCanvas`로 전달하면, 스냅샷 데이터가 오염된 경우(직접 DB 조작 등) 이후 검증 단계를 우회할 수 있다.
- 제안: 스냅샷을 `saveCanvas`로 주입하기 전 `class-validator`로 DTO 검증 수행

---

**[INFO] `workflowVersionsController` — 워크스페이스 소유권 검증 없음**
- 위치: `workflow-versions.controller.ts`
- 상세: `GET /workflows/:wfId/versions`와 `GET /workflows/:wfId/versions/:versionId` 엔드포인트에서 `WorkspaceId` 데코레이터를 사용하지 않는다. JWT 인증은 있으나, 해당 `wfId`가 요청자의 워크스페이스에 속하는지 확인하지 않아 다른 워크스페이스의 버전 목록을 조회할 수 있다.
- 제안: `WorkspaceId` 데코레이터를 추가하고 `findByWorkflow`, `findOne` 시 워크스페이스 소속 검증 수행

---

**[INFO] `window.location.reload()` — 복원 성공 후 강제 리로드**
- 위치: `restore-confirm-dialog.tsx` — `onSuccess`
- 상세: 보안 문제는 아니나, 성공 응답의 실제 데이터(`workflow`, `nodes`, `edges`)를 활용하지 않고 페이지 전체를 리로드한다. 이 방식은 적절히 동작하지만, 추후 전체 리로드 없이 상태를 갱신하는 방향으로 개선 시 해당 응답 데이터를 신뢰하기 전에 검증 로직이 필요함을 유의.

---

**[INFO] `importWorkflowDto` — `containerId`, `toolOwnerId` 타입 검증 없음**
- 위치: `import-workflow.dto.ts` — `ImportNodeDto`
- 상세: `containerId?: number | null`, `toolOwnerId?: string | null` 필드에 `@IsOptional()` 외 타입 검증(`@IsNumber()`, `@IsString()`)이 없다. 잘못된 타입이 통과될 수 있다.
- 제안: `@IsNumber()` / `@IsString()` / `@IsNull()` 등 타입 검증 추가

---

### 요약

전반적으로 NestJS의 `class-validator` 파이프라인, `ParseUUIDPipe`, JWT 인증 등 기본 보안 인프라가 잘 갖춰져 있다. 가장 주목할 이슈는 **버전 이력 컨트롤러의 워크스페이스 소유권 검증 누락**으로, 인증된 사용자라면 타 워크스페이스의 버전 이력을 열람할 수 있는 수평 권한 상승(IDOR) 가능성이 있다. 또한 `description`, `tags`, `settings` 등 자유 형식 필드의 크기 제한 부재, 버전 번호 할당 시 레이스 컨디션, 스냅샷 복원 시 런타임 검증 생략이 보완이 필요한 사항이다. 하드코딩된 시크릿, XSS, SQL 인젝션 등 고위험 취약점은 발견되지 않았다.

### 위험도

**MEDIUM**