# RESOLUTION — 22_09_30

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W-1 | 코드(backlog) | 4977d961 | 초대 토큰 해시 저장 — 즉각 취약점 아님. `plan/in-progress/security-backlog-invitation-token-hash.md` 백로그 등록 |
| W-2 | 코드 | 4977d961 | `promoteRotatedNotificationSecrets` notification config 부재 skip 경로 — `continue` 전 v2/rotatedAt null 클리어 + save + 경고 로그 |
| W-3 | 테스트 | 4977d961 | `triggers.service.spec.ts` 프로바이더 중복 → `createBaseProviders()` 헬퍼 추출 (Secret rotation + setupChatChannel 두 describe 재사용) |
| testing-W-1 | 코드(판단재량) | — | `@Roles` 단위 미검증 — e2e(`audit-logs.e2e-spec.ts`)가 viewer·editor·비멤버 403 5케이스로 커버. SUMMARY 맥락상 재량 허용 처리, 코드 변경 없음 |
| testing-W-2 | 테스트 | 4977d961 | `secrets.rotate` 실패 시 예외 전파 계약 단위 테스트 추가 (`mockRejectedValueOnce` → rethrow 검증) |
| testing-W-3 | 테스트 | 4977d961 | notification config 부재 skip 케이스 — W-2 fix 에 맞춰 v2/rotatedAt null 클리어 assertion 갱신 |
| INFO #1 (SPEC-DRIFT) | spec | (draft 위임) | `spec/data-flow/15-external-interaction.md` §3.3 갭 주의 문구 제거 → `plan/in-progress/spec-update-external-interaction-c3-drift.md` |
| INFO #2 (SPEC-DRIFT) | spec | (draft 위임) | `spec/data-flow/15-external-interaction.md` §Rationale C3 해소 이력으로 전환 → 동일 draft |
| INFO #3 | 코드 | 4977d961 | `AuditLogsController.findAll` `@ApiForbiddenResponse` 데코레이터 추가 |
| INFO #6 | 코드 | 4977d961 | `AuditLogsService.record` `console.warn` → `Logger.warn` (NestJS Logger 일관성) |
| INFO #11 | spec | 4977d961 | `spec/data-flow/1-audit.md` §2.1 인라인 날짜 텍스트("2026-06-10 V-03 갭 해소") 제거 |
| INFO #12 | 문서 | 4977d961 | `plan/in-progress/security-fixes-audit-guard-secret-rotation.md` frontmatter `spec_impact` 에 `spec/1-data-model.md`, `spec/5-system/1-auth.md` 추가 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (40 passed)
- e2e   : 통과 (184/184)

## 보류·후속 항목

- SPEC-DRIFT draft 위임: `plan/in-progress/spec-update-external-interaction-c3-drift.md`
  - §3.3 마지막 줄 갭 주의 문구 제거 (`v2 승격·클리어` 로만 남김)
  - §Rationale "§1.5 구현 갭을 본문에 남긴 이유" → 과거 시제 + C3 해소 이력으로 갱신
- testing-W-1 (RolesGuard 단위 통합 테스트 미추가): e2e 커버로 재량 허용. 향후 Guard 변경 시 단위 레벨 회귀 테스트 추가 권장.
- INFO #4 (getSortColumn @IsIn 검증): `QueryAuditLogDto` 상속 체인에 `@IsIn(['asc','desc'])` 존재 확인만 필요 — 코드 fix 범위 아님 (INFO).
- INFO #5 (secrets.rotate JSDoc): `triggers.service.ts` JSDoc 에 "실패 시 예외 전파 → job retry 유도" 의도 명시 — 향후 문서 개선 기회로 남김.
- INFO #7 (getSortColumn Set 리팩토링): INFO 수준, 후속 리팩토링 백로그 잠재.
- INFO #8 (notificationSigningRef 헬퍼 추출): INFO 수준, 리팩토링 백로그.
- INFO #9 (as never 타입 단언): INFO 수준, 리팩토링 기회.
- INFO #13 (AuditLogsService.findAll JSDoc): INFO 수준, 문서 개선 기회.
- INFO #14 (e2e afterAll cleanup): e2e DB isolation 구조 내 현재 충분 — INFO 수준.
