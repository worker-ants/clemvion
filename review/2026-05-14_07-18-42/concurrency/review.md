## 발견사항

제공된 diff에서 실제 동시성 구현 코드(`cafe24-api.client.ts`, `cafe24-mcp-tool-provider.ts`, `cafe24.handler.ts`)가 프롬프트 크기 제한으로 누락되었습니다. 가시적 변경사항 기준으로 리뷰합니다.

---

**[INFO]** `mcp-server-selector.tsx` — React Query `staleTime` 설정
- 위치: `queryKey: ["integrations", "mcp-capable"]`, `staleTime: 30_000`
- 상세: React Query가 동일 queryKey에 대한 중복 요청을 자동 dedup합니다. 브라우저 단일 스레드 환경이므로 `useState(pickerOpen)`과 `add()` 핸들러 간 경쟁 조건 없음. 정상.

**[INFO]** `mcp-capable-service-types.ts` — 순수 상수, 모듈 초기화 시 1회 할당
- 상세: `as const` 배열이므로 불변. 동시성 무관.

**[INFO]** `integrations.ts` — 옵셔널 타입 필드 추가
- 상세: 타입 선언만이므로 런타임 동시성 영향 없음.

---

### 기 조치된 핵심 동시성 항목 확인 (RESOLUTION.md 기준)

`review/2026-05-14_01-29-47/RESOLUTION.md`에서 실제 구현 파일의 동시성 이슈 처리 결과가 확인됩니다:

| 항목 | 내용 | 조치 결과 |
|---|---|---|
| W3 | 429 retry thundering herd | `Math.random() * 500` jitter 추가 ✅ |
| C5 | `integrationLocks` Map unbounded | `tracked.finally()` 이미 삭제 처리됨 (false positive) ✅ |
| C6 | `cleanup({ executionId: undefined })` 전체 세션 삭제 | no-op + `__resetForTesting()` 분리 + NODE_ENV guard ✅ |
| W1 | token refresh `pessimistic_write` lock 부재 | 단일 인스턴스 전제 trade-off로 follow-up 분리 |

---

### 요약

가시적 diff 범위(프론트엔드 UI, 상수, 타입, 문서)의 변경사항은 동시성 관련 코드를 포함하지 않습니다. 실제 동시성 로직이 있는 `cafe24-api.client.ts`의 per-integration 토큰 갱신 직렬화(프로세스 내 lock Map)와 `cafe24-mcp-tool-provider.ts`의 `executionId` 격리는 diff에서 누락되어 직접 검증 불가하나, RESOLUTION.md 기록을 통해 thundering herd jitter, unbounded Map 정리, cleanup guard가 이미 처리된 것이 확인됩니다. 멀티 인스턴스 환경에서의 DB `pessimistic_write` lock 부재(W1)는 단일 인스턴스 전제 하의 known follow-up으로 남아있습니다.

### 위험도

**LOW** — 가시적 코드 자체에는 동시성 문제 없음. 핵심 구현의 주요 동시성 이슈는 이전 리뷰 사이클에서 조치 완료됨.