파일 쓰기 권한이 필요합니다. 권한을 허용해 주시면 `review/2026-04-09_09-18-22/SUMMARY.md`에 통합 보고서를 저장하겠습니다.

그 전에 보고서 내용을 먼저 출력합니다:

---

# Code Review 통합 보고서

## 전체 위험도
**HIGH** - 테스트 비결정성 버그(`vi.clearAllMocks`), 보안 설계 결함(Code 노드 샌드박싱 미명시, Redis 평문 저장), 다수의 스펙-구현 불일치 및 아키텍처 레이어 위반이 복합적으로 발견됨

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `vi.clearAllMocks()`가 모듈 레벨 mock 구현을 제거하여 테스트 실행 순서에 따른 비결정적 실패 발생 | `execution-detail-page.test.tsx` L118, `execution-list-page.test.tsx` L54-56 | `beforeEach`에서 `vi.clearAllMocks()` 후 mock 구현을 명시적으로 재설정 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | Code 노드 Raw JS 실행 환경 샌드박싱 정책 미명시 — RCE 수준 위험 | `spec/5-system/4-execution-engine.md` §5.3 | `isolated-vm`, Docker 격리 등 정책 스펙 명시, 위험 모듈 차단 |
| 2 | Security | `buttonConfig` 내부 포트 ID 노출 — 공격자 버튼 클릭 API 위조 가능 | `spec/4-nodes/6-presentation-nodes.md` §1.3 step 9 | API 응답에서 내부 포트 ID 제거, label/style만 노출 |
| 3 | Security | link 버튼 URL 표현식을 통한 Open Redirect / SSRF 위험 | `spec/4-nodes/6-presentation-nodes.md` §1.6 | 허용 프로토콜 제한, 내부 IP 차단, 서버 측 화이트리스트 검증 |
| 4 | Security | Route to Error Port의 `originalInput` 전체 전달로 민감 데이터 유출 위험 | `spec/5-system/3-error-handling.md` §3.2 | 민감 필드 마스킹, 64KB 초과 시 truncation |
| 5 | Security | `nodeOutputCache` 민감 데이터 Redis 평문 저장 | `spec/5-system/4-execution-engine.md` §6.2 | 암호화 옵션 명시, `sensitiveOutput: true` 플래그 지원 |
| 6 | Security | Dynamic Carousel `source` 표현식으로 민감 노드 출력 접근 후 화면 노출 가능 | `spec/4-nodes/6-presentation-nodes.md` §1.1 | 표현식 결과 배열 타입 런타임 검증, 민감 소스 선택 시 경고 |
| 7 | Requirement | `waiting_for_input` 필터 버튼 미구현 (스펙 §2.3 명시) | `executions/page.tsx` `FILTER_BUTTONS` | `{ label: "Waiting", value: "waiting_for_input" }` 추가 |
| 8 | Requirement | API Error와 Not Found 상태 미구분 — 두 경우 모두 "Execution not found." 표시 | `[executionId]/page.tsx` | `isError` 분기를 별도 처리하여 에러 원인별 메시지 구분 |
| 9 | Requirement / Bug | `currentIndex === -1` 시 `items[0]` 반환 버그 — 잘못된 prev/next 탐색 | `[executionId]/page.tsx` L137-143 | `if (currentIndex === -1) return { prev: null, next: null };` 즉시 추가 |
| 10 | Requirement | Spec 내부 불일치 — §2.1 ASCII art `Trigger` 컬럼이 §2.4 테이블 정의에 누락 | `spec/2-navigation/6-execution-history.md` §2.1, §2.4 | §2.4에 `Trigger` 컬럼 추가 또는 §2.1에서 제거 |
| 11 | Requirement | Timeline 노드 클릭 시 `nodeDetailTab` 초기화 미흡 (에러 없는 노드로 이동 후에도 Error 탭 유지) | `[executionId]/page.tsx` `onNodeClick` | `onNodeClick`에서 스펙 §3.3 기준으로 `nodeDetailTab` 초기화 |
| 12 | Architecture / Maintainability | `STATUS_*` 상수, `formatDuration`이 두 파일에 복제 — 상태 추가 시 양쪽 동기화 필요 | `executions/page.tsx` L22-65, `[executionId]/page.tsx` L22-65 | `src/lib/constants/execution-status.ts`로 추출 |
| 13 | Architecture | API 응답 정규화 로직 (`(data as any).data ?? data`)이 각 queryFn에 분산, 캐스팅 방식 불일치 | `[executionId]/page.tsx` L105-124, `executions/page.tsx` L152-156 | axios interceptor 또는 API 클라이언트에서 단일 unwrapping 처리 |
| 14 | Architecture | 인접 실행 탐색 로직이 프론트엔드에 위치 (`limit:100` 전체 로드 후 `findIndex`) — 100건 초과 시 기능 파괴 | `[executionId]/page.tsx` L115-143 | 백엔드에 `/api/executions/:id/adjacent` API 추가, 스펙 §3.6 반영 |
| 15 | Architecture | `NodeResultsTab` props 과다 (6개) — `selectedNodeId`, `nodeDetailTab`이 부모에 불필요하게 위치 | `[executionId]/page.tsx` L295-305 | 두 상태를 `NodeResultsTab` 내부로 이동 |
| 16 | API Contract | Carousel 버튼 포트 출력 형식에서 `clickedBy` 필드 제거 — Breaking Change | `spec/4-nodes/6-presentation-nodes.md` 버튼 포트 출력 형식 | `clickedBy` 유지 + `selectedItem` 추가(non-breaking) 또는 마이그레이션 가이드 명시 |
| 17 | API Contract | 실제 API 응답 래핑이 스펙 계약과 불일치 | `spec/2-navigation/6-execution-history.md` §5 | 백엔드 응답 형식 스펙대로 통일 또는 API 클라이언트에서 단일 정규화 |
| 18 | API Contract | prev/next 탐색 전용 엔드포인트 스펙 미정의 | `spec/2-navigation/6-execution-history.md` §3.6 | 스펙에 adjacent API 추가 |
| 19 | Testing | 로딩/에러/not-found 상태 테스트 완전 부재 | `execution-detail-page.test.tsx`, `execution-list-page.test.tsx` | skeleton, API 실패, not-found 분기별 테스트 추가 |
| 20 | Testing | 핵심 인터랙티브 기능(정렬, 필터, 페이지네이션, Prev/Next) 테스트 없음 | `execution-list-page.test.tsx`, `execution-detail-page.test.tsx` | 각 기능 단위 테스트 추가 |
| 21 | Testing | `waiting_for_input` 필터 버튼 누락 감지 테스트 없음 | `execution-list-page.test.tsx` | 필터 버튼 목록 검증 테스트 추가 |
| 22 | Testing | `Failed Execution` describe 블록이 `createWrapper()` 미사용 — QueryClient 캐시 오염 위험 | `execution-detail-page.test.tsx` L150-170 | `createWrapper()` 헬퍼로 통일 |
| 23 | Testing | `formatDuration` 순수 함수 단위 테스트 없음 (두 파일에 중복 정의된 채 미검증) | `executions/page.tsx` L57-65, `[executionId]/page.tsx` L57-65 | 공통 모듈 추출 후 경계값 단위 테스트 추가 |
| 24 | Testing | `Failed Execution` 블록의 `executionId` 불일치 (`exec-1` vs `exec-fail`) — 잠재적 flaky | `execution-detail-page.test.tsx` | ID 통일 |
| 25 | Performance | `ExecutionListPage` 행 렌더링 시 `nodeExecutions` 3중 filter 순회 O(n×m) | `executions/page.tsx` `executions.map()` 내부 | 단일 `reduce`로 통합 집계 |
| 26 | Performance / Security | `totalPages` 무한 버튼 렌더링 — 서버 응답값 상한 없어 DOM 폭증 가능 | `executions/page.tsx` Pagination | `Math.min(totalPages ?? 0, 100)` + 슬라이딩 윈도우 적용 |
| 27 | Side Effect | Blocking Mode 활성화 조건 확장 — `itemButtons` 설정 시 기존 워크플로우 예상 외 Blocking Mode 진입 가능 | `spec/4-nodes/6-presentation-nodes.md` §1.3 6번 | 기존 워크플로우 영향도 평가 |
| 28 | Side Effect | Dynamic 모드 "배열 필드 자동 탐색" 로직 제거 — `source` 미설정 기존 워크플로우 일부 파괴 가능 | `spec/4-nodes/6-presentation-nodes.md` §1.3 3-1항 | 하위호환 동작 유지 여부 결정 및 스펙 명시 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | 페이지 컴포넌트 책임 과도 집중 (데이터 페칭·상태·렌더링) | `[executionId]/page.tsx` 전체 | `useExecutionDetail`, `useAdjacentExecutions` 커스텀 훅 분리 검토 |
| 2 | Maintainability | `detailTabs` 배열 렌더마다 재생성 | `[executionId]/page.tsx` L307-311 | `useMemo(() => [...], [selectedNode?.error])` 적용 |
| 3 | Performance | `JsonViewer`에서 매 렌더마다 `JSON.stringify` 재실행 | `[executionId]/page.tsx` `JsonViewer` | `useMemo` 또는 `React.memo` 적용 |
| 4 | Performance | `sortedNodeExecutions` 이후 `.filter()` 2회 추가 순회 | `[executionId]/page.tsx` 메인 컴포넌트 | 단일 `useMemo`로 정렬+집계 통합 |
| 5 | Testing | 버튼 탐색이 DOM 인덱스/`textContent` 의존으로 fragile | `execution-detail-page.test.tsx` L130-153 | `getByRole` 또는 `data-testid` 기반으로 교체 |
| 6 | Testing | `mockBack` 선언 후 `router.back()` 검증 테스트 없음 | `execution-list-page.test.tsx` L6 | 검증 테스트 추가 또는 변수 제거 |
| 7 | Documentation | `_selectedPort` 메타데이터 처리가 두 문서에 분산 기술 | presentation-nodes Note, execution-engine §2.1 | 상호 참조 링크 추가 |
| 8 | Documentation | `itemButtons`와 `ItemDef.buttons` 관계 불명확 | `spec/4-nodes/6-presentation-nodes.md` L21, L35 | Config 테이블에 한 줄 설명 추가 |
| 9 | Documentation | 대시보드 행 클릭 동작 변경 의도 미명시 | `spec/2-navigation/0-dashboard.md` L79-80 | dead code 정리 또는 TODO 주석 추가 |
| 10 | API Contract | `buttonConfig.buttonItemMap` WS 이벤트 페이로드 추가 — 소비자 인지 필요 | `spec/4-nodes/6-presentation-nodes.md` §1.3 Blocking Mode 2번 | WS 페이로드 전체 스키마 스펙 명시 |
| 11 | API Contract | `NodeExecution.error` skipped 상태에도 설정 — 기존 `null` 단정 코드 영향 가능 | `spec/5-system/3-error-handling.md` Skip Node 정책 | 프론트엔드 타입 정의 확인 |
| 12 | Security | `as any` 타입 캐스팅으로 런타임 검증 우회 | queryFn들 | Zod 스키마 검증 도입 검토 |
| 13 | Security | Worker 태스크 메시지에 `input` 전체 포함 | `spec/5-system/4-execution-engine.md` §4.2 | `inputRef`(캐시 키)만 포함하는 간접 참조 방식 검토 |
| 14 | Scope | Carousel 스펙 변경이 실행 내역 리뷰 범위에 혼재 | `spec/4-nodes/6-presentation-nodes.md`, `spec/5-system/4-execution-engine.md` | PR 범위 분리 또는 명시 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | HIGH | Code 노드 샌드박싱 미명시, buttonConfig 포트 ID 노출, Open Redirect, Redis 평문 저장 |
| Testing | HIGH | `vi.clearAllMocks()` mock 구현 소실로 비결정적 테스트, 핵심 기능 커버리지 전무 |
| Performance | MEDIUM | `adjacentQuery` limit:100 전체 로드, 3중 filter 순회, 페이지네이션 DOM 폭증 |
| Architecture | MEDIUM | API 응답 정규화 분산, 인접 탐색 로직 위치 오류, 상수 이중 정의 |
| Requirement | MEDIUM | `waiting_for_input` 필터 누락, API Error/Not Found 미구분, `currentIndex === -1` 버그 |
| API Contract | MEDIUM | `clickedBy` Breaking Change, 응답 래핑 불일치, adjacent API 미정의 |
| Side Effect | MEDIUM | Blocking Mode 조건 변경 기존 워크플로우 영향, 배열 자동 탐색 로직 제거 |
| Maintainability | MEDIUM | 상수·유틸 중복, API 정규화 분산, `NodeResultsTab` props 과다 |
| Dependency | LOW | `as any` 캐스팅 (런타임 검증 라이브러리 미활용) |
| Documentation | LOW | 스펙 내 상호 참조 미흡, `itemButtons`/`ItemDef.buttons` 관계 불명확 |
| Scope | LOW | Carousel 스펙 변경이 실행 내역 리뷰 범위에 혼재 |
| Database | NONE | 해당 없음 |
| Concurrency | NONE | 해당 없음 |

