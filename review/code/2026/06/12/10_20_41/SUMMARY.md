# Code Review 통합 보고서

리뷰 대상: `test-code-http-hardening` 그룹3 — 테스트 보강 + W14 주석 수정 + plan 체크박스 갱신
변경 범위: 6파일 / +220 / -9 (code/http/i18n 테스트 + W14 주석 off-by-one 수정 + plan 체크박스)
리뷰 일시: 2026-06-12

---

## 전체 위험도

**LOW** — 모든 변경이 테스트 추가·주석 수정·plan 갱신으로 구성되며 운영 코드 변경은 없다. Critical 발견 없음. Warning은 테스트 코드 품질·유지보수성 영역에 집중되며 기능 회귀 위험은 없다. SPEC-DRIFT 1건은 코드가 아닌 spec 갱신 누락으로 project-planner 위임 대상이다.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/2-code.md §4 step2` 래퍼 표현식이 실제 2단 구조(`outer async IIFE + "use strict" + inner __user async arrow`)를 반영하지 않음. 단일 인라인 표현으로 기술되어 독자가 step2 기준 오프셋 계산 시 오류 가능. 코드 구현은 옳고 spec이 낡은 상태. | `spec/4-nodes/5-data/2-code.md` line 107 | 코드 유지. spec `§4 step2` 래퍼 표현식을 2단 구조로 갱신하거나 "개념적 요약 — 실제 구조 및 오프셋은 §4 step2 아래 노트 참조" 보조 주석 추가. project-planner 위임 |
| W2 | 테스트/부작용 | `process.env.ALLOW_PRIVATE_HOST_TARGETS` 직접 변이 패턴 (`try/finally` 복원). 현재는 안전하나, 향후 `env-read-once` 옵션이 채택될 경우 모듈 캐시로 인해 테스트가 false positive로 통과할 구조적 취약점 존재. | `http-request.handler.spec.ts` lines 220–246 | `env-read-once` 채택 시 `jest.replaceProperty` 또는 모듈 리셋 기반으로 교체. 현재 단계에서는 plan에 예비 메모 추가 |
| W3 | 테스트/부작용 | `global.fetch` 직접 교체 후 dry-run 테스트에서 `afterEach` 복원 없음. 이후 테스트에 영향 가능. 단, 기존 파일 전체 관행과 동일한 패턴으로 신규 도입 문제 아님. | `http-request.handler.spec.ts` lines 1099–1100 | `afterEach(() => { jest.restoreAllMocks(); })` 또는 `jest.spyOn(globalThis, 'fetch')` 패턴 전환. 파일 전체 단위로 일괄 정리 권장 |
| W4 | 유지보수성 | `makeService` + `new HttpRequestHandler` 2줄 setup이 신규 테스트 4건 전체에 인라인 중복. 기존 `beforeEach`/헬퍼 미활용. 매직 문자열 `'t'` 도 반복. | `http-request.handler.spec.ts` lines 203–204, 230–231, 260–261, 284–285 | 공통 setup을 `beforeEach` 또는 `describe` 스코프 공유 변수로 추출. `const TOKEN = 't'` 상수화 |
| W5 | 유지보수성 | `process.env` 수동 복원 패턴이 Jest 관용 방식(`jest.replaceProperty`) 대신 수동 `try/finally` 사용. W2와 동일 근원의 유지보수성 문제. | `http-request.handler.spec.ts` lines 220–246 | `jest.replaceProperty(process.env, 'ALLOW_PRIVATE_HOST_TARGETS', 'true')` 사용 권장 |
| W6 | 테스트 | `$vars` copy-out 실패 fallback 테스트가 isolated-vm `jail.get(..., { copy: true })` API의 함수 거부 동작에 의존. 향후 isolated-vm 버전업 시 catch 분기 미실행에도 테스트가 통과할 false positive 위험. catch 분기 실행 직접 검증 없음. | `code.handler.spec.ts` lines 94–111 | 주석에 "catch 분기 실행 여부는 handler 구조상 spy 주입 불가 — 행동(스냅샷 복원) 기준 검증" 명시. 장기적으로 fallback 로직 순수 함수 추출 시 직접 단위 테스트 가능 (plan W4) |
| W7 | 문서화 | `ALLOW_PRIVATE_HOST_TARGETS` 환경변수(SSRF 방어 전역 opt-out)가 `.env.example` 또는 운영 가이드에 미문서화. 보안 민감 설정이나 이번 diff에 설정 문서 업데이트 없음. | `.env.example`, 운영 가이드 (미변경) | `ALLOW_PRIVATE_HOST_TARGETS`를 환경변수 목록 문서에 "보안 SSRF opt-out — 프로덕션 사용 금지" 경고와 함께 명시. 이번 PR 차단 사유 아님, 기존 follow-up plan 추적 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | 보안 | `__dryRun` 플래그 외부 주입 가능 경로 감사 필요. dry-run은 SSRF 가드를 실행하지 않으므로 외부 사용자가 플래그를 직접 주입 가능하다면 우회 경로 열림. 본 PR 직접 취약점 아님. | `http-request.handler.spec.ts` lines ~251–280 | `context.variables.__dryRun` 설정 출처(API 핸들러, 플로우 실행 엔진 등) 감사. 외부 입력에서 신뢰 없이 전달되지 않는지 확인 |
| I2 | 보안 | `ALLOW_PRIVATE_HOST_TARGETS=true` 단일 플래그로 전 노드 SSRF 방어 전역 비활성화 — 프로덕션 오구성 시 단일 장애점(SPOF). 이전 세션(10_07_06) INFO-6에서도 지적. | `http-request.handler.spec.ts` lines ~219–247 | 서버 시작 시 `ALLOW_PRIVATE_HOST_TARGETS=true` 감지 시 WARN 레벨 로그 출력. CI 프로덕션 env 검증 게이트 추가 권장 |
| I3 | 보안 | `_retry_state.json`에 `/Volumes/project/private/clemvion/...` 형태 개발자 로컬 절대 경로 하드코딩. git 이력에 영구 노출. 이전 세션(10_07_06) INFO-7에서도 지적. | `review/code/2026/06/12/10_07_06/_retry_state.json` | 저장소 공개 가능성 있다면 `review/**/_retry_state.json` `.gitignore` 추가 또는 상대 경로 저장으로 생성 스크립트 수정 |
| I4 | 테스트 | SSRF 차단 테스트에 IPv6 bracket 형식(`http://[::1]/`) 및 percent-encoded IP 커버리지 갭 | `http-request.handler.spec.ts` lines 1034–1058 | `http-safety.ts` 또는 `assertSafeOutboundUrl` 직접 단위 테스트로 IPv6/encoded 케이스 커버. 현 spec에 최소 `http://[::1]/` 1케이스 추가 권장 |
| I5 | 테스트 | `configEcho credential strip` 테스트에서 `config.url ?? ''` 패턴이 `config.url === undefined`일 때도 통과 — credential strip 여부를 실질 검증하지 못할 수 있음 | `http-request.handler.spec.ts` lines 1123–1142 | `expect(result.config.url).toBeDefined()` 선행 단언 추가. 차단 경로에서 config.url 존재 여부 구현 확인 후 적용 |
| I6 | 테스트 | i18n 테스트 `toContain("SSRF")` 단언이 번역 문자열에 영문 "SSRF" 포함 의존. 번역 담당자가 "SSRF" 미포함 표현 사용 시 정확한 번역에도 테스트 깨짐 | `backend-labels.test.ts` lines 341–347 | `toContain("SSRF")` 유지하되 "ERROR_KO['HTTP_BLOCKED']에 'SSRF' 포함 필수" 의도 주석 명시. 번역 키 변경 시 테스트 동반 갱신 안내 |
| I7 | 유지보수성 | 테스트 네이밍 스타일 혼재 — 기존 `should ...` 접두 vs 신규 `reuses ...`, `falls back ...`, `does not spoof ...` 다양한 동사 혼용 | `code.handler.spec.ts` lines 36, 61, 75, 94, 120, 129 | `describe` 블록 내 기존 `should` 접두 규칙 준수 또는 PR 단위 스타일 가이드 명문화 |
| I8 | 유지보수성 | 반환값 타입 단언 `as unknown as { meta: { logs: string[] } }` 패턴이 4회 이상 반복. 반환 타입 변경 시 다수 위치 수동 수정 필요 | `code.handler.spec.ts` lines 62–68, 75–82, 94–106, 120–127 | 타입 단언 헬퍼 `asExecuteResult<T>` 함수 또는 타입 alias를 테스트 파일 상단에 선언 |
| I9 | 유지보수성 | isolate reuse 테스트 루프 매직 넘버 `5` — 의미 불명확, 주석은 있음 | `code.handler.spec.ts` line 44 | `const REUSE_ITERATIONS = 5;` 상수 추출 |
| I10 | 유지보수성 | `it.each` 테스트 레이블 세 번째 `(%s)` 자리표시자가 콜백 인자에서 무시됨 — 유지보수자 혼동 가능 | `http-request.handler.spec.ts` lines 193–217 | 세 번째 인자를 `_label`로 수신하거나 레이블에서 `(%s)` 제거하여 시그니처·레이블 일치 |
| I11 | 유지보수성 | dry-run 테스트의 `__workspaceId: 'ws-1'` 매직 문자열이 기존 `contextWithWorkspace` 픽스처와의 일치 여부 불명확 | `http-request.handler.spec.ts` lines 253–257 | `contextWithWorkspace.variables.__workspaceId` 참조 또는 기존 픽스처 스프레드 확장 |
| I12 | 테스트 | `classifyCodeNodeError(null)` 케이스가 두 테스트에서 중복 단언 — "does not spoof" 테스트의 핵심 의도 희석 | `code.handler.spec.ts` lines 120–135 | "does not spoof" 테스트를 `err=null, isolate=defined-but-not-disposed` 형태로 재표현하여 의도 명확화 |
| I13 | 테스트 | `console.warn`/`console.error` 캡처 테스트에서 `null`, `undefined`, `Error` 인스턴스, 순환참조 등 엣지 케이스 직렬화 미커버 | `code.handler.spec.ts` lines 61–73 | 낮은 우선순위. 필요 시 `console.log(null)`, `console.log(undefined)` 케이스 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | dry-run `__dryRun` 플래그 외부 주입 감사 필요(INFO), SSRF opt-out 단일 장애점(INFO), `_retry_state.json` 절대 경로 이력 노출(INFO) |
| requirement | LOW | SPEC-DRIFT 1건 — `spec/2-code.md §4 step2` 래퍼 표현식 구현 불일치(WARNING). 나머지 모든 요구사항 충족 |
| scope | NONE | 모든 변경이 plan 명시 후속 항목에 1:1 대응. 범위 이탈 없음 |
| side_effect | LOW | `process.env` 직접 변이(env-read-once 채택 시 false positive 위험, WARNING), `global.fetch` afterEach 복원 누락(WARNING) |
| maintainability | LOW | `makeService` setup 중복(WARNING), `process.env` 비관용 복원 패턴(WARNING), 타입 단언·매직 문자열 인라인 반복(INFO) |
| testing | LOW | `$vars` copy-out fallback isolated-vm API 의존 구조적 취약점(WARNING). 나머지 커버리지 갭은 INFO 수준 |
| documentation | LOW | `ALLOW_PRIVATE_HOST_TARGETS` 운영 문서 미반영(WARNING, 기존 follow-up 추적 중). W14 주석 수정·테스트 인라인 주석 품질 양호 |

