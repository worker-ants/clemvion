# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 없음. `DEFAULT_SENSITIVE_KEYS`(token 계열 8종) 확장의 blast-radius 측정이 정적 스키마 필드명 grep 에 한정돼, HTTP Request/Send Email 노드의 `headers`/`body` 안 사용자 정의 동적 키(예: `id_token`, `csrfToken`)라는 실제 위험 벡터를 원천적으로 검증하지 못한다는 WARNING 1건이 핵심. 마스킹 방향은 과다(안전) 쪽이라 보안 사고는 아니나 기능 회귀(정상 워크플로가 마스킹으로 깨질) 가능성이 이전 라운드 대비 재확인됐다. 나머지 3개 reviewer(testing/maintainability/documentation)는 이전 라운드(`16_46_56`) WARNING 이 실제로 해소됐음을 코드/뮤테이션 재현으로 직접 확인했고 추가 WARNING/Critical 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect | `DEFAULT_SENSITIVE_KEYS`(token 계열 8종) blast-radius "0건" 측정이 정적 코드(node 스키마 필드명) grep 에 한정돼, HTTP Request/Send Email 노드의 `headers`/`body` 안 **사용자 정의 동적 키**(`id_token`/`csrfToken`/`auth_token` 등)를 원천적으로 검증하지 못한다. `handler-output.adapter.ts` 를 통해 workflow-assistant 범위를 넘어 전체 노드 실행 엔진의 `config` 영속·WS emit·표현식 echo 에 적용되는 공유 상수라 파급이 넓다 | `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts:21-38` → `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:36` → `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:178-191`, `.../send-email/send-email.handler.ts:115` | 방향은 과다 마스킹(안전)이라 보안 사고는 아니나, (a) `config` 가 다운스트림 표현식에서 실제로 읽히는 사례가 있는지(프로덕션 표본/e2e) 확인하거나 (b) 어렵다면 최소한 "정적 grep 으로 이 리스크가 닫히지 않는다"는 사실을 `mask-sensitive-fields.util.ts` 주석과 관련 plan 트래커에 명시적으로 남길 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | "키 먼저, 값 나중" 순서 불변식이 전용 캐너리 없이 부수적으로만 커버됨(순서 반전 뮤테이션 시 18개 중 2개만 RED) | `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:92` | 필수 아님. 여유 시 순서 전용 최소 재현 테스트 1건 추가 |
| 2 | testing | 값 축 캐너리가 `error` 필드에만 있고 `inputData`/`outputData` 자유 텍스트 값에 대한 직접 캐너리는 없음 | `explore-tools.service.spec.ts:534-564` | 필수 아님. 여유 시 `inputData`/`outputData` 각각 값-축 캐너리 1건씩 추가 |
| 3 | maintainability | 같은 PR 안에서 token 계열 8종 회귀 테스트 커버리지가 두 소비처(`mask-sensitive-fields.util.spec.ts` 8종 전부 vs `handler-output.adapter.spec.ts` 5종만) 사이에 비대칭 | `codebase/backend/src/modules/execution-engine/handler-output.adapter.spec.ts:97-102` | `it.each` 목록을 유틸 스펙과 동일한 8개로 맞추고, 가능하면 두 파일이 같은 상수 배열을 참조하게 해 드리프트를 구조적으로 방지 |
| 4 | maintainability | 내부 컴포즈 함수 `both` 가 여전히 "무엇의 양쪽인지"를 이름만으로 드러내지 않음(이전 라운드부터 의도적 미조치) | `explore-tools.service.ts:92` | 조치 불요(기존 결정 유지). 다음에 손댈 때 `redactLayered` 류 이름 고려 |
| 5 | documentation | LLM 도구 설명 문자열(`tool-definitions.ts`, `system-prompt.ts`)이 값-패턴 축 마스킹을 반영하지 않음(이전 라운드 RESOLUTION 에서 "과다 마스킹 방향이라 안전"으로 명시적 미조치) | `codebase/backend/src/modules/workflow-assistant/tools/tool-definitions.ts:170`, `.../prompts/system-prompt.ts:234` | 처분 유지에 동의. 필수 아님 |
| 6 | documentation | `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1 의 `egress-masking.md` 참조가 평문이고 마크다운 링크가 아님 | `spec/3-workflow-editor/4-ai-assistant.md:259` | 급하지 않음. `[Egress 마스킹 좌표계](../conventions/egress-masking.md)` 형태로 링크화 가능 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| side_effect | MEDIUM | `DEFAULT_SENSITIVE_KEYS` blast-radius 측정 방법론이 동적 사용자 키(HTTP/Email 노드 headers/body)를 원천적으로 못 봄(WARNING). 나머지는 확인 완료(INFO, 문제 없음) |
| testing | LOW | 이전 라운드 유일 실질 갭(자매 표면 자기 테스트 부재)이 `it.each`+뮤테이션 재현(5 RED)으로 해소 확인. 순서/값-축 캐너리 커버리지 소소한 INFO 2건 |
| maintainability | LOW | 이전 WARNING(JSDoc 배치) 해소 확인. 신규 헬퍼가 기존 3중 중복 축소. 테스트 커버리지 비대칭·네이밍 INFO 2건 |
| documentation | NONE | 이전 WARNING(CHANGELOG 누락) 상호참조까지 갖춰 해소, JSDoc 배치 WARNING 도 해소. spec 4곳 동기화 유지. 유예된 INFO 2건만 재확인 |

## 발견 없는 에이전트

없음(모든 에이전트가 최소 1건 이상의 INFO/WARNING 기록, 단 documentation 은 위험도 NONE).

## 권장 조치사항
1. (선택, 권장) `DEFAULT_SENSITIVE_KEYS` blast-radius 리스크의 사각지대(동적 사용자 키)를 코드 주석·plan 트래커에 명시해 향후 오판을 방지하거나, 실사용 표본/e2e 로 실제 파급 여부를 확인한다.
2. (선택) `handler-output.adapter.spec.ts` 의 token 계열 `it.each` 를 `mask-sensitive-fields.util.spec.ts` 와 동일한 8개 키 세트로 맞추고 공유 상수로 드리프트를 구조적으로 방지한다.
3. (선택, 급하지 않음) 나머지 INFO 6건은 모두 필수 조치가 아니며 기존 결정 유지 또는 여유 시 경량 개선으로 남긴다.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용. 강제 화이트리스트(router_safety) `documentation, maintainability, side_effect, testing` 전원 실행, 4명 전원 결과 확보됨(누락 없음).