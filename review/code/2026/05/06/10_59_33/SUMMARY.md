파일 쓰기 권한이 없어 직접 저장은 불가합니다. 통합 보고서 내용을 출력합니다.

---

# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — `$today` 제거의 기존 워크플로우 호환성 미보장, 보안 취약점(OAuth URL 미검증·경로 탐색), 핵심 테스트 누락, 환경 설정값 하드코딩이 복합적으로 존재. Critical 수준은 없으나 다수의 WARNING이 중첩됨.

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API Contract · Side Effect · Dependency | **`$today` → `$now` 묵시적 Breaking Change** — DB에 저장된 기존 워크플로우 표현식에 `$today`가 있으면 런타임 `undefined` 반환 또는 평가 실패. 마이그레이션 전략 없음 | `expression-constants.ts`, `evaluator.ts`, `expression-resolver.service.ts` | 백엔드 evaluator에 `$today` fallback alias 추가하거나 DB 일괄 마이그레이션 스크립트 작성 |
| 2 | Security | **OAuth 팝업 URL 미검증** — `res.authUrl`을 프로토콜·도메인 검사 없이 `window.open()`에 직접 전달 | `integrations/[id]/page.tsx:369-372, 499-509` | `parsed.protocol === 'https:'` 및 허용 도메인 allowlist 검사 추가 |
| 3 | Security | **Webhook `endpointPath` 경로 탐색(Path Traversal) 미검증** — `../../admin` 같은 값으로 표시 URL 조작 가능 | `trigger-detail-drawer.tsx:226-231` | `/^[\w\-]+$/` 패턴 검사 적용 |
| 4 | Security · Architecture | **`window.confirm()` 으로 치명적 작업 승인** — 클릭재킹·XSS 체인으로 우회 가능 | `integrations/[id]/page.tsx:853` | React state 기반 인앱 다이얼로그로 교체 |
| 5 | Security | **타임존 입력 클라이언트 측 유효성 검증 부재** — 자유 텍스트 입력으로 임의 값이 백엔드 전달 | `schedules/page.tsx:891-898` | `Intl.supportedValuesOf('timeZone').includes(formTimezone)` 검사 추가 |
| 6 | Side Effect · Requirement · Maintainability | **CalendarView `toLocaleString("default", ...)` 직접 호출** — AGENTS.md 규약 위반, 브라우저 기본 로케일로 월 이름 표시 | `schedules/page.tsx:368` | `formatDate`에 `"month-year"` 포맷 추가 또는 `intlLocale` 명시 |
| 7 | Architecture · Maintainability · Testing | **`getWebhookUrl` + `TYPE_BADGE_STYLES` 두 파일에 완전 중복** — 포트 번호 변경 시 동기화 누락 위험 | `triggers/page.tsx:47-54, 199-203` / `trigger-detail-drawer.tsx:39-43, 226-230` | 공유 유틸 파일로 통합 |
| 8 | Side Effect · Security · Architecture | **Webhook URL 포트 `:3011` 하드코딩** — 프로덕션 환경에서 잘못된 URL 생성 | `triggers/page.tsx:199-203`, `trigger-detail-drawer.tsx:227-231` | `NEXT_PUBLIC_WEBHOOK_BASE_URL` 환경변수로 외부화 |
| 9 | Architecture · Requirement | **`trigger-detail-drawer.tsx` i18n 미적용** — 모든 사용자 노출 문자열이 영어/한국어 하드코딩, 다른 컴포넌트와 불일치 | `trigger-detail-drawer.tsx` 전체 | `useT()` 도입 후 번역 키 등록 |
| 10 | Testing | **`$today` 제거 회귀 테스트 누락** — 실수로 재추가해도 CI 탐지 불가 | `expression-constants.ts` | `ROOT_VARIABLES`·`BUILT_IN_PICKER_VARIABLES`에 `$today` 부재 명시적 검증 |
| 11 | Testing | **`filterRootVariablesByScope` 테스트 없음** — 루프 변수 범위 제어가 핵심 기능임에도 미검증 | `expression-constants.ts` | `hasLoop: false`일 때 루프 변수 은닉 검증 테스트 작성 |
| 12 | Testing · Security | **`isSafeUrl` 보안 함수 테스트 없음** — `javascript:`, `data:`, 상대 경로 등 XSS 벡터 검증 부재 | `button-bar.tsx:33-39` | 유틸 파일로 분리 후 공격 벡터 케이스 단위 테스트 추가 |
| 13 | Testing | **`formatDate`/`timeAgo` 스토어 로케일 폴백 테스트 누락** — `locale` 인수 생략 시 코드 경로 미검증 | `date.test.ts` | store에 `"ko"` 설정 후 `formatDate` 결과 검증 |
| 14 | Architecture | **`ConversationItem`의 `"rag"` 타입이 유니온 미포함, `as string` 캐스팅으로 우회** | `conversation-inspector.tsx:277, 511, 554` | `ConversationItem` 유니온에 `{ type: "rag"; content: string; turnIndex: number }` 추가 |
| 15 | Architecture | **`formatRel` 함수가 `timeAgo()`를 재구현** — i18n 추상화 우회 | `integrations/[id]/page.tsx:214-223` | `timeAgo(integration.lastUsedAt)` 직접 사용 |
| 16 | API Contract | **`/triggers/{id}/history` 및 `/workflows` 목록 API 응답 형식 불일치** — 배열/`{ items }` 래퍼 이중 처리 | `trigger-detail-drawer.tsx:72-74`, `schedules/page.tsx:559`, `triggers/page.tsx:135` | 백엔드 응답 형식 단일화 후 클라이언트 이중 처리 제거 |
| 17 | Performance | **`getCronDescription()` 렌더 루프 내 미캐시 호출** — invalidate 시마다 전체 행 cronstrue 파싱 반복 | `schedules/page.tsx:1003-1006` | `useMemo`로 스케줄 id별 사전 계산 |
| 18 | Requirement | **`formatDate` 유효하지 않은 입력 처리 부재** — `"Invalid Date"` 문자열이 UI에 노출 | `date.ts:69-101` | `isNaN(d.getTime())` 검사 후 `"—"` 반환 |
| 19 | Requirement | **`"datetime"` 포맷 테스트에서 시간 컴포넌트 검증 누락** | `date.test.ts:118-122` | `expect(result).toMatch(/\d{1,2}:\d{2}/)` 추가 |
| 20 | Documentation | **EN/KO 치트시트 옵셔널 체이닝 예시 비대칭** — 한국어 버전에만 3개 예시 추가 | `cheatsheet.en.mdx` | 영어 버전에 동일 예시 3개 추가 |
| 21 | Documentation | **`today()` 함수가 공개 문서에 기재됐으나 구현 여부 미확인** | `variables-and-context.en.mdx:95`, `variables-and-context.mdx:106` | `evaluator.ts` 확인 후 미구현 시 문서에서 제거 |
| 22 | Concurrency | **`ButtonBar` 클릭 가드 TOCTOU** — React 18 Concurrent Mode에서 state 스냅샷 기반 guard가 동일 플러시 사이클 내 중복 실행 허용 가능 | `button-bar.tsx:62-78` | `useRef`로 즉각 잠금 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability · Documentation | **`formatDate` `format` 파라미터가 `string`으로 느슨하게 타입 지정** | `date.ts:69` | `"iso" \| "datetime" \| "time" \| "date"` 유니온 타입으로 변경 및 export |
| 2 | Requirement | **`"datetime"` 포맷에 `toLocaleDateString` 사용** — 일부 엔진에서 시간 부분 누락 가능 | `date.ts:78-86` | `d.toLocaleString(intlLocale, {...})` 사용 |
| 3 | Maintainability | **`RawSchedule`/`mapSchedule`이 컴포넌트 함수 내부에 정의** | `schedules/page.tsx:481-507` | 모듈 최상단으로 이동 |
| 4 | Performance | **RAG 콘텐츠 정규식 매 렌더 재실행** | `conversation-inspector.tsx:383, 593-595` | `useMemo`로 `sourceCount` 사전 계산 |
| 5 | Performance | **`Intl` 포맷터 인스턴스 미캐시** | `date.ts:69-101` | 로케일 키 기반 인스턴스 캐시 |
| 6 | Dependency | **`dayjs` 의존성이 `$today` 제거 후 미사용일 가능성** (~12 kB 절감 가능) | `frontend/package.json:40` | 실사용 여부 확인 후 제거 검토 |
| 7 | Dependency | **`"use client"` 지시문이 `date.ts` 전체에 전파** | `date.ts:1` | 서버 렌더링 필요 시 스토어 읽기를 훅으로 격리 |
| 8 | Testing | **`summarizeToolResult` export 됐으나 테스트 없음** | `conversation-inspector.tsx:217-245` | `__tests__/conversation-inspector.test.ts` 작성 |
| 9 | Testing | **`getRunDaysInMonth` 월 경계 케이스 테스트 없음** | `schedules/page.tsx:98-125` | DST, 2월 29일, `31 * * *` 엣지 케이스 추가 |
| 10 | Security | **서버 오류 메시지 직접 toast 출력** | `integrations/[id]/page.tsx:392-393, 829` | 알려진 오류 코드만 i18n 키로 매핑 |
| 11 | Security | **AI 툴 호출 인자 마스킹 없이 UI 출력** | `conversation-inspector.tsx:83-87` | `password`, `token`, `secret` 키 이름 기반 마스킹 검토 |
| 12 | Maintainability | **expression 피커 제외 목록이 문자열 배열 하드코딩** | `expression-constants.ts:78` | `RootVariable`에 `excludeFromPicker?: boolean` 플래그 추가 |
| 13 | Requirement | **버전 히스토리 diff 비교 순서 미보장** | `version-history-panel.tsx:70-75` | 버전 번호 기준 정렬 또는 "Base / Compare" 레이블 표시 |
| 14 | API Contract | **`GET /schedules?limit=200` 달력 뷰 우회** | `schedules/page.tsx:531-538` | `GET /schedules/all` 전용 엔드포인트 설계 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | MEDIUM | OAuth 팝업 URL 미검증, Webhook 경로 탐색, 타임존 입력 미검증, `window.confirm` 우회 |
| API Contract | MEDIUM | `$today` 기존 워크플로우 breaking change, 응답 형식 불일치 |
| Side Effect | MEDIUM | CalendarView 로케일 우회, Webhook 포트 하드코딩, `$today` 데이터 영향 |
| Testing | MEDIUM | `$today` 회귀 테스트 없음, `filterRootVariablesByScope` 미검증, `isSafeUrl` 미검증 |
| Architecture | MEDIUM | 대형 페이지 컴포넌트 SRP 위반, 중복 코드, `"rag"` 타입 우회 |
| Requirement | MEDIUM | CalendarView 규약 위반, 유효하지 않은 입력 미처리, i18n 미적용 |
| Performance | LOW | `getCronDescription` 루프 내 미캐시, RAG 정규식 매 렌더 재실행 |
| Concurrency | LOW | `ButtonBar` 클릭 가드 TOCTOU (이론적) |
| Documentation | LOW | EN/KO 치트시트 비대칭, `today()` 함수 구현 불명확 |
| Maintainability | LOW | `formatDate` format 타입 느슨, 중복 상수·함수, 포트 하드코딩 |
| Dependency | LOW | `dayjs` 미사용 가능성, `"use client"` 경계 전파 |
| Scope | LOW | CalendarView `toLocaleString` 미전환, 전반적 일관성 양호 |
| Database | NONE | 해당 없음 |

