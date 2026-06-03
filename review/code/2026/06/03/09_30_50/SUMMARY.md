# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — i18n 동반 갱신 누락(LABEL_KO/HINT_KO) 2건이 UI에 즉각 영향을 주며, 보안/요구사항/유지보수성 경고가 복수 존재. 기능 오동작이나 데이터 손실 위험은 없으나 출시 전 처리 권장.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| — | — | 해당 없음 | — | — |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | i18n / User Guide Sync | `"Timeout (sec)"` — `LABEL_KO` 매핑 누락. 프론트엔드 노드 설정 UI에 한국어 번역 없이 영문 노출 | `code.schema.ts` ui.label / `frontend/src/lib/i18n/backend-labels.ts` | `LABEL_KO`에 `"Timeout (sec)": "타임아웃(초)"` 추가 |
| 2 | i18n / User Guide Sync | `code` 필드 hint 문자열 변경 — `HINT_KO` 신규 키 미등록, 구 키 orphan | `code.schema.ts` / `backend-labels.ts` HINT_KO | 구 키 제거 + 신규 키 `"Use return to produce output. $input, $vars, $execution, $node, $helpers are injected."` 한국어 매핑 추가 |
| 3 | 보안 | `$helpers.crypto.hash` — `algorithm` 인자 화이트리스트 없음. 유효하지 않은 알고리즘 전달 시 OpenSSL 내부 오류 메시지 노출 우려 | `code.handler.ts` `buildHelpers()` `crypto.hash` | `ALLOWED_HASH_ALGORITHMS` Set으로 화이트리스트 제한, 목록 외 값은 즉시 `throw new Error('Unsupported hash algorithm')` |
| 4 | 보안 | 스택 트레이스 — `NODE_ENV !== 'production'` 조건으로 `output.error.details.stack` 노출. 스테이징이 development로 운영될 경우 외부 접근 가능 엔드포인트에서 내부 경로 정보 유출 가능 | `code.handler.ts` `failure()` 메서드 | API 레이어에서 stack 필드 필터링 확인 또는 `EXPOSE_STACK=true` 명시 플래그로 변경 |
| 5 | 보안 | `$helpers.crypto.hash` — `data` 인자 타입 가드 없음. 런타임에 객체/숫자 전달 시 예상치 못한 동작 | `code.handler.ts` `buildHelpers()` | 진입부에서 `typeof data !== 'string'` 가드 추가 |
| 6 | 요구사항 | `meta.durationMs` 누락 — spec §5.1/§5.3 `handler return` 필드로 표기됨. 코드에 측정 로직 없음. spec의 "engine inject"/"handler return" 이중 표기 충돌 | `code.handler.ts` `execute()` 성공 반환값 및 `failure()` | spec §5.1 출처 컬럼 확정 후 handler 또는 engine 중 한 곳에서 구현 |
| 7 | 요구사항 | `$helpers.base64.decode` — UTF-8 외 반환 타입 spec 미정의. 이진 데이터 디코딩 시 데이터 손실 발생하나 사용자에게 지원 범위 불명확 | `code.handler.ts` `buildHelpers()` | spec §2.2에 "반환 타입은 UTF-8 string, 이진 데이터 사용은 지원 범위 외" 명시 |
| 8 | 유지보수성 | 에러 코드 리터럴(`'EXECUTION_TIMEOUT'`, `'ERR_SCRIPT_EXECUTION_TIMEOUT'`, `'CODE_RUNTIME_ERROR'`)이 `execute()` 2곳과 `failure()` 정규화 분기에 분산. 변경 시 누락 위험 | `code.handler.ts` L205, L214, L247–249, L281–286 | 파일 상단에 `const ERR = { ... } as const` 열거 상수 선언 |
| 9 | 유지보수성 / 아키텍처 | `buildHelpers()` 반환 타입이 `Record<string, unknown>` — 내부 API 구조가 타입 시스템에서 소실 | `code.handler.ts` L43 | `interface HelpersApi { date; crypto; base64 }` 선언 후 반환 타입 강화 |
| 10 | 유지보수성 | config 에코 블록(`{ code, language, timeout }`)이 성공 경로와 `failure()` 내에서 중복 구성 | `code.handler.ts` L236–240, L292–296 | `buildEchoConfig()` 순수 함수로 분리 |
| 11 | API 계약 | `timeout` 범위 검증 책임 분산 — zod 스키마(타입만)와 `validateCodeConfig`(실제 범위 강제)로 나뉨. 미래 개발자 혼선 가능성 | `code.schema.ts` 전체 | `validateCodeConfig` 호출 경로를 통합 테스트로 커버하거나 zod `.superRefine()`으로 통합 |
| 12 | 테스트 | `$helpers` host realm 보안 격리 테스트 부재. dayjs 반환 객체를 통한 host prototype 접근 가능성 미검증 | `code.handler.spec.ts` | `execute — security restrictions` describe에 dayjs constructor 노출 여부 검증 케이스 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능 | `buildHelpers()`가 매 `execute()` 호출마다 새 객체 생성. 클로저는 무상태이므로 모듈 상수로 추출 가능 | `code.handler.ts` L23–43 | `const SANDBOX_HELPERS = buildHelpers()` 모듈 상수화 |
| 2 | 성능 | `validate()`와 `execute()`에서 동일 code를 `vm.Script`로 2회 컴파일 (V8 파싱 중복) | `code.handler.ts` L149–155, L188–193 | 중장기: 컴파일된 Script를 cache key로 보관 후 재사용 |
| 3 | 성능 | `deepClone(context.variables)` — JSON 직렬화/역직렬화. `Date`/`undefined`/`Map` 타입 소리없이 손실 | `code.handler.ts` L170 | `structuredClone()` 교체 고려 또는 variables 크기 상한 문서화 |
| 4 | 아키텍처 | timeout 상수(`1`, `120`)가 zod `.meta()` ui hint와 `validateCodeConfig` 두 곳에 리터럴 중복 | `code.schema.ts` | `MIN_TIMEOUT_SEC`/`MAX_TIMEOUT_SEC` 상수를 상단으로 추출, 양쪽에서 참조 |
| 5 | 아키텍처 | `buildSandbox` 파라미터가 `execMeta`, `nodeMeta`로 점진 확장 중. context 슬라이스 추가 시마다 파라미터 증가 | `code.handler.ts` L66–68 | `interface SandboxContextMeta { execMeta; nodeMeta }` Parameter Object 패턴으로 통합 |
| 6 | 아키텍처 | `DEFAULT_TIMEOUT_SEC = 30`이 `code.handler.ts`와 `code.schema.ts` `.default(30)` 두 곳에 독립 선언 | `code.handler.ts` L13, `code.schema.ts` L61 | schema에서 상수 export 후 handler가 참조하거나 주석으로 역할 명시 |
| 7 | 요구사항 | `$helpers.crypto.hash` — 허용 알고리즘 목록 spec 미정의. spec §2.2 침묵 | spec §2.2 | spec §2.2에 허용 알고리즘 목록 또는 에러 처리 규칙 명시 (project-planner 영역) |
| 8 | 요구사항 | `$helpers.date(value)` — `value` 생략 시 현재 시각 반환 동작 spec 미문서화 | spec §2.2 | `$helpers.date(value?)` 로 옵셔널 표기 변경 + 생략 시 현재 시각 명시 (project-planner 영역) |
| 9 | 테스트 | `$helpers.crypto.hash` — 유효하지 않은 알고리즘 에러 경로(`CODE_EXECUTION_FAILED`) 검증 테스트 없음 | `code.handler.spec.ts` | `md9` 등 무효 알고리즘에 대한 에러 포트 라우팅 테스트 추가 |
| 10 | 테스트 | `$helpers.base64.decode` — 잘못된 Base64 입력의 silent-failure 동작 미검증 | `code.handler.spec.ts` | 유효하지 않은 Base64 입력 케이스 추가 |
| 11 | 테스트 | `$helpers.date` — invalid date 입력 시 `isValid() === false` 동작 미검증 | `code.handler.spec.ts` | `$helpers.date("invalid")` 케이스 추가 |
| 12 | 테스트 | `$node` fallback 테스트에서 `beforeEach` 의존 묵시적 전제. `nodeId`/`nodeLabel` 부재가 테스트 조건임을 코드로 불명확 | `code.handler.spec.ts` L71–79 | `delete (context as any).nodeId` 명시 또는 guard 주석 보강 |
| 13 | 보안 | `$helpers.base64.decode` — 잘못된 Base64/비-UTF-8 입력 시 replacement character 포함 결과 반환. 오류 미발생 | `code.handler.ts` `buildHelpers()` | JSDoc으로 silent-failure 동작 명시 |
| 14 | 보안 | Symbol 셰도잉(`undefined`) — well-known Symbol 접근 불가는 의도된 제한. `$helpers` 반환 객체가 Symbol 속성 미포함임을 테스트/문서화 권장 | `code.handler.ts` `buildSandbox()` | 필요 시 테스트로 명시 |
| 15 | API 계약 | `output.error.details.legacyCode` — 내부 코드(`EXECUTION_TIMEOUT`, `CODE_RUNTIME_ERROR`) 외부 노출. 클라이언트가 파싱 시 계약 위반 위험 | `code.handler.ts` `failure()` | "내부 디버그 전용, 파싱 금지" 문서화 또는 별도 이슈 등록 |
| 16 | 문서화 | `buildSandbox` — 신규 `nodeMeta` 파라미터 설명 없음 | `code.handler.ts` 시그니처 | 한 줄 주석으로 "current node identity injected as `$node`" 기술 |
| 17 | 문서화 | `code.schema.ts` timeout 필드 — zod `.min/.max` 미사용 이유 주석에서 완전 설명 부재 | `code.schema.ts` L1326–1329 | "왜 zod .min/.max 아닌 validateCodeConfig: 커스텀 에러 메시지 단일 처리" 한 줄 추가 |
| 18 | 문서화 | 테스트 describe 블록 — 신규 `spec §2.1`/`§2.2` 참조 표기 있으나 기존 블록에는 없어 스타일 불일치 | `code.handler.spec.ts` | 기존 describe 블록에 spec 섹션 번호 점진 추가 (이번 PR 범위 밖) |
| 19 | 변경 범위 | 전체 4개 파일 — 커밋 의도 범위 내 수정만 확인됨. 무관한 파일 수정 없음 | — | 없음 |
| 20 | 동시성 | `$vars` 원자적 교체, logs 배열 호출 스코프 격리, Promise.race finally clearTimeout 모두 정상 | `code.handler.ts` | 현행 유지 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | crypto.hash 알고리즘 무검증(OpenSSL 내부 오류 노출), 스택 트레이스 비-production 노출 경로 미확인 |
| user_guide_sync | MEDIUM | LABEL_KO `"Timeout (sec)"` 누락, HINT_KO 구 키 orphan + 신규 키 미등록 (UI 즉각 영향) |
| requirement | LOW | `meta.durationMs` 누락 (spec 이중 표기 충돌), `base64.decode` 반환 타입 spec 미정의 |
| maintainability | LOW | 에러 코드 리터럴 분산, config 에코 객체 중복, `buildHelpers()` 반환 타입 과다 광범위 |
| architecture | LOW | `buildHelpers()` 반환 타입 `Record<string, unknown>` 구조 소실, timeout 상수 중복 |
| api_contract | LOW | timeout 검증 분산 구조, `legacyCode` 내부 코드 노출 |
| performance | LOW | `buildHelpers()` 매 호출 재생성, vm.Script 이중 컴파일 |
| testing | LOW | host realm 보안 격리 테스트 부재, error-path 케이스 누락 |
| side_effect | LOW | 모든 변경이 설계 의도 내. 하위 호환 유지 확인 |
| concurrency | NONE | $vars 원자적 교체, Promise.race 타이머 정리, logs 격리 모두 정상 |
| documentation | NONE | 문서화 품질 양호. CRITICAL/WARNING 누락 없음 |
| scope | NONE | 커밋 범위 내 수정만 확인. 범위 이탈 없음 |

