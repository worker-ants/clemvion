# Convention Compliance — PR2 구현 착수 직전

검토 대상: `plan/in-progress/external-interaction-api.md` + `spec/5-system/14-external-interaction-api.md` 의 PR2 Phase 분할안  
검토 기준: `spec/conventions/migrations.md`, `spec/conventions/swagger.md`, `spec/conventions/conversation-thread.md`, `spec/conventions/i18n-userguide.md`, `spec/5-system/2-api-convention.md`, `PROJECT.md`

---

## 발견사항

### [WARNING] Migrations CHECK 제약 plan 에 명시돼 있으나 spec SQL DDL 에는 미포함

- **target 위치**: `plan/in-progress/external-interaction-api.md §2.1` — `notification_health VARCHAR(16) NOT NULL DEFAULT 'unknown' CHECK (notification_health IN ('unknown','healthy','degraded'))`
- **위반 규약**: `spec/conventions/migrations.md §1` (명명·제약 규약은 `codebase/backend/migrations/README.md` 위임이지만, plan §2.1 의 체크박스 DDL 텍스트와 `spec/5-system/14-external-interaction-api.md §7.1` 의 DDL 사이에 불일치 존재)
- **상세**: spec §7.1 의 SQL 예시에는 `CHECK (notification_health IN ('unknown','healthy','degraded'))` 가 없고 단순 `VARCHAR(16) NOT NULL DEFAULT 'unknown'` 만 기재됨. plan §2.1 에는 CHECK 제약이 포함된 형태로 작성되어 있어, 구현 시 어느 쪽을 따를지 모호하다. migrations.md 가 직접 CHECK 표기를 강제하지는 않지만 "제약 의도를 SQL 에 명시"하는 것이 컨벤션 정신에 부합하며, spec DDL 이 단일 진실이 돼야 한다.
- **제안**: `spec/5-system/14-external-interaction-api.md §7.1` 의 DDL 예시에 `CHECK (notification_health IN ('unknown','healthy','degraded'))` 를 추가해 plan 과 일치시킨다. 단 spec 은 `project-planner` 권한이므로 developer 는 구현 시 plan §2.1 텍스트를 따르고, 사후 spec 갱신 태스크(`plan/in-progress/spec-update-*.md`)를 등록한다.

---

### [WARNING] Swagger — `@ApiTags` 값이 spec 에 미지정; 기존 컨트롤러와 일관성 위험

- **target 위치**: `spec/5-system/14-external-interaction-api.md §10.1` + `plan/in-progress/external-interaction-api.md §2.3`
- **위반 규약**: `spec/conventions/swagger.md §2-1` (`@ApiTags('<Label>')` 는 모든 컨트롤러 필수 + `@ApiBearerAuth` 명칭 분리)
- **상세**: spec §10.1 은 `@ApiBearerAuth('interaction-token')` 의 분리 등록만 지정할 뿐, `@ApiTags` 값("External Interaction" 또는 다른 값)을 명시하지 않는다. swagger.md 는 `@ApiTags` 를 상단에 반드시 기재하도록 요구한다. 구현자가 임의로 태그를 지을 경우 Swagger UI 에서 기존 `Triggers` / `Executions` 태그와 혼재될 수 있다. prompt 파일의 검토 관점 2항에서도 `@ApiTags('External Interaction')` 를 권고하지만 spec 문서 자체에는 적혀 있지 않다.
- **제안**: `spec/5-system/14-external-interaction-api.md §10.1` 에 `@ApiTags('External Interaction')` 를 명시 추가 (spec 갱신) 하거나, 구현 단계 P4/P5 체크박스에 `@ApiTags('External Interaction')` 적용을 명기한다.

---

### [WARNING] Swagger — 응답 DTO 래퍼 헬퍼(`ApiAcceptedWrappedResponse`) 적용 여부 미명시

- **target 위치**: `plan/in-progress/external-interaction-api.md §2.3` + `spec/5-system/14-external-interaction-api.md §5.1 성공 응답`
- **위반 규약**: `spec/conventions/swagger.md §5` (모든 성공 응답은 인라인 스키마 아닌 DTO 클래스 + 공용 래퍼 헬퍼 사용. `ApiAcceptedWrappedResponse(Dto)` 가 202 응답 래퍼로 이미 제공됨)
- **상세**: `POST /interact` 의 `202 Accepted` 응답, `POST /cancel` 의 `202 Accepted` 응답, `POST /refresh-token` 의 `200 OK` 응답 모두 spec §5.1/§5.4/§5.5 에 body shape 이 inline 으로 기재돼 있다. plan §2.3 체크박스에도 DTO 클래스 생성과 래퍼 헬퍼 적용 언급이 없다. swagger.md §6 에 따르면 `@ApiOkResponse({ schema: ... })` 인라인은 "레거시 패턴 제거" 대상이다.
- **제안**: P4 체크박스에 `dto/responses/interact-response.dto.ts`, `dto/responses/cancel-response.dto.ts`, `dto/responses/refresh-token-response.dto.ts` 를 `dto/responses/` 에 생성하고, 각 엔드포인트에 `ApiAcceptedWrappedResponse` / `ApiOkWrappedResponse` 를 적용하는 항목을 명시 추가.

