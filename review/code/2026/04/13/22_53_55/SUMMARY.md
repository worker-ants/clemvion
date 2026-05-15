# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능 구현은 요구사항을 충족하나, 리팩터링 후 정리되지 않은 Dead Code와 타입 불일치가 코드 품질 부채로 남아 있음

## Critical 발견사항

없음

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 코드 품질 | `WARNING` 상수 및 `if (!result) return { ...WARNING }` 분기가 Dead Code로 전락. 모든 formatter가 `warning(detail)`을 직접 반환하도록 변경되어 fallback 경로가 실행될 수 없음. 향후 `carouselSummary`에 null 반환 경로가 추가될 경우 구 메시지 `"⚠ Not configured"`가 유출될 위험 | `node-config-summary.ts:36` 및 `getConfigSummary` 내 fallback 분기 | `WARNING` 상수 및 fallback 분기 제거. `carouselSummary` 반환 타입을 `ConfigSummaryResult`로 통일한 후 `FORMATTERS` 레지스트리 타입도 `| null` 제거 |
| 2 | 타입 안전성 | `carouselSummary`만 `ConfigSummaryResult \| null` 반환 타입 유지. 함수 구현상 null을 반환하는 경로가 없으나 타입 선언이 실제 동작을 반영하지 않아 `FORMATTERS` 레지스트리 타입 전체를 느슨하게 유지시킴 | `node-config-summary.ts` — `carouselSummary` 함수 시그니처 | 반환 타입을 `ConfigSummaryResult`로 좁히고, `FORMATTERS` 레지스트리 타입을 `Record<string, (config: NodeConfig) => ConfigSummaryResult>`로 갱신 |
| 3 | 타입 안전성 | `FORMATTERS` 레지스트리 타입 선언(`\| null` 포함)과 실제 formatter 함수 시그니처(non-null) 불일치. 타입만 보고 로직을 추론할 때 null 반환 가능성을 오해할 수 있음 | `node-config-summary.ts` — `FORMATTERS` 선언부 | `carouselSummary` 정리 후 레지스트리 타입을 `Record<string, (config: NodeConfig) => ConfigSummaryResult>`로 통일 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 커버리지 | `merge` 노드의 `inputCount: 0` 경계값 테스트 누락. `typeof config.inputCount === "number"` 조건은 `0`을 통과시키므로 `"0 inputs · wait_all"` 반환이 의도된 동작인지 불분명 | `node-config-summary.test.ts` — `merge summary` describe | `inputCount: 0` 케이스 명시적 테스트 추가 또는 `> 0` 가드 구현 |
| 2 | 테스트 커버리지 | `text_classifier` 노드의 `llmConfigId` 단독 설정 케이스 테스트 누락. `ai_agent`, `information_extractor`는 동일한 케이스가 있으나 `text_classifier`에는 없음 | `node-config-summary.test.ts` — `text_classifier summary` 섹션 | `information_extractor`의 `"accepts llmConfigId alone when model override is empty"` 패턴을 동일하게 추가 |
| 3 | 테스트 일관성 | loop 컨테이너 경고 테스트는 tooltip 내용(`"Count not set"`)을 검증하지만, http_request 경고 테스트는 P 태그 존재 여부만 확인하고 tooltip 내용은 미검증. 테스트 깊이 비대칭 | `custom-node.test.tsx` — http_request 경고 테스트 | http_request(및 기타 일반 노드) 경고 테스트에 `tooltipContent.textContent` 포함 여부 검증 추가 |
| 4 | 테스트 정밀도 | `/^⚠/` 정규식이 ⚠로 시작하는 모든 텍스트에 매칭되어 의도치 않은 경고 메시지가 `<p>` 태그에 렌더링되어도 통과될 수 있음 (단, 구체적 메시지 검증은 `node-config-summary.test.ts`에서 커버) | `custom-node.test.tsx` line 120, 147, 176 | 현재 목적(body에 `<p>` 미렌더링 확인)에는 허용 가능. 주석으로 의도 명시 권장 |
| 5 | 명명 일관성 | 구현의 `warning(detail)` 헬퍼와 테스트의 `warningOf(detail)` 헬퍼가 동일 역할이나 이름이 달라 관계를 추론하는 인지 부하 발생 | `node-config-summary.ts:37`, `node-config-summary.test.ts:7` | 테스트 헬퍼를 `warning(detail)`과 동일한 이름으로 통일하거나 `// mirrors warning() in implementation` 주석 추가 |
| 6 | 가독성 | `warning()` 함수 내 `\u26a0` 유니코드 이스케이프가 매직 문자로 존재. 직관적 파악 어려움 | `node-config-summary.ts` — `warning()` 함수 내 템플릿 리터럴 | 리터럴 `"⚠"` 사용 또는 모듈 상단에 `const WARNING_ICON = "⚠"` 상수 정의 |
| 7 | 문서화 | 신규 `warning()` 헬퍼에 인라인 JSDoc 없음. `getConfigSummary` JSDoc도 변경된 동작(미설정 시 null 대신 구체적 경고 반환)을 반영하지 않음 | `node-config-summary.ts` — `warning()` 함수 및 `getConfigSummary` JSDoc | `warning()` 함수에 `/** Returns a warning ConfigSummaryResult with a human-readable detail string. */` 추가. `getConfigSummary` JSDoc에 null 반환 케이스와 경고 반환 케이스 구분 명시 |
| 8 | 아키텍처 | `manual_trigger` 예외 처리가 `FORMATTERS` 레지스트리 외부에 하드코딩. 새로운 "요약 없는 노드" 추가 시 조건 누적 가능 | `node-config-summary.ts` — `getConfigSummary` 내 `if (nodeType === "manual_trigger") return null` | `FORMATTERS`에 `manual_trigger: () => null` 등록하여 dispatcher 내 하드코딩 제거 |
| 9 | 보안 | DB 쿼리 첫 번째 줄이 캔버스 UI에 노출됨. 화면 공유·스크린샷 환경에서 연결 문자열, 자격증명 등 민감 정보 노출 위험 | `node-config-summary.ts:154-158` — `databaseQuerySummary` | 쿼리 내용 대신 `SELECT · 23 chars` 형태로 길이 표시 또는 민감 패턴 마스킹 정책 수립 고려 |
| 10 | 보안 | `config` 값이 `as string \| undefined` 강제 캐스팅으로 가져와짐. `config.url`이 객체인 경우 `[object Object]`가 text에 삽입될 수 있음 | `node-config-summary.ts` 전반 | 중요 필드에 `typeof value === 'string'` 타입 가드 추가 검토 |
| 11 | 성능 | `warning()` 호출마다 새 객체와 템플릿 리터럴 문자열이 생성됨. 경고 메시지는 정적이므로 모듈 레벨 캐싱 가능 | `node-config-summary.ts` — 각 포매터의 `warning()` 호출부 | 모듈 상단에 `const W = { urlNotSet: warning("URL not set"), ... } as const` 형태로 사전 계산 캐싱 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| architecture | LOW | WARNING 상수 dead code, FORMATTERS 타입 불일치, carousel 반환 타입 불일치 |
| maintainability | LOW | WARNING 상수 dead code, carousel 반환 타입 불일치, 경고 문자열 하드코딩 |
| side_effect | LOW | WARNING 상수 dead code, FORMATTERS 타입 불일치, carousel null 반환 시 구 메시지 유출 위험 |
| testing | LOW | WARNING 상수 dead code, merge inputCount:0 미테스트, tooltip 검증 비대칭 |
| documentation | LOW | WARNING 상수 dead code, warning() JSDoc 누락, getConfigSummary JSDoc 미갱신 |
| security | LOW | SQL 쿼리 노출, config 값 타입 캐스팅 의존, XSS 잠재 가능성(현재 React 환경에서는 안전) |
| dependency | LOW | WARNING 상수 dead code, FORMATTERS 타입 불일치 |
| performance | LOW | WARNING 상수 dead code, warning() 매 호출마다 객체 생성 |
| scope | LOW | WARNING 상수 dead code, spec 소급 반영(허용 가능) |
| requirement | LOW | WARNING 상수 dead code, carousel 반환 타입 불일치, text_classifier 테스트 누락 |
| concurrency | NONE | 순수 동기 함수, 동시성 이슈 없음 (WARNING 상수 dead code INFO로 언급) |
| database | NONE | 데이터베이스 관련 코드 없음 |
| api_contract | NONE | API 계약 변경 없음 |

