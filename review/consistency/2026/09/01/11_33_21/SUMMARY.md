# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 성공, 전문 확보 완료)

## 전체 위험도
**LOW** — target(`spec/5-system/2-api-convention.md`, `spec/5-system/3-error-handling.md`) 델타는 4개 관련 spec·구현 diff와 값 단위로 정합하며, 발견된 문제는 표 내부 갱신 누락(WARNING 1건)과 swagger 강제 상한 초과(WARNING 1건), 그리고 이미 방어된 명명 근접(WARNING 1건)뿐이다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| (없음) | — | — | — | — | — |

## planner 인계 (권한 밖 Critical)

> 해당 없음 — Critical 자체가 없다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| (없음) | | | | |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | §9 파일 업로드 표의 "응답" 행이 신규 아바타 엔드포인트 실제 응답(프로필 봉투)을 반영 안 함 — KB 문서 전용 옛 서술("파일 메타데이터 id/status")만 남음 | `spec/5-system/2-api-convention.md` §9 (line 275-284, 특히 282) | `spec/2-navigation/9-user-profile.md` §6.1(line 354) 이 명시하는 실제 계약(`PATCH /users/me` 와 동일한 프로필 봉투) | "응답" 행을 "엔드포인트별 상이 — KB 문서는 문서 메타데이터(id, status 등), 아바타는 `PATCH /users/me` 와 동일한 프로필 봉투(§5.1)" 로 분기 서술 추가 |
| 2 | convention_compliance | `@ApiOperation.description` 강제 상한(50~150자) 초과 — `uploadAvatar` 170자(신규), `updateMe` 202자(이 PR 이 107→202자로 늘림) | `codebase/backend/src/modules/users/users.controller.ts` `uploadAvatar()`·`updateMe()` | `spec/conventions/swagger.md` §3 "엔드포인트 description: 50~150자, 강제" (DTO description 만 2026-08-23 개정으로 예외, 엔드포인트는 그대로 강제) | 보안/정책 캐비엇 문구를 `UserProfileDto.avatarUrl` 의 `@ApiPropertyOptional description`(길이 예외가 정확히 겨냥하는 자리)으로 옮기고, 엔드포인트 description 은 50~150자로 축약 |
| 3 | naming_collision | `s3.publicBaseUrl`/`S3_PUBLIC_BASE_URL` 이 과거 금지된 phantom key(`app.publicBaseUrl`/bare `publicBaseUrl`)와 leaf 토큰 공유 | `codebase/backend/src/common/config/s3.config.ts`, `.env.example:163`, `spec/data-flow/4-file-storage.md §2.3` | `codebase/backend/src/modules/triggers/triggers.service.spec.ts:1384-1529` (webhook `callbackUrl` 조립 회귀 테스트가 금지하는 phantom key) | 네임스페이스·용도가 달라 실충돌은 아님(이미 "근접 명명 주의" 문단 + 회귀 테스트로 방어됨) — 코드 변경 불요, 후속 PR 이 `s3.publicBaseUrl` 을 다른 도메인 base URL 조립에 재사용하지 않도록 리뷰 시 참조 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | §9 "허용 타입" 행이 "최대 크기" 행과 달리 아바타 예시를 얻지 못해 표 내 갱신 밀도 비대칭 | `spec/5-system/2-api-convention.md` §9 (line 281) | 여유 있으면 "(Knowledge Base 문서: PDF/Markdown/텍스트 등, 아바타: png/jpg/jpeg/webp/gif)" 로 대칭화. 급하지 않음 |
| 2 | rationale_continuity, convention_compliance (중복 통합) | §7 Rate Limiting 표에 아바타 업로드(`POST /api/users/me/avatar`) 행 부재 — 구현상 별도 `@Throttle` 없이 글로벌 100 req/min 상속, §7 자체 원칙("주요 업로드 표면은 행으로 등재")상 KB 문서 행과 대칭 필요 | `spec/5-system/2-api-convention.md` §7 | "파일 업로드 (KB 문서)" 행을 "파일 업로드 (KB 문서·아바타)"로 확장하거나 별도 행 추가 |
| 3 | convention_compliance | `UserProfileDto.avatarUrl` 필드에 JSDoc/description 없음 — 보안 캐비엇이 있어야 할 자리가 비어있고 대신 엔드포인트 description(강제 상한 있는 자리)에 쌓임 | `codebase/backend/src/modules/users/dto/responses/user-response.dto.ts` | WARNING #2 제안과 동일 — "공개 URL(추측 불가능 UUID 로 접근 통제) — PATCH/업로드로 바뀌면 이전 오브젝트는 정리됨" 요지의 description 추가 |
| 4 | convention_compliance | `2-api-convention.md` 에 명시적 `## Overview` 섹션 없음 (frontmatter 직후 바로 §1) — 이 PR 이전부터 존재하던 구조, 이 PR 책임 아님 | `spec/5-system/2-api-convention.md` 최상단 | 이번 PR 범위 밖. 추후 문서 개편 시 고려 |
| 5 | naming_collision | `POST /api/users/me/avatar` — 신규 엔드포인트 아님, `user-profile.md §6.1` 이 취소선으로 이미 예약해 둔 경로를 구현으로 전환 | `spec/5-system/2-api-convention.md §9` | 조치 불요 (정합 사례) |
| 6 | naming_collision | `INVALID_FILE_TYPE` — KB 문서 업로드(`knowledge-base.service.ts:928`)와 아바타가 동일 코드 공유, target 문서가 명시적으로 공용 의도 | `spec/5-system/3-error-handling.md §1.3` | 조치 불요 (의도된 재사용) |
| 7 | naming_collision | `FILE_REQUIRED` — 신규 코드, 저장소 내 기존 사용처 없음 | `spec/5-system/3-error-handling.md §1.3` | 조치 불요 |
| 8 | plan_coherence | `plan/in-progress/spec-draft-avatar-storage-key.md` 가 §A~§H 전체 반영 완료 후에도 in-progress 에 남아 있음 — evidence 문서(tracker 아님)로 보존 의도, lifecycle 가드 위반 아님 | `plan/in-progress/spec-draft-avatar-storage-key.md` | 조치 불요 |
| 9 | plan_coherence | `3-error-handling.md §1.3` `PAYLOAD_TOO_LARGE` "message 는 고정 문구만" 서술과 `spec-sync-user-profile-gaps.md` 의 미해결 multer 413 leak WARNING 간 충돌 가능성 — 조사 결과 target 문서가 애초 "body-parser 의 413" 으로 스코프를 좁혀 명시해 모순 아님 | `spec/5-system/3-error-handling.md §1.3` | 조치 불요 (별도 항목으로 이미 추적 중) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | §9 표 "응답" 행이 아바타 엔드포인트 실제 응답(프로필 봉투)을 반영 못 함(WARNING). 그 외 5개 관련 spec·구현 diff 와 값 단위 정합 |
| rationale_continuity | LOW | "아바타 업로드 없음" 문구 반전은 기각-대안이 아니라 사실 서술 갱신으로 판정, Rationale 연속성 위반 아님. §7 표 아바타 행 누락만 INFO |
| convention_compliance | LOW | `swagger.md §3` 엔드포인트 description 강제 상한(150자) 초과 2건(WARNING). 나머지 규약(에러 코드 명명·응답 envelope·HTTP status)은 전부 준수 |
| plan_coherence | NONE | target 델타는 이전 impl-done CRITICAL BLOCK 을 해소하는 6-파일 동시 수정의 일부로, 상위 결정·plan 라이프사이클과 완전히 일관 |
| naming_collision | LOW | `s3.publicBaseUrl`/`S3_PUBLIC_BASE_URL` 이 과거 금지 phantom key 와 leaf 이름 공유(WARNING, 이미 방어됨). 나머지 신규 식별자는 재사용/신규 구분이 정확 |

## 권장 조치사항
1. (BLOCK 해소 우선 — 해당 없음, BLOCK:NO)
2. `swagger.md §3` 강제 상한 위반 해소 — `uploadAvatar`/`updateMe` 의 `@ApiOperation.description` 을 50~150자로 축약하고, 보안/정책 캐비엇 문구는 `UserProfileDto.avatarUrl` 의 DTO description(예외가 열려 있는 자리)으로 이동 (WARNING #2, INFO #3 동시 해소)
3. `spec/5-system/2-api-convention.md` §9 "응답" 행에 아바타 엔드포인트 분기 서술 추가 (WARNING #1)
4. `s3.publicBaseUrl`/`S3_PUBLIC_BASE_URL` 명명 근접 — 코드 변경 불요, 향후 PR 리뷰 시 `app.publicBaseUrl` phantom key 재사용 방지 참조점으로만 유지 (WARNING #3)
5. (선택, 낮은 우선순위) §7 Rate Limiting 표에 아바타 업로드 행 추가, §9 "허용 타입" 행 대칭화