---

### [WARNING] Hooks 컨트롤러 `@Public()` 유지 — plan 에 명시 없음

- **target 위치**: `plan/in-progress/external-interaction-api.md §2.6`
- **위반 규약**: `spec/conventions/swagger.md §2-1` (`@Public()` 전용 컨트롤러는 `@ApiBearerAuth` 를 넣지 않음)
- **상세**: spec §10.1 은 "Hooks 진입점은 기존대로 `@Public()` + `@ApiSecurity({})` 패턴 유지" 를 지정하지만, plan §2.6 의 Hooks 응답 확장 체크박스에 `@Public()` 데코레이터 유지 여부가 체크 항목으로 없다. 구현 시 잘못해서 `@ApiBearerAuth` 를 추가하거나 Guard 를 바꿔 기존 공개 접근이 깨질 수 있다.
- **제안**: plan §2.6 에 "`HooksController` 의 `@Public()` / `@ApiSecurity({})` 패턴 그대로 유지 확인" 항목을 체크박스로 추가.

---

### [WARNING] API convention §5.3 에러 응답 body — `details` 타입 불일치

- **target 위치**: `spec/5-system/14-external-interaction-api.md §5.1 에러 응답 표`
- **위반 규약**: `spec/5-system/2-api-convention.md §5.3` (에러 응답: `"details": [{ "field", "message" }]` — 배열)
- **상세**: `2-api-convention.md §5.3` 의 에러 응답 예시에서 `"details"` 는 `Array<{ field, message }>` 형태다. 그런데 `14-external-interaction-api.md §5.1` 의 `VALIDATION_FAILED` 에러 응답은 `"details": { "fieldErrors": [...] }` — 객체 래핑 형태로 정의한다. 두 shape 이 다르다. spec §5.1 은 "Spec API 규칙 §5.3 의 컨벤션을 따른다" 고 명시하면서도 실제 예시는 다른 형태를 쓴다.
- **제안**: 구현 시 `fieldErrors` 를 `details.fieldErrors` (객체) 와 `details` (배열) 중 어느 것을 따를지 명확히 해야 한다. 이미 spec §5.1 에서 의도적으로 기존 컨벤션과 다르게 정의했다면(구조화 field 에러를 위한 확장), spec §5.1 에 "2-api-convention §5.3 의 details 배열 형태를 확장한 객체 형태 채택 이유" 를 Rationale 로 추가해야 한다. 그렇지 않으면 GlobalExceptionFilter 가 내보내는 기본 에러 shape 과 구현 간 불일치가 발생한다. developer 는 이 점을 P4 구현 시 확인하고, spec 갱신이 필요하면 `project-planner` 에 위임.

---

### [WARNING] API convention §2.2 — REST endpoint 경로 케밥케이스 `refresh-token` 적합, `interact` / `cancel` 는 동사형 — 확인 필요

- **target 위치**: `spec/5-system/14-external-interaction-api.md §5.1~§5.5`
- **위반 규약**: `spec/5-system/2-api-convention.md §2.2` (리소스는 복수형 명사, 케밥 케이스)
- **상세**: `2-api-convention.md §2` 는 "리소스는 복수형 명사" 를 권장한다. `/interact`, `/cancel` 은 동사형 액션 endpoint 다. REST 컨벤션 상 동사형은 일반적으로 허용하지 않는 패턴이다. 그러나 spec §5.1~§5.4 + §R11 에서 이 경로 선택에 대한 rationale 이 명시적으로 기술되어 있고(facade 레이어, 외부 노출 표면 단순화), `2-api-convention.md` 가 모든 action endpoint 를 명사화하도록 강제하는 것은 아니다(예: `/stop` 같은 액션은 기존 코드에서도 사용). 따라서 이는 `CRITICAL` 위반이 아니라 의도적 결정이 이미 있는 WARNING 수준.
- **제안**: 구현 시 spec §R11 의 결정을 준거로 삼고, 별도 보완 불필요. 단 swagger 의 `@ApiOperation` summary 에서 "동작 의미" 를 명확히 기술하여 API 소비자 혼선을 차단.

---

### [WARNING] i18n — P7 신규 UI 문자열에 대한 `dict/ko/triggers.ts` 존재 여부 미확인