## 발견 없는 에이전트

- **concurrency**: 동시성 위험 요소 없음. Promise.race 패턴, $vars 원자적 교체, logs 격리 모두 올바름.
- **documentation**: CRITICAL/WARNING 수준 문서 누락 없음. spec 문서와 구현 간 불일치 없음.
- **scope**: 커밋 메시지 범위 내 수정만 확인. 무관 파일 수정, 불필요 리팩토링 없음.

## 권장 조치사항

1. **[즉시] i18n 동반 갱신** — `backend-labels.ts`의 `LABEL_KO`에 `"Timeout (sec)": "타임아웃(초)"` 추가, `HINT_KO`에서 구 hint 키 제거 + 신규 hint 한국어 매핑 추가. UI 즉각 영향이며 `ui-label-parity.test.ts` 가드 실패 가능성 있음.
2. **[권장] crypto.hash 알고리즘 화이트리스트** — `ALLOWED_HASH_ALGORITHMS` Set 도입, 목록 외 알고리즘 즉시 throw. `data` 인자 타입 가드도 함께 추가.
3. **[권장] 스택 트레이스 노출 정책 확인** — API 레이어에서 `output.error.details.stack` 클라이언트 응답 필터링 여부 검증 또는 명시적 `EXPOSE_STACK` 플래그로 변경.
4. **[권장] `meta.durationMs` 책임 소재 확정** — spec §5.1 `출처` 컬럼 "engine inject"/"handler return" 이중 표기 충돌을 project-planner에서 확정 후 구현.
5. **[권장] 에러 코드 상수화** — `const ERR = { EXECUTION_TIMEOUT, VM_TIMEOUT, RUNTIME } as const` 파일 상단 선언으로 분산 리터럴 통합.
6. **[권장] `HelpersApi` 인터페이스 선언** — `buildHelpers()` 반환 타입을 `Record<string, unknown>`에서 구체 인터페이스로 강화.
7. **[선택] 테스트 보강** — host realm 격리(dayjs constructor 접근 테스트), `$helpers` error-path(무효 알고리즘, 잘못된 Base64), `$helpers.date` invalid date 케이스 추가.
8. **[선택] spec 문서 갱신 (project-planner)** — `$helpers.date(value?)` 옵셔널 표기, `base64.decode` 반환 타입 UTF-8 명시, `$helpers.crypto.hash` 허용 알고리즘 목록 추가.
9. **[선택] `buildEchoConfig()` 추출** — 성공/실패 경로의 config 에코 객체 중복 제거.

## 라우터 결정

라우터 `routing_status=done` — 선별 실행:

**실행** (12명): `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `concurrency`, `api_contract`, `user_guide_sync`

**강제 포함(router_safety)** (6명): `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`

**제외** (2명):

| 제외된 reviewer | 이유 |
|-----------------|------|
| dependency | 라우터 선별 제외 |
| database | 라우터 선별 제외 |