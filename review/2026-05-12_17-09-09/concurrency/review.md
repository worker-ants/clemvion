### 발견사항

- **[INFO]** `findById` 후 `workspace.type` 조건 분기 사이의 TOCTOU(Time-of-Check-Time-of-Use)
  - 위치: `workflows.service.ts` — `findAll` 내 ownership 필터 블록
  - 상세: `workspacesService.findById(workspaceId)`로 워크스페이스 타입을 읽은 뒤, 그 결과를 기반으로 `qb.andWhere()`를 분기한다. 극히 드물지만 해당 await 이후 동일 요청 흐름 내에서 워크스페이스가 팀 → 개인으로 전환될 경우, 잘못된 ownership 조건이 붙은 채 쿼리가 실행될 수 있다.
  - 제안: 읽기 전용 목록 조회이므로 실질적 보안/데이터 손상 위험은 없다. 다만 강하게 보장하려면 `findAll` 쿼리와 workspace 조회를 동일 트랜잭션(read-only) 안에서 실행하거나, workspace 타입을 JWT/컨텍스트에서 직접 가져오는 방식을 고려할 수 있다.

- **[INFO]** `ownership === 'mine' | 'shared'` 경로에서 추가 DB 라운드트립
  - 위치: `workflows.service.ts:85-98`
  - 상세: `workspacesService.findById`는 직렬 호출이므로 동시 요청이 많을 때 커넥션 풀 점유가 늘어난다. `all`(기본값) 경로는 호출하지 않으므로 비교적 영향이 제한적이다.
  - 제안: 워크스페이스 타입이 이미 JWT claim 또는 미들웨어 컨텍스트에 존재한다면 DB 조회를 생략할 수 있다. 현재 구조에서는 실제 문제가 될 가능성이 낮다.

---

### 요약

변경된 코드는 대부분 요청 단위 로컬 변수(`qb`)를 다루는 읽기 전용 쿼리 빌딩이며, 공유 가변 상태·잠금·병렬 쓰기가 존재하지 않는다. `await` 누락이나 이벤트 루프 블로킹도 없다. 유일한 동시성 인접 사항은 `findById → qb.andWhere` 사이의 TOCTOU이나, 이는 읽기 전용 목록 조회이므로 잘못된 필터가 한 요청에 적용될 수 있는 정도의 리스크로 데이터 무결성에 영향을 주지 않는다. 전반적으로 동시성 관점의 결함은 없다고 볼 수 있다.

### 위험도

**LOW**