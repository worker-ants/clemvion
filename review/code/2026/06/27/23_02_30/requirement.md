# 요구사항(Requirement) 리뷰 — ai-mem-admin-frontend

대상 spec: `spec/5-system/17-agent-memory.md §6` (AGM-12/13), `spec/2-navigation/16-agent-memory.md`

---

## 발견사항

### [SPEC-DRIFT] [WARNING] X-Deleted-Count 응답 헤더가 spec §6 에 없음
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.controller.ts` clearScope 메서드 · `spec/5-system/17-agent-memory.md §6` 표 마지막 행 및 bullet
- 상세: spec §6 표 `DELETE /agent-memories?scopeKey=` 는 "한 scope 의 메모리 전체 삭제 (204) — scopeKey 필수" 만 정의하고, `X-Deleted-Count` 응답 헤더를 전혀 언급하지 않는다. 코드는 `res.setHeader('X-Deleted-Count', String(deleted))` 를 추가해 실제 삭제 행 수를 응답 헤더로 echo 하고, 프론트엔드는 이를 파싱(`agentMemoriesApi.clearScope` 반환값 = `number`)해 0건이면 `toast.info`, 1건 이상이면 `toast.success` 로 분기한다. 이 동작은 의도적이고 합리적인 UX 개선(멱등 삭제 시 "삭제했다" 오해 방지)이며 코드를 되돌리는 것이 오답이다. spec 본문이 낡은 상태다.
- 제안: 코드 유지. spec/5-system/17-agent-memory.md §6 표 해당 행을 다음 방향으로 갱신:
  - `DELETE /agent-memories?scopeKey=` 행 설명에 "응답 헤더 `X-Deleted-Count: <삭제 행 수>` echo (0 가능 — 멱등)" 추가.
  - 표 아래 bullet "hard delete" 또는 별도 bullet 로 "clearScope 응답에는 `X-Deleted-Count` 헤더로 실제 삭제 행 수가 실린다. 0건이면 대상이 없었던 것이므로 UI 는 중립 토스트로 분기한다" 명시.
  - spec/2-navigation/16-agent-memory.md §2 "scope 전체 삭제" 단계에 "0건 삭제 시 중립 토스트('삭제할 메모리가 없었어요')" 행위 추가.

---

### [INFO] listMemories 는 2쿼리, listScopes 는 단일쿼리 — 설계 비대칭
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory-admin.service.ts` `listMemories` (496행~503행) vs `listScopes` (394행~421행)
- 상세: `listScopes` 는 CTE + `COUNT(*) OVER()` 단일 쿼리로 데이터·total 을 동시에 가져온다. `listMemories` 는 데이터 쿼리 + 별도 COUNT 쿼리 2회를 실행한다. 기능상 무결하며 spec 이 쿼리 수를 제한하지 않는다. 성능 차이는 scope 당 행이 최대 1000건(AGM-06)이므로 무시 가능하다. 추후 `listMemories` 도 단일쿼리로 통일할 여지는 있지만 현재 차단 사항이 아니다.
- 제안: 현 구현 유지. 향후 성능 개선 시 `COUNT(*) OVER()` 단일쿼리 패턴으로 통일 검토.

---

### [INFO] workspace-invitations-pruner 큐 추가 (e2e)
- 위치: `codebase/backend/test/system-status.e2e-spec.ts` EXPECTED_QUEUE_NAMES
- 상세: W7 backlog(WorkspaceInvitationsPrunerService) 완료에 따라 `workspace-invitations-pruner` 를 큐 목록에 추가했다. 본 PR 의 agent memory admin 범위 외 변경이지만 동일 커밋에 포함된 것이며, 실 소스 `MONITORED_QUEUES` 와 정합하는 올바른 갱신이다.

---

