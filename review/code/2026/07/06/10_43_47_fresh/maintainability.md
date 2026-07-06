# 유지보수성 Fresh 리뷰 — 워크플로우 목록 폴더 필터 (resolution 반영 후)

대상: `git diff origin/main...HEAD` (2 commits: 6279d01b6 + 2a859be6d)
Fresh 리뷰 초점 — 직전 리뷰(`review/code/2026/07/06/10_32_44/`) 이후 반영된 수정:
- `codebase/frontend/src/lib/api/folders.ts` — ad-hoc `data.data ?? []` → 중앙 `unwrap()` + `apiClient.get<{ data: FolderData[] }>` 제네릭
- `codebase/frontend/src/app/(main)/workflows/page.tsx` — `currentWorkspaceId` 셀렉터, subscribe 콜백에 `setFolderId("")` 추가, `foldersQuery` queryKey 워크스페이스 스코프화
- `codebase/frontend/src/app/(main)/workflows/__tests__/workflows-page.test.tsx` — 로컬 `FolderData` 재정의 → `import type { FolderData }`

## 발견사항

- **[INFO]** `folders.ts` 의 `unwrap<FolderData[]>(response)` 제네릭이 `apiClient.get<{ data: FolderData[] }>` 제네릭과 중복
  - 위치: `codebase/frontend/src/lib/api/folders.ts:22-24`
  - 상세: `apiClient.get<{ data: FolderData[] }>("/folders")` 로 이미 응답 타입을 명시했는데 `unwrap<FolderData[]>(response)` 에서 타입 인자를 다시 써야 한다. `unwrap` 시그니처가 `AxiosResponse<unknown>` 을 받기 때문에(응답 제네릭이 `unwrap` 쪽으로 자동 전파되지 않음) 어쩔 수 없는 최소 중복이며, sibling 파일(`dashboard.ts`, `model-configs.ts`, `workflow-test-datasets.ts` 등)도 대부분 `apiClient.get()` 을 제네릭 없이 호출하고 `unwrap<T>(response)` 쪽에서만 타입을 명시하는 반대 패턴을 쓴다. 다만 `users.ts`/`workflows.ts`/`assistant.ts`/`auth.ts`/`sessions.ts` 는 `apiClient.get<{ data: T }>(...)` 제네릭 명시를 이미 쓰고 있어(다만 이들은 `unwrap` 을 안 쓰고 caller 가 `.data.data` 로 직접 언랩), folders.ts 는 두 기존 관용구(제네릭 명시형 vs unwrap 헬퍼형)를 합친 하이브리드가 됐다.
  - 제안: 실질적 유지보수 비용은 낮음(타입 어긋남은 컴파일 타임에 즉시 드러남, 런타임 동작 영향 없음). 굳이 통일하려면 `apiClient.get("/folders")` 로 되돌리고 `unwrap<FolderData[]>(response)` 하나로만 타입을 명시하는 쪽(다수 sibling 관행)이 더 일관적이나, 강제할 정도의 문제는 아니다.

- **[INFO]** `page.tsx` 에 `currentWorkspaceId` selector 가 `currentWorkspace` selector 와 개념적으로 겹침
  - 위치: `codebase/frontend/src/app/(main)/workflows/page.tsx:94-97`
  - 상세: `currentWorkspace = useWorkspaceStore((s) => s.workspaces.find(w => w.id === s.currentWorkspaceId))` 로 이미 `currentWorkspaceId` 에 의존하는 파생값을 만든 직후, `foldersQuery` 의 `queryKey` 에 넣을 원시 문자열이 필요해 `currentWorkspaceId` 를 별도 selector 로 다시 구독한다. 두 selector 모두 `useWorkspaceStore` 를 부르므로 코드만 보면 약간의 중복으로 보일 수 있다.
  - 제안: `currentWorkspace?.id` 로 대체하면 selector 하나를 줄일 수 있으나, `currentWorkspace` 가 `undefined` 인 초기 로딩 구간에서 `queryKey` 값이 미묘하게 달라질 수 있어(선택 전환 타이밍) 오히려 별도 selector 로 원시값을 직접 구독하는 현재 방식이 더 안전하고 의도가 명확하다. 조치 불필요 — 현행 유지 권장.

## 컨벤션 일관성 확인 (문제 없음)

- **`unwrap` 사용 패턴**: `foldersApi.list()` 가 `unwrap<T>(response) ?? []` 형태로 옵셔널 폴백을 유지한 것은 `dashboard.ts`/`knowledge-bases.ts`/`model-configs.ts` 등 sibling 이 목록류 엔드포인트에서 빈 배열 폴백을 쓰는 관행과 부합한다(단일 객체류 엔드포인트는 폴백 없이 `unwrap` 그대로 반환).
- **주석 갱신**: `page.tsx` subscribe 콜백 주석이 "ownership 만 리셋" → "ownership·folderId 둘 다 리셋 + 폴더가 워크스페이스 스코프라 스테일 매치 0건이 되는 이유"로 정확히 갱신되어, W1 fix 배경을 다음 리더가 바로 이해할 수 있다.
- **queryKey 워크스페이스 스코프화**: `["folders", currentWorkspaceId]` 는 같은 파일의 `workflowsQuery` 가 `debouncedSearch/filter/ownership/sortKey/folderId/page` 를 모두 key 에 나열하는 기존 관례와 동일한 접근이라 이질감이 없다.
- **테스트**: `import type { FolderData } from "@/lib/api/folders"` 로 교체되면서도 `vi.mock` 팩토리 호이스팅 제약(타입 import 는 런타임에 elide 되어 문제 없음)을 정확히 이해한 주석이 남아, 다음에 이 mock 을 수정할 사람이 "왜 로컬 재정의가 아닌가"를 바로 파악할 수 있다. 실제 계약(`folders.ts` 의 인터페이스)과 mock 데이터 shape 가 구조적으로 자동 동기화되어 향후 필드 추가/제거 시 drift 위험이 사라졌다.
- **테스트 케이스 정리(W2)**: page-reset 단언을 vacuous 하게 만들던 "페이지 2로 이동 후 확인" 셋업 제거 + 테스트명 정정(`sends ?folderId=<id> on the first page ...`) + mock 한계를 설명하는 주석 추가는, 테스트가 실제로 검증하는 것과 이름이 어긋나지 않도록 정직하게 좁힌 개선으로 가독성에 도움이 된다.
- **신규 테스트**(`clears the selected folder when the workspace is switched`)는 기존 describe 블록의 `it` 구조·주석 스타일과 일치하며, 워크스페이스 전환 회귀를 비-vacuous 하게 검증한다.

## 요약

이번 fresh 리뷰에서 다룬 세 가지 수정(unwrap 헬퍼 도입, page.tsx 워크스페이스 스코프 대응, 테스트 타입 import 교체) 모두 이전 리뷰의 Warning/INFO 를 정확한 지점에서 해소했다. `unwrap` 사용은 sibling 파일들과 실질적으로 동일한 계약 해소 목적을 달성하며, 제네릭 이중 명시는 사소한 스타일 차이일 뿐 동작이나 가독성에 해를 끼치지 않는다. `page.tsx` 의 subscribe 콜백·queryKey 변경은 기존 대칭 패턴(ownership)을 그대로 확장한 것이라 새 리더가 코드를 따라가는 데 무리가 없고, 주석도 "왜 이렇게 했는가"를 정확히 설명한다. 테스트의 `import type` 교체는 mock-실제 계약 drift 위험을 없앤 명확한 개선이다. Critical/Warning 수준 결함은 발견되지 않았다.

## 위험도

NONE
