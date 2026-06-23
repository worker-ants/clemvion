# Code Review 통합 보고서 (스코프: feat 커밋 8c5a3a54 — frontend 코드 21파일)

## 전체 위험도
**MEDIUM** — Critical 0. WARNING 18(상태 불일치·테스트 갭·보안 하드닝·SPEC-DRIFT), INFO 다수.

## Critical
_없음_

## WARNING — 처분

| # | 카테고리 | 발견 | 처분 |
|---|---|---|---|
| 1 | SideEffect | `useAppearanceDraft` loadedId+draft 이중 setState (key 리마운트로 이미 커버, 중복 복잡도) | **fix** — loadedId 제거, key 리마운트+lazy init 신뢰 |
| 2 | SideEffect | setState 업데이터 내부 localStorage 쓰기(StrictMode 이중 실행) | **fix** — localStorage 를 sync effect 로 분리 |
| 3 | SideEffect | create 후 `["triggers"]` 캐시 미무효화(트리거 화면 불일치) | **fix** — `["triggers"]` 도 invalidate |
| 4 | Architecture | 클라이언트 `crypto.randomUUID()` endpointPath, 재시도 시 중복 가능 | **defer(by-design)** — spec 2-trigger-list §2.5 가 클라 UUID 생성 규정; 이중제출은 isPending 가드. RESOLUTION 근거 |
| 5,6,7,18 | Testing | 인스턴스 전환·에러 상태·로딩 상태·admin RBAC 미검증 | **fix** — 테스트 추가 |
| 8 | UserGuideSync | `/web-chat` 운영 콘솔 user guide docs 미반영 | **defer(증분2)** — 미리보기 포함 완성 시 작성. plan followup 등록 |
| 9 | Security | `escapeForScript` U+2028/U+2029 미처리 | **fix** — 유니코드 라인구분자 이스케이프 |
| 10 | Security | localStorage 역직렬화 런타임 검증 부재 | **fix** — primaryColor hex·position·locale sanitize |
| 11 | Requirement/UX | isLoading 중 skeleton/indicator 부재 | **fix** — 로딩 표시 추가 |
| 12 | Requirement | onCreated 응답 래핑(`{data:{id}}`) 미방어 | **fix** — `created?.data?.id ?? created?.id` |
| 13 | Performance | `useWorkflowOptions` staleTime 0 → dialog 마다 refetch | **fix** — staleTime 추가 |
| 14 | Architecture | createButton JSX 변수 재사용 | **defer(저영향)** — 동일 JSX 2곳 재사용, 재조정 영향 미미 |
| 15 | Maintainability | mutationFn 반환 타입 미명시 → 캐스팅 | **fix** — 반환 타입 명시 |
| 16 | Maintainability | `limit: 100` 매직넘버 중복 | **fix** — 상수 추출 |
| 17 | [SPEC-DRIFT] | `5-admin-console.md` status spec-only·code:[] 인데 코드 구현됨 | **fix(spec)** — status: partial + code globs |
| 18 | [SPEC-DRIFT] | §5 fallback 이 Phase1 전 동작 미기술 | **fix(spec)** — §5 주석 보강 |

## INFO (선별 처분)
- 미사용 `fireEvent` import 제거(fix). 미사용 i18n 키 `list.*`(증분2 예비 — 주석 명시). 중복 `t.type==='webhook'` 필터(주석). CRLF·prune 테스트 추가(fix 일부). 나머지 아키텍처/네이밍 INFO 는 저영향 — RESOLUTION 기록 후 선택 반영.

## 처리
1. 코드 fix(SideEffect/Security/Testing/Perf/Maintainability) → lint·unit 재통과.
2. SPEC-DRIFT(W-17·18) → spec frontmatter partial + §5 주석 (planner 경로 불요 — frontmatter bookkeeping + 본인 spec).
3. defer 항목(W-4 by-design, W-8 user guide 증분2, W-14 저영향) → RESOLUTION 근거.
4. docker/e2e 는 환경 차단(DeadlineExceeded) — RESOLUTION TEST 결과에 기록.
