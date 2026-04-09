# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** - API 응답 정규화 분산, 테스트 순서 의존성, 스펙-구현 불일치, Breaking Change 다수 발견

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API Contract / Side Effect | `clickedBy` 필드 제거 — Breaking Change. `"clickedBy": "user-uuid"`가 `"selectedItem": {...}`으로 교체되어 기존 다운스트림 노드·저장된 실행 이력 데이터와 구조 불일치 발생 | `spec/4-nodes/6-presentation-nodes.md` §1.3 버튼 포트 출력 형식 | `clickedBy` 유지(deprecated 표시)하거나 마이그레이션 가이드 명시. Continue 포트 출력에는 여전히 `clickedBy` 존재하여 두 출력 경로 스키마 비대칭 |
| 2 | Side Effect / Security | `buttonConfig.buttonItemMap` 처리 코드 누락 가능성. 실행 엔진이 해당 필드를 인식 못하면 아이템 버튼 클릭 시 `selectedItem`이 항상 `undefined`로 전달 | `spec/4-nodes/6-presentation-nodes.md` §1.3 실행 로직 6-2항 | `CarouselHandler`에서 `buttonItemMap` 조회 로직 구현 확인 필수. 스펙에 연관 구현 파일 경로 명시 |
| 3 | Side Effect | `_selectedPort` 자동 제거 동작 — 기존 워크플로우 중 `$input._selectedPort`를 직접 참조하는 경우 조용한 오류 발생 | `spec/5-system/4-execution-engine.md` §2.1 | DB 검토로 사용자 직접 참조 케이스 확인 후 호환성 노트 추가 |
| 4 | API Contract | API 응답 래핑 불일치 — `(data as any).data ?? data` 패턴이 여러 컴포넌트에 반복되어 `{ data: T }` 또는 `T` 두 형태가 혼재 | `[executionId]/page.tsx:109`, `executions/page.tsx:143` | axios interceptor 또는 API 클라이언트 레이어에서 단일 정규화 처리. API Convention 확정 |
| 5 | Architecture | API 응답 정규화 로직이 UI 컴포넌트에 분산 — 레이어 책임 역전 | `[executionId]/page.tsx:105-124`, `executions/page.tsx:152-156` | `createApiClient` 또는 axios interceptor 레벨에서 `response.data.data ?? response.data` 단일 처리 |
| 6 | Architecture / Maintainability | `STATUS_ICON`, `STATUS_BADGE_VARIANT`, `STATUS_LABEL`, `formatDuration`이 두 페이지 파일에 중복 정의. 상태 추가 시 양쪽 동기화 필요 | `executions/page.tsx:23-65`, `[executionId]/page.tsx:23-65` | `src/lib/constants/execution-status.ts` 및 `src/lib/utils/duration.ts`로 즉시 추출 |
| 7 | Architecture | `adjacentQuery`가 prev/next 2개 ID를 위해 `limit: 100` 전체 로드 후 클라이언트 `findIndex`. 100건 초과 시 기능 장애 | `[executionId]/page.tsx:115-133` | 백엔드에 `GET /api/executions/:id/adjacent` 전용 엔드포인트 추가. 단기: `ADJACENT_QUERY_LIMIT = 100` 상수화 |
| 8 | Architecture | `NodeResultsTab` 6개 prop drilling — 내부 관심사(`nodeDetailTab` 등)가 부모에 노출 | `[executionId]/page.tsx:295-305` | `selectedNodeId`만 외부 prop으로 받고 나머지 상태는 컴포넌트 내부로 이동 |
| 9 | Architecture | `waiting_for_input` 필터 버튼이 스펙에 정의되어 있으나 구현에 누락 | `spec/2-navigation/6-execution-history.md §2.3`, `executions/page.tsx:101-107` | `FILTER_BUTTONS` 배열에 `{ label: "Waiting", value: "waiting_for_input" }` 추가 |
| 10 | Testing | `vi.clearAllMocks()` 후 모듈 레벨 mock 구현 소실 — 테스트 실행 순서 의존성으로 CI 환경에서 비결정적 실패 유발 | `execution-detail-page.test.tsx`, `execution-list-page.test.tsx` — `beforeEach` | `beforeEach`에서 모든 mock 구현을 명시적으로 재설정 |
| 11 | Testing | `formatDuration` 순수 함수 단위 테스트 없음. 두 파일에 중복 정의되어 불일치 발견도 어려움 | `executions/page.tsx:57-65`, `[executionId]/page.tsx:57-65` | 공통 모듈 추출 후 경계값 테스트 추가 |
| 12 | Testing | 로딩/에러/빈 상태 분기 테스트 누락 (`isLoading`, `isError`, `null` 반환 케이스) | `execution-detail-page.test.tsx`, `execution-list-page.test.tsx` | 스켈레톤, 에러 UI, "not found" UI 케이스 테스트 추가 |
| 13 | Testing | 페이지네이션·정렬·필터 인터랙션 테스트 전무 | `execution-list-page.test.tsx` | 필터 변경 시 page 리셋, 정렬 토글, 페이지 버튼 클릭 등 인터랙션 테스트 추가 |
| 14 | Testing | Prev/Next 네비게이션 버튼 동작 테스트 없음. `currentIndex === -1` 버그(`items[0]`이 next로 반환) 미검증 | `execution-detail-page.test.tsx` | 비활성화 상태 및 클릭 네비게이션 테스트 추가. `executionId` 미포함 케이스 회귀 테스트 |
| 15 | Testing | `Failed Execution` 테스트에서 `executionId` 불일치 (`"exec-1"` vs `"exec-fail"`) | `execution-detail-page.test.tsx` ~L190 | `failedExec.id = "exec-fail"`로 맞추거나 `executionId: "exec-1"`으로 통일 |
| 16 | Requirement | 노드 기본 탭 선택 우선순위가 스펙과 반대 — 스펙은 `outputData 있으면 Preview 우선`이지만 구현은 `error 우선` | `[executionId]/page.tsx:348-351` | `setNodeDetailTab(ne.outputData ? "preview" : ne.error ? "error" : "output")` |
| 17 | Requirement | 실행 상세 Finished 시간이 항상 full datetime으로 표시 — 스펙은 같은 날이면 `HH:mm:ss`만 요구 | `[executionId]/page.tsx:241` | `formatDate` 유틸에 same-day 조건 추가 |
| 18 | Performance | 실행 목록 행 렌더링 시 `nodeExecutions` 3중 filter 순회 — O(20N) 매 렌더마다 발생 | `executions/page.tsx` — `executions.map()` 내부 | 단일 `reduce`로 한 번에 `completed`, `failed`, `total` 집계 |
| 19 | Performance | `JsonViewer`에 `React.memo` 미적용 — 부모 리렌더마다 `JSON.stringify` 재실행 | `[executionId]/page.tsx` — `JsonViewer` 컴포넌트 | `React.memo` + `useMemo` 적용 |
| 20 | Performance | 페이지네이션 `Array.from({ length: totalPages })` 전체 렌더링 — 비정상 `totalPages`시 DoS-like 문제 | `executions/page.tsx` — Pagination 섹션 | 슬라이딩 윈도우(현재 ±2) + 상한선(`Math.min(totalPages, 100)`) 적용 |
| 21 | Security | `_selectedPort` 내부 메타데이터가 `NodeExecution.output_data`에 저장 후 `JsonViewer`로 노출 가능 | `spec/5-system/4-execution-engine.md` §2.1 | `output_data` 저장 전 `_selectedPort` 필드 제거 또는 API 응답 필터링 |
| 22 | Security | Carousel `itemButtons` 동적 ID(`{btnId}__item_{index}`)가 예측 가능 — 서버 측 소유권 검증 없으면 임의 트리거 가능 | `spec/4-nodes/6-presentation-nodes.md` §1.3 | 버튼 클릭 처리 시 서버에서 `buttonId`가 해당 실행의 `buttonConfig`에 존재하는지 검증 |
| 23 | Security | `selectedItem` 출력에 소스 데이터 전체 포함 — Dynamic 모드에서 민감 필드(PII, 토큰 등)가 `interaction_data`에 영구 기록 | `spec/4-nodes/6-presentation-nodes.md` — 버튼 포트 출력 형식 | `selectedItemFields` 옵션으로 출력 필드 제한 또는 백엔드 마스킹 정책 적용 |
| 24 | Security | Skip Node의 `NodeExecution.error` 보존으로 내부 시스템 정보(DB 쿼리, 파일 경로 등)가 사용자에게 노출 가능 | `spec/5-system/3-error-handling.md` | 에러 메시지 sanitization 정책 적용 또는 API 응답에서 일반화된 메시지만 반환 |
| 25 | Documentation | `buttonConfig.buttonItemMap` 타입·형식이 어디에도 정의되지 않음 (`Record<string, number>` 등) | `spec/4-nodes/6-presentation-nodes.md` §1.3 | ButtonConfig 구조체에 `buttonItemMap?: Record<string, number>` 필드 추가 정의 |
| 26 | Documentation | `source` 필드 필수/선택 불일치 — Config 테이블은 "dynamic 모드 시 필수", 실행 로직은 "미설정 허용(하위호환)" | `spec/4-nodes/6-presentation-nodes.md` Config 테이블 vs §1.3 3-1항 | 선택(`✗`)으로 수정하거나 신규/기존 워크플로우 구분 명시 |
| 27 | Maintainability | `itemButtons`(dynamic) vs `items[].buttons`(static) 네이밍 비대칭 — 동일 개념을 다른 이름으로 지칭 | `spec/4-nodes/6-presentation-nodes.md` Config 표, ItemDef 표 | 네이밍 통일 또는 스펙 상단에 두 방식의 대칭성 명시 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Scope | `clickedBy` 필드 제거가 의도적인지 확인 필요 (감사 목적으로 유용) | `spec/4-nodes/6-presentation-nodes.md:109` | 의도적 삭제면 스펙에 명시, 아니면 복원 |
| 2 | API Contract | `adjacentQuery` `limit: 100` 한계가 API 스펙에 미반영. 100건 초과 시 네비게이션 불가 | `spec/2-navigation/6-execution-history.md §3.6` | 스펙에 현재 구현 한계 명시 또는 Known Limitations 섹션 추가 |
| 3 | Security | 실행 내역 API에 인증/인가 요구사항 미명시 | `spec/2-navigation/6-execution-history.md` API 섹션 | 스펙에 "워크스페이스 소유권 검증 필수" 명시 |
| 4 | Security | `adjacentQuery` `limit: 100` 조회 시 불필요한 민감 데이터 전송 | `spec/2-navigation/6-execution-history.md §3.6` | adjacent 전용 API는 `id`와 `status`만 반환하도록 응답 필드 제한 |
| 5 | Dependency | `zod` 미도입으로 API 응답 런타임 타입 검증 부재. `as any` 캐스팅이 타입 안전성 우회 | 전체 API 응답 처리 코드 | `zod` 도입 여부 결정 또는 API 클라이언트에서 충분한 타입 정의 제공 |
| 6 | Performance | `sortedNodeExecutions` 생성 후 `completedCount`/`failedCount` 별도 2회 추가 순회 | `[executionId]/page.tsx` 메인 컴포넌트 본문 | 동일 `useMemo` 내에서 정렬과 집계를 함께 처리 |
| 7 | Performance | `detailTabs` 배열이 매 렌더마다 재생성 | `[executionId]/page.tsx` — `NodeResultsTab` 컴포넌트 본문 | `useMemo(() => [...tabs], [selectedNode?.error])` 적용 |
| 8 | Performance | 테스트에서 `QueryClient` 캐시 테스트 간 오염 가능성 | `execution-detail-page.test.tsx` — `Failed Execution` describe 블록 | `createWrapper()` 헬퍼로 통일하여 테스트마다 새 `QueryClient` 보장 |
| 9 | Testing | `Failed Execution` describe 블록에서 `createWrapper()` 헬퍼 미사용 — 일관성 없음 | `execution-detail-page.test.tsx` L150-170 | `createWrapper()` 또는 `renderPage()` 헬퍼로 통일 |
| 10 | Testing | 버튼 쿼리를 `getAllByRole("button")[0]` 인덱스로 접근 — DOM 순서 변경 시 취약 | `execution-detail-page.test.tsx` L130-153 | `getByRole("button", { name: /back to executions/i })` 등 역할/레이블 기반으로 변경 |
| 11 | Testing | `mockBack` 선언되었으나 `router.back()` 호출 검증 테스트 없음 | `execution-list-page.test.tsx` L6 | back 버튼 클릭 시 `router.back()` 호출 테스트 추가 |
| 12 | Testing | `NodeResultsTab` 서브탭 전환 및 `JsonViewer` 렌더링 테스트 없음 | `execution-detail-page.test.tsx` | 노드 선택 → Input/Output/Error 탭 전환 + JSON 렌더링 검증 테스트 추가 |
| 13 | Testing | Timeline 노드 클릭 시 `nodeDetailTab` 미초기화 버그 회귀 테스트 없음 | `execution-detail-page.test.tsx` | 에러 노드 → 에러 없는 노드 클릭 시 Error 탭 자동 해제 검증 |
| 14 | Requirement | 스펙 §2.1 다이어그램에 Trigger 열이 있으나 §2.4 테이블 정의와 불일치 — 구현은 §2.4 기준 | `spec/2-navigation/6-execution-history.md` §2.1 vs §2.4 | §2.1 다이어그램을 §2.4와 일치하도록 수정 |
| 15 | Requirement | Nodes 열 `totalCount`가 skipped 노드 제외 기준과 목록 페이지(`nodeExecutions?.length`) 간 불일치 가능 | `[executionId]/page.tsx:116-122` | 스펙에서 "전체 수" 기준 명확화 후 두 페이지 통일 |
| 16 | Requirement | 정렬 변경 시 page 리셋 동작이 스펙에 미정의 (필터 변경만 명시) | `executions/page.tsx:131-139` | `spec/2-navigation/6-execution-history.md §2.6`에 정렬 변경 시 리셋 동작 명시 |
| 17 | Requirement | `waiting_for_input` 노드의 상세 뷰 동작이 스펙에 미정의 | `spec/2-navigation/6-execution-history.md §3.3` | 해당 상태 노드 클릭 시 기본 탭 및 표시 내용 명세 추가 |
| 18 | Documentation | `NodeExecution.error` 형식이 §3.2 에러 포트 구조와 달리 `{ message: "..." }`만 기술 | `spec/5-system/3-error-handling.md §3.1` | 기존 에러 구조 §2.2를 참조하는 링크 추가 |
| 19 | Documentation | `_selectedPort` strip 동작이 presentation 노드 스펙과 실행 엔진 스펙 두 곳에 분산 기술 | `spec/4-nodes/6-presentation-nodes.md §1.3`, `spec/5-system/4-execution-engine.md §2.1` | 실행 엔진 스펙 §2.1을 단일 진실 소스로 하고 presentation 노드 스펙에서 참조 링크만 추가 |
| 20 | Documentation | 화면 구성도에 `[Waiting]` 버튼 누락 (필터 표에는 존재) | `spec/2-navigation/6-execution-history.md §2.1` | 화면 구성도에 `[Waiting]` 버튼 추가 |
| 21 | Documentation | Static `ItemDef.buttons`와 Dynamic `itemButtons` 간 관계, 공존 시 포트 수·라우팅 우선순위 미명시 | `spec/4-nodes/6-presentation-nodes.md` | 글로벌 `buttons` / Static `ItemDef.buttons` / Dynamic `itemButtons` 비교 요약 표 추가 |
| 22 | Side Effect | Skip Node의 `error` 필드 추가로 `skipped` 상태 노드에서 에러 탭이 의도치 않게 활성화 가능 | 프론트엔드 실행 상세 페이지 — 에러 탭 조건부 노출 | `skipped` 상태 노드의 에러 탭 표시 여부 별도 처리 로직 검토 |
| 23 | Side Effect | 대시보드 행 클릭 동작 단일화(실패 시 디버그 뷰 → 실행 상세 페이지)로 기존 status 분기 로직 제거 필요 | `spec/2-navigation/0-dashboard.md` L79-80 | 대시보드 컴포넌트 행 클릭 핸들러에서 status 분기 로직 제거 확인 |
| 24 | Side Effect | `source` 필드의 "미설정" 판별 조건 불명확 — `null`, `undefined`, 빈 문자열 처리 여부 미정의 | `spec/4-nodes/6-presentation-nodes.md` §1.3 3-1항 | "미설정" 판별 조건 명확히 기술 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| api_contract | MEDIUM | `clickedBy` 제거 Breaking Change, API 응답 래핑 불일치 |
| side_effect | MEDIUM | `buttonItemMap` 처리 코드 누락 가능, `_selectedPort` 자동 제거 기존 워크플로우 영향 |
| security | MEDIUM | `_selectedPort` 클라이언트 노출, 동적 버튼 ID 예측 가능, 민감 데이터 영구 저장 |
| architecture | MEDIUM | API 정규화 레이어 책임 역전, 도메인 상수 중복, `adjacentQuery` 구조적 문제 |
| performance | MEDIUM | `adjacentQuery` 100건 전체 로드, 3중 filter 순회, `JsonViewer` memo 미적용 |
| testing | MEDIUM | `vi.clearAllMocks()` 순서 의존성, 핵심 인터랙션 테스트 전무, `currentIndex === -1` 버그 미검증 |
| maintainability | MEDIUM | 상수 중복, 테스트 순서 의존성, 스펙-구현 암묵적 차이 |
| requirement | MEDIUM | 노드 기본 탭 우선순위 역전, Finished 시간 포맷 불일치, `waiting_for_input` 필터 누락 |
| documentation | LOW | `buttonItemMap` 스키마 미정의, `source` 필수/선택 불일치 |
| dependency | LOW | 내부 모듈 중복 의존, API 클라이언트 추상화 미흡 |
| scope | LOW | `clickedBy` 제거 의도 확인 필요 |
| database | NONE | 해당 없음 |
| concurrency | NONE | 해당 없음 |

