## 발견사항

### **[INFO]** `workspacesService.findById` null 반환 시 무음 폴백

- **위치**: `workflows.service.ts` — ownership 필터 블록
- **상세**: `workspace?.type === 'team'` 조건에서 `findById`가 null을 반환하면 예외를 던지지 않고 ownership 필터를 조용히 건너뜁니다(`all` 처럼 동작). 이는 기능상 안전하지만(메인 쿼리에 `w.workspace_id = :workspaceId` 가 이미 걸려 있어 빈 결과를 반환), 잘못된 `workspaceId`가 감지 없이 통과될 수 있습니다.
- **제안**: 필요한 경우 명시적으로 `NotFoundException`을 발생시키는 것을 고려하되, 이는 `WorkspaceId` 데코레이터가 멤버십을 사전 검증하는 구조라면 중복 처리에 해당하므로 현재 패턴 유지도 무방합니다.

---

### **[INFO]** 소유 필터의 보안 경계가 프론트엔드가 아닌 백엔드에 있음을 명시 확인

- **위치**: `frontend/page.tsx` — `if (isTeamWorkspace && ownership !== 'all')` 조건
- **상세**: 프론트엔드는 팀 워크스페이스일 때만 `ownership` 파라미터를 전송하지만, 이는 UI 최적화일 뿐입니다. 개인 워크스페이스에서 악의적으로 `?ownership=mine`을 직접 호출해도 백엔드가 `workspace.type !== 'team'`이면 필터를 무시하여 올바르게 대응합니다. **이중 방어가 정상 작동 중입니다.**

---

### **[INFO]** `ownership='all'` 시 DB 조회 없음 (성능 관점에서 확인)

- **위치**: `workflows.service.ts` — `if (ownership === 'mine' || ownership === 'shared')` 조건
- **상세**: `ownership`이 `all`이거나 미지정인 경우 `workspacesService.findById` 호출이 발생하지 않습니다. 단위 테스트(`all-noop`)로 이 동작이 검증되고 있습니다. N+1 쿼리 문제 없음.

---

## 긍정적 보안 사항

| 항목 | 평가 |
|------|------|
| SQL 인젝션 | `qb.andWhere('w.created_by = :userId', { userId })` — TypeORM 파라미터 바인딩 사용, 안전 |
| `userId` 출처 | JWT `user.sub`에서 추출 (신뢰된 소스), 사용자 입력 직접 반영 아님 |
| DTO 입력 검증 | `@IsIn(['mine', 'shared', 'all'])` — 허용 값 화이트리스트 열거형 검증 |
| 정렬 컬럼 안전성 | `getSortColumn()`의 화이트리스트 맵 패턴 유지 — SQL 인젝션 불가 |
| 백엔드 강제 검증 | 개인 워크스페이스에서 `ownership` 파라미터가 오더라도 서버가 무시, 클라이언트 신뢰 불필요 |
| 단위 테스트 커버리지 | `mine` / `shared` / personal-ignore / all-noop 4가지 핵심 경로 모두 검증 |

---

## 요약

이번 변경은 소유 필터(`ownership`) 쿼리 파라미터를 추가하는 최소한의 기능 확장입니다. 모든 DB 쿼리는 TypeORM 파라미터 바인딩을 사용하여 SQL 인젝션이 불가능하며, `userId`는 JWT에서 추출된 신뢰된 값입니다. DTO 수준의 `@IsIn` 검증과 서비스 수준의 워크스페이스 타입 확인이 이중으로 적용되어 있어 프론트엔드 우회 시에도 백엔드가 올바르게 동작합니다. 인증·인가·입력 검증·암호화 관점에서 새로운 취약점은 발견되지 않았습니다.

---

## 위험도

**LOW**