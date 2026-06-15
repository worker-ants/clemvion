# 요구사항(Requirement) Review

## 발견사항

### **[INFO]** list 쿼리의 workspace visibility 필터 — 잠재적 타 워크스페이스 공유본 누출
- 위치: `workflow-test-datasets.service.ts` 라인 85–90, `list()` 메서드
- 상세: `list()` 의 QueryBuilder 는 `d.workflow_id = :workflowId` + `d.workspace_id = :workspaceId` 로 workspaceId 격리를 먼저 걸고, 그 다음 `(d.owner_id = :userId OR d.visibility = :workspace)` 를 추가한다. workspaceId 조건이 먼저 적용되므로 타 워크스페이스 데이터는 포함되지 않는다. 로직은 정확하지만, visibility = 'workspace' 인 경우 workspaceId 필터가 먼저 동작하기 때문에 cross-workspace 노출 위험이 없음을 명시적 주석이 없어 검토 시 혼동 가능성이 있다.
- 제안: 현 로직은 올바르다. 선택적으로 주석에 "workspaceId 격리가 visibility 필터보다 우선" 을 명시해 가독성을 높이면 좋다.

### **[INFO]** e2e 테스트 E 케이스 — 403/404 양쪽 허용
- 위치: `workflow-test-dataset.e2e-spec.ts` 라인 2215: `expect([403, 404]).toContain(res.status)`
- 상세: cross-workspace IDOR 테스트(E)가 403/404 양쪽을 허용하고 있다. `findAccessible` 로직 상 workspaceId 불일치면 entity 가 조회되지 않아 404 가 반환된다. 하지만 PATCH 요청이 workspaceId 격리 후 ownerId 불일치로 403 이 되는 시나리오도 이론적으로 가능하다. 실제로는 workspaceId 격리로 항상 404 가 나오므로 `toBe(404)` 로 좁혀도 무방하다 — 현재는 양쪽 모두 IDOR 방지를 충족한다.
- 제안: 기능 정확도 관점에서는 큰 문제 없음. 테스트 의도를 더 명확히 하려면 404 만 허용하도록 좁히는 것을 고려.

### **[WARNING]** clone 시 소유자 자신의 private 데이터셋 재복제 — 409 처리를 클라이언트에 위임
- 위치: `workflow-test-datasets.service.ts` 라인 215–224, `copyName()`; `workflow-test-datasets.service.ts` 라인 177–193, `clone()`
- 상세: clone 대상이 이미 `"이름 (Copy)"` 인 경우 다시 `"이름 (Copy) (Copy)"` 가 생성된다. 더 중요한 것은, 소유자 자신이 자기 private 데이터셋을 clone 하면 `findAccessible(requireOwner=false)` 를 통과하고, 같은 이름 + 같은 workflow + 같은 owner 로 저장을 시도해 `saveUnique` 가 409 DUPLICATE_NAME 을 던진다. 서비스 내에서 이 경우를 사전 차단하거나 이름에 타임스탬프/카운터를 붙이는 처리가 없고, 클라이언트(번호 증가 재시도)에 책임을 위임한다는 것이 주석에 명시돼 있다.
  - spec §2.2 / R-2.2 는 clone 의 충돌 처리를 명시하지 않으므로 "spec 이 클라이언트 책임으로 정함" 은 아니지만, spec 침묵 영역이므로 정책 결정의 명시성이 낮다.
- 제안: spec §2.2 는 clone 충돌 해결 방법을 기술하지 않으므로 코드 버그로 보기 어렵다. 단, clone endpoint 의 409 응답 시나리오에 "소유자 자신의 private 재복제" 를 포함한다는 것을 API 문서(OpenAPI description)나 spec 에 명시하면 클라이언트 혼란을 줄일 수 있다.

### **[INFO]** `@IsNotEmpty()` 와 `@IsOptional()` 의 validator 순서 (UpdateDto)
- 위치: `update-workflow-test-dataset.dto.ts` 라인 6–10 (`name` 필드)
- 상세: `@IsOptional()` → `@IsString()` → `@IsNotEmpty()` → `@MaxLength(255)` 순서다. class-validator 에서 `@IsOptional()` 이 undefined/null 을 통과시키므로 빈 문자열 `""` 이 들어오면 `@IsNotEmpty()` 가 올바르게 거부한다. 동작에는 문제없으나, decorator 순서가 일관성 없이 혼재(`@IsOptional` 이 제일 위가 아닌 파일도 존재할 수 있음)할 경우 미래 유지보수 시 혼동 가능성이 있다.
- 제안: 현재 동작은 올바름. 코드 스타일 상 `@IsOptional()` 을 맨 위에 두는 관례를 팀 단위로 통일하면 좋다.

### **[INFO]** `data` 컬럼명 vs `input` 속성 — spec 과 구현이 일치하며 의도적 결정
- 위치: `workflow-test-dataset.entity.ts` 라인 43–44; `spec/1-data-model.md §2.13.3`
- 상세: DB 컬럼은 `data`, 엔티티/DTO 속성은 `input` 이다. spec/1-data-model.md §2.13.3 은 "DB 컬럼은 `data`, 엔티티/DTO 속성은 `input`" 임을 명시적으로 기재하고, 이유(TransformInterceptor 충돌 회피)도 함께 기록한다. 코드(`@Column({ name: 'data', type: 'jsonb', default: {} }) input: ...`)와 spec 이 완전히 일치한다.
- 제안: 이상 없음.

