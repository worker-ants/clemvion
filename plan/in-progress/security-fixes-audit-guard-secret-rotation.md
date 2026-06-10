---
worktree: security-fixes-0f9165
started: 2026-06-10
owner: developer
spec_impact:
  - spec/data-flow/1-audit.md
  - spec/data-flow/15-external-interaction.md
---

# 보안 fix 2건 — audit-logs Admin+ 가드(V-03) + notification secret rotation 무효(C3)

출처: 전수 감사 보고 V-03 ([spec-coverage SUMMARY](../../review/spec-coverage/2026/06/10/12_32_46/SUMMARY.md)) + trigger-schedule-sync 리뷰 이월 C3 ([trigger-review-deferred-fixes](./trigger-review-deferred-fixes.md) 항목 1).

## 계약 (SoT)

- **V-03**: `spec/5-system/1-auth.md §4.2` — "관리자(Admin+)만 조회 가능 / 기간, **사용자**, 액션 유형으로 필터링", §5 표 "GET /api/audit-logs (Admin+)". 현 코드: `@Roles` 부재 (전역 RolesGuard 는 미지정 라우트 통과) + `@WorkspaceId` 헤더 무검증 → 비멤버 열람 가능. userId 필터도 미구현.
- **C3**: 승격(`promoteRotatedNotificationSecrets`)이 v2 평문을 `config.signing.secret` 에 쓰지만 `resolveSigningSecret` 은 `secretRef` 우선 → secret store ref 보유 trigger 는 승격 후에도 구 secret 으로 서명 지속 (rotation 무효). `spec/data-flow/15-external-interaction.md §1.5` 구현 갭 blockquote 가 SoT 로 기술 중.

## 설계

- **V-03**: `AuditLogsController.findAll` 에 `@Roles('admin')` — RolesGuard 가 membership+role 동시 검증 (비멤버 차단 포함). `QueryAuditLogDto` 에 `userId?` (`@IsUUID`) 추가 + service where 절. spec 본문 변경 없음 (계약 이행), data-flow/1-audit.md 의 "Admin+ 미강제 갭" 기술만 플립.
- **C3**: promote 루프에서 평문 쓰기 대신 `normalizeNotificationSecretRef` 와 동일 canonical ref (`buildSecretRef(triggers/<id>/notification-signing)`) 로 `secrets.rotate(ref, wsId, v2)` + `signing.secretRef=ref` 설정(+평문 키 제거). ref 기존재(내용 회전)·부재(신규 연결) 양쪽 커버. dual-sign window 의미 유지 (grace 중 secondary=v2, 승격 후 primary=신규).

## 체크리스트

- [x] /consistency-check --impl-prep spec/5-system/ — BLOCK YES: Critical 4건(본 작업 무관 기존 drift — 1-data-model §2.1 User 필드 누락 3건·초대 토큰 정책 병치 1건) 즉시 해소 (User 표 동기화 + 1-auth §1.5.D Rationale + rate limit 확정값). 잔여 WARNING (invitation_already_accepted 에러코드 미등재·register body email 명시·§5 응답 래퍼 주석·plan 중복 추적 2건) 은 본 작업 범위 밖 — 후속 planner 백로그로 기록
- [x] 단위 테스트 선작성 (audit-logs.spec.ts 신설 3케이스 + triggers promote 3케이스, 구계약 기대 기존 1건 신계약 갱신)
- [x] 구현 — 커밋 98b0b618
- [x] e2e (audit-logs.e2e-spec.ts 신설 5케이스: admin 200/viewer·editor 403/비멤버 위조 403/userId 필터)
- [x] TEST WORKFLOW (lint·unit·build·e2e 184 전부 PASS, 2026-06-10 22:07)
- [x] spec 갭 기술 플립 (data-flow/1-audit.md §2.1 권한·필터 / 15-external-interaction.md §1.5 승격 경로)
- [ ] /ai-review + resolution
- [ ] /consistency-check --impl-done spec/5-system/
