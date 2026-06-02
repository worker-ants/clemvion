# Code Review 통합 보고서

리뷰 대상: cafe24-allowlist-ui (Cafe24 MCP server allowlist UI 신설)
리뷰 일시: 2026-06-02
리뷰어: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency

---

## 전체 위험도

**MEDIUM** — `onChange` 타입 계약 위반 및 `['*']` 처리 누락이 핵심 위험. 테스트 커버리지 갭(4건 WARNING) 이 회귀 방어망을 약화시킨다. 보안·아키텍처·범위·동시성은 낮음 또는 없음 수준.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 타입 안전성 | `onChange` Props 타입이 `string[]`로 선언되나 `commit` 내부에서 `undefined as unknown as string[]`로 강제 캐스팅해 `undefined`를 전달 — TypeScript 보호 완전 우회, 미래 부모 컴포넌트에서 배열 메서드 직접 호출 시 런타임 TypeError 발생 가능 | `cafe24-allowlist-editor.tsx` L66 | `Props.onChange`를 `(enabledTools: string[] \| undefined) => void`로 변경하고 `as unknown as` 캐스팅 제거 |
| 2 | 요구사항 충실도 | `spec/5-system/11-mcp-client.md §5.6`이 `['*']`를 "전체 허용(기본)"으로 정의하나 `isEnabled`가 이를 처리하지 않아, 기존 설정에 `['*']`가 있으면 모든 체크박스가 unchecked로 오표시 | `cafe24-allowlist-editor.tsx` L60 (`isEnabled`) | `enabledTools == null \|\| enabledTools.includes('*') \|\| enabledTools.includes(id)` 로 보강 |
| 3 | 테스트 | `commit()`의 `sameAsAll → onChange(undefined)` 역전 동작(default_true 복원 핵심 비즈니스 로직) 테스트 케이스 없음 | `__tests__/cafe24-allowlist-editor.test.tsx` | `enabledTools={allIds에서 하나 빠진 배열}` 상태에서 마지막 off op를 on으로 토글 시 `onChange(undefined)` 호출 검증 케이스 추가 |
| 4 | 테스트 | `level === 'program'` restrictedApproval 배지 렌더 미테스트 — consistency-check INFO #5로 명시 결정된 동작임에도 회귀 방어 없음 | `__tests__/cafe24-allowlist-editor.test.tsx` | `OP_PROGRAM` 픽스처 추가 및 해당 op 행 배지 렌더 검증 |
| 5 | 테스트 | `McpServerSelector`의 Cafe24 확장 섹션(chevron 토글, `Cafe24AllowlistEditor` 임베드, `patch` 연결, enabledTools 카운트 뱃지) 테스트 전혀 없음 | `mcp-server-selector.tsx` (신규 Cafe24 섹션) | `__tests__/mcp-server-selector.test.tsx` 신설 또는 picker 테스트에 cafe24 시나리오 케이스 추가 (최소 3케이스) |
| 6 | 테스트 | `cafe24-extras.ts` 공유 헬퍼(`readCafe24Extras`, `resolveCafe24OperationLabel`) 독립 단위 테스트 없음 — structural narrowing 분기와 locale/dict miss fallback이 간접 경로로만 검증 | `src/lib/node-definitions/cafe24-extras.ts` | `src/lib/node-definitions/__tests__/cafe24-extras.test.ts` 신설 |
| 7 | 보안 | `onChange` 타입 캐스팅으로 allowlist 상태가 `undefined`로 전파될 때 상위 컴포넌트가 빈 배열로 오해석하면 allowlist 논리 오류(전부 차단 또는 전부 허용) 발생 가능 | `cafe24-allowlist-editor.tsx` L66, `mcp-server-selector.tsx` 콜백 | Warning #1 해결로 동시 해소 |
| 8 | 유지보수성 | `mcp-server-selector.tsx` 내 에러 메시지 3개("Failed to load MCP servers...", "No MCP server registered...", "No MCP servers attached...") 영문 하드코딩 — 같은 파일의 다른 텍스트는 모두 `t(...)` i18n 처리 | `mcp-server-selector.tsx` lines ~1056~1064 | ko/en dict에 i18n 키 등록 후 `t()` 호출로 대체. 이번 PR 범위 외라면 `// TODO(i18n):` 마킹 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | `McpServerSelector`에 `serviceType === "cafe24"` 하드코딩 분기 삽입 — 서비스 타입 증가 시 OCP 위반 경로 | `mcp-server-selector.tsx` L226-265 | 중기적으로 render prop 또는 provider 패턴으로 고급 UI를 외부 주입 가능하도록 리팩터링 검토 |
| 2 | 아키텍처 | `Cafe24AllowlistEditor` 내 default_true materialize 비즈니스 로직이 컴포넌트 본문에 인라인 — 단위 테스트가 렌더링 경유로만 가능 | `cafe24-allowlist-editor.tsx` L53-78 | `materializeAllowlist(...)` 순수 함수로 추출 시 독립 단위 테스트 가능 |
| 3 | 아키텍처 | `expanded` Set에서 `remove()` 시 stale 항목 미정리 — 동일 integrationId 재추가 시 의도치 않은 펼침 상태 복원 | `mcp-server-selector.tsx` `remove()` | `remove` 함수에 `setExpanded(prev => { const n = new Set(prev); n.delete(integrationId); return n; })` 추가 |
| 4 | 보안 | 백엔드 `extras` 응답의 `op.id`·`op.labelKey` 무검증 사용 — MITM 시 UI 라벨 오염 가능 (React 자동 이스케이프로 XSS 직접 실행 위험 낮음) | `cafe24-extras.ts` `readCafe24Extras()` | id는 `/^[a-zA-Z0-9_]+$/` 정규식, labelKey는 `cafe24.<resource>.<id>` 패턴 검증 추가 |
| 5 | 보안 | `_retry_state.json`에 `/Volumes/project/private/clemvion/` 절대경로 하드코딩 — 공개 저장소 배포 시 개발 환경 구조 노출 | `review/consistency/2026/06/02/10_09_21/_retry_state.json` | `review/**/_retry_state.json` 패턴을 `.gitignore`에 추가 |
| 6 | 보안 | 에러 메시지에 "integrations service" 내부 서비스명 노출 | `mcp-server-selector.tsx` L1057 | i18n 키 처리 및 기술 세부사항 일반화 |
| 7 | 요구사항 | `categoryRestricted`에 `ops.some()` 사용 — 카테고리 내 일부만 scope-level인 op 추가 시 헤더 ⚠ false-positive 가능. 현재 메타데이터 구조에서는 문제없음 | `cafe24-allowlist-editor.tsx` L97-103 | 혼합 카테고리 추가 가능성 시 `ops.every()`로 변경 검토 |
| 8 | 요구사항 | `resources.sort()` 알파벳 정렬 — spec §8.3에 정렬 순서 미정의 | `cafe24-allowlist-editor.tsx` L59 | 필요 시 spec §8.3에 정렬 순서 한 줄 명시 (project-planner 위임) |
| 9 | 유지보수성 | `integration-configs.tsx` 함수 추출 후 남겨진 주석("추출됨, drift 방지")이 인지 부담 | `integration-configs.tsx` L79-81 | 주석 블록 제거. import 한 줄만으로 의도 전달 충분 |
| 10 | 유지보수성 | `base()`라는 이름이 추상적 — "materialize된 enabledTools 기준값"의 의미가 불명확 | `cafe24-allowlist-editor.tsx` | `materializedTools()` 또는 `effectiveTools()`로 rename |
| 11 | 유지보수성 | `patch` 함수명과 파라미터명 동일 — 섀도잉으로 혼란 가능 | `mcp-server-selector.tsx` `function patch(...)` | 파라미터명을 `updates` 또는 `partialRef`로 변경 |
| 12 | 유지보수성 | `readCafe24Extras()`가 전역 Zustand 스토어 직접 접근 — React 렌더 외부 호출 시 반응성 없음, 명시적이지 않음 | `cafe24-extras.ts` | JSDoc에 "Zustand 스토어 스냅숏 직접 접근 — 컴포넌트 렌더 맥락 외 호출 시 반응성 없음" 명시 |
| 13 | 유지보수성 | 테스트에서 `originalDefs` 캡처가 모듈 평가 시점(describe 최상위) — 선행 테스트 오염 시 잘못된 원본 캡처 가능 | `cafe24-allowlist-editor.test.tsx` L95 | `beforeAll` 내로 이동하거나 `afterEach`에서 known-clean 상태로 복원 |
| 14 | 유지보수성 | `op` 헬퍼 함수 이름 지나치게 축약, 루프 변수 `op`와 혼동 가능 | `cafe24-allowlist-editor.test.tsx` L142 | `makeOp` 또는 `buildOperation`으로 rename |
| 15 | 유지보수성 | `headerBoxes[0]` 인덱스 접근이 `resources.sort()` 알파벳 순서에 암묵적으로 의존 | `cafe24-allowlist-editor.test.tsx` L276 | `screen.getByRole("checkbox", { name: /mileage/i })`로 aria-label 직접 특정 |
| 16 | 테스트 | `enabledTools={[]}` 빈 배열 경계 케이스 미테스트 — undefined(전부 허용)와 구별되는 명시적 전부 차단 상태 | `__tests__/cafe24-allowlist-editor.test.tsx` | 모든 체크박스 unchecked 검증 케이스 추가 |
| 17 | 테스트 | 영어(en) 로케일 렌더 미검증 — 모든 테스트가 `locale: "ko"` 고정 | `__tests__/cafe24-allowlist-editor.test.tsx` | `describe("en locale")` 블록에서 최소 1케이스 추가 |
| 18 | 테스트 | 카테고리 헤더 체크박스 indeterminate 상태 미테스트 | `__tests__/cafe24-allowlist-editor.test.tsx` | partial 상태에서 `indeterminate` DOM 속성 및 헤더 클릭 시 전체 on 검증 |
| 19 | 문서화 | `resolveCafe24OperationLabel` JSDoc에서 `.` 키 충돌 이유 및 spec SoT 참조 누락 (원본 JSDoc에 있었으나 이전 시 누락) | `cafe24-extras.ts` L39-44 | JSDoc에 dot-key 충돌 이유 및 `spec/conventions/cafe24-api-metadata.md §7.5` SoT 명시 보완 |
| 20 | 문서화 | `cafe24-extras.ts` JSDoc에 "older backend" 케이스와 "free-form text fallback" 설명 누락 | `cafe24-extras.ts` `readCafe24Extras` JSDoc | "older backend(extras 없이 배포된 버전)에서도 null 반환되며 소비자에서 free-form fallback" 보완 |
| 21 | 문서화 | `commit` 내 `as unknown as string[]` 타입 캐스팅에 의도를 설명하는 주석 없음 | `cafe24-allowlist-editor.tsx` L570 | 캐스팅 이유 주석 추가 (또는 Warning #1 해결로 캐스팅 자체 제거) |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | MEDIUM | `['*']` 처리 누락(spec §5.6 불일치), `onChange` 타입 계약 위반 |
| testing | MEDIUM | sameAsAll 역전 동작 미테스트, McpServerSelector 신규 섹션 미테스트, cafe24-extras 독립 테스트 없음 |
| security | LOW | `onChange` 타입 캐스팅의 allowlist 논리 오류 가능성, extras 무검증 렌더링 |
| architecture | LOW | `onChange` 타입 불일치, McpServerSelector OCP 위반 잠재성 |
| side_effect | LOW | `onChange` Props 타입 위장, `expanded` stale 항목 잔류 |
| maintainability | LOW | `onChange` 타입 지뢰, 하드코딩 영문 에러 메시지 |
| documentation | NONE | `resolveCafe24OperationLabel` JSDoc 누락, `onChange` 타입 문서 불일치 (모두 INFO) |
| scope | NONE | 변경 전체가 계획된 범위 내. 이탈 없음 |
| concurrency | NONE | 동시성 코드 없음. 해당 없음 |

---

## 발견 없는 에이전트

- **concurrency**: 동기 React 렌더링 및 순수 함수 헬퍼만 포함. 비동기 코드 없음. 경쟁 조건·데드락·스레드 안전성 위험 없음.
- **scope**: 변경 전체가 plan 문서에 사전 명시된 항목. 범위 이탈·무관한 파일 변경·불필요한 기능 추가 발견 없음.

---

## 권장 조치사항

1. **[즉시] `onChange` Props 타입 수정** — `cafe24-allowlist-editor.tsx` Props 인터페이스를 `onChange: (enabledTools: string[] | undefined) => void`로 변경하고 `undefined as unknown as string[]` 캐스팅 제거. `McpServerSelector` 핸들러 타입도 함께 조정. (Warning #1, 보안 Warning #7, 아키텍처·요구사항·부작용·유지보수성 동일 지적 통합 해소)

2. **[즉시] `['*']` 처리 추가** — `isEnabled`를 `enabledTools == null || enabledTools.includes('*') || enabledTools.includes(id)`로 보강. `base()`·`commit()`의 `sameAsAll` 경로도 동일 처리. (Warning #2)

3. **[즉시] 테스트 3건 추가** — (a) `sameAsAll → onChange(undefined)` 역전 동작 케이스 (b) `level='program'` 배지 렌더 케이스 (c) `enabledTools=[]` 빈 배열 경계 케이스. (Warning #3, #4, INFO #16)

4. **[단기] `McpServerSelector` 신규 섹션 테스트 신설** — `__tests__/mcp-server-selector.test.tsx` 생성 또는 기존 테스트에 cafe24 서버 시나리오 추가. 최소 (1) expand 버튼 클릭 → AllowlistEditor 노출 (2) non-cafe24 미노출 (3) 카운트 뱃지 표시. (Warning #5)

5. **[단기] `cafe24-extras.ts` 독립 단위 테스트 신설** — `src/lib/node-definitions/__tests__/cafe24-extras.test.ts` 생성. `readCafe24Extras` 4분기, `resolveCafe24OperationLabel` locale hit/miss 3분기. (Warning #6)

6. **[단기] 하드코딩 영문 에러 메시지 i18n 처리** — `mcp-server-selector.tsx` 3개 문자열을 ko/en dict 등록 후 `t()` 호출. (Warning #8)

7. **[중기] `expanded` stale 항목 정리** — `remove()` 함수에 `setExpanded(prev => { const n = new Set(prev); n.delete(integrationId); return n; })` 추가. (INFO #3)

8. **[중기] `_retry_state.json` gitignore 추가** — `review/**/_retry_state.json` 패턴을 `.gitignore`에 추가. (INFO #5)

9. **[이후 리팩터] 네이밍·문서화 정비** — `base()` → `materializedTools()`, `op()` → `makeOp()`, `patch` 파라미터명 → `updates`, `integration-configs.tsx` 주석 블록 제거, `resolveCafe24OperationLabel` JSDoc 보완. (INFO #10, #11, #14, #9, #19)

---

## 라우터 결정

라우터가 reviewer를 선별하여 실행함 (`routing_status=done`).

- **실행** (9명): security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency
- **강제 포함 (router_safety)** (7명): documentation, maintainability, requirement, scope, security, side_effect, testing

**제외된 reviewer** (5명):

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 라우터 판단에 의해 제외 |
| dependency | 라우터 판단에 의해 제외 |
| database | 라우터 판단에 의해 제외 |
| api_contract | 라우터 판단에 의해 제외 |
| user_guide_sync | 라우터 판단에 의해 제외 |