---

## 발견 없는 에이전트

- **Database** — 변경 파일에 DB 직접 접근 코드 없음
- **Concurrency** — 변경 파일이 문서 및 UI 코드로 동시성 분석 대상 없음

---

## 권장 조치사항

1. **[즉시] `vi.clearAllMocks()` 패턴 수정** — `beforeEach`에서 mock 구현 명시적 재설정으로 CI 비결정적 실패 차단
2. **[즉시] `currentIndex === -1` 버그 수정** — `if (currentIndex === -1) return { prev: null, next: null };` 가드 추가
3. **[즉시] `waiting_for_input` 필터 버튼 추가** — `FILTER_BUTTONS`에 항목 추가 및 테스트 작성
4. **[즉시] API Error / Not Found 분기 구분** — `isError` 시 별도 에러 메시지 표시
5. **[단기] 상수·유틸 공통 모듈 추출** — `STATUS_*`, `formatDuration`을 단일 파일로 추출, 단위 테스트 추가
6. **[단기] API 응답 정규화 단일화** — axios interceptor 또는 API 클라이언트에서 일원화
7. **[단기] 핵심 기능 테스트 추가** — 정렬, 필터, 페이지네이션, Prev/Next, 로딩/에러/not-found 상태
8. **[단기] `nodeDetailTab` 초기화 로직** — `onNodeClick`에서 스펙 §3.3 기준으로 탭 초기화
9. **[단기] `totalPages` 상한 적용** — `Math.min(totalPages ?? 0, 100)` + 슬라이딩 윈도우 페이지네이션
10. **[단기] `clickedBy` Breaking Change 대응** — 기존 코드 grep 확인, non-breaking 마이그레이션
11. **[중기] 보안 설계 보완** — Code 노드 샌드박싱 정책 명시, buttonConfig 포트 ID 제거, `originalInput` 마스킹, Redis 암호화 옵션
12. **[중기] `/api/executions/:id/adjacent` 엔드포인트 추가** — `limit:100` 우회 구현 제거, 스펙 §3.6 업데이트
13. **[중기] `NodeResultsTab` 상태 소유권 이동** — `selectedNodeId`, `nodeDetailTab`을 컴포넌트 내부로 이전
14. **[중기] Spec 내부 불일치 해소** — `Trigger` 컬럼 §2.1 vs §2.4 정리, adjacent API 한계 명시
15. **[장기] Dynamic 모드 배열 자동 탐색 하위호환 정책 결정** — 스펙 명시 및 구현 반영