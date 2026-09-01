# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 1건(아바타 S3 키의 `workspaceId` prefix 생략이 `spec/0-overview.md` §2.7 Rationale 의 명시적 원칙과 정면 충돌) 발견. 근본 원인이 developer 권한 밖(spec 수정 필요)이라 §planner 인계 대상이지만, 등급은 CRITICAL 그대로이고 BLOCK 도 그대로 유지한다.

## 전체 위험도
**HIGH** — 코드 자체의 자기정합성·규약 준수는 대체로 높으나, 신규 아바타 공개 버킷 키 구조가 `spec/0-overview.md` 의 명시적 Rationale 결정과 정면 모순되어 방치 시 버킷 정책 오설정(운영 사고: "업로드는 성공, 이미지는 403")으로 이어질 실제 경로가 있다. 다행히 이 gap 은 이미 `plan/in-progress/spec-update-avatar-upload-implemented.md` 로 상세 추적 중이다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity (교차 확인: cross_spec·naming_collision 도 같은 사안을 WARNING 으로 지적 — 최고 등급 채택, 하향 없음) | 아바타 S3 키에서 `workspaceId` prefix 를 생략(`avatars/{userId}/{uuid}.{ext}`)한 것이 `spec/0-overview.md` §2.7 `## Rationale → S3 객체 키 prefix 설계` 의 명시적 문장("Form/Avatar 영역은 §2.7 의 키 구조와 같이 이 패턴(workspaceId prefix)을 따른다", "Knowledge Base 원본 문서 키**만** workspaceId 를 prefix 에서 제외")과 정면 충돌 | `codebase/backend/src/modules/users/users.service.ts`(`avatarKeyPrefix`/`updateAvatar`), `codebase/backend/.env.example` | `spec/0-overview.md` §2.7 본문 트리·표 + `## Rationale` "S3 객체 키 prefix 설계" 항목; `spec/data-flow/4-file-storage.md` §1.2/§2.1(`<workspaceId>/avatars/<userId>.<ext>`) | planner 턴에서 §2.7 본문(트리·표) **뿐 아니라 `## Rationale` 텍스트 자체**도 "KB·Avatar 두 영역이 예외" 로 정정 + Avatar 배제 근거(User 는 워크스페이스 비종속 리소스) bullet 신설. `data-flow/4-file-storage.md` 도 동일 갱신 |

## planner 인계 (권한 밖 Critical)