---

## 발견 없는 에이전트

- **database** — 변경 파일에 DB 관련 코드 없음
- **concurrency** — 변경 파일이 마크다운 문서 전체, 실행 코드 없음

---

## 권장 조치사항

1. **[즉시] `vi.clearAllMocks()` 후 mock 재설정** — CI 비결정적 실패 방지. `beforeEach`에서 모든 mock 구현 명시적 재설정
2. **[즉시] `STATUS_*` 상수 + `formatDuration` 공통 모듈 추출** — 두 파일 중복 제거 후 단위 테스트 추가
3. **[즉시] 노드 기본 탭 선택 우선순위 수정** — `ne.outputData ? "preview" : ne.error ? "error" : "output"` 으로 변경
4. **[즉시] `waiting_for_input` 필터 버튼 추가** — `FILTER_BUTTONS`에 `{ label: "Waiting", value: "waiting_for_input" }` 추가
5. **[단기] API 응답 정규화를 API 클라이언트 레이어로 이동** — `(data as any).data ?? data` 패턴을 axios interceptor 또는 API 클라이언트 내부로 통합
6. **[단기] `currentIndex === -1` 버그 수정 및 회귀 테스트 추가** — `adjacentQuery` 엣지 케이스 처리
7. **[단기] 로딩/에러/빈 상태 + Prev/Next 네비게이션 테스트 추가** — 핵심 분기 커버리지 확보
8. **[단기] `buttonConfig.buttonItemMap` 스키마 스펙 정의** — 타입 명시 및 출력 예시에 포함
9. **[단기] Finished 시간 same-day 조건 구현** — `formatDate` 유틸에 조건부 로직 추가
10. **[단기] 페이지네이션 상한선 처리** — `Math.min(totalPages, 100)` + 슬라이딩 윈도우 적용
11. **[단기] `JsonViewer` `React.memo` + `useMemo` 적용** — 불필요한 `JSON.stringify` 재실행 방지
12. **[단기] `_selectedPort` 보안 처리** — `output_data` 저장 전 또는 API 응답에서 필드 제거
13. **[중기] `GET /api/executions/:id/adjacent` 전용 엔드포인트 추가** — `adjacentQuery`의 `limit: 100` 구조적 한계 해소
14. **[중기] `clickedBy` Breaking Change 마이그레이션 전략 수립** — 기존 저장 데이터·다운스트림 노드 호환성 검토
15. **[중기] 실행 내역 API 인증/인가 요구사항 스펙 명시** — 워크스페이스 소유권 검증 강제 여부 확인