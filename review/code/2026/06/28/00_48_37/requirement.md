# 요구사항(Requirement) 리뷰

대상 spec: `spec/5-system/17-agent-memory.md §6` (AGM-12/13), `spec/2-navigation/16-agent-memory.md §2`

---

## 발견사항

### [INFO] CORS exposedHeaders 적용 범위 — 비-hooks/비-external 경로 전체
- 위치: `codebase/backend/src/main.ts` L185-192, `codebase/backend/src/common/cors/web-chat-cors.ts` L110
- 상세: `exposedHeaders: ['X-Deleted-Count']` 는 `defaultOptions()` 에만 포함되므로, `HOOKS_PATH_RE`(`/api/hooks/*`) 와 `EXTERNAL_EXEC_PATH_RE`(`/api/external/*`) 에 매칭되지 않는 모든 경로(admin frontend 포함 `/api/agent-memories` 포함)에 적용된다. agent-memory admin 엔드포인트는 이 경로 분기에 정확히 해당하므로 fix 는 올바르다. 단 향후 다른 엔드포인트에서 추가 커스텀 응답 헤더가 생기면 동일 배열에 추가해야 한다는 구조적 제약이 남는다.
- 제안: 현 상태 수용. 향후 커스텀 응답 헤더 목록이 길어지면 상수(`EXPOSED_RESPONSE_HEADERS`)로 추출 고려.

### [INFO] ScopeListPanel/MemoryListPanel 테스트 — RoleGate 투명 모킹
- 위치: `scope-list-panel.test.tsx` L8-10, `memory-list-panel.test.tsx` L8-10
- 상세: 두 테스트 파일 모두 `RoleGate` 를 "항상 children 렌더" 로 모킹한다. 이로 인해 삭제 버튼이 역할 무관하게 항상 보여 콜백 행동 테스트가 가능하다. 역할 기반 가시성 자체는 `RoleGate` 컴포넌트 단위 테스트에서 별도 검증되므로 이 구조는 의도적이고 올바르다.
- 제안: 현 상태 수용.

### [INFO] listScopes q-미지정 시 params 에 q 키 없음 — 명시적 검증
- 위치: `codebase/frontend/src/lib/api/__tests__/agent-memories.test.ts` L81-92
- 상세: `listScopes({ limit: 20, offset: 0 })` (q 미지정) 시 `getMock` 에 전달된 params 에 `q` 키 자체가 없음을 검증한다. undefined 를 params 에 포함하면 일부 HTTP 클라이언트가 `?q=undefined` 를 보낼 수 있으므로 이 동작을 명시 검증하는 것은 올바르다.
- 제안: 현 상태 수용.

---

## 기능 완전성 검토

### W1 CORS fix

`createWebChatCorsDelegate` 에서 `defaultOptions()` 호출 경로(`line 110`):

```
cb(null, deps.defaultOptions())
// = cb(null, { origin: ..., credentials: true, exposedHeaders: ['X-Deleted-Count'] })
```

NestJS `app.enableCors(corsDelegate)` 는 각 요청마다 delegate 를 호출하고 반환된 `CorsOptionsLike` 를 cors npm 패키지에 그대로 전달한다. cors 패키지는 `exposedHeaders` 필드를 `Access-Control-Expose-Headers` 응답 헤더로 변환한다. 전파 경로에 단절이 없다. fix 완결.

### W10 deletedRowCount flat-array 방어 분기

`deletedRowCount` 구현:
```typescript
if (Array.isArray(result) && Array.isArray(result[0])) {
  return (result[0] as { id: string }[]).length; // 정상 튜플: [[rows], count]
}
return (result as { id: string }[]).length; // 방어: flat array [{ id }, ...]
```

테스트 입력 `[{ id: 'a' }]`:
- `Array.isArray([{ id: 'a' }])` = true (result 자체는 배열)
- `Array.isArray({ id: 'a' })` = false (result[0] 는 객체)
- → 방어 분기: `[{ id: 'a' }].length` = 1 → 반환 1 ✓

기대값 `toBe(1)` 정합.

### AGM-12/13 spec fidelity (이번 커밋 기준)

| 항목 | 구현 | spec 갱신 |
|---|---|---|
| `DELETE /agent-memories?scopeKey=` `X-Deleted-Count` echo | 컨트롤러 `res.setHeader('X-Deleted-Count', String(deleted))` ✓ | `17-agent-memory.md §6` 표 행 + bullet ✓ |
| 0건 중립 토스트 UX | `agentMemoriesApi.clearScope` → `Number.isFinite(count) ? count : 0` + page.tsx toast.info 분기 ✓ | `16-agent-memory.md §2` scope 전체 삭제 항목 ✓ |
| CORS `exposedHeaders` 필수 | `main.ts` defaultOptions + `CorsOptionsLike` ✓ | `17-agent-memory.md §6` 삭제 건수 echo bullet ✓ |

이전 SPEC-DRIFT(S1) 는 이번 커밋에서 spec 반영으로 해소됨. code 와 spec 일치.

### W8 MemoryListPanel 테스트 시나리오

| 케이스 | 검증 포인트 | 정합 |
|---|---|---|
| `selectedScope=null` | placeholder 문자열 | ✓ |
| `isLoading=true` | `.animate-spin` DOM 존재 | ✓ |
| `memories=[]` | 빈 상태 문자열 | ✓ |
| `kind="weird-kind"` | KIND_META 부재 → 원문 표시 | ✓ |
| 삭제 버튼 클릭 | `onRequestDeleteMemory("m1")` | ✓ |
| `hasNextPage=true` + load more | `onLoadMore()` | ✓ |

### W9 ScopeListPanel 테스트 시나리오

| 케이스 | 검증 포인트 | 정합 |
|---|---|---|
| `isLoading=true` | `.animate-spin` DOM | ✓ |
| `scopes=[]` + 비로딩/비에러 | 빈 상태 문자열 | ✓ |
| scope 텍스트 클릭 | `onSelectScope("cust-1")` | ✓ |
| 삭제 버튼 클릭 | `onRequestClearScope(SCOPE)` (전체 객체 전달) | ✓ |
| `hasNextPage=true` + load more | `onLoadMore()` | ✓ |

### TODO/FIXME 점검

변경된 파일 전체에서 TODO/FIXME/HACK/XXX 마커 없음. ✓

---

## 요약

이번 커밋은 이전 ai-review MEDIUM(W1 CORS X-Deleted-Count 기능 버그) 에 대한 후속 조치다. `main.ts` defaultOptions 에 `exposedHeaders: ['X-Deleted-Count']` 를 추가해 cross-origin 브라우저가 헤더를 읽을 수 있도록 했으며, `CorsOptionsLike` 인터페이스에도 타입이 일치하게 선언됐다. 전파 경로(`defaultOptions → createWebChatCorsDelegate → app.enableCors → cors npm → Access-Control-Expose-Headers`)가 완결되어 clearScope의 0건/다건 토스트 분기가 실제로 동작한다. 이전 SPEC-DRIFT(S1)는 이번 커밋에서 양쪽 spec 파일(`17-agent-memory.md §6`, `16-agent-memory.md §2`)에 반영돼 코드와 spec 이 일치한다. 테스트 보강(W8~W11)은 모두 구현 계약과 정합하며 AGM-12/13 에서 요구하는 격리·인가·embedding 제외·pagination 등 기존 요구사항도 이전 커밋에서 이미 충족된 상태다. 신규 발견 CRITICAL/WARNING 없음.

---

## 위험도

NONE