### **[INFO]** `create` DTO 에서 `input` 필드의 `@IsNotEmpty()` 미적용
- 위치: `create-workflow-test-dataset.dto.ts` 라인 15–21 (`input` 필드)
- 상세: `input` 은 `@IsObject()` 만 적용돼 있어 빈 객체 `{}` 가 허용된다. 서비스의 `create()` 에서도 `dto.input ?? {}` 로 빈 객체를 기본값으로 처리하며, DB 컬럼 default 도 `'{}'` 다. 이는 의도적인 설계로 spec §2.2 "Mock Input JSON" 가 빈 객체를 유효한 값으로 허용하는 것과 부합한다 (빈 입력으로 실행 가능).
- 제안: 이상 없음.

---

## Spec Fidelity 점검

분석 대상 spec: `spec/3-workflow-editor/3-execution.md §2.2, §9`, `spec/1-data-model.md §2.13.3`

### §9 API 경로 — 코드와 spec 의 일치 확인

| spec §9 항목 | 코드 |
|---|---|
| `GET /api/workflows/:workflowId/test-datasets` | `@Get('workflows/:workflowId/test-datasets')` — 일치 |
| `POST /api/workflows/:workflowId/test-datasets` | `@Post('workflows/:workflowId/test-datasets')` — 일치 |
| `PATCH /api/test-datasets/:id` | `@Patch('test-datasets/:id')` — 일치 |
| `DELETE /api/test-datasets/:id` | `@Delete('test-datasets/:id')` — 일치 |
| `POST /api/test-datasets/:id/clone` | `@Post('test-datasets/:id/clone')` — 일치 |

### §9 응답 코드 — 일치 확인

| spec | 코드 |
|---|---|
| POST 201 | `@HttpCode(HttpStatus.CREATED)` — 일치 |
| DELETE 204 | `@HttpCode(HttpStatus.NO_CONTENT)` — 일치 |
| 중복 409 DUPLICATE_NAME | `ConflictException({ code: 'DUPLICATE_NAME' })` — 일치 |
| 비소유자 수정/삭제 403 | `ForbiddenException` — 일치 |

### §2.2 권한 모델 — 일치 확인

| spec R-2.2 요구사항 | 코드 구현 |
|---|---|
| 생성 시 항상 요청 유저 소유 + private | `create()` 에서 `ownerId: userId`, `visibility: dto.visibility ?? PRIVATE` — 일치 |
| 수정/삭제 소유자만 | `findAccessible(requireOwner=true)` — 일치 |
| 공유본 타 구성원은 read-only; 수정하려면 clone | `update/remove` 는 소유자만, `clone` 은 가시 데이터셋 대상 — 일치 |
| 비소유 private → 404 (존재 은닉) | `findAccessible` 의 `!isOwner && visibility !== WORKSPACE → NotFoundException` — 일치 |
| `(workflow_id, owner_id, name)` UNIQUE → 409 DUPLICATE_NAME | SQL UNIQUE 제약 + `saveUnique()` catch 23505 → ConflictException(DUPLICATE_NAME) — 일치 |

### spec/1-data-model.md §2.13.3 필드 정의 — 일치 확인

| spec 필드 | Migration V097 | Entity |
|---|---|---|
| id UUID PK | `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` | `@PrimaryGeneratedColumn('uuid')` |
| workflow_id FK → Workflow CASCADE | `REFERENCES workflow(id) ON DELETE CASCADE` | `@Column({ name: 'workflow_id' })` |
| owner_id FK → User CASCADE | `REFERENCES "user"(id) ON DELETE CASCADE` | `@Column({ name: 'owner_id' })` |
| workspace_id FK → Workspace CASCADE | `REFERENCES workspace(id) ON DELETE CASCADE` | `@Column({ name: 'workspace_id' })` |
| visibility Enum private/workspace 기본 private | `VARCHAR(20) DEFAULT 'private' CHECK (...)` | `@Column({ default: PRIVATE })` |
| name Varchar(255) | `VARCHAR(255) NOT NULL` | `@Column({ length: 255 })` |
| data JSONB (API: input) | `data JSONB NOT NULL DEFAULT '{}'` | `@Column({ name: 'data', type: 'jsonb' })` |
| created_at / updated_at TimestampTZ | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | `@CreateDateColumn / @UpdateDateColumn` |
| 인덱스 `(owner_id, workflow_id)` | 생성됨 | `@Index(['ownerId', 'workflowId'])` |
| 인덱스 `(workspace_id, visibility)` | 생성됨 | `@Index(['workspaceId', 'visibility'])` |

모든 spec 정의 필드가 Migration, Entity, DTO 에 정확히 구현되어 있다.

---

## 요약

변경된 13개 파일 모두 spec/3-workflow-editor/3-execution.md §2.2·§9 및 spec/1-data-model.md §2.13.3 에서 정의한 기능을 완전히 구현하고 있다. 권한 모델(owner 기본 private, workspace read-only 공유, 비소유자는 clone, 비소유 private → 404 존재 은닉), UNIQUE 제약 및 409 DUPLICATE_NAME 변환, Editor+ 역할 제한, 모든 API 경로·HTTP 상태 코드가 spec 과 line-level 로 일치한다. Migration V097 의 스키마, TypeORM 엔티티, DTO 검증, 서비스 비즈니스 로직, 단위 테스트, e2e 테스트가 일관되게 연계되어 있다. TODO/FIXME/HACK 주석 없음. 발견된 사항은 모두 INFO/WARNING 수준이며 기능 오작동을 일으키지 않는다 — WARNING 1건은 spec 이 침묵한 영역의 정책 결정 명시성 이슈로, 코드 오류가 아니다.

## 위험도

LOW
