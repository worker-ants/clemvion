# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. 신규 코드 델타(커밋 `9482cc0c0`, `it.each` 튜플 순서 정정)는 직전 라운드 WARNING 을 해소한 테스트-전용 수정이며 프로덕션 코드는 무변경. 이번 라운드에서 새로 나온 실질 WARNING 은 REST `getStatus` 이중 순회 비용 미실측 1건뿐. forced(router_safety) 화이트리스트 7명(`documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`) 전원 결과 확보 확인됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | performance | REST 스냅샷(`getStatus`)이 `outputData` 를 `stripExternalOnlyFields` + `deepRedactSecrets` 로 이제 **두 번** 완전 재귀 순회한다. WS fanout 경로는 A/B 실측(+20.2 µs/emit 통상, 대용량 최대 +61 ms@6.5MB)이 plan 에 문서화돼 있으나, REST 경로의 이 이중 순회는 아직 실측된 적이 없다. REST 는 요청마다 새 객체라 WS 의 identity 캐시(`SANITIZE_CACHE`/`DEEP_REDACT_CACHE`) 이득도 없다 | `codebase/backend/src/modules/external-interaction/interaction.service.ts:98`(`stripAndRedact`), 호출부 `:379`(`nodeOutput`)·`:441`(`result`)·`:445`(`error`) | 대용량 `outputData` 에 대해 REST 경로 전용 A/B 측정을 실행해 `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 의 실측 항목에 병기하거나 별도 후속 항목으로 등재. 유예하더라도 반드시 숫자를 남길 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 이미 전송된 과거 데이터(fix 이전 SSE/webhook/chat-channel/REST 로 나간 `llmCalls`)는 코드 수정으로 회수 불가 — CHANGELOG·plan 에 이미 disclose·추적됨, 신규 발견 아님 | `CHANGELOG.md:34-35` | 코드 조치 불요, 운영 판단(외부 통합자 로그 점검 등)은 이미 plan 등재 |
| 2 | side_effect | `stripAndRedact` 의 clone-on-write 산출물이 `deepRedactSecrets` 의 기존 identity 캐시(`DEEP_REDACT_CACHE`, WeakMap)를 `llmCalls` 포함 payload 에서 항상 무력화한다 — 정확성 버그 아님(stale/누수 없음), 다른 모듈 소유 캐시의 효과를 조용히 없애는 상호작용 | `codebase/backend/src/modules/external-interaction/interaction.service.ts:98-108` ↔ `codebase/backend/src/shared/utils/sanitize-error-message.ts:107,136-141` | REST 는 hot path 아니라 별도 조치 불요. 다음에 `stripDeep`/`deepRedactSecrets` 캐싱을 재검토할 때(기존 유예 WARNING 후속) 함께 고려 |
| 3 | requirement | `error`/`result` 필드가 `CANCELLED` 상태에서는 채워지지 않음 — spec §6.5 표와 잠재 불일치이나 이 diff 범위 밖의 pre-existing 갭(조건식 자체는 이번 diff 가 건드리지 않음) | `codebase/backend/src/modules/external-interaction/interaction.service.ts` `getStatus()` result/error 삼항 조건 | 이 PR 범위 조치 불요. `CANCELLED` 시 `error` 채움 여부는 별도 planner 항목으로 검토 |
| 4 | requirement | `stripAndRedact` 반환 타입이 DB 계약(JSONB object-or-null)에 의존한 방어적 캐스팅 — 이 diff 이전부터 있던 패턴 계승, 신규 리스크 아님 | `codebase/backend/src/modules/external-interaction/interaction.service.ts:98` | 조치 불요, 참고 기록 |
| 5 | api_contract | 라이브 REST 엔드포인트 응답이 버전 표식 없이 조용히 좁아짐(`llmCalls` 필드 제거) — 이미 문서화된 계약(WS §4.4)을 뒤늦게 강제하는 시정이라 실질 breaking change 는 아니나, 의도치 않게 그 필드를 수신하던 외부 클라이언트 입장에선 스키마 변경 | `codebase/backend/src/modules/external-interaction/interaction.service.ts:98,379,441,445` | 추가 조치 불필요 — EIA 표면에 정식 버저닝 스킴 부재, CHANGELOG 공지로 갈음하는 현재 처리가 합리적 |
| 6 | api_contract | REST(`deepRedactSecrets`, `>=` 경계)와 WS fanout(`sanitizePayloadForWs`, `>` 경계)이 같은 깊이 상수에 다른 마스크 토큰/경계 연산자를 쓰는 의도된 비대칭 — 채널마다 마스크 토큰 문자열이 다를 수 있음(`'***'` vs `'[REDACTED]'`) | `codebase/backend/src/shared/utils/strip-external-only-fields.ts:29-42` | 조치 불요 — JSDoc 표로 이미 명문화. 신규 표면 추가 시 같은 표의 조합을 명시적으로 선택할 것 |
| 7 | maintainability | 인접한 두 `it.each` 블록(`interaction.service.spec.ts:668-673` vs `:716-721`)의 튜플 필드 순서가 서로 다름(`[label,status,field]` vs `[label,field,status]`) — 각각은 정확하지만 향후 복붙 편집 시 혼동 소지 | `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:668-673,716-721` | 필수 아님 — 다음에 이 근처를 만질 때 순서 통일 또는 교차 참조 주석 추가 |
| 8 | maintainability | `__proto__` 오염 방어(`Object.defineProperty`)가 신규 함수 `stripDeep` 에만 있고, 같은 파일의 기존 자매 함수 `sanitizeInner` 는 여전히 bracket 대입(`result[k]=...`) — `sanitizeInner` 는 이 diff 범위 밖이라 이번 라운드 지적 대상은 아님 | `codebase/backend/src/shared/utils/strip-external-only-fields.ts:127-142` ↔ `codebase/backend/src/modules/websocket/websocket.service.ts:277-291` | 이번 라운드 조치 불요. 다음에 `sanitizeInner`/`sanitizePayloadForWs` 를 만질 때 같은 `__proto__` 하네스로 회귀 테스트 + `defineProperty` 패턴 적용을 plan 후속 항목으로 |
| 9 | maintainability | `stripDeep` 배열 분기의 이중 `if` (clone 트리거 / 대입)에 설명 주석 부재 — 로직은 정확하나 인지 부하 소폭 존재 | `codebase/backend/src/shared/utils/strip-external-only-fields.ts:110-114` | 필수 아님, 한 줄 주석 권장 |
| 10 | architecture | 재귀 트리 순회(clone-on-write) 스켈레톤이 3곳(`stripDeep`/`sanitizeInner`/`sanitize-error-message.ts` redact 순회)에 독립 구현 — 이전 라운드부터 이월된 의도적 defer, 신규 아님 | `strip-external-only-fields.ts`, `websocket.service.ts`, `sanitize-error-message.ts` | 조치 불요(이월) |
| 11 | architecture | `maxDepth` 인자와 호출부 상수(`MAX_REDACT_DEPTH`/`MAX_SANITIZE_DEPTH`)의 "짝을 맞춘다" 불변식이 타입이 아닌 JSDoc 관례+테스트로만 강제 — 이전 라운드에서 이미 조치 불요로 결론 | `strip-external-only-fields.ts` | 조치 불요(이월) |
| 12 | scope | 순수 포맷팅(빈 줄 1개) 삽입이 기능 변경 커밋에 혼입 | `codebase/backend/src/modules/external-interaction/interaction.service.ts:133` | 조치 불요, 참고. 향후 누적되면 별도 포맷팅 커밋 분리 권장 |
| 13 | scope | spec 문서 변경 범위(§6.2 봉투 래퍼, `waitingNodeType` 매핑, `error.code`/`nodeId` nullable 화)가 "llmCalls 차단" 보다 넓어 보이나, `plan/in-progress/eia-terminal-payload.md` 의 `BLOCK: YES` → planner 턴(`4b13ca5ae`) 정식 절차를 거친 정당한 spec drift 정정 | `spec/5-system/14-external-interaction-api.md`, `spec/1-data-model.md` | 조치 불요 — 절차 준수 확인됨 |
| 14 | user_guide_sync | doc-sync-matrix 21개 trigger 행 전수 대조 결과 매칭 없음 — `codebase/frontend/**`/`codebase/channel-web-chat/**` 변경 0건, 신규 UI 문자열·노드·warning/error 코드·auth 흐름 변경 없음 | changeset 전체 (backend-only) | 조치 불요 |
| 15 | 공통(architecture/testing/documentation/api_contract) | 이번 라운드(`16_44_37`)의 유일한 신규 코드 델타는 커밋 `9482cc0c0`(테스트 `it.each` 튜플 순서 정정, 직전 라운드 WARNING 해소) 하나뿐 — 4개 reviewer 가 독립적으로 `git show`/`git diff`/`npx jest` 로 재검증, 프로덕션 로직·계약·구조 영향 없음 확인(관련 spec 3파일 5 suites/150 tests 전부 통과) | `interaction.service.spec.ts:712-731` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `llmCalls` 누출 CRITICAL 해소 확인(positive), `__proto__` 방어 확인(positive). 잔여는 코드로 해소 불가한 과거 노출 리스크(운영 판단, 이미 disclose) |
| performance | LOW | REST `getStatus` 이중 순회 미실측(WARNING). WS 이중 순회는 이미 A/B 실측·유예됨(INFO) |
| architecture | NONE | 이번 델타는 테스트 파일 전용, 구조 영향 없음. 이월 INFO 2건(재귀 스켈레톤 3중복, 깊이 상수 짝맞춤 비-타입 강제) |
| requirement | NONE | 기능 완전성·spec 정합 확인(positive). CANCELLED 상태 error/result 미채움은 pre-existing 갭(신규 아님) |
| scope | NONE | 핵심 코드 diff 단일 관심사로 좁게 유지. spec 확장은 정식 절차 준수, 포맷팅 1줄 혼입은 무해 |
| side_effect | LOW | 입력 비변형·`__proto__` 방어·이벤트 계약 불변 전부 확인(positive). `stripAndRedact` 가 `DEEP_REDACT_CACHE` identity 캐시를 무력화(INFO, 정확성 버그 아님) |
| maintainability | LOW | 공유 유틸 추출·재명명 등 구조 개선(positive). `it.each` 튜플 순서 비일관, `__proto__` 방어 비대칭(스코프 밖) 등 INFO 4건 |
| testing | NONE | 재정렬 커밋 실행 재검증(150 tests 통과), 핵심 로직 무변경, 커버리지 갭 없음 |
| documentation | NONE | 직전 WARNING(`it.each` placeholder 불일치) 해소 확인, 문서/코드/plan 정합 확인(positive) |
| api_contract | LOW | null/{} 구분 보존, EIA URL 정정 등 계약 개선(positive). 응답 payload 조용한 축소(버전신호 없음, CHANGELOG 로 완화)는 INFO |
| user_guide_sync | NONE | doc-sync-matrix 21행 전수 대조, 매칭 trigger 없음(backend-only 보안 수정) |

