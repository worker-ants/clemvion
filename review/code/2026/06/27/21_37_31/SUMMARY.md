# Code Review 통합 보고서

> 대상 변경셋: trigger endpointPath UUID 강제(W1 보안) + WorkspaceInvitationsPrunerService 신규 추가
> 생성일시: 2026-06-27 21:37:31

## 전체 위험도

**MEDIUM** — Breaking API Change(endpointPath UUID 강제)로 인한 기존 클라이언트 마이그레이션 필요. Redis 장애 시 앱 전체 부팅 차단 위험. Critical 발견 없음; 의도된 보안 강화 설계이나 배포 전 DB·클라이언트 적합성 확인 요함.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API Breaking Change | `endpointPath` 유효성 검증이 `@IsString/@MaxLength(255)` → `@IsUUID('4')` 로 강화되어 비-UUID 경로를 사용하던 기존 클라이언트에 파괴적 변경. 의도된 보안 강화(WH-SC-01)이나 배포 전 DB 레코드 전수 확인 및 클라이언트 마이그레이션 필요. | `create-trigger.dto.ts` L55, `update-trigger.dto.ts` L63 | 배포 전 DB `endpoint_path` 컬럼 UUID 형식 적합성 확인; 프론트엔드 클라이언트가 `crypto.randomUUID()` 사용 중인지 검증 |
| 2 | 보안 | `auth_config_id IS NULL` 트리거에서 `endpointPath` UUID가 사실상 유일한 접근 비밀 키(WH-SC-01)인데, 서버는 v4 UUID 형식만 검증하고 클라이언트 RNG 품질은 검증 불가. 저엔트로피 v4 UUID 제출을 서버가 거부할 수단 없음. | `create-trigger.dto.ts` L138, `spec/5-system/12-webhook.md` WH-SC-01 | API 문서 및 spec에 `crypto.randomUUID()` 또는 동등한 CSPRNG 사용을 강제 요구사항으로 명시("반드시 사용해야 한다"로 강화) |
| 3 | 아키텍처 | `UpdateTriggerDto`가 `endpointPath`를 유효한 값으로 수락하지만 서비스 레이어가 이를 거부하는 누출 추상화(Leaky Abstraction). 클라이언트가 Swagger prose를 읽어야만 필드가 사실상 불변임을 알 수 있어 레이어 경계 책임 분리 모호. | `update-trigger.dto.ts` — `endpointPath` 필드 + description 주석 | (a) `UpdateTriggerDto`에서 `endpointPath` 제거 또는 (b) 서비스에서 `ENDPOINT_PATH_IMMUTABLE` 명시적 예외 throw (minor 버전 사이클에서 처리 권장) |
| 4 | 인프라/부작용 | `WorkspaceInvitationsPrunerService.onModuleInit`에서 Redis unavailable 시 throw되어 `@Global()` `WorkspacesModule` 전체 부팅이 차단됨. Redis 장애가 워크스페이스 무관 모듈 초기화까지 막음. | `workspace-invitations-pruner.service.ts` `onModuleInit` | Redis가 필수 의존임을 운영팀에 명문화; Redis 장애 내성 필요 시 `onModuleInit` 내부 예외를 catch하고 경고 로그만 남기는 soft-fail 방식 고려 |
| 5 | 테스트 | `UpdateTriggerDto`에서 비-UUID 거부 케이스만 테스트하고, 유효한 v4 UUID가 통과하는지 확인하는 케이스 부재. `@IsUUID('4')` 데코레이터 실제 적용 여부를 회귀 탐지 관점에서 충분히 검증하지 못함. | `trigger-dto-validation.spec.ts` — UpdateTriggerDto `endpointPath` describe 블록 | `UpdateTriggerDto — 유효한 v4 UUID 통과` 케이스 추가 (`{ endpointPath: VALID_UUID }` → `errors.find(e => e.property === 'endpointPath')` 가 undefined) |
| 6 | 테스트 | `upsertJobScheduler` 호출 시 세 번째 인자의 `removeOnComplete`/`removeOnFail` retention 설정을 검증하지 않음. 이 설정 누락 또는 오설정 시 Redis에 완료 잡이 무기한 누적될 수 있음. | `workspace-invitations-pruner.service.spec.ts` — `onModuleInit` 테스트 | `expect.objectContaining({ opts: expect.objectContaining({ removeOnComplete: ..., removeOnFail: ... }) })` 검증 추가 |
| 7 | 유지보수 | `trigger-dto-validation.spec.ts` 내 동일 구조의 픽스처 상수 `baseCreate`(모듈 스코프)와 `baseTrigger`(describe 내부)가 중복 공존. 베이스 구조 변경 시 두 곳 수정 필요. | `trigger-dto-validation.spec.ts` L275–279 (`baseCreate`) vs L282–286 (`baseTrigger`) | `baseTrigger`를 제거하고 모듈 스코프 `baseCreate`로 통일 |
| 8 | 유지보수 | `trigger-dto-validation.spec.ts` 내 동일 값의 검증 옵션 상수 `VALIDATE_OPTIONS`(L273)와 `VALIDATE_OPTS`(WebChatAppearanceDto describe 내)가 이름만 달리해 중복 정의. 우연한 불일치 위험. | `trigger-dto-validation.spec.ts` L273, L811 부근 | 모듈 최상위 `VALIDATE_OPTIONS` 하나로 통일, `VALIDATE_OPTS` 참조 교체 |

