### 발견사항

---

#### `workspaces.service.ts` — `transferOwnership`

- **[WARNING]** 워크스페이스 엔티티를 트랜잭션 밖에서 읽은 뒤 트랜잭션 안에서 저장
  - 위치: `workspaces.service.ts` `transferOwnership` 메서드, 트랜잭션 전 `findOne` + 트랜잭션 내 `wsRepo.save(workspace)`
  - 상세: `workspace`는 `this.workspaceRepository.findOne()`로 트랜잭션 외부에서 로드된다. 이후 트랜잭션 내 `wsRepo.save(workspace)`는 해당 엔티티 전체를 UPDATE한다. 트랜잭션 시작 전과 save 사이에 동시 `PATCH /workspaces/:id`(rename 등)가 실행되면, 해당 변경이 트랜잭션의 `save`에 의해 덮어써질 수 있다. 또한 `workspaceId` 유효성 검사 이후 트랜잭션 내에서 workspace를 다시 `FOR UPDATE` 락으로 읽는 것이 아니기 때문에, 멤버 락 기간 중 workspace 상태가 바뀌어도 감지할 수 없다.
  - 제안: workspace를 트랜잭션 내 `wsRepo`로 재조회하거나, `wsRepo.update({ id: workspaceId }, { ownerId: targetMembership.userId })`처럼 변경 컬럼만 대상으로 UPDATE하여 엔티티 전체 재기록 없이 원자적으로 처리

- **[INFO]** 멤버 `save` 2회 순차 호출 — 배치 가능
  - 위치: `workspaces.service.ts` 트랜잭션 내부, `memRepo.save(targetMembership)` / `memRepo.save(requesterMembership)`
  - 상세: TypeORM은 배열을 받는 `save([...])` 오버로드를 지원한다. 현재 두 save가 순차 `await`이므로 왕복 2회가 발생한다.
  - 제안: `await memRepo.save([targetMembership, requesterMembership])`로 단일 왕복 처리

---

#### `app.module.ts` — 전역 `RolesGuard`

- **[INFO]** 모든 요청에 가드 메타데이터 조회 추가
  - 위치: `APP_GUARD` 등록 블록
  - 상세: `RolesGuard`가 전역으로 등록되면 `@Roles` 데코레이터가 없는 라우트에도 `reflector.getAllAndOverride()` 호출이 항상 실행된다. NestJS 메타데이터 조회는 O(1)이고 메모리 내 연산이므로 실제 영향은 무시 수준이다. 다만, 기존 per-controller 방식 대비 전체 요청 경로에 오버헤드가 추가되는 구조 변경임은 인지할 것.
  - 제안: 현 수준에서 조치 불필요. 필요 시 `@SkipAuth()`처럼 guard skip 데코레이터로 opt-out 지점을 명시적으로 표시하는 정도로 충분

---

#### `frontend/src/app/(main)/workspace/settings/page.tsx` — `DangerZoneTab`

- **[INFO]** `useQuery` `staleTime` 미설정으로 인한 반복 네트워크 요청
  - 위치: `DangerZoneTab` 내 `membersQuery` 선언부
  - 상세: `staleTime`이 없으면 React Query는 컴포넌트 마운트(탭 전환 포함) 시마다 멤버 목록을 다시 fetch한다. `enabled: transferEligible` 덕분에 owner 아닌 사용자에게는 발생하지 않지만, owner가 탭을 자주 전환할 경우 불필요한 요청이 누적된다. 멤버 목록은 `MembersTab`과 `["workspace-members", workspaceId]` 키를 공유하므로, 한쪽에서 이미 fetch된 데이터가 있으면 중복 요청 없이 캐시 활용이 가능하지만, 이 보장은 두 탭이 동시에 마운트된 경우에 한정된다.
  - 제안: `staleTime: 30_000` 정도를 추가하거나, `MembersTab`과 동일 키를 사용한다는 점을 활용해 탭 간 캐시 공유를 의도적으로 문서화

---

### 요약

이번 변경의 성능 관점 주요 이슈는 `transferOwnership` 서비스 메서드에 집중된다. workspace 엔티티를 트랜잭션 밖에서 읽어 전체 save하는 패턴은 동시 수정 시 덮어쓰기(lost update)를 유발할 수 있으며, 이는 성능보다 데이터 정합성에 더 직접적인 영향을 준다. 멤버 `save` 2회 순차 호출은 단순 배치 변환으로 개선 가능하다. `RolesGuard` 전역화는 메타데이터 조회 오버헤드가 실질적으로 무시 가능한 수준이며, 프론트엔드 `staleTime` 미설정은 소규모 낭비에 그친다. 전체적으로 심각한 성능 병목은 없으나, service 레이어의 트랜잭션 설계 개선이 권장된다.

### 위험도

**MEDIUM** (트랜잭션 경계 외 엔티티 재기록 패턴이 데이터 정합성 위험을 내포하며, 나머지는 LOW 수준)