## 발견 없는 에이전트

없음 — 전 에이전트가 최소 INFO 이상 기록(대부분 positive finding 포함).

## 권장 조치사항
1. REST `getStatus` 경로의 `stripAndRedact` 이중 순회(strip+redact)에 대해 대용량 `outputData` A/B 측정을 실행하고 `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 에 병기 또는 별도 후속 항목으로 등재 (WARNING #1).
2. (선택, 낮은 우선순위) `interaction.service.spec.ts` 의 인접 `it.each` 튜플 필드 순서를 통일하거나 교차 참조 주석 추가 — 향후 복붙 편집 실수 방지.
3. (선택, 낮은 우선순위) 다음에 `sanitizeInner`/`sanitizePayloadForWs` 를 만질 기회가 있으면 `stripDeep` 과 동일한 `__proto__` 방어(`Object.defineProperty`) 패턴 적용을 plan 에 후속 항목으로 등재.
4. 그 외 항목은 모두 조치 불요로 확인됨 — 즉시 실행 가능한 CRITICAL 은 없음.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract`, `user_guide_sync` (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명) — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단상 이번 changeset 과 관련 낮음(패키지/의존성 변경 없음) |
  | database | router 판단상 이번 changeset 과 관련 낮음(스키마/쿼리 변경 없음) |
  | concurrency | router 판단상 이번 changeset 과 관련 낮음(동시성 로직 변경 없음) |