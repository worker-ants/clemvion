# 보안(Security) 리뷰

## 발견사항

### [INFO] URL 경로에 사용자 제공 ID 삽입 — 경로 탐색 아님, 단 검증 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/frontend/src/lib/api/schedules.ts` — `update`, `delete`, `runNow` 함수 (라인 68–80), `` `/schedules/${id}` ``
- 상세: `id` 파라미터는 TypeScript `string` 타입이며, 런타임에 길이·형식 검증 없이 URL 경로에 직접 보간된다. 이 계층이 프론트엔드 클라이언트이므로 임의 조작된 ID 는 결국 백엔드로 전달된다. 백엔드가 입력 검증과 인가를 책임진다고 가정할 수 있으나, 프론트 API 카탈로그에 UUID 형식 등 최소 검증을 추가하면 방어 깊이가 더 생긴다. 현재 변경 범위가 behavior-preserving 리팩토링이므로 즉각 차단 사유는 아님.
- 제안: 실제 ID 포맷(UUID 등)이 정해져 있다면 API 카탈로그 계층에서 `if (!/^[\w-]{1,64}$/.test(id)) throw new Error(...)` 형식의 입력 검증을 추가하는 것을 고려. 백엔드 인가 검증에 의존하는 현재 구조가 실제 설계 의도라면 INFO 수준 유지.

### [INFO] `StatisticsQueryParams` 의 `Record<string, string | number | undefined>` — 타입 광역 허용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/frontend/src/lib/api/statistics.ts` 라인 15–18
- 상세: 모든 GET 요청의 쿼리 파라미터를 임의 문자열 키 허용 타입으로 정의하고 있다. Axios 는 파라미터를 URL 인코딩하여 전송하므로 XSS·커맨드 인젝션 위험은 없으나, 의도치 않은 파라미터가 백엔드로 노출될 가능성이 있다. TypeScript 타입이 런타임 게이트가 아니므로 악의적이 아니더라도 오사용 경로가 생긴다.
- 제안: 실제 사용 필드(`period`, `workflowId`, `startDate`, `endDate`, `format` 등)를 명시적 인터페이스로 좁히는 것이 더 안전하고 유지보수성도 높다. 현재는 INFO 수준.

### [INFO] 통계 내보내기 오류 무시 패턴
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/frontend/src/app/(main)/statistics/page.tsx` 라인 376–378 (`catch {}` 블록)
- 상세: `handleExport` 의 `catch` 블록이 모든 오류를 조용히 삼킨다. 이 자체는 보안 취약점이 아니나, 실패 원인(예: 401 인증 오류, 네트워크 오류)이 사용자에게 전혀 노출되지 않는다. 보안 관점에서는 인증 만료·세션 무효 상태를 사용자가 인지하지 못할 수 있다.
- 제안: 최소한 `toast.error(...)` 처리를 추가하여 인증 오류를 사용자에게 알리도록 개선. 주석에 "could add toast in the future" 로 이미 인지하고 있음.

### [INFO] 하드코딩된 시크릿 없음
- 위치: 전체 변경 파일
- 상세: API 키, 토큰, 비밀번호, 인증서 등 하드코딩된 시크릿은 발견되지 않았다. 모든 인증은 `apiClient` 인스턴스(중앙 클라이언트)에 위임된다.

### [INFO] XSS — `a.download` 속성에 `period` 값 사용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/frontend/src/app/(main)/statistics/page.tsx` 라인 371 — `a.download = \`statistics-${period}.${format}\``
- 상세: `period` 와 `format` 을 파일명 속성에 직접 보간한다. `download` 속성은 파일명을 제안할 뿐이며 브라우저가 경로 탐색을 차단하므로 XSS 위험은 없다. `format` 은 `"csv" | "json"` 리터럴 유니온으로 타입이 좁혀져 있어 사실상 안전하다. `period` 는 런타임 값이므로 이론적으로 예외적 문자를 포함할 수 있으나 파일명 수준에서 OS가 제거하거나 변환한다. 실질 위험 없음.
- 제안: 방어적으로 `period.replace(/[^\w-]/g, '')` 를 적용할 수 있으나 필수 아님.

## 요약

이번 변경은 프론트엔드 페이지의 `apiClient` 직접 호출을 `lib/api/*` 카탈로그로 이전하는 behavior-preserving 리팩토링이다. 보안 관점에서 새로운 취약점은 도입되지 않았다. 인증·인가는 기존 `apiClient` 인스턴스에 위임되어 있으며 변경 없이 유지된다. 하드코딩 시크릿·XSS·SQL/커맨드 인젝션·LDAP 인젝션·경로 탐색·안전하지 않은 암호화 알고리즘 등 주요 취약점은 해당 없다. 지적 사항 모두 INFO 수준이며, `schedules.ts` 의 ID 경로 보간 및 `StatisticsQueryParams` 의 광역 타입은 백엔드 인가 레이어가 실질적 게이트를 담당한다는 전제 하에 현재 구조가 수용 가능하다.

## 위험도

NONE