---

## 발견 없는 에이전트

| 에이전트 | 사유 |
|----------|------|
| Database | 리뷰 대상 파일에 DB 스키마·쿼리·마이그레이션·ORM 코드 없음 |

---

## 권장 조치사항

1. **[즉시] `$today` breaking change 대응** — evaluator에 fallback alias 추가 또는 DB 마이그레이션 스크립트 작성. 회귀 테스트 동시 추가.
2. **[즉시] OAuth 팝업 URL 검증 추가** — `https:` 프로토콜 + 허용 도메인 allowlist 검사.
3. **[즉시] Webhook `endpointPath` 경로 조작 방어** — `/^[\w\-]+$/` 패턴 검사 적용.
4. **[단기] Webhook URL 포트 하드코딩 환경변수화** — `NEXT_PUBLIC_WEBHOOK_BASE_URL` 도입 + 두 파일 중복 로직 공유 유틸 통합.
5. **[단기] CalendarView 로케일 규약 준수** — `toLocaleString("default", ...)` → `intlLocale` 명시 방식 교체.
6. **[단기] `isSafeUrl` + `filterRootVariablesByScope` 테스트 추가** — 보안·핵심 기능 검증.
7. **[단기] `window.confirm` → 인앱 다이얼로그 교체** — `workspace/settings` 패턴 적용.
8. **[중기] `trigger-detail-drawer.tsx` i18n 적용** — `useT()` 도입 및 한/영 혼재 해소.
9. **[중기] `ConversationItem` `"rag"` 타입 유니온 추가** — `as string` 캐스팅 제거.
10. **[중기] `formatDate` 타입 정밀화** — 유니온 타입 + 유효하지 않은 입력 방어 코드.
11. **[중기] `today()` 문서 정합성 확인** — 미구현 시 공개 문서에서 제거.
12. **[중기] `getCronDescription` 렌더 루프 메모이제이션** — `useMemo`로 스케줄 id별 사전 계산.
13. **[장기] 대형 페이지 컴포넌트 분리** — `schedules/page.tsx`(1,104줄) 등 SRP 위반 컴포넌트 분리.