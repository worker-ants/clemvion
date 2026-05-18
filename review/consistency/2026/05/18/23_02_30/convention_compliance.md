# 정식 규약 준수 검토 — `plan/in-progress/2fa-webauthn.md`

검토 모드: spec draft 검토 (--spec)  
검토 일시: 2026-05-18  
대상 파일: `plan/in-progress/2fa-webauthn.md`

---

### 발견사항

- **[INFO]** plan frontmatter 구조 — 규약 준수
  - target 위치: 파일 상단 frontmatter (`worktree`, `started`, `owner`)
  - 위반 규약: 해당 없음
  - 상세: `worktree: 2fa-webauthn-impl`, `started: 2026-05-18`, `owner: developer` — CLAUDE.md §PLAN 문서 라이프사이클에서 요구하는 3개 필드 모두 정확히 포함. 규약 준수.
  - 제안: 없음.

- **[INFO]** 마이그레이션 파일명 명명 규약 — 준수
  - target 위치: §3 데이터 모델 / 마이그레이션, `V057__webauthn_credentials_and_recovery.sql`, `V058__login_history_webauthn_failed_event.sql`
  - 위반 규약: `spec/conventions/migrations.md §1`
  - 상세: 두 파일명 모두 `V<정수>__<snake_case_descriptor>.sql` 형식을 정확히 따르고 있다. 설명자는 영문 소문자 + `_` 만 사용. alphanumeric suffix 없음.
  - 제안: 없음. 단, plan 에는 V057·V058 번호가 고정 기재되어 있는데, 착수 직전 `§3 전제` 절차(max(V) 재확인 + 가드 스크립트)를 밟도록 유도하는 체크리스트가 이미 포함되어 있어 적절함.

- **[INFO]** 마이그레이션 `.conf` 파일 정책 — 준수
  - target 위치: §3, V057 항목: "단일 트랜잭션 (CONCURRENTLY 없음) → `.conf` 불필요"
  - 위반 규약: `spec/conventions/migrations.md §1`
  - 상세: CONCURRENTLY 없는 트랜잭션 모드에서는 `.conf` 페어 불필요. plan 이 이를 명시적으로 표현하고 있어 규약 이해가 정확함.
  - 제안: 없음.

- **[WARNING]** 응답 DTO 경로 표기의 규약 일관성
  - target 위치: §4 백엔드 구현, `codebase/backend/src/modules/auth/dto/responses/webauthn-response.dto.ts` 항목
  - 위반 규약: `spec/conventions/swagger.md §5-1`
  - 상세: `swagger.md §5-1` 은 응답 DTO 위치를 `codebase/backend/src/modules/<module>/dto/responses/*-response.dto.ts` 로 규정하며 파일명 패턴은 `*-response.dto.ts`. plan 에 기재된 경로 `webauthn-response.dto.ts` 는 이 패턴을 따른다. 그러나 같은 §4 에서 request DTO 를 `webauthn.dto.ts` (responses 하위가 아닌 dto 루트) 로 기재하는데, swagger.md 는 request DTO 위치 규약을 명시하지 않으므로 자체적 판단 영역이다. responses 분리 여부는 규약 준수. 다만 DTO 클래스명 중 `WebAuthnRegisterOptionsDto` / `WebAuthnAuthOptionsDto` 는 "Options" 가 request payload 가 아닌 서버가 내려주는 응답(challenge option)이므로 역할과 suffix 가 명확하다 — 혼동 가능성 있으나 규약 직접 위반은 아님.
  - 제안: 구현 시 DTO 명이 "서버 → 클라이언트 방향의 options payload" 임을 JSDoc 에 명시해 역할 혼선을 방지할 것.

- **[WARNING]** Swagger 어노테이션 참조 표현의 비일관성
  - target 위치: §4 백엔드 구현, auth.controller.ts 항목: `ApiOkWrappedResponse`, `ApiBadRequest`/`ApiUnauthorized`
  - 위반 규약: `spec/conventions/swagger.md §2-4`, `§5-2`
  - 상세: plan 본문이 `ApiBadRequest` / `ApiUnauthorized` 로 표기하고 있으나 실제 NestJS Swagger 데코레이터 이름은 `ApiBadRequestResponse` / `ApiUnauthorizedResponse` (`Response` suffix 필수). `swagger.md §2-4` 표에도 `@ApiBadRequestResponse`, `@ApiUnauthorizedResponse` 로 명시되어 있다. plan 에서 `Response` suffix 를 생략한 것은 구현자가 그대로 복사-붙여넣기 할 경우 오류를 유발할 수 있다.
  - 제안: plan §4 의 해당 항목을 `@ApiBadRequestResponse` / `@ApiUnauthorizedResponse` 로 수정. (`ApiOkWrappedResponse` 는 프로젝트 공용 헬퍼라 규약 준수.)

