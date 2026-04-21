### 발견사항

---

**[WARNING] `update` 엔드포인트의 No-op 분기에서 인가 검사 누락**
- 위치: `workspaces.controller.ts` — `update()` 메서드, `dto.name === undefined` 분기
- 상세: `dto.name`이 undefined일 때 `findById`로 워크스페이스를 조회해 반환하는데, 이 경로에서는 `renameWorkspace` → `assertAdmin` 검사를 거치지 않는다. 즉, 어떤 인증된 사용자라도 임의의 워크스페이스 ID에 `PATCH /workspaces/:id` (body 없이)를 보내면 워크스페이스 존재 여부와 이름·슬러그·타입 정보를 열람할 수 있다. 멤버가 아닌 사용자에게 타 워크스페이스 메타데이터가 노출된다.
- 제안: no-op 분기를 제거하거나, 해당 분기에서도 `assertMembership` / `assertAdmin`을 먼저 호출한다.

```ts
// Before (취약)
if (dto.name === undefined) {
  const ws = await this.workspacesService.findById(workspaceId);
  ...
}

// After (권고)
if (dto.name === undefined) {
  await this.workspacesService.assertMembership(workspaceId, user.sub); // 또는 assertAdmin
  const ws = await this.workspacesService.findById(workspaceId);
  ...
}
```

---

**[WARNING] `renameWorkspace`에서 이름 검증 실패 시 `ConflictException` 오용**
- 위치: `workspaces.service.ts` — `renameWorkspace()`, 108번째 줄 근방
- 상세: 이름이 너무 짧거나 길 때 `ConflictException`(409)을 던진다. 의미상으로는 `BadRequestException`(400)이 맞다. 오류 코드가 `WORKSPACE_NAME_TOO_SHORT`임에도 HTTP 상태 코드가 409로 내려가면 클라이언트가 재시도 로직을 오작동할 수 있고, 에러 로그 분석 시 혼란을 야기한다. 보안 측면에서는 오류 응답 형태의 일관성이 무너지면 에러 처리 우회 시도가 쉬워진다.
- 제안: `BadRequestException` 사용.

---

**[WARNING] `deleteWorkspace`에서 개인 워크스페이스 타입 검사가 역할 검사 이후에 위치**
- 위치: `workspaces.service.ts` — `deleteWorkspace()`
- 상세: `getMemberRole` → owner 검증 → `findOne` → 개인 워크스페이스 차단 순서다. 만약 owner가 개인 워크스페이스 ID를 보내면 DB를 두 번 조회한 뒤에야 차단된다. 기능 버그는 아니지만, 타입 검사를 역할 검사보다 앞에 두면 불필요한 DB 쿼리를 줄이고 로직이 명확해진다. 현재 로직에서 멤버십이 없는 사용자가 개인 워크스페이스 ID를 전달하면 `OWNER_REQUIRED`가 먼저 응답되어 해당 리소스의 존재 여부를 간접적으로 유추할 수 있는 **정보 노출(IDOR 유사)**이 발생한다.
- 제안: 워크스페이스 조회·타입 검증 → 역할 검증 순서로 변경하거나, 존재하지 않는 워크스페이스와 권한 부족을 동일한 에러로 처리.

---

**[INFO] 워크스페이스 삭제 시 관련 데이터의 cascade 의존성 명시 부족**
- 위치: `workspaces.service.ts` — `deleteWorkspace()` 주석
- 상세: 주석에 "멤버·초대는 cascade 또는 외부 정리에 의존한다"고 명시되어 있다. cascade가 DB 엔티티에 정의되지 않았거나 누락된 경우, 워크스페이스 삭제 후 고아(orphan) 멤버십·초대 레코드가 남아 데이터 무결성 문제가 될 수 있다. 고아 레코드가 남으면 나중에 동일 ID로 새 워크스페이스가 만들어졌을 때 이전 멤버십이 재사용될 위험이 있다.
- 제안: 엔티티에 `onDelete: 'CASCADE'`가 설정되어 있는지 확인하거나, 서비스 레이어에서 명시적으로 멤버·초대를 먼저 삭제한다.

---

**[INFO] 프론트엔드 삭제 확인 입력값 비교가 클라이언트 단독 검증**
- 위치: `frontend/src/app/(main)/workspace/settings/page.tsx` — `DangerZoneTab`
- 상세: `confirmInput !== workspaceName` 검사는 UI에서만 수행된다. 서버에서는 별도의 이중 확인 없이 `DELETE /workspaces/:id`를 처리한다. 브라우저 개발자 도구로 직접 API 호출 시 확인 절차를 우회할 수 있다. 이는 일반적인 SPA 패턴이므로 심각도는 낮으나, 실수로 인한 삭제 방지보다 악의적 우회는 막지 못한다.
- 제안: 중요도 높은 파괴적 작업에는 서버 측에서도 요청 본문에 `confirmName`을 받아 검증하는 것을 고려한다.

---

**[INFO] `leaveWorkspace`의 sole-owner 검사 TOCTOU(경쟁 조건) 가능성**
- 위치: `workspaces.service.ts` — `leaveWorkspace()`
- 상세: `owners.length <= 1` 검사와 `memberRepository.remove` 사이에 간격이 존재한다. 두 owner가 동시에 탈퇴를 시도할 경우 두 요청 모두 `owners.length === 2`를 읽고 통과한 뒤 모두 탈퇴가 될 수 있다. 결과적으로 owner 없는 워크스페이스가 생길 수 있다.
- 제안: DB 트랜잭션 + SELECT FOR UPDATE, 또는 애플리케이션 레벨 잠금으로 검사-삭제를 원자적으로 처리한다.

---

### 요약

전반적으로 JWT 인증 가드가 컨트롤러 전체에 적용되어 있고, UUID 파이프로 경로 파라미터를 검증하며, DTO에 class-validator를 사용하는 등 기본 보안 관행을 잘 따르고 있다. 주요 리스크는 `PATCH /:id` 엔드포인트의 no-op 분기에서 멤버십 검증이 누락되어 타 워크스페이스 메타데이터가 열람 가능한 점, 그리고 `leaveWorkspace`의 sole-owner 검사에 경쟁 조건이 존재하는 점이다. 하드코딩된 시크릿, SQL 인젝션, XSS 등 직접적인 고위험 취약점은 발견되지 않았다.

### 위험도

**MEDIUM** (no-op 분기 인가 누락 + 경쟁 조건이 함께 존재)