- **target 위치**: `plan/in-progress/external-interaction-api.md §3.1`
- **위반 규약**: `spec/conventions/i18n-userguide.md Principle 1·2` + `PROJECT.md §변경 유형 → 신규 UI 문자열 (TSX)` (ko/en parity hard fail)
- **상세**: plan §3.1 에서 Trigger 상세 드로어에 notification 섹션과 interaction 섹션을 추가한다. 이 섹션의 라벨·placeholder·토스트 메시지 등은 모두 i18n dict 키 경유가 필수다. plan 에 "i18n KO/EN parity" 가 명시(`plan §3.1` 마지막 줄 "(i18n KO/EN 양쪽)")되어 있으나, 어느 섹션 파일(`triggers.ts`? `settings.ts`?)에 넣을지, 현재 그 파일이 존재하는지가 착수 전에 확인되지 않았다. 실제 파일이 없으면 신규 섹션 파일 생성 + `dict/ko/index.ts` / `dict/en/index.ts` export 추가가 필요하며, 이는 P7 착수 전 파악해야 할 선결 조건이다.
- **제안**: P7 착수 전 `codebase/frontend/src/lib/i18n/dict/ko/` 디렉토리를 확인해 `triggers.ts` 유무를 파악하고, 없으면 신규 파일 생성 + index.ts export 추가를 P7 체크박스에 추가. 있으면 기존 파일에 notification/interaction 키 추가 계획 명시.

---

### [WARNING] i18n — 신규 errorCode (`EXECUTION_TERMINATED`, `SCOPE_MISMATCH`, `STATE_MISMATCH` 등) 의 backend-labels.ts 처리 계획 부재

- **target 위치**: `spec/5-system/14-external-interaction-api.md §5.1 에러 응답 표` + `plan/in-progress/external-interaction-api.md §2.3`
- **위반 규약**: `spec/conventions/i18n-userguide.md Principle 3` + `PROJECT.md §변경 유형 → 신규 errorCode 발행`
- **상세**: 본 spec 은 `TOKEN_INVALID`, `TOKEN_EXPIRED`, `SCOPE_MISMATCH`, `EXECUTION_NOT_FOUND`, `STATE_MISMATCH`, `IDEMPOTENCY_KEY_CONFLICT`, `EXECUTION_TERMINATED`, `RATE_LIMITED` 등 다수의 신규 errorCode 를 발행한다. i18n-userguide.md Principle 3 에 따르면 "신규 errorCode 추가 시 PR 본문에 `ko` 로케일에서 영문 노출 명시" 가 요구된다. 그러나 plan 이나 spec 어디에도 이 명시 의무에 대한 체크박스가 없다.
- **제안**: plan §2.3 또는 §4 (테스트) 에 "PR 본문에 신규 errorCode 목록 + ko 영문 노출 명시 예정" 체크박스 추가. `ERROR_KO` 매핑 테이블 신설 계획이 있으면 follow-up plan 으로 등록.

---

### [WARNING] Conversation Thread 규약 §5.1 — SSE / Notification payload 의 `messages[].source` 마커 처리가 P5/P6 체크박스에 누락

- **target 위치**: `plan/in-progress/external-interaction-api.md §2.5` + `spec/5-system/14-external-interaction-api.md §5.3 context.conversationThread`
- **위반 규약**: `spec/conventions/conversation-thread.md §5.1` (WebSocket emit 결과의 `source` 마커: injected = `source: 'injected'`, 라이브 = `source: 'live'`)
- **상세**: spec §5.3 과 §6.2 의 `context.conversationThread` 에 "messages[].source 마커 누락 시 'live' 폴백" 이 명시돼 있다. SSE 어댑터(P5) 는 Redis pub/sub 으로 WebSocket 이벤트를 받아 SSE 스트림으로 변환하는데, 이때 `messages[].source` 마커가 그대로 전달되도록 passthrough 해야 한다. plan §2.5 의 SSE 어댑터 체크박스에는 "source 마커 preserve" 에 대한 명시가 없다. notification-dispatcher(P3) 도 마찬가지로 `conversationThread` payload 를 그대로 wrap 할 때 `source` 마커가 유지돼야 한다.
- **제안**: plan §2.5 에 "SSE 어댑터가 WebSocket 이벤트의 `conversationThread.messages[].source` 마커를 변형 없이 pass-through" 체크박스 추가. plan §2.4 (NotificationDispatcher) 에도 동일 확인 항목 추가.

---

### [INFO] Migrations V059 — `notification_rotated_at TIMESTAMPTZ` NOT NULL 여부 명확화

