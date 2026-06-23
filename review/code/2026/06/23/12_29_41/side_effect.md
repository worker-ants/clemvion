# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] `statistics/page.tsx` 에 `apiClient` import 잔류 — 제거되지 않음
- 위치: `codebase/frontend/src/app/(main)/statistics/page.tsx` diff hunk `@@ -3,6 +3,15 @@`
- 상세: diff 상단부에 `import { apiClient } from "@/lib/api/client";` 가 여전히 존재한다. 삭제된 것이 아니라 `statisticsApi` import 가 추가된 것이다. 페이지 내 `/workflows` 직접 호출(cross-domain 잔류분)이 `apiClient` 를 계속 쓰므로 의도적 잔류이나, 이 import 가 미래에 해당 호출까지 이전되면 이 줄도 함께 제거 대상이 된다. 현재로서는 의도된 상태이고 부작용은 없다.
- 제안: 별도 조치 불필요. cross-domain `/workflows` 이전 시 제거 예정임을 주석으로 표기하거나 plan 잔류 항목에 기록.

### [INFO] `exportStats` — `new Blob([res.data as BlobPart])` 이중 래핑 가능성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/frontend/src/lib/api/statistics.ts` L1799-1804
- 상세: `responseType: "blob"` 설정 시 axios 는 이미 응답 body 를 `Blob` 인스턴스로 파싱해 `res.data` 에 넣는다. 이 상태에서 `new Blob([res.data as BlobPart])` 를 하면 `Blob` 을 `BlobPart` 로 넘겨 새 `Blob` 으로 감싸는 이중 래핑이 된다. 브라우저 환경에서 `Blob` 은 `BlobPart` 로 허용되므로 내용은 보존되고 동작은 유지되지만, 불필요한 메모리 복사가 발생한다.
  - 구 코드(`statistics/page.tsx`): `const blob = new Blob([res.data as BlobPart]);` — 동일 패턴을 그대로 옮겼으므로 **동작 회귀는 없다**. behavior-preserving 이전이라는 커밋 의도에 부합.
  - 단, 신규 카탈로그에서 개선 기회가 있음. `res.data as Blob` 으로 직접 반환하면 이중 래핑이 사라진다.
- 제안: 즉시 수정 의무는 없으나, 개선을 원할 경우 `return res.data as Blob;` 으로 단순화 권장.

---

## 요약

이번 변경은 세 페이지(`dashboard`, `statistics`, `schedules`)가 직접 호출하던 `apiClient` 를 `lib/api/{dashboard,statistics,schedules}.ts` 카탈로그 모듈로 추출하는 순수 리팩터링이다. 전역 변수 신규 도입 없음, 파일시스템 부작용 없음, 환경 변수 읽기/쓰기 없음, 공개 API 시그니처 변경 없음(신규 모듈 추가만), react-query 쿼리 키 무변, toast/navigation 무변, envelope 언래핑 로직은 `unwrap`/`normalizePagedResponse` 로 중앙화하되 페이지의 기존 패턴(`data.data ?? data`, `normalizePagedResponse`)과 동치임이 확인된다. `statistics/page.tsx` 의 `apiClient` import 잔류는 cross-domain `/workflows` 호출용으로 의도된 것이며, `exportStats` 의 `new Blob([...])` 이중 래핑은 구 코드와 동일한 패턴을 그대로 유지한 것으로 동작 회귀 없이 behavior-preserving 이다. 의도치 않은 부작용은 식별되지 않는다.

## 위험도

NONE
