# Code Review 통합 보고서

## 전체 위험도
**LOW** — 순수 behavior-preserving 리팩터. 기능·보안·사이드이펙트 위험 없음. spec frontmatter 미등재(SPEC-DRIFT)와 캐시 무효화 책임 분리 미완 두 가지 WARNING 이 존재하나 비차단 수준.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `lib/api/triggers.ts` 가 `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 에 미등재 — spec-impl 트레이서빌리티 누락. 코드는 옳고 spec frontmatter 가 낡은 상태(consistency check W-2 재확인). | `spec/2-navigation/2-trigger-list.md` frontmatter | project-planner 세션에서 `code:` 목록에 `codebase/frontend/src/lib/api/triggers.ts` 추가 |
| 2 | Architecture | `TriggerDeleteDialog` 컴포넌트 내에서 `queryClient.invalidateQueries(["triggers"])` 를 직접 호출 — 캐시 무효화 책임이 컴포넌트에 내재화되어 재사용 시 광범위 refetch 결합 위험. JSDoc 도 `onDeleted?` prop 패턴 언급하나 미반영. | `trigger-delete-dialog.tsx` L150, L157 | `onDeleted?: () => void` prop 추가 후 캐시 무효화 책임을 호출자(page.tsx)에 위임. M-8 2단계에서 처리 권장. |
| 3 | Architecture | `getHistory` 응답 envelope 정규화 로직(`body?.data ?? body`, `Array.isArray`, `data?.items ?? []`)이 `getById` 등 다른 메서드에도 인라인으로 중복 산재 — 백엔드 응답 포맷 변경 시 수정 지점 분산 위험. | `triggers.ts` L836-843, L991-993 | `normalizeEnvelope<T>(res, mode)` 또는 `unwrapEnvelope<T>` 공통 헬퍼 추출. M-8 2단계 또는 별도 리팩터로 등록 권장. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | API 레이어 단일 책임 강화 — 트리거 도메인 `apiClient` 직접 호출 13곳 전부가 `triggersApi` 카탈로그로 집결됨. SRP·레이어 책임 분리 방향에 부합하는 정방향 리팩터. | `triggers.ts`, `trigger-delete-dialog.tsx`, `trigger-history-dialog.tsx` | 해당 없음 (긍정 발견). |
| 2 | Architecture | `triggersApi` 객체 리터럴 패턴 — `executions.ts` 관례 답습으로 일관성 있음. 현 규모에서 인터페이스 추가 추상화는 복잡도만 높임. | `triggers.ts` L979 | 현 패턴 유지 적절. |
| 3 | Architecture | `TriggerDetail` 프론트/백엔드 동명 공존 — shared-types 패키지 도입 시 네임 충돌 잠재. consistency check W-3 기존 지적 사항. | `triggers.ts:32` | M-8 2단계에서 `TriggerDetailView` 등으로 개칭 검토. |
| 4 | Requirement | `getHistory` envelope 정규화의 `{ data: { data: [...] } }` 이중 래핑은 미처리이나 spec 상 해당 케이스가 정의되지 않아 현행 범위에서 문제 없음. 테스트 3케이스(배열/envelope/빈값)로 커버됨. | `triggers.ts` L1030-1032 | 추가 변형이 운영 중 발견되면 케이스 추가. |
| 5 | Requirement | `triggerId as string` 타입 단언 — `enabled: !!triggerId && open` 가드로 런타임 안전하나 타입 레벨 명시 보장 없음. 기존 패턴 보존 범위. | `trigger-history-dialog.tsx` L395 | early return 또는 props 오버로드 분리 고려. 즉각 강제 아님. |
| 6 | Requirement | `trigger.name` 빈 문자열 시 confirm match 즉시 true — backend 가 spec §2.5로 차단하므로 실 경로 미진입. 방어 코드 부재는 기존 코드와 동일. | `trigger-delete-dialog.tsx` L185 | 해당 없음. |
| 7 | Maintainability | `getHistory<T>` 제네릭 — 호출자가 `TriggerHistoryEntry` 를 명시 지정해야 함. `getById` 는 `TriggerDetail` 을 명시 반환해 불일치. 두 번째 호출처 등장 시 타입 정의 위치 합의 필요. | `triggers.ts` L1024-1032, `trigger-history-dialog.tsx` L394 | `TriggerHistoryEntry` 공유 인터페이스를 `triggers.ts` 에 export 하거나 기본 타입 파라미터 정의 검토. |
| 8 | Maintainability | `triggerId as string` 단언 — `enabled` 조건 분리 시 null 호출 감출 구멍 가능성. | `trigger-history-dialog.tsx` L394 | `if (!triggerId) return []` early return 또는 props 타입 오버로드. |
| 9 | Maintainability | `trigger-history-dialog.tsx` Link 의 `className` 인라인 보간이 길어 가독성 저하. `div` 버전은 `rowClass` 단순 참조로 두 분기 비대칭. | `trigger-history-dialog.tsx` L461 | `rowLinkClass = cn(rowClass, "...")` 별도 변수 추출 권장. |
| 10 | Maintainability | `fakeAxios` 헬퍼의 `config: {} as unknown as AxiosResponse<T>` 강제 캐스팅 — axios 가 `config` 에 접근하는 경로 추가 시 조용한 오류 가능. | `triggers.test.ts` L611-617 | `satisfies Partial<AxiosResponse<T>>` 형태로 최소 충족 구조 명시 고려. |
| 11 | Testing | 다이얼로그 테스트가 `triggersApi` 대신 내부 구현인 `apiClient` 를 mock — Vitest 호이스팅으로 현재 정상 동작하나, 향후 `triggersApi` 가 다른 fetch 구현으로 교체 시 false green 위험. | `trigger-delete-dialog.test.tsx`, `trigger-history-dialog.test.tsx` | 중기적으로 `vi.mock("@/lib/api/triggers")` 직접 mock 전환 권장. |
| 12 | Testing | `getHistory` params=undefined 시 axios 호출 인수 검증 없음 — URL 오타/params 전달 방식 변경 감지 불가. | `triggers.test.ts` L571-583 | envelope/빈값 케이스에 `toHaveBeenCalledWith` 인수 검증 추가 고려. |
| 13 | Testing | `trigger-delete-dialog.test.tsx` 의 `apiDeleteMock` 검증이 `triggersApi.delete` 내부 HTTP path를 전제 — `triggers.test.ts` 단위 테스트와 중복. | `trigger-delete-dialog.test.tsx` L129 | `triggersApi.delete` 직접 mock + 호출 여부만 확인으로 계층 책임 명확화. |
| 14 | Documentation | `TriggerListParams` JSDoc 에 `search`/`sort`/`order` 생략 의도 미주석 — 소비자가 spec §3 전체 파라미터 모를 수 있음. (consistency W-1 재확인) | `triggers.ts` `TriggerListParams` | 인터페이스 JSDoc 에 `// 현재 클라이언트는 search/sort/order 미전송` 주석 추가. |
| 15 | API Contract | `getHistory` `limit` 파라미터가 optional — 미전달 시 backend 기본값에 의존. 현 호출부는 `HISTORY_LIMIT=10` 항상 전달하므로 실질 위험 없음. | `triggers.ts` L1027-1035 | 주석에 backend default limit 또는 권장 limit 명시 고려. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 보안 취약점 없음. 순수 리팩터로 신규 공격면 미도입. |
| architecture | LOW | 캐시 무효화 책임 컴포넌트 내재화(WARNING), envelope 정규화 중복(WARNING). 핵심 레이어 분리 목표 달성. |
| requirement | NONE | spec §3/§4.2-4.4/R-6/R-7/R-13 모두 기존 동작 보존. SPEC-DRIFT(frontmatter 미등재)는 코드 결함 아님. |
| scope | NONE | 변경 파일 7개 전부 명시된 목적(M-8 1단계 완결)에 정확히 부합. 불필요한 변경 없음. |
| side_effect | NONE | HTTP 동사·URL·props 무변. 순수 확장(additive). 기존 호출자 영향 없음. |
| maintainability | NONE | 제네릭 타입 책임 위치·envelope 헬퍼 추출·단언 제거 세 가지 INFO 수준 개선 여지. 즉각 수정 불필요. |
| testing | LOW | 다이얼로그 테스트가 `apiClient` 내부 mock — 현재 동작 정확하나 중장기 리팩터 권장. 실질 미커버 위험 경로 없음. |
| documentation | LOW | `triggers.ts` spec frontmatter 미등재(WARNING, project-planner 위임). `TriggerListParams` 생략 미주석(INFO). |
| api_contract | NONE | 엔드포인트 경로·HTTP 메서드·파라미터 스키마 모두 spec §3 준수. Breaking change 없음. |

