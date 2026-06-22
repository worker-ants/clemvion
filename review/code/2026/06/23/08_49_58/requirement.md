# 요구사항(Requirement) 리뷰 결과

## 발견사항

### 기능 완전성

- **[INFO]** `triggersApi.delete` 이관 완료 — `trigger-delete-dialog.tsx` 가 `apiClient.delete` 를 직접 호출하던 부분을 `triggersApi.delete(id)` 로 교체. 이전 consistency check (08_33_48) 의 I-1 항목이 본 커밋으로 해소됨. 동작 surface 무변.
  - 위치: `/codebase/frontend/src/components/triggers/trigger-delete-dialog.tsx` L148
  - 상세: delete 이관이 완료되어 트리거 도메인 API 직접 호출 13곳 전부가 `triggersApi` 경유로 통일됨.

- **[INFO]** `triggersApi.getHistory` 신설 및 `trigger-history-dialog.tsx` 이관 완료 — `apiClient.get(.../history)` 와 inline 정규화 로직(4줄)이 `triggersApi.getHistory` 로 캡슐화됨.
  - 위치: `/codebase/frontend/src/lib/api/triggers.ts` L1025–1033
  - 상세: 배열 root / `{ items }` envelope / `{ data: { items } }` double-envelope 세 형식 모두 처리. 아래 엣지케이스 항목에서 더 상세히 점검.

### 엣지 케이스

- **[WARNING]** `getHistory` envelope 정규화 로직의 `{ data: { items } }` 형식 처리 경로가 불완전할 수 있음.
  - 위치: `/codebase/frontend/src/lib/api/triggers.ts` L1030–1032
  - 상세: 정규화 코드는 아래 순서로 동작한다.
    ```ts
    const body = res.data as { data?: unknown };
    const data = (body?.data ?? body) as T[] | { items?: T[] };
    return Array.isArray(data) ? data : (data?.items ?? []);
    ```
    테스트 케이스 3번 (`{ data: { items: [...] } }`) 은 `res.data = { data: { items: [...] } }` → `body.data = { items: [...] }` → `data = { items: [...] }` → `data.items` 반환으로 올바름. 그러나 테스트 케이스 3번은 `fakeAxios({ data: { items: [{ id: "h1" }] } })` 이고, 실 backend 가 `{ data: [{ id: "h1" }] }` (배열 envelope) 를 보낼 때는: `body.data = [...]` → `data = [...]` → `Array.isArray` 분기로 배열 반환 — 이 경우도 정상. 그러나 `{ data: { data: { items: [...] } } }` 형태의 이중 래핑은 처리 불가. 현재 spec §3 및 API convention 에서 이중 래핑 케이스가 별도 정의되어 있지 않으므로 spec 상 INFO 수준이나, `getById` 구현이 동일 `body?.data ?? body` 패턴을 사용하므로 일관성은 있음.
  - 제안: 현행 정규화 로직 범위가 테스트로 커버됨 (배열/envelope/빈값 3케이스). 추가 변형이 운영 중 발견되면 케이스 추가.

- **[INFO]** `triggerId as string` 타입 단언 — `queryFn` 내부에서 `triggerId` 가 `string | null` 임에도 `as string` 캐스팅.
  - 위치: `/codebase/frontend/src/components/triggers/trigger-history-dialog.tsx` L395
  - 상세: `enabled: !!triggerId && open` 가드로 `null` 일 때 queryFn 이 실행되지 않으므로 런타임 안전하나, TypeScript 타입 레벨에서 논리적 보장이 코드에 명시되지 않은 형태. 이전 코드도 동일 패턴이었으므로 동작 보존 범위.

- **[INFO]** `trigger.name` 이 빈 문자열인 경우 confirm match 는 `confirmText.trim() === ""` 로 즉시 true 가 됨.
  - 위치: `/codebase/frontend/src/components/triggers/trigger-delete-dialog.tsx` L185
  - 상세: 빈 이름 트리거가 실제로 생성 가능한지는 spec §2.5 / §2.3.1 이 `name` 을 1~120자 필수로 규정하므로 backend 에서 차단됨. 단 방어 코드 부재 자체는 이전 코드와 동일.

### TODO/FIXME

- **[INFO]** 리뷰 대상 파일 전체에 TODO / FIXME / HACK / XXX 주석이 없음. 미완성 작업 시사 없음.

### 의도와 구현 간 괴리

- **[INFO]** `triggersApi.delete` 주석이 "cascade(schedule·notification·interaction)는 backend" 라고 명시 — spec §4.3 cascade 동작과 일치. 구현은 단순 DELETE 위임으로 올바름.

- **[INFO]** `trigger-history-dialog.tsx` 의 JSDoc이 "spec `spec/2-navigation/2-trigger-list.md §2.1` + Rationale R-6" 를 참조 — spec §2.1 (⋮ 메뉴 "호출 이력") 과 R-6 (별도 Dialog 분리 Rationale) 를 정확히 인용.

### 에러 시나리오

- **[INFO]** `trigger-delete-dialog.tsx` 의 404 동시 삭제 처리가 spec §4.4 와 일치함.
  - 위치: `/codebase/frontend/src/components/triggers/trigger-delete-dialog.tsx` L157–162
  - 상세: spec §4.4 — "동시 삭제: 두 번째는 `404 RESOURCE_NOT_FOUND` — 클라이언트는 무시 가능 (사용자에게 토스트 1회)". 구현은 `isAxiosLikeStatus(err, 404)` 시 `invalidateQueries` + `toast.message` + `onClose()` 로 처리 — 동작 일치.