---

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/data-flow/12-workspace.md` §3.1 라인 222–224이 "현재 프로덕션 호출자가 없어 만료 row는 영구 잔존한다. 정리 job 연결은 미구현."으로 기술되어 있으나, 이번 변경셋이 `WorkspaceInvitationsPrunerService`를 신규 추가해 해당 갭을 정확히 해소함. 같은 문서 §1.2는 이미 갱신되었으나 §3.1만 낡은 상태로 상충. 코드는 옳고 spec만 낡음. | `spec/data-flow/12-workspace.md` §3.1 L222–224 | 코드 유지; §3.1 해당 문단을 "만료 row는 `WorkspaceInvitationsPrunerService`(매일 04:00 Asia/Seoul, BullMQ repeatable job)가 주기적으로 삭제한다."로 갱신 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `languageHints` 사용자 정의 메시지가 HTML/스크립트 새니타이징 없이 저장됨. Web Chat 위젯에서 innerHTML 렌더링 시 Stored XSS 잠재 벡터. | `trigger-dto-validation.spec.ts` L735 이하 | Web Chat 위젯에서 `languageHints` 값을 `textContent`로만 처리하는지 확인 |
| 2 | 아키텍처 | `CreateTriggerDto.type`이 `@IsIn(['webhook', 'manual'])` 하드코딩 배열로 강제되어 TypeScript 타입 안전성 부재. 새 타입 추가 시 여러 곳 수동 동기화 필요. | `create-trigger.dto.ts` L93–94 | `TRIGGER_TYPES = ['webhook', 'manual'] as const` SOT 상수로 추출 후 공유 |
| 3 | 아키텍처 | `endpointPath` UUID 강제가 DTO 레이어에만 있고 서비스/DB 레벨 이중 검증 여부 불명확. ValidationPipe 우회 경로 존재 시 DB에 비-UUID 값 기록 가능. | `create-trigger.dto.ts`, `update-trigger.dto.ts` | DB migration에 `endpoint_path` UUID 형식 CHECK constraint 추가 검토 |
| 4 | 요구사항 | `WorkspaceInvitationsPrunerService` 스케줄 시각(04:00 Asia/Seoul)이 spec에 명시되지 않음. 코드 결정은 합리적이나 가시성 부족. | `workspace-invitations-pruner.service.ts` L1257 | `spec/data-flow/12-workspace.md` §3.1에 스케줄 시각 명기 (비차단) |
| 5 | 부작용 | 매일 04:00 Asia/Seoul `workspace_invitation` 테이블 만료 row 실삭제 신규 도입. 이전에는 호출자 없이 `pruneExpired`가 존재만 했음. | `workspace-invitations-pruner.service.ts` `prune()` | 감사(audit) 목적 만료 초대 row 보존 요구사항 없는지 확인; `pruneExpired`가 삭제 전 audit 로그를 남기는지 검토 |
| 6 | 부작용 | `uniqueEndpoint(_label)` 파라미터가 완전히 무시되나 시그니처에 잔존. 의도적 변경이나 미래 독자 오해 가능. | `chat-channel-trigger-create.e2e-spec.ts` L1499 | 추후 `uniqueEndpoint(): string`으로 파라미터 제거 및 콜 사이트 정리 (선택적) |
| 7 | 유지보수 | `create-trigger.dto.ts` `endpointPath` ApiPropertyOptional description이 4줄 문자열 연결로 과도하게 장황. | `create-trigger.dto.ts` L130–134 | decorator description 간결화 후 상세 내용은 JSDoc 주석으로 분리 |
| 8 | 유지보수 | `removeOnComplete`/`removeOnFail` age 값(`7 * 24 * 60 * 60` 등)이 각 파일에서 독립 관리되어 불일치 위험. | `workspace-invitations-pruner.service.ts` L1271–1272 | 공통 시간 상수 파일 추출 또는 named const 선언 |
| 9 | 테스트 | v3/v5 UUID 거부 케이스 미테스트. `@IsUUID('4')` 거부는 당연하나 WH-SC-01 맥락에서 문서화 가치 있음. | `trigger-dto-validation.spec.ts` | v5 UUID(version nibble=5) 거부 케이스 추가 (선택적) |
| 10 | 테스트 | `prune()` 에러 swallow catch 블록에서 non-Error throw(문자열 등) 경로 미테스트. | `workspace-invitations-pruner.service.spec.ts` | `Promise.reject('raw string error')` 케이스 추가 (선택적) |
| 11 | 테스트 | e2e 레벨에서 비-UUID `endpointPath` → 400 반환 케이스 부재. ValidationPipe 스택 완전 검증 보완 가능. | `webhook-trigger.e2e-spec.ts` | `endpointPath: 'my-integration'` POST → 400 VALIDATION_ERROR e2e 케이스 추가 (선택적) |
| 12 | 문서화 | `WorkspaceInvitationsPrunerService` 공개 메서드 `process()`/`prune()`에 JSDoc 독스트링 부재. | `workspace-invitations-pruner.service.ts` L278, L282 | `process()`에 "BullMQ 워커 진입점 — prune()로 위임" 1줄 JSDoc, `prune()`에 에러 swallow 정책 JSDoc 추가 |
| 13 | 문서화 | `UpdateTriggerDto.endpointPath` JSDoc에 서비스 거부 정책이 누락되어 Swagger UI와 IDE hover 간 정보 비대칭. | `update-trigger.dto.ts` L53 (JSDoc) | JSDoc에 "생성 후 변경은 service가 거부한다" 추가 |
| 14 | 문서화 | `PATCH /api/triggers/:id` endpointPath 변경 거부 시 반환 HTTP 상태 코드·오류 코드가 Swagger에 미명시. | `update-trigger.dto.ts` description | Swagger 응답 섹션에 `400 ENDPOINT_PATH_IMMUTABLE`(또는 실제 오류 코드) 추가 |
| 15 | 동시성 | `prune()` 에러 swallow로 인해 `removeOnFail: { age: 30 * 24 * 60 * 60 }` 설정이 현재 dead code. 의도적 설계이나 오해 소지. | `workspace-invitations-pruner.service.ts` | `onModuleInit` 주석에 "현재 `process`가 에러를 swallow하므로 `removeOnFail`은 미래 재-throw 전환 대비 placeholder" 명시 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 클라이언트 UUID 엔트로피 미검증(WARNING); endpointPath UUID 강제는 보안 향상 |
| architecture | LOW | UpdateTriggerDto Leaky Abstraction(WARNING); 트리거 타입 SOT 부재(INFO) |
| requirement | LOW | SPEC-DRIFT: spec/data-flow/12-workspace.md §3.1 미갱신; 코드 구현은 정확 |
| scope | N/A | 출력 파일 없음 (status=success로 보고되었으나 파일 부재) |
| side_effect | LOW | Redis 부팅 차단 위험(WARNING); Breaking API change(WARNING); 나머지 INFO |
| maintainability | LOW | 중복 상수 2건(WARNING); spec §3.1 내부 불일치(SPEC-DRIFT와 중복) |
| testing | LOW | UpdateTriggerDto 통과 케이스 부재(WARNING); upsertJobScheduler opts 미검증(WARNING) |
| documentation | LOW | JSDoc 부재·spec 미반영 모두 INFO 수준; 긍정적 문서화 다수 |
| concurrency | LOW | removeOnFail dead code(INFO, 의도적); 멀티 인스턴스 안전성 확인됨 |
| api_contract | MEDIUM | Breaking Change(WARNING, 의도적); 서비스 거부 오류 코드 미명시(INFO) |

---

## 발견 없는 에이전트

해당 없음. 모든 실행 에이전트가 발견사항을 보고함.

---

## 권장 조치사항

1. **[배포 전 필수]** DB `endpoint_path` 컬럼에 비-UUID 형식 레코드가 있는지 전수 확인하고, 프론트엔드 클라이언트가 `crypto.randomUUID()` 를 사용 중인지 검증 (Breaking Change 대응)
2. **[SPEC-DRIFT 필수]** `spec/data-flow/12-workspace.md` §3.1 L222–224의 "정리 job 연결은 미구현" 문구를 `WorkspaceInvitationsPrunerService` 도입 내용으로 갱신 (코드 revert 아님, spec 갱신)
3. **[운영 필수]** Redis 가용성이 `WorkspacesModule` 부팅의 필수 전제임을 운영팀에 명문화; Redis 장애 내성이 필요한 환경이라면 soft-fail 방식 고려
4. **[보안]** API 문서/spec에 `endpointPath` 생성 시 `crypto.randomUUID()` 사용을 강제 요구사항으로 명시 (현재 "발급하며" → "반드시 사용해야 한다"로 강화)
5. **[아키텍처]** `UpdateTriggerDto`에서 `endpointPath` 필드 제거 또는 서비스에서 `ENDPOINT_PATH_IMMUTABLE` 명시적 예외 throw 도입 (minor 버전 사이클에서 처리)
6. **[테스트]** `UpdateTriggerDto` 유효한 v4 UUID 통과 케이스 추가 + `upsertJobScheduler` opts(`removeOnComplete`/`removeOnFail`) 검증 강화
7. **[유지보수]** `trigger-dto-validation.spec.ts` 내 중복 상수 정리: `baseTrigger` → `baseCreate` 통일, `VALIDATE_OPTS` → `VALIDATE_OPTIONS` 통일

---

## 라우터 결정

`routing_status=done` — 라우터가 실행 reviewer를 선별함.

- **실행** (10명): `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `concurrency`, `api_contract`
- **강제 포함(router_safety)** (7명): `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`
- **제외** (4명):

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 라우터 판단에 의해 생략 |
| dependency | 라우터 판단에 의해 생략 |
| database | 라우터 판단에 의해 생략 |
| user_guide_sync | 라우터 판단에 의해 생략 |