### 발견사항

- **[INFO]** `X-Deleted-Count` 헤더 누락(header absent) 폴백 케이스는 커버되나, 비정상 헤더 값 케이스 일부 누락
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-admin-rebase-df13f9/codebase/frontend/src/lib/api/__tests__/agent-memories.test.ts`
  - 상세: `agentMemoriesApi.clearScope` 테스트는 정상(3건), 0건, 헤더 부재, 비숫자(NaN) 케이스를 모두 커버한다. 단, 음수 문자열(`"-1"`) 또는 부동소수점(`"2.5"`) 입력 시 파싱 결과가 명시적으로 검증되지 않는다. 실제 서버가 반환하지 않는 값이라 회귀 위험은 낮지만, 방어 파싱 계약을 문서화하는 관점에서 누락이다.
  - 제안: `parseInt` + `isNaN` 분기를 문서화하는 엣지 케이스 테스트 1건 추가 (선택적).

- **[INFO]** CORS `exposedHeaders` 설정에 대한 단위 테스트 부재
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-admin-rebase-df13f9/codebase/backend/src/main.ts` (line 189–191)
  - 상세: `main.ts` 에 `exposedHeaders: ['X-Deleted-Count']` 가 추가됐으나, 이 설정을 직접 검증하는 테스트가 없다. `web-chat-cors.spec.ts` 와 `cors-origins.spec.ts` 도 `exposedHeaders` 필드를 검증하지 않는다. CORS 설정은 integration/e2e 수준에서만 실제로 검증 가능하지만, 설정값 자체를 스냅샷으로 고정해 회귀를 막을 수 있다.
  - 제안: `web-chat-cors.spec.ts` 또는 CORS 관련 단위 테스트에 `exposedHeaders` 필드 존재·값 검증 케이스 추가.

- **[INFO]** `clearScope` 서비스 계층에서 SQL RETURNING 절 결과 파싱 경로의 방어 분기 미검증
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-admin-rebase-df13f9/codebase/backend/src/modules/agent-memory/agent-memory-admin.service.spec.ts` (line 260–282)
  - 상세: `clearScope` 서비스 테스트는 `[rows, 2]` 형태(RETURNING + affected 수) 와 빈 케이스를 커버한다. `deleteMemory` 테스트(line 260 주석)는 `deletedRowCount` 방어 분기를 명시 검증하는데, `clearScope` 에 동일 방어 분기가 있는지, 있다면 테스트로 커버되는지 확인이 필요하다.
  - 제안: `clearScope` 서비스 구현에서 `affected` 카운트 추출 경로를 확인하고, 방어 분기가 있다면 테스트 추가.

- **[INFO]** 프론트엔드 페이지 테스트에서 삭제 후 scope 목록 갱신(re-fetch) 동작이 검증되지 않음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-admin-rebase-df13f9/codebase/frontend/src/app/(main)/agent-memory/__tests__/agent-memory-page.test.tsx`
  - 상세: `clearScope` 성공 후 토스트 분기(success/info)는 잘 검증된다. 그러나 삭제 완료 후 `listScopes` 쿼리가 무효화(invalidate)되어 목록이 갱신되는 동작은 테스트하지 않는다. 이는 `react-query` invalidation 계약에 해당하는 통합 행동으로, 현재 mock 구조로도 `getMock` 2회 호출 여부로 검증 가능하다.
  - 제안: 삭제 후 `getMock` 가 scopes endpoint 를 재호출하는 것을 `waitFor` + `toHaveBeenCalledTimes(2)` 로 검증하는 케이스 추가(선택적).

- **[INFO]** 리뷰 대상 파일(review/consistency/**, spec/*.md)은 테스트 대상이 아님 — 해당 없음
  - 위치: 파일 1–13 (review/consistency/, spec/ 문서)
  - 상세: 변경 대상 대부분이 spec·일관성 검토 산출물(`.md`, `.json`)이다. 이 파일들은 실행 가능 코드가 아니므로 테스트 적용 대상이 아니다. 실제 구현 변경은 파일 14–15 (spec/.md 2건) + 연관 코드(`main.ts`, `web-chat-cors.ts`)에 한정되며, 해당 구현 코드는 테스트가 존재한다.

### 요약

이번 변경의 핵심 구현 사항인 `X-Deleted-Count` 헤더 echo(백엔드 컨트롤러/서비스)와 프론트엔드 0건 중립 토스트 분기는 테스트 커버리지가 양호하다. 백엔드 컨트롤러 스펙에서 정상 다건, 0건(멱등), 공백 scopeKey 거부 케이스를 명확히 검증하고, 서비스 스펙에서 SQL 격리·삭제 수 반환을 검증한다. 프론트엔드 API 계층(agent-memories.test.ts)은 헤더 파싱 엣지 케이스(부재, 비숫자 폴백 포함)까지 커버하며, 페이지 컴포넌트 테스트(agent-memory-page.test.tsx)는 토스트 분기 통합 흐름을 검증한다. 미흡 사항은 모두 INFO 수준으로: CORS `exposedHeaders` 설정에 대한 단위 테스트 부재, 음수/부동소수점 헤더 값 파싱 명시 검증 부재, 삭제 후 목록 re-fetch 동작 미검증 정도다. 기존 회귀 테스트를 깨뜨리는 변경은 없으며 테스트 격리·가독성·mock 적절성 모두 수용 가능한 수준이다.

### 위험도

LOW