- **[INFO]** `@ApiParam` uuid format 규약 — 준수
  - target 위치: §4, auth.controller.ts 항목: `@ApiParam({ name: 'id', format: 'uuid' })` 명시
  - 위반 규약: `spec/conventions/swagger.md §5-4` 체크리스트 "경로 UUID 파라미터는 `@ApiParam({ format: 'uuid' })` 일관 적용"
  - 상세: plan 이 이를 명시적으로 언급하고 있어 규약 인지 및 준수 의도가 확인됨.
  - 제안: 없음.

- **[INFO]** 응답 DTO 래퍼 헬퍼 사용 방침 — 준수
  - target 위치: §4, `swagger.md §5-1·§5-4 준수` 언급
  - 위반 규약: `spec/conventions/swagger.md §5-2`, `§6`
  - 상세: `ApiOkWrappedResponse` 등 공용 래퍼 헬퍼 사용이 plan 에 명시되어 있어, `§6 레거시 패턴 제거` (인라인 `schema` 객체 금지) 위반 예방 의도가 반영되어 있다.
  - 제안: 없음.

- **[INFO]** plan 문서 위치·이름 규약 — 준수
  - target 위치: 파일 경로 `plan/in-progress/2fa-webauthn.md`
  - 위반 규약: CLAUDE.md §명명 컨벤션, §PLAN 문서 라이프사이클
  - 상세: `plan/in-progress/` 에 평문 파일명으로 위치. 미완 체크박스(`[ ]`)가 다수 남아있어 `in-progress/` 분류가 정확하다. `plan/complete/` 에 있거나 최상위 `plan/*.md` 에 위치한 규약 위반 없음.
  - 제안: 없음.

- **[INFO]** node-output 규약 적용 가능성 — 해당 없음
  - target 위치: 전체 문서
  - 위반 규약: `spec/conventions/node-output.md`
  - 상세: 본 plan 은 WebAuthn 인증 기능(백엔드 모듈 + 프론트엔드 UI) 을 다루며 workflow 노드의 Output 계약과 무관한 도메인이다. node-output.md 규약 적용 대상이 아님.
  - 제안: 없음.

- **[INFO]** cafe24-api-catalog / cafe24-api-metadata 규약 — 해당 없음
  - target 위치: 전체 문서
  - 위반 규약: `spec/conventions/cafe24-api-catalog/`, `spec/conventions/cafe24-api-metadata.md`
  - 상세: WebAuthn 구현은 Cafe24 API 카탈로그·메타데이터와 무관한 도메인. 해당 규약 적용 대상이 아님.
  - 제안: 없음.

---

### 요약

`plan/in-progress/2fa-webauthn.md` 는 CLAUDE.md 가 요구하는 plan frontmatter 3-필드 구조, `plan/in-progress/` 위치 규약, 마이그레이션 파일명 규약(`spec/conventions/migrations.md §1`), 응답 DTO 경로 규약(`spec/conventions/swagger.md §5-1`), UUID `@ApiParam` format 규약(`§5-4`) 등 핵심 정식 규약을 대체로 준수하고 있다. 발견된 주요 문제는 단 하나로, plan 본문에서 NestJS Swagger 데코레이터 명을 `ApiBadRequest` / `ApiUnauthorized` 로 `Response` suffix 없이 기재한 점이다(`swagger.md §2-4` 위반). 이는 CRITICAL 수준은 아니나 구현자가 plan 을 그대로 따를 경우 컴파일 오류를 유발할 수 있으므로 WARNING 으로 분류한다. DTO 클래스명의 역할 혼동 가능성도 사소한 명확성 문제로 함께 지적한다. 전반적으로 규약 준수 수준은 양호하며, 경미한 표기 정정이 필요한 수준이다.

---

### 위험도

LOW
