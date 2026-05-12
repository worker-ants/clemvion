### 발견사항

---

**[WARNING] Cross-module service dependency — WorkflowsService → WorkspacesService**
- 위치: `workflows.service.ts:46`, `workflows.service.ts:88-97`
- 상세: `WorkflowsService`가 `WorkspacesService.findById`를 직접 호출하여 workspace type을 조회한다. 이로 인해 `workflows` 모듈이 `workspaces` 모듈을 런타임 의존성으로 가지게 되며, 역방향 의존(`WorkspacesService` → `WorkflowsService`)이 생길 경우 순환 참조 위험이 잠재한다. 현재는 단방향이지만 모듈 경계가 흐려진다.
- 제안: workspace type을 request-level에서 한 번 resolve하는 방법이 더 깔끔하다. `X-Workspace-Id` 헤더를 처리하는 기존 미들웨어/가드가 workspace entity를 이미 조회한다면, `req.workspace.type`을 request context에 붙여 컨트롤러에서 `userId`처럼 파라미터로 전달하면 서비스 레이어의 cross-module 의존을 제거할 수 있다. 단기적으로는 현행 방식도 기능상 문제없다.

---

**[WARNING] 소유 필터 적용 시 추가 DB 쿼리 (ownership=mine/shared 경로)**
- 위치: `workflows.service.ts:86-97`
- 상세: `ownership`이 `mine` 또는 `shared`일 때 workspace type 확인을 위해 `findById`를 별도로 호출한다. 팀 워크스페이스의 모든 list 요청(ownership 필터 사용 시)에서 두 번의 쿼리가 발생한다. `all`일 때 스킵하는 최적화는 잘 되어 있으나, 팀 워크스페이스에서 필터를 자주 사용하는 경우 N+1 패턴의 전조가 될 수 있다.
- 제안: workspace type이 request context에 이미 있다면 DB 쿼리를 완전히 제거할 수 있다. 또는 `workspace.type`을 `WorkspacesModule` 캐싱 레이어를 통해 메모리에서 읽도록 구성.

---

**[INFO] Optional chaining 방어 코드와 실제 보장 불일치**
- 위치: `workflows.service.ts:89` — `workspace?.type === 'team'`
- 상세: `WorkspacesService.findById`는 workspace가 없으면 `NotFoundException`을 던지므로(`workflows`의 `findById` 패턴 참고), `workspace`가 `null/undefined`일 케이스는 이론적으로 도달 불가다. Optional chaining이 실제 방어 효과 없이 코드 의도를 모호하게 만든다.
- 제안: `findById` 반환값이 항상 entity임을 보장한다면 `const workspace = await …; if (workspace.type === 'team')` 형태로 명확히 작성.

---

**[INFO] 소유 필터 상태가 URL에 반영되지 않음**
- 위치: `page.tsx:48` — `useState<Ownership>("all")`
- 상세: `search`, `filter`(status)도 동일하게 `useState`를 사용하므로 내부 일관성은 유지된다. 그러나 `page`는 URL param으로 관리되어 북마크/공유가 가능한 반면, 소유 필터는 새로고침 시 초기화된다. 이 비대칭은 현재 컴포넌트 설계 패턴을 따른 것이지만, 향후 딥링크 요구사항이 생기면 전체 필터 상태의 URL 직렬화를 재검토해야 한다.
- 제안: 현재 스코프에서는 수용 가능. 필터 상태 URL 직렬화는 별도 enhancement로 분리 권장.

---

**[INFO] 방어 다층화(defense-in-depth) — 양호**
- 위치: `page.tsx:103-105` (클라이언트), `workflows.service.ts:86-97` (서버)
- 상세: 클라이언트는 팀 워크스페이스가 아니면 `ownership` 파라미터를 전송하지 않고, 서버는 받더라도 개인 워크스페이스에서는 무시한다. 보안·일관성 관점에서 적절한 이중 방어.

---

**[INFO] 쿼리 빌더 파라미터화 — 양호**
- 위치: `workflows.service.ts:92-95`
- 상세: `andWhere('w.created_by = :userId', { userId })`와 같이 파라미터 바인딩을 사용하여 SQL injection 위험 없음.

---

**[INFO] 문서 섹션 번호 재편 — 디스크 디렉터리 동기화 필요**
- 위치: `registry.ts` SECTION_LABELS — `03-expression-language` → `04-expression-language` 등
- 상세: 레지스트리 레이블 맵은 갱신되었으나, 실제 `src/content/docs/` 하위 디렉터리명이 함께 변경되지 않으면 섹션이 누락된다. 이 diff만으로는 디스크 상태를 확인할 수 없다.
- 제안: `frontend/src/content/docs/` 디렉터리 구조가 레지스트리 키와 완전히 일치하는지 확인.

---

### 요약

이번 변경은 ownership 필터 기능을 spec → DTO → service → controller → frontend → docs 전 계층에 걸쳐 일관되게 구현했으며, 각 레이어의 책임 분리는 대체로 잘 유지되어 있다. 주요 아키텍처 우려는 `WorkflowsService`가 `WorkspacesService`를 직접 의존하게 된 점으로, 이는 cross-module 결합도를 높이고 `ownership=mine/shared` 경로마다 추가 DB 쿼리를 발생시킨다. 미들웨어나 request context를 통해 workspace type을 상위에서 전달하면 서비스 레이어를 더 순수하게 유지할 수 있다. 테스트 구조(4가지 경계 케이스: mine/team, shared/team, personal-ignore, all-no-db-hit)는 설계 의도를 잘 문서화하고 있으며, 클라이언트와 서버 양쪽에서 개인 워크스페이스를 방어하는 이중 가드 패턴은 올바르다.

### 위험도

**LOW**