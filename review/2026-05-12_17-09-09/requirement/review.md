## 발견사항

---

### [WARNING] `shared` 필터의 SQL `!=` — NULL 행 누락

- **위치**: `workflows.service.ts` — `qb.andWhere('w.created_by != :userId', { userId })`
- **상세**: SQL에서 `NULL != '...'`는 `TRUE`가 아닌 `NULL`을 반환한다. `created_by`가 NULL인 워크플로우(레거시 데이터, 마이그레이션 이전 행 등)는 `shared` 필터 결과에서 누락된다. 현재 `create()`는 항상 `createdBy: userId`를 설정하므로 신규 데이터엔 해당하지 않지만, 과거 데이터나 직접 DB 조작 시 침묵하는 필터링 버그가 발생할 수 있다.
- **제안**:
  ```sql
  w.created_by != :userId OR w.created_by IS NULL
  ```
  또는 엔티티 수준에서 `created_by NOT NULL` 제약을 마이그레이션으로 보장.

---

### [WARNING] 워크스페이스 전환 시 `ownership` 상태 미초기화

- **위치**: `frontend/src/app/(main)/workflows/page.tsx` — `const [ownership, setOwnership] = useState<Ownership>("all")`
- **상세**: 팀 워크스페이스에서 `ownership='mine'` 선택 → 개인 워크스페이스로 전환(UI 필터 숨겨짐, 파라미터 미전송으로 동작은 정상) → 다시 팀 워크스페이스로 복귀 시 `ownership` 상태가 `'mine'`으로 남아 있어 필터 버튼이 "내 워크플로우"가 활성화된 상태로 표시된다. 사용자가 왜 전체 목록이 안 보이는지 혼란스러울 수 있다.
- **제안**: `currentWorkspace` 변경 시 `ownership`을 `'all'`로 초기화하는 `useEffect` 추가:
  ```ts
  useEffect(() => { setOwnership("all"); }, [currentWorkspaceId]);
  ```

---

### [WARNING] 빈 상태 메시지에서 `ownership` 필터 미고려

- **위치**: `frontend/src/app/(main)/workflows/page.tsx` — EmptyState `description` 분기
- **상세**: 현재 빈 상태 메시지 분기 조건이 `debouncedSearch || filter !== "all"`만 확인하고 `ownership !== "all"`을 누락한다. 팀 워크스페이스에서 `ownership='mine'`으로 필터링했는데 내 워크플로우가 없는 경우, "필터를 조정해 보세요" 대신 "첫 번째 워크플로우를 만들어 보세요" + 생성 버튼이 표시된다.
- **제안**:
  ```tsx
  debouncedSearch || filter !== "all" || (isTeamWorkspace && ownership !== "all")
    ? t("workflows.adjustFiltersHint")
    : t("workflows.firstWorkflowHint")
  ```

---

### [INFO] `registry.ts` 섹션 번호 재정렬 — 디렉토리 실제 이름 변경 검증 필요

- **위치**: `frontend/src/lib/docs/registry.ts` — `SECTION_LABELS` 키 변경 (`03-expression-language` → `04-expression-language` 등)
- **상세**: 레지스트리 레이블 키가 물리적 `content/docs/` 디렉토리 이름과 일치해야 한다. 이 diff만으로는 실제 디렉토리가 함께 이름 변경되었는지 확인 불가. 불일치 시 해당 섹션 문서 전체가 인덱스에서 누락된다.
- **제안**: `ls frontend/src/content/docs/` 로 실제 디렉토리 이름이 레지스트리 키와 일치하는지 확인.

---

### [INFO] `WorkspacesService.findById` null 반환 시 묵시적 `all` 동작

- **위치**: `workflows.service.ts` — `if (workspace?.type === 'team')`
- **상세**: `WorkspacesService.findById`가 `null`을 반환하면 소유 필터가 조용히 무시된다(`all`처럼 동작). `WorkflowsService.findById`와 달리 `NotFoundException`을 던지지 않는다면 클라이언트는 이유 없이 전체 목록을 받게 된다. `workspaceId`로 필터링된 워크플로우 목록 자체가 비어있을 것이므로 실질적 문제는 없지만, 의도가 코드에 명시되지 않아 가독성이 낮다.
- **제안**: 주석으로 명시하거나 `WorkspacesService.findById`의 반환 계약(null vs throw)을 서비스 내부에서 일관되게 처리.

---

## 요약

NAV-WF-07(소유 필터) 구현은 백엔드 DTO 검증, 서비스 레이어 워크스페이스 타입 분기, 프론트엔드 조건부 UI, i18n, 스펙/문서까지 체계적으로 완성되어 있다. 테스트도 핵심 시나리오(mine/shared/personal-무시/all-DB-무호출) 4가지를 커버한다. 다만 SQL `!=`의 NULL 처리 누락(shared 필터에서 `created_by IS NULL` 행 누락), 워크스페이스 전환 시 ownership 상태 미초기화, 빈 상태 메시지 분기 미반영 세 가지가 실사용 시 예상치 못한 동작을 유발할 수 있으며, 이 중 SQL NULL 문제는 데이터 정합성에 직접 영향을 준다.

## 위험도

**LOW** (기능 동작은 정상이나 엣지 케이스 3건이 UX 오류 또는 필터 결과 누락으로 이어질 수 있음)