## 발견 없는 에이전트

- **security**: 취약점 해당 없음 (OWASP Top 10 전항목 점검 완료)
- **scope**: 범위 이탈 없음 (모든 변경 목적 내 적합)
- **side_effect**: 사이드이펙트 없음 (순수 확장 변경)
- **api_contract**: API 계약 위반 없음 (엔드포인트 계약 완전 보존)

## 권장 조치사항

1. **(project-planner 위임)** `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 목록에 `codebase/frontend/src/lib/api/triggers.ts` 추가 — spec-impl 트레이서빌리티 복원 및 이후 spec-coverage 감사 재보고 방지.
2. **(M-8 2단계 포함)** `TriggerDeleteDialog` 에 `onDeleted?: () => void` prop 추가 후 `queryClient.invalidateQueries` 책임을 `page.tsx` 호출자로 이전 — 컴포넌트 재사용성 확보.
3. **(중기 리팩터)** `normalizeEnvelope<T>` / `unwrapEnvelope<T>` 공통 헬퍼 추출 — `getById`/`getHistory` 및 향후 메서드의 envelope 언래핑 중복 제거.
4. **(중기)** 다이얼로그 컴포넌트 테스트를 `vi.mock("@/lib/api/triggers")` 직접 mock 방식으로 전환 — API 계층 경계 명확화 및 향후 구현 교체 내성 확보.
5. **(소규모)** `TriggerListParams` JSDoc 에 `search/sort/order` 미전송 주석 추가, `getHistory` JSDoc 에 `limit` backend 기본값 위임 명시.

## 라우터 결정

라우터 결정 방식: `routing=done` (router 가 선별)

- **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract` (9명)
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)
- **제외**: 5명

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 순수 API 호출 경유 레이어 통일 리팩터 — 런타임 성능 변경 없음 |
| dependency | 신규 외부 의존성 추가 없음 |
| database | 프론트엔드 전용 변경 — DB 스키마/쿼리 관련 없음 |
| concurrency | 동시성 로직 변경 없음 |
| user_guide_sync | 사용자 노출 동작 변경 없음 — 내부 리팩터 전용 |