### [INFO] AgentMemoryAdminService 가 모듈 exports 에 없음 — 의도적
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.module.ts`
- 상세: `providers` 에 등록됐지만 `exports` 에는 없다. `AgentMemoryAdminService` 는 같은 모듈의 `AgentMemoryController` 만 소비하므로 외부 모듈 노출이 불필요하다. SRP 설계 의도에 부합한다.

---

## 기능 완전성 검토

**AGM-12 (조회 API)**

| 요구사항 | 구현 상태 |
|---|---|
| `GET /agent-memories/scopes` — distinct scope_key, count, MAX(updated_at) | ✓ CTE GROUP BY + COUNT(*) |
| 페이지네이션(limit/offset), q ILIKE 필터 | ✓ 단일쿼리 COUNT(*) OVER() + q 파라미터 바인딩 |
| total = LIMIT 전 전체 distinct scope 수, offset 초과 시 0 | ✓ `rows[0]?.total ?? 0` |
| `GET /agent-memories` — scopeKey 필수, kind 필터, created_at DESC | ✓ DTO @IsNotEmpty 검증 + metadata->>'kind' 필터 |
| embedding 응답 제외 | ✓ SELECT 절에 embedding 없음, 테스트도 검증 |
| workspace_id 격리 | ✓ 모든 쿼리 `am.workspace_id = $1` |
| viewer+ 인가 | ✓ @Roles('viewer') |

**AGM-13 (삭제 API)**

| 요구사항 | 구현 상태 |
|---|---|
| `DELETE /agent-memories/:id` 단건, hard delete | ✓ DELETE RETURNING + deletedRowCount |
| 워크스페이스 교차 차단 — `WHERE id=$1 AND workspace_id=$2` | ✓ affected=0 → NotFoundException |
| `DELETE /agent-memories?scopeKey=` scope 전체, scopeKey 필수 | ✓ 공백 방어 + BadRequestException |
| editor+ 인가 | ✓ @Roles('editor') |

**AGM-11 (kind fallback)**

`listMemories` 응답 매핑 `kind: r.kind ?? 'fact'` — spec "kind 결손 시 fact fallback" 정합. ✓

**deletedRowCount 함수 계약**

TypeORM PostgresQueryRunner 가 `RETURNING` 있는 DELETE 를 `[rows, count]` 튜플로 반환. `result[0]` 이 배열인 경우(정상 튜플) `.length` 를 반환, 그 외(방어: 직접 배열) `.length` 반환. `[[], 0]` 케이스에서 `result[0]` = `[]` → `Array.isArray([])` = true → length 0. ✓

**프론트엔드 X-Deleted-Count 파싱**

```typescript
const count = Number(raw);
return Number.isFinite(count) ? count : 0;
```
- 헤더 없음(`undefined`) → `Number(undefined)` = NaN → 0 반환 ✓  
- 비숫자(`"not-a-number"`) → NaN → 0 반환 ✓  
- `"0"` → 0 (finite) → 0 반환 ✓  
- `"3"` → 3 (finite) → 3 반환 ✓

**page.tsx ConfirmModal confirmLabel 정합**

clearScope ConfirmModal: `confirmLabel={t("common.delete")}`. ko dict `common.delete = "삭제"`. 테스트 `getByRole("button", { name: "삭제" })` 정합 ✓. ScopeListPanel 삭제 버튼 aria-label `t("agentMemory.scopes.delete")` = "scope 전체 삭제" — 테스트 첫 클릭 `name: "scope 전체 삭제"` 정합 ✓.

---

## 요약

이번 변경은 spec §6 (AGM-12/13) 에 정의된 admin read/delete surface 를 `AgentMemoryService` 에서 `AgentMemoryAdminService` 로 SRP 분리하고, scope 전체 삭제 시 `X-Deleted-Count` 헤더 echo + 프론트 0건 중립 토스트 UX 를 추가했다. 조회·삭제·격리·권한·embedding 제외 등 spec 의 모든 요구사항이 line-level 로 구현돼 있으며 엣지 케이스(빈 결과, offset 초과, kind null fallback, RETURNING 튜플 오인)도 정확히 처리된다. 유일한 spec 미반영 사항은 `X-Deleted-Count` 헤더와 0건 중립 토스트 동작인데, 이는 의도적·합리적 UX 개선이라 코드가 옳고 spec 갱신이 필요한 SPEC-DRIFT 다. 코드 버그는 없다.

---

## 위험도

LOW