## 발견 없는 에이전트

- **database** — 데이터베이스 관련 코드 미포함
- **api_contract** — 외부 API 계약 변경 없음

## 권장 조치사항

1. **[필수] Dead Code 제거 및 타입 정합성 복원** — `carouselSummary` 반환 타입을 `ConfigSummaryResult`로 좁히고, `WARNING` 상수와 `getConfigSummary`의 `if (!result)` fallback 분기를 함께 제거. `FORMATTERS` 레지스트리 타입도 `| null` 제거하여 타입 시스템이 실제 동작을 정확히 반영하도록 정리 _(WARNING #1, #2, #3 통합 해결)_

2. **[권장] 테스트 커버리지 보완** — `merge` 노드 `inputCount: 0` 경계값 테스트 추가, `text_classifier` `llmConfigId` 단독 케이스 테스트 추가, http_request 경고 테스트에 tooltip 내용 검증 추가 _(INFO #1, #2, #3)_

3. **[권장] `warning()` 헬퍼 및 JSDoc 개선** — `\u26a0`을 리터럴 `"⚠"`로 교체, `warning()` 함수에 JSDoc 추가, `getConfigSummary` JSDoc 갱신 _(INFO #6, #7)_

4. **[검토] SQL 쿼리 노출 정책 수립** — 화면 공유 시나리오를 고려하여 쿼리 내용 노출 범위 정책 결정 (길이 표시 또는 마스킹) _(INFO #9)_

5. **[선택] 헬퍼 명명 일관성** — 테스트의 `warningOf`를 `warning`으로 통일하거나 관계를 주석으로 명시 _(INFO #5)_