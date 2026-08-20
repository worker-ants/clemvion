# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 1건은 실 코드 결함이 아니라 plan/RESOLUTION 문서에 남은 "뮤테이션 검증 RED 개수" 서술이 재현되지 않는 테스트-증거 신뢰성 문제. 나머지는 전부 INFO(완결성/일관성 개선 여지) 또는 확인 완료(문제 없음). forced reviewer 7명(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | plan/RESOLUTION 이 주장하는 "뮤테이션 검증 키 축 6 RED"가 직전 커밋의 실제 정규식으로 재현되지 않는다 — `x-auth-token`은 직전 커밋(`45ba37792~1`)의 `x[_-]auth[_-]?token` 대안이 이미 커버해 되돌려도 GREEN이며, 실측은 `id_token`/`csrf_token`/`csrfToken`/`session_token` + 캐너리 `nextPageToken` = **정확히 5 RED**다. 이 PR은 이 수치를 "8→5→6"으로 세 차례 정정하며 앞선 리뷰어의 정확한 값(5)을 오히려 "틀렸다"고 재정정했다 | `plan/in-progress/eia-secret-pattern-token-family.md:126-130,142`, `review/code/2026/08/17/14_00_15/RESOLUTION.md:64-67` | plan 문서의 "키 축 6 RED"를 "키 축 5 RED(`x-auth-token`은 직전 커밋에서 이미 커버돼 회귀 대상 아님)"로 정정하고, RESOLUTION.md의 "리뷰어는 x-auth-token을 빠뜨렸다" 서술도 함께 정정. 재현 시 `git show <SHA>:<path>` 출력을 그대로 사용해 손 재입력 오류를 배제할 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | `maskSensitiveFields`(`DEFAULT_SENSITIVE_KEYS`)는 이번 diff 범위 밖으로 키 축에서 여전히 `token` 접두 계열을 평문 통과시킴 — 별도 트래커에서 추적 중인 기존(alreay-known) 노출, 이번 diff의 회귀 아님 | `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md:247-253` | 조치 불요(별도 트래커) |
| 2 | security | WS↔공용 `CREDENTIAL_KEY_PATTERN`의 `x-api-key` 비대칭 — 이전부터 있던 의도된 설계, 이번 diff는 문서화만 보강 | `websocket.service.ts:73`, `sanitize-error-message.ts:104` | 조치 불요 |
| 3 | security | 받아들인 오탐 — 불투명 커서(`nextPageToken` 등)도 `token` 접미 패턴에 걸려 마스킹됨. 보안 방향으로만 작용하는 트레이드오프, DB 원문 보존이라 기능 저하 아님 | `sanitize-error-message.ts:98-101`, `sanitize-error-message.spec.ts:408-418` | 조치 불요(캐너리로 고정됨) |
| 4 | requirement | ReDoS 회귀를 고정하는 자동 벤치마크(서브프로세스+timeout)가 커밋되지 않음 — 패턴이 단일 `*`+리터럴 구조라 회귀 위험 낮음, 라운드 내 명시적으로 유예된 선택 사항 | `sanitize-error-message.ts` `SECRET_LEAK_PATTERNS` | 조치 불요(유예 결정). 향후 정규식에 정량자 추가 시 캐너리 고려 |
| 5 | scope / side_effect / documentation | 이전 리뷰(`14_00_15` code-review, `13_31_57`/`14_00_50` consistency-check) 산출물 26개 파일과 review-fix 커밋이 이번 diff에 함께 커밋됨 — CLAUDE.md가 규정한 "구현 완료 후 자동 review/fix는 상시 승인된 강제 의무" 워크플로의 정상 산출물이며, `RESOLUTION.md`가 주장하는 WARNING 5건+consistency WARNING 1건+INFO 3건 처분 내역과 라인 단위로 1:1 대응 확인(몰래 끼워 넣은 추가 변경 없음) | `review/code/2026/08/17/14_00_15/**`, `review/consistency/2026/08/17/{13_31_57,14_00_50}/**` | 조치 불요 |
| 6 | scope | `mcp-error-codes.ts` 흡수 + spec 문서 정정 3건(`hmacAlgorithm` 출처·§11 `execution.stop` 각주·§2.2 인증 family)이 리터럴 티켓 범위 밖으로 보이나 plan 최초 작성 시점부터 "곁들이는 저비용 문서 3건"으로 명시 선언되고 트래커로 추적됨 | `spec/5-system/14-external-interaction-api.md`, `spec/5-system/2-api-convention.md`, `mcp-error-codes.ts` | 조치 불요 |
| 7 | side_effect / documentation | `MCP_EXTRA_SECRET_PATTERNS`가 빈 배열이 되어 `redactMcpSecrets`의 첫 for 루프가 상시 no-op — 공용 `SECRET_LEAK_PATTERNS`가 상위집합으로 흡수함을 8건 GREEN으로 검증됨, JSDoc이 훅 유지 이유를 선언부에는 명시하나 소비 루프 지점에는 참조 주석이 없어 함수 본문만 보면 죽은 코드로 오인 가능 | `mcp-error-codes.ts` 선언부(39-53행) vs 소비 루프(72-81행) | 조치 불요. 향후 정리 시 소비 루프에 "위 JSDoc 참조 — 현재 no-op, 훅 유지" 주석 한 줄 추가 고려 |
| 8 | maintainability / testing | "미러" 관계인 두 회귀 테스트 파일이 같은 `token` 계열 커버리지를 서로 다른 스타일로 작성 — `sanitize-error-message.spec.ts`는 공유 `FAMILY` 배열+`it.each`(8개 독립 테스트, 실패 시 어떤 멤버인지 즉시 식별), `websocket.service.spec.ts`는 단일 객체 리터럴+for-loop(첫 실패에서 루프 중단, 나머지 키의 안전 여부 미관측). 두 목록은 SoT 공유 없이 각 파일에 독립 하드코딩돼 있어 다음 계열 확장 시 한쪽만 갱신되는 드리프트 위험도 있음(이번 PR이 고친 결함 자체가 "미러 중 하나만 갱신됨" 클래스였음) | `sanitize-error-message.spec.ts:368-378`, `websocket.service.spec.ts:119-158` | 필수 아님. 공유 fixture(예: `test/fixtures/credential-key-family.ts`)로 `FAMILY` 추출 + `websocket.service.spec.ts`도 `it.each`로 전환 고려 |
| 9 | testing | 대문자 전용 형태(`TOKEN=`, `CSRF_TOKEN`)에 대한 명시적 회귀 캐너리가 없음 — `/i` 플래그로 코드 검토상 안전하나 이 자체를 못박는 테스트가 없어 플래그 누락 회귀를 즉시 못 잡음 | `sanitize-error-message.spec.ts:368-378` (`FAMILY` 전부 소문자/카멜케이스) | 필수 아님. `TOKEN=sk-live-abc123` 류 대문자 캐너리 1건 추가 고려 |
| 10 | side_effect | 공유 정규식 SoT(`SECRET_LEAK_PATTERNS`, `CREDENTIAL_KEY_PATTERN` ×2 미러)를 넓히는 편집이라 다수 egress 소비자(WS emit·스레드 렌더러·종결 에러 페이로드·MCP 에러·execution-engine 알림)의 마스킹 출력이 동시에 변경됨 — 의도된 목적이며 이전 라운드가 이미 포착, 427 suites 실측+뮤테이션+캐너리로 뒷받침 | `sanitize-error-message.ts:42,104`, `websocket.service.ts:78` | 조치 불요. 향후 재확장 시 전수 소비자 재확인 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | `token` 계열 값·키 패턴 마스킹 누락을 정확히 닫음. ReDoS 없음(직접 벤치마크 재확인). 잔여는 전부 기존/의도된 INFO |
| requirement | LOW | 핵심 기능·spec·회귀 테스트 전부 독립 재실행으로 재확인(124 tests GREEN, 뮤테이션 2 RED). 유일 갭은 선택적 벤치마크 자동화 미비 |
| scope | NONE | 39개 변경 파일 전부 프롬프트와 일치, review-fix 커밋 내역이 RESOLUTION.md 처분과 라인 단위 1:1 대응. 스코프 이탈 없음 |
| side_effect | LOW | 함수 시그니처·전역 상태·환경변수·네트워크·이벤트 계약 전부 불변. 유일한 실질 축은 의도된 공유 정규식 SoT 확장의 blast radius(이미 알려짐) |
| maintainability | LOW | 실질 코드 변경은 저위험(정규식 상수 교체, 배열 비우기, JSDoc/테스트 확장). 이전 라운드 WARNING/INFO 전부 반영 확인. 잔여는 미러 테스트 스타일 불일치 1건 |
| testing | WARNING | 프로덕션 정규식·신규 회귀 테스트 자체는 기능적으로 올바름. 다만 plan/RESOLUTION의 "뮤테이션 검증 6 RED" 수치가 이번에도(세 번째로) 재현 안 됨(실측 5 RED) — 테스트-증거 신뢰성 문제 |
| documentation | NONE | JSDoc 자기모순·CHANGELOG 누락·plan drift·spec 캐비엇 등 이전 WARNING 전부 소스에서 직접 재검증 완료. 신규 문서화 결함 없음 |

## 발견 없는 에이전트

없음 (7개 에이전트 모두 최소 INFO 이상 발견 보유; CRITICAL/WARNING 없이 NONE으로 종결한 에이전트는 security·scope·documentation).

## 권장 조치사항
1. `plan/in-progress/eia-secret-pattern-token-family.md:126-130,142`와 `review/code/2026/08/17/14_00_15/RESOLUTION.md:64-67`의 "키 축 6 RED / x-auth-token 회귀" 서술을 실측값(5 RED, `x-auth-token`은 직전 커밋에서 이미 커버돼 회귀 대상 아님)으로 정정한다. (WARNING 1 — 유일한 비차단 필수 조치)
2. (선택) `websocket.service.spec.ts`의 키-축 회귀 테스트를 `it.each` 기반으로 전환하고, 두 미러 스펙 파일의 `FAMILY` fixture를 공유 상수로 추출해 향후 계열 확장 시 드리프트를 구조적으로 차단한다.
3. (선택) 대문자 전용 키/값(`TOKEN=`, `CSRF_TOKEN`) 회귀 캐너리 1건과, MCP `MCP_EXTRA_SECRET_PATTERNS` 소비 루프 지점에 "no-op, 훅 유지" 주석 한 줄을 추가해 완결성을 높인다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(정규식 상수 확장·JSDoc·테스트·문서)와 무관 |
  | architecture | router 판단상 이번 diff와 무관 |
  | dependency | router 판단상 이번 diff와 무관(의존성 변경 없음) |
  | database | router 판단상 이번 diff와 무관(DB 스키마/쿼리 변경 없음) |
  | concurrency | router 판단상 이번 diff와 무관(동시성 로직 변경 없음) |
  | api_contract | router 판단상 이번 diff와 무관(공개 API 계약 변경 없음) |
  | user_guide_sync | router 판단상 이번 diff와 무관(사용자 가이드 대상 아님) |