- **target 위치**: `spec/5-system/14-external-interaction-api.md §7.1` + `plan/in-progress/external-interaction-api.md §2.1`
- **위반 규약**: `spec/conventions/migrations.md §1` + `codebase/backend/migrations/README.md` (NOT NULL / DEFAULT 규칙)
- **상세**: `notification_rotated_at TIMESTAMPTZ NULL` 은 nullable 컬럼. NULL 허용 목적(rotation 미수행 = NULL)이 명확하므로 규약 위반은 아니다. `notification_last_error TEXT NULL` 도 동일. `notification_secret_v2 TEXT NULL` 도 같다. 그러나 migration README 에서 권장하는 "가능한 한 NOT NULL + DEFAULT" 패턴의 관점에서, rotation 미수행 상태를 `NULL` 이 아닌 `DEFAULT ''` 이나 별도 컬럼 없이 관리하는 대안도 검토 가능하다. 현재 spec 의 `NULL` 선택은 의도적이므로 INFO 등급.
- **제안**: 착수 전 추가 검토 불필요. V059 작성 시 plan §2.1 의 DDL 그대로 사용하고, migrations README 의 트랜잭션 모드 지침(`BEGIN; ... COMMIT;` 또는 `executeInTransaction=true` default) 을 따른다.

---

### [INFO] git add 전략 — PR2 는 대규모 신규 파일 포함, `-A` 금지 준수 계획 확인

- **target 위치**: `plan/in-progress/external-interaction-api.md` 전체 phase
- **위반 규약**: `PROJECT.md §e2e 실행 원칙` + `CLAUDE.md §Skill 체계 developer` (`git add -A` 금지)
- **상세**: PR2 는 신규 파일 15+ (entity, dto, service, controller, migration, SDK 패키지 등) 가 생성된다. 각 phase 종료 commit 시 `git add -A` 가 아닌 `git add <files>` 명시 패턴을 강제해야 한다. plan 분할안이 phase 별 commit 으로 설계돼 있어 원칙은 정합하지만, 실제 구현자가 편의상 `git add -A` 를 쓰지 않도록 plan 에 reminder 를 두는 것이 안전하다.
- **제안**: plan 의 각 phase 에 "commit 시 `git add <변경 파일 목록>` 명시 (`-A` 금지)" 메모 추가 (INFO 수준이라 필수는 아님).

---

### [INFO] `@clemvion/sdk` 패키지 — monorepo workspace 위치 미확정

- **target 위치**: `plan/in-progress/external-interaction-api.md §3.2`
- **위반 규약**: `PROJECT.md §코드베이스 구조` (공유 패키지는 `codebase/packages/` 하위)
- **상세**: plan §3.2 에 "별도 monorepo workspace" 로 신설한다고 했으나, PROJECT.md 는 공유 패키지를 `codebase/packages/<name>/` 에 두고 `file:../packages/*` 로 참조하는 패턴을 정의한다. 외부 npm publish 용 SDK 는 이 구조와 다를 수 있다. plan §3.2 의 "별도 monorepo workspace" 가 `codebase/packages/sdk/` 인지 `codebase/sdk/` 인지 (common-context.md §SDK 도 둘을 병기) 미확정.
- **제안**: P8 착수 전 SDK 패키지 위치를 `codebase/packages/sdk/` 로 확정하고 plan §3.2 에 명시. `codebase/{frontend,backend}/package.json` 의 `file:../packages/sdk` 참조 경로도 P8 체크박스에 추가.

---

## 요약

PR2 구현 착수 대상인 `plan/in-progress/external-interaction-api.md` 와 `spec/5-system/14-external-interaction-api.md` 의 Phase 분할안은 `spec/conventions/migrations.md` 의 V번호·명명 규약(V059 신규, snake_case, 단조 증가)을 위반하지 않으며, swagger.md 의 `@ApiBearerAuth('interaction-token')` 분리·`@Public()` hooks 유지 결정도 spec 에 명시돼 있다. 다만 swagger.md §5 의 응답 DTO 래퍼 헬퍼 적용 계획이 plan 체크박스에 누락돼 있고, API convention §5.3 의 에러 응답 `details` shape 과 spec §5.1 의 `fieldErrors` 객체 래핑 간 불일치가 구현 시 GlobalExceptionFilter 와 충돌할 위험이 있다. i18n 규약 관점에서는 신규 TSX 문자열의 dict 섹션 파일 존재 여부와 신규 errorCode 의 ko 노출 명시 의무가 plan 에서 빠져 있고, conversation-thread.md §5.1 의 `source` 마커 passthrough 가 SSE 어댑터·NotificationDispatcher 체크박스에 미기재됐다. 모두 CRITICAL 위반은 아니나 구현 단계에서 규약 drift 로 이어질 수 있는 WARNING 이다. BLOCK 사유는 없다.

## 위험도

LOW

STATUS: WARN