- **[INFO]** `trigger-history-dialog.tsx` 는 `isError` 상태를 별도 UI(`triggers.history.loadFailed`)로 처리 — 에러 시나리오 핸들링 완비.

### 데이터 유효성

- **[INFO]** `triggersApi.delete` 는 `id: string` 단일 파라미터만 받고 추가 유효성 검증 없음 — 빈 문자열(`""`) 전달 시 `/triggers/` DELETE 가 발생하나, 호출부(`trigger-delete-dialog.tsx`)가 `trigger.id` 를 전달하므로 실제 경로에서 빈 문자열 진입 불가. 방어 코드 미추가는 `getById`, `update` 등 기존 메서드와 일관됨.

### 비즈니스 로직

- **[INFO]** 삭제 확인 다이얼로그의 type별 본문 텍스트 분기(`webhook` / `schedule` / `manual`)가 spec §4.2 와 정확히 일치.
  - spec §4.2: "트리거 type 에 따라 본문 텍스트가 분기됨 — webhook: URL 노출, schedule: cron + nextRunAt, manual: workflowName"
  - 구현: L170–183 의 삼항 체인이 동일 3분기를 처리. webhook — `trigger.webhookUrl`, schedule — `trigger.cronExpression + trigger.nextRunAt`, manual — `trigger.workflowName`.

- **[INFO]** spec §4.2 "오삭제 방지: 사용자가 트리거 이름을 정확히 타이핑해야 삭제 버튼 활성화" — `isConfirmMatch = confirmText.trim() === trigger.name.trim()` 로 구현 (L185). 양쪽 모두 `trim()` 처리로 앞뒤 공백 관대하게 처리.

- **[INFO]** spec §2.1 R-6 / R-7 — "호출 이력은 drawer 에 포함되지 않음, 별도 Dialog 만 제공". `trigger-history-dialog.tsx` 가 그 별도 Dialog 이며, drawer 와 분리됨 — 비즈니스 로직 일치.

- **[INFO]** spec R-13 — "각 호출 항목은 `/workflows/:workflowId/executions/:executionId` 로 drill-down 하는 Link 로 동작, `workflowId` 없으면 read-only div". 구현 L459–473 이 정확히 이 분기를 구현.

### 반환값

- **[INFO]** `triggersApi.delete` 가 `Promise<void>` 반환 — spec §4.4 "204 No Content (응답 본문 없음)". 반환값 무시가 의도됨.

- **[INFO]** `triggersApi.getHistory` 의 모든 코드 경로가 `T[]` 를 반환:
  - `Array.isArray(data)` true → 배열 그대로 반환
  - `Array.isArray` false + `data.items` 존재 → `data.items` 반환
  - `Array.isArray` false + `data.items` 없음 → `[]` 반환 (nullish coalescing)

### Spec Fidelity

- **[INFO] [SPEC-DRIFT]** `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 목록에 `codebase/frontend/src/lib/api/triggers.ts` 가 미등재.
  - 위치: `/Volumes/project/private/clemvion/spec/2-navigation/2-trigger-list.md` frontmatter L4–12
  - 상세: 이미 consistency check W-2 에서 지적된 사항. 이번 커밋으로 신설 파일(`triggers.ts`)이 스펙 정의 `code:` 목록에 없어 traceability 약화. 코드 자체는 spec §3 API 표를 정확히 구현하고 있어 코드가 옳고 spec frontmatter 가 낡은 상태.
  - 제안: 코드 유지 + spec 반영. `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 에 `codebase/frontend/src/lib/api/triggers.ts` 추가 (project-planner 위임).

- **[INFO]** `TriggerListParams` 에 `search` / `sort` / `order` 파라미터 미포함 — consistency check W-1 기존 지적 사항이나 본 커밋의 변경 범위 밖(이전 PR 에서 이미 존재하던 타입). 이번 커밋이 해당 타입을 수정하지 않으므로 본 리뷰의 직접 대상 아님.

- **[INFO]** `triggersApi.getHistory` 의 제네릭 파라미터 `<T>` 패턴 — spec §3 은 history API 의 응답 형식을 별도로 명시하지 않음. 클라이언트가 `TriggerHistoryEntry` 로 구체화하는 구조는 spec 공백 영역의 합리적 확장.

---

## 요약

본 커밋은 `triggersApi` 에 `delete` / `getHistory` 메서드를 추가하고, `trigger-delete-dialog.tsx` 와 `trigger-history-dialog.tsx` 가 각각 `apiClient` 를 직접 호출하던 부분을 `triggersApi` 경유로 교체하는 순수 리팩터다. spec `2-trigger-list.md §3` API 표의 전체 엔드포인트가 커버됐고, §4.2–4.4 의 삭제 정책(type별 본문 분기, 이름 확인, 동시 삭제 404 처리)과 R-6/R-7/R-13 의 비즈니스 로직이 기존 코드와 동일하게 보존됨이 확인된다. 새로운 로직 상 버그나 spec 위반은 발견되지 않았으며, 기존 consistency check 가 지적한 SPEC-DRIFT(frontmatter 미등재)는 코드 결함이 아니라 spec 갱신 누락이다.

## 위험도

NONE

---
STATUS: SUCCESS