> 위 Critical 은 근본 원인이 developer 권한 밖(spec 수정 필요)이다. **여기 실려도 등급은 CRITICAL 그대로이고 `BLOCK: YES` 도 그대로입니다** — 우회가 아니라 다음 행동을 지정하는 장치.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | 이번 PR 은 `developer` 권한(코드 전용, `spec/5-system/` diff 0). `spec/0-overview.md` §2.7 은 제품 정의/아키텍처 결정이라 "자기-반증형 소정정" 예외(예고·트리거 문장 한정) 대상도 아님 — developer 가 직접 고칠 수 없음 | project-planner | `spec/0-overview.md` §2.7 본문 트리·표 + `## Rationale` "S3 객체 키 prefix 설계" 항목(현재 "KB 만" 배타적 서술 → "KB·Avatar" 로, Avatar 배제 근거 bullet 추가); `spec/data-flow/4-file-storage.md` §1.2/§2.1/§2.2 (실제 키 패턴·공개 접근 모델로 갱신) | `plan/in-progress/spec-update-avatar-upload-implemented.md` (이미 존재 — 단, 현재 체크리스트가 §2.7 본문/표만 지목하고 `## Rationale` 절 정정을 누락하고 있어 이번 리뷰가 그 누락을 지적함. 함께 반영 필요) |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `spec/2-navigation/9-user-profile.md` 가 이미 구현·e2e 검증된 아바타 업로드를 여전히 "미구현 (Planned)" 으로 서술(spec-impl drift) | `spec/2-navigation/9-user-profile.md` §2.1/§6.1 | `users.controller.ts`(`uploadAvatar`), `users.service.ts`(`updateAvatar`), e2e `test/users-avatar-upload.e2e-spec.ts` | `plan/in-progress/spec-update-avatar-upload-implemented.md` 실행 — 배지 flip + §6.1 엔드포인트 계약 반영 |
| 2 | cross_spec | 공개 버킷(anonymous GET) 접근 모델·신규 `S3_PUBLIC_BASE_URL`/`s3.publicBaseUrl` 설정 키가 어느 spec 문서에도 미문서화 | `spec/data-flow/4-file-storage.md` §2.3 ConfigService 매핑 표, `spec/0-overview.md` §2.7 | `codebase/backend/src/common/config/s3.config.ts`(`resolvePublicBaseUrl` 등), `s3.service.ts`(`getPublicUrl`), `.env.example` | §2.3 에 `publicBaseUrl` 행 추가 + "공개 vs 비공개 오브젝트" 구분 절 신설 + 배포 선행조건(버킷 정책: `avatars/` 익명 GET 허용 + ListBucket 차단) 명시 |
| 3 | rationale_continuity | spec 동기화 추적 plan 의 체크리스트가 §2.7 본문/표만 지목하고 `## Rationale` 절 정정을 명시하지 않음(Critical #1 의 원인) | `plan/in-progress/spec-update-avatar-upload-implemented.md` 체크리스트 | `spec/0-overview.md` `## Rationale` "S3 객체 키 prefix 설계" | 체크리스트에 `## Rationale` 정정을 별도 항목으로 추가 |
| 4 | convention_compliance | `@ApiOperation.description` 길이 강제(50~150자, `swagger.md` §3) 초과 2건 — `updateMe` 202자(35% 초과), `uploadAvatar`(신설) 170자(13% 초과) | `codebase/backend/src/modules/users/users.controller.ts` `updateMe`/`uploadAvatar` | `spec/conventions/swagger.md` §3 "엔드포인트 description 50~150자 — 강제" | 150자 이내로 압축하거나, DTO description 에 이미 적용된 "보안·정책 캐비엇 길이 예외" 를 swagger.md §3 표에 엔드포인트 description 까지 명시적으로 확장 |
| 5 | convention_compliance | multer 유래 413(`PayloadTooLargeException`)이 `error-handling.md` §1.3 의 CWE-209 고정 문구("Request payload too large.") 계약을 깨고 라이브러리 원문("File too large")을 그대로 반환(`HttpException` 분기를 타서 `mapHttpErrorLike` 마스킹을 우회) | `spec/5-system/3-error-handling.md` §1.3 `PAYLOAD_TOO_LARGE` 행 vs `http-exception.filter.ts`, `users.controller.ts`(`FileInterceptor` fileSize 2MB) | 같은 패턴이 기존 `knowledge-base.controller.ts` 에도 있었으나 이 PR 이 도달 가능성을 크게 높임 | `HttpException` 분기에서 413 이고 message 가 라이브러리 기본 문자열일 때 고정 문구로 정규화 + `http-exception.filter.spec.ts` 에 `message` 를 명시적으로 단언하는 회귀 테스트 추가 |
| 6 | naming_collision | 신설 `s3.publicBaseUrl`/`S3_PUBLIC_BASE_URL` 이 과거 실제 장애(Telegram webhook 거부)를 낸 "쓰면 안 되는 이름" `app.publicBaseUrl`/bare `publicBaseUrl` 과 leaf 이름을 공유 — 기능적 충돌은 없으나(네임스페이스 분리) grep 기반 조사 시 혼동 소지 | `codebase/backend/src/common/config/s3.config.ts`, `.env.example` | `codebase/backend/src/modules/triggers/triggers.service.spec.ts`(canary 주석, canonical `app.url`) | 양쪽에 상호 참조 주석("이 `publicBaseUrl` 은 S3 전용이며 `app.url` 과 무관" 등) 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec / plan_coherence / naming_collision (교차 일치) | 신규 에러 코드 `FILE_REQUIRED`·`INVALID_FILE_TYPE` 이 `spec/5-system/3-error-handling.md` §1.3 카탈로그에 미등재. `INVALID_FILE_TYPE` 은 KB 모듈과 공용이나 그 사실도 미문서화 | `spec/5-system/3-error-handling.md` §1.3 | `plan/in-progress/spec-update-avatar-upload-implemented.md` 가 이미 todo 로 보유 — 등재 시 "KB 문서 업로드와 공용 코드" 명시 |
| 2 | cross_spec | 신규 plan 이 영향 문서 4개(`9-user-profile.md`/`0-overview.md`/`4-file-storage.md`/`3-error-handling.md`) 중 어디의 frontmatter `pending_plans` 에도 등재되지 않음 | 각 문서 frontmatter | 최소 `9-user-profile.md` 부터 `pending_plans` 목록에 이 plan 추가 |
| 3 | naming_collision | `users.controller.ts` 의 `Express` → `ExpressNS` import alias 변경이 이 컨트롤러에 한정(다른 컨트롤러 4곳은 여전히 `Express`) — Multer 전역 네임스페이스 충돌 회피 목적, 코드 주석이 범위·후속조건 명시 | `codebase/backend/src/modules/users/users.controller.ts` | 조치 불요. 향후 두 번째 Multer 컨트롤러 도입 시 `spec/conventions/` import 별칭 규약 문서화 검토 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | S3 키 구조가 `0-overview.md` §2.7 계획과 3축(prefix·세그먼트·파일명) 모두 다름, `9-user-profile.md` 배지 stale, 공개 버킷 설정 미문서화 |
| rationale_continuity | MEDIUM (finding 자체는 CRITICAL) | `workspaceId` prefix 생략이 `0-overview.md` Rationale 의 명시적 배타 서술과 정면 충돌; 추적 plan 체크리스트가 Rationale 절 정정을 누락 |
| convention_compliance | MEDIUM | `@ApiOperation.description` 길이 강제 2건 초과, multer 413 이 CWE-209 고정 문구 계약 위반 |
| plan_coherence | LOW | target(`spec/5-system/`) 델타 0, 발견된 gap 전부 기존 plan 이 이미 추적 중, 신규 미해결 없음 |
| naming_collision | LOW | 진짜 "동일 이름·다른 의미" 충돌은 0건, `publicBaseUrl` 이름 공유·S3 키 포맷 불일치는 다른 checker 와 교차 확인 |

## 권장 조치사항

1. (BLOCK 해소 우선) planner 턴에서 `spec/0-overview.md` §2.7 본문(트리·표) **및 `## Rationale`** "S3 객체 키 prefix 설계" 항목을 실제 키 패턴(`workspaceId` 미포함, `avatars/{userId}/{uuid}.{ext}`)으로 정정하고, `spec/data-flow/4-file-storage.md` §1.2/§2.1/§2.2 도 동일하게 갱신 — `plan/in-progress/spec-update-avatar-upload-implemented.md` 를 실행하되 체크리스트에 `## Rationale` 정정 항목을 먼저 추가할 것.
2. 같은 planner 턴에 `spec/2-navigation/9-user-profile.md` 배지 flip(§2.1/§6.1), `spec/5-system/3-error-handling.md` §1.3 에 `FILE_REQUIRED`/`INVALID_FILE_TYPE` 등재, `data-flow/4-file-storage.md` §2.3 에 `publicBaseUrl` 설정 키 추가, 4개 문서 frontmatter `pending_plans` 동기화까지 한 번에 처리.
3. developer 후속 코드 수정(별도 턴): `@ApiOperation.description` 2건을 150자 이내로 압축하거나 `swagger.md` §3 규약 자체를 개정, multer `PayloadTooLargeException.message` 를 CWE-209 고정 문구로 정규화 + 회귀 테스트 추가.
4. (경미, 선택) `s3.config.ts`/`triggers.service.spec.ts` 에 `publicBaseUrl` 이름 관련 상호 참조 주석 추가.
