# 요구사항(Requirement) 리뷰 결과

## 발견사항

### **[INFO] [SPEC-DRIFT] spec/data-flow/15-external-interaction.md §3.3 — "구현 갭 주의 포함" 문구 잔류**
- 위치: `spec/data-flow/15-external-interaction.md`, 라인 283 (`§3.3 Notification signing secret` 상태 전이 다이어그램)
- 상세: C3 fix 로 `promoteRotatedNotificationSecrets` 의 구현 갭이 해소됐고 §1.5 본문도 갱신됐다. 그런데 §3.3 상태 전이 설명 마지막 줄 `` `v2 승격·클리어` (§1.5 구현 갭 주의 포함). `` 에 구 갭 참조가 남아 있다. 코드 동작은 옳고 §1.5 본문도 바르게 갱신됐으므로, 코드 버그가 아니라 spec 의 §3.3 텍스트 갱신 누락이다.
- 제안: 코드 유지 + spec §3.3 텍스트를 `` `v2 승격·클리어`. `` (갭 주의 문구 제거) 로 갱신. 연관: §Rationale "§1.5 구현 갭을 본문에 남긴 이유" 섹션도 역사 노트로 보존하거나 삭제 여부를 결정 필요.

### **[INFO] [SPEC-DRIFT] spec/data-flow/15-external-interaction.md §Rationale "§1.5 구현 갭을 본문에 남긴 이유" — 현재 시제 불일치**
- 위치: `spec/data-flow/15-external-interaction.md`, 라인 324–329
- 상세: Rationale 섹션이 "data-flow 문서는 코드를 단일 진실로 서술하되, 의도와의 불일치가 … 본문 callout 으로 가시화했다. 해소는 developer plan 으로 추진한다." 를 현재 시제로 기술한다. C3 fix 이후 갭이 해소됐으므로 이 섹션은 역사 서술이 됐다. 코드는 옳고 §1.5 본문도 갱신됐으므로 spec 텍스트 조정 누락이다.
- 제안: 코드 유지 + 해당 Rationale 섹션을 "2026-06-10 C3 해소" 사실로 갱신하거나 역사 맥락을 유지하면서 과거 시제로 전환. 대상 spec: `spec/data-flow/15-external-interaction.md §Rationale`.

### **[INFO] AuditLogsController — `@ApiForbiddenResponse` Swagger 선언 누락**
- 위치: `codebase/backend/src/modules/audit-logs/audit-logs.controller.ts`, `findAll` 핸들러
- 상세: `@Roles('admin')` 적용 시 `RolesGuard` 가 비멤버·권한 미달 시 403 Forbidden 을 반환하지만, 컨트롤러에는 `@ApiUnauthorizedResponse` 만 선언돼 있고 `@ApiForbiddenResponse` 가 없다. Swagger 문서상 403 응답이 누락된다. 기능 동작에는 영향 없음.
- 제안: `@ApiForbiddenResponse({ description: '권한 부족 (Admin 미만) 또는 비멤버' })` 추가.

---

## 요약

두 보안 픽스(V-03, C3) 모두 요구사항 대비 기능을 완전히 구현했다.

**V-03 (Audit log Admin+ 가드)**: `@Roles('admin')` 데코레이터가 정상 부착됐고, `RolesGuard` 는 워크스페이스 멤버십(`getMemberRole` null 반환 → false)과 역할 계층(viewer=1, editor=2, admin=3, owner=4)을 함께 검증해 비멤버의 `X-Workspace-Id` 위조도 차단한다. `userId` 필터는 `@IsUUID()` 유효성 검증 + service where 절 양쪽이 모두 구현됐다. spec 5-system/1-auth.md §4.2 ("관리자(Admin+)만 조회 가능 / 기간, 사용자, 액션 유형으로 필터링") 및 §5 표 ("GET /api/audit-logs (Admin+)") 와 line-level 로 일치한다.

**C3 (notification secret rotate promote 무효 버그)**: `promoteRotatedNotificationSecrets` 가 이제 `secrets.rotate(canonicalRef, workspaceId, secretV2)` 로 secret store 내용을 교체한 뒤 `signing.secretRef = ref` 로 연결하고 `signing.secret` 평문 키를 삭제한다. `resolveSigningSecret` 의 `secretRef` 우선 정책과 정합해 승격 즉시 새 secret 으로 primary 서명이 전환된다. notification config 없는 trigger 는 `continue` 로 skip 돼 `triggerRepo.save` 미호출이 검증됐다. `spec/data-flow/15-external-interaction.md §1.5` 본문도 갱신됐다.

단위 테스트(3 + 3케이스 신설 + 기존 계약 갱신)와 e2e 테스트(5케이스: admin 200/viewer·editor 403/비멤버 위조 403/userId 필터)가 각 보안 요구사항을 회귀 차단한다. 발견된 3건은 모두 spec 텍스트 후처리 누락(INFO SPEC-DRIFT 2건) 또는 Swagger 문서 완성도(INFO 1건)이며, 기능 정확성·보안 강제·비즈니스 로직에 영향하는 코드 버그는 없다.

---

## 위험도

**LOW** — 기능·보안 요구사항은 완전히 구현됐다. 잔류 이슈는 spec 텍스트 후처리 2건(SPEC-DRIFT)과 Swagger 선언 1건으로 운영 위험 없음.