---

## 발견 없는 에이전트

없음 (전 에이전트 발견사항 있음, scope는 NONE 위험도이나 INFO 항목 기록됨).

---

## 권장 조치사항

1. **[SPEC-DRIFT, W1]** `spec/4-nodes/5-data/2-code.md §4 step2` 래퍼 표현식을 2단 구조(`outer IIFE + inner __user arrow`)로 갱신 또는 "개념 요약 — 실제 구조는 §4 아래 노트 참조" 주석 추가. project-planner 위임. (코드 변경 불필요)
2. **[W2/W5]** `http-request.handler.spec.ts`의 `process.env.ALLOW_PRIVATE_HOST_TARGETS` 변이를 `jest.replaceProperty` 패턴으로 교체하여 Jest 관용 복원 방식으로 전환.
3. **[W3]** `http-request.handler.spec.ts` 신규 dry-run 테스트에 `afterEach(() => { jest.restoreAllMocks(); })` 추가 또는 `jest.spyOn(globalThis, 'fetch')` 패턴 전환.
4. **[W4]** 신규 테스트 4건의 인라인 `makeService` + `new HttpRequestHandler` setup을 `beforeEach` 또는 `describe` 공유 변수로 추출.
5. **[W6]** `$vars` copy-out fallback 테스트 주석에 "catch 분기 실행 여부는 spy 주입 불가 — 행동 기준 검증" 명시. 장기 follow-up으로 fallback 로직 순수 함수 추출 plan 기록.
6. **[W7]** `ALLOW_PRIVATE_HOST_TARGETS`를 `.env.example` 또는 운영 가이드에 "SSRF opt-out — 프로덕션 사용 금지" 경고와 함께 문서화 (기존 follow-up plan 항목으로 추적).
7. **[I4]** SSRF 차단 테스트에 IPv6 bracket 형식(`http://[::1]/`) 케이스 1건 이상 추가. 또는 `assertSafeOutboundUrl` 직접 단위 테스트에서 커버.
8. **[I5]** `configEcho credential strip` 테스트에 `expect(result.config.url).toBeDefined()` 선행 단언 추가하여 `undefined` 우회 방지.
9. **[I2]** 서버 시작 시 `ALLOW_PRIVATE_HOST_TARGETS=true` 감지 시 WARN 레벨 로그 출력 추가 고려. CI 프로덕션 env 검증 게이트 추가 권장.
10. **[I3]** `review/**/_retry_state.json`을 `.gitignore`에 추가하거나 생성 스크립트를 상대 경로 저장으로 수정 (저장소 공개 가능성 있을 경우).

---

## 라우터 결정

라우터 선별 실행:

- **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명, 전원 router_safety 강제 포함)
- **제외**: performance, architecture, dependency, database, concurrency, api_contract, user_guide_sync (7명)
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 테스트 코드 추가·주석 수정 변경 — 성능 관련 운영 코드 변경 없음 |
| architecture | 구조적 아키텍처 변경 없는 테스트 보강 PR |
| dependency | 신규 의존성 추가 없음 |
| database | DB 관련 변경 없음 |
| concurrency | 동시성 관련 운영 코드 변경 없음 |
| api_contract | API 계약 변경 없음 (테스트 전용 변경) |
| user_guide_sync | 사용자 가이드 동기화 불필요한 테스트·주석 변경 |