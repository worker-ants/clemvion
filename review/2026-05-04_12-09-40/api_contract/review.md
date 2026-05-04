### 발견사항

- **[INFO]** RolesGuard opt-in → opt-out 전환 — 하위 호환성 유지됨
  - 위치: `app.module.ts` + 전체 컨트롤러 diff
  - 상세: `@UseGuards(RolesGuard)` 제거 후 전역 `APP_GUARD`로 승격. `@Roles()` 없는 라우트는 default-allow로 통과하므로 기존 시맨틱이 그대로 유지됨. Breaking change 없음.
  - 제안: 없음. 변경 의도가 명확하고 기존 클라이언트에 영향 없음.

- **[INFO]** 신규 엔드포인트 응답 타입이 200 OK + `{ data: { ok: true } }`
  - 위치: `workspaces.controller.ts` `transferOwnership()` / `workspaces.ts` 클라이언트
  - 상세: `leave`, `remove` 등 기존 action 엔드포인트와 동일한 응답 형식 사용. 일관성 있음.
  - 제안: 없음.

- **[WARNING]** `workspace` 엔티티를 트랜잭션 밖에서 조회 후 트랜잭션 안에서 save
  - 위치: `workspaces.service.ts` `transferOwnership()` — 트랜잭션 외부의 `workspaceRepository.findOne` + 트랜잭션 내부의 `wsRepo.save(workspace)`
  - 상세: `workspace` 객체는 트랜잭션 외부에서 페치되어 pessimistic_write 락 범위 밖에 있음. 두 요청이 동시에 `transferOwnership`을 호출하면 outer fetch 시점과 inner save 시점 사이에 `workspace.ownerId`가 이미 다른 값으로 바뀐 상태를 덮어쓸 수 있음. `workspace.type === 'personal'` 검증도 트랜잭션 외부이나, type은 불변이므로 실제 위험은 `ownerId` 갱신에 한정됨.
  - 제안: `workspace`도 트랜잭션 내부에서 `wsRepo.findOne({ where: { id: workspaceId }, lock: { mode: 'pessimistic_write' } })`로 재조회 후 save.

- **[INFO]** `transferOwnership` 엔드포인트에 `@Roles()` 데코레이터 없음
  - 위치: `workspaces.controller.ts` — `transferOwnership()` 메서드
  - 상세: 이는 의도된 설계. workspace 컨트롤러는 역할 검증을 service-level로 위임하는 패턴을 일관되게 사용하며, service에서 `OWNER_REQUIRED` ForbiddenException이 올바르게 throw됨. Swagger `@ApiForbiddenResponse` 도 반영되어 있음.
  - 제안: 없음. 기존 워크스페이스 엔드포인트 패턴과 일치.

- **[INFO]** `newOwnerMemberId`가 `User.id`가 아닌 `WorkspaceMember.id`임을 명시
  - 위치: `transfer-ownership.dto.ts` Swagger description
  - 상세: "새 owner 가 될 WorkspaceMember 의 UUID"로 명확히 기술되어 API 소비자가 혼동할 여지 없음. 프론트엔드 클라이언트도 `m.id` (member ID)를 올바르게 전송.
  - 제안: 없음.

---

### 요약

이번 변경은 크게 두 가지로 구성된다. ①`RolesGuard`를 컨트롤러 단위 opt-in에서 전역 `APP_GUARD` opt-out으로 전환한 것은 동작 시맨틱을 그대로 유지하며 Breaking change가 없다. ②신규 `POST /workspaces/:id/transfer-ownership` 엔드포인트는 요청 검증(IsUUID), 응답 형식, 에러 코드 체계, Swagger 문서 모두 기존 API 컨벤션을 정확히 따른다. 다만 `workspace` 엔티티를 트랜잭션 외부에서 페치한 뒤 내부에서 저장하는 부분은 동시 요청 시 ownerId 덮어쓰기 경합이 이론상 가능하므로 트랜잭션 내 재조회를 권장한다.

### 위험도
**LOW**