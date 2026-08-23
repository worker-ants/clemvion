# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 은 없음. workflow-assistant LLM 도구의 마스킹 갭(값 축 `deepRedactSecrets` 미적용, `token` 계열 키 미등록)을 닫는 잘 설계된 보안 강화 PR이나, `DEFAULT_SENSITIVE_KEYS`(공유 module-level 상수) 확장이 이번 PR 스코프 밖의 자매 표면(`handler-output.adapter.ts` → 모든 노드 실행의 `config` 영속: DB 저장·WS emit·표현식 echo)에 코드 변경 없이 자동 전파되는데, 그 경로의 프로덕션 리스크(실제 노드 config 에 해당 키 이름과 충돌하는 값이 있는지)가 측정되지 않은 채 그 표면 자신의 테스트로도 잠기지 않았다. 두 항목(side_effect WARNING, testing WARNING)이 같은 구조적 갭의 다른 단면을 짚고 있다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect | `DEFAULT_SENSITIVE_KEYS`(공유 module-level 상수)에 `token` 계열 8개 추가가 이번 PR 스코프(workflow-assistant read 경로) 밖의 `handler-output.adapter.ts`(→ 모든 노드 실행의 `config` DB 저장·WS emit·표현식 echo)에도 자동 전파된다. plan 이 "값 축"에만 명시적으로 경계했던 "저장/표현식이 읽는 값이 바뀌어 정상 워크플로를 깨뜨릴 수 있다"는 리스크가 "키 축" 확장에도 원리적으로 동일 적용될 수 있는데 실측이 없다 | `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts:13-27` → `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:36` | 실제 노드 `configSchema`/프로덕션 데이터에서 8개 키 이름과 충돌하는 사례가 없는지 확인하거나, workflow-assistant 전용 `ASSISTANT_SENSITIVE_KEYS` 를 분리해 공유 기본값 확장의 블라스트 반경을 좁힐 것 |
| 2 | testing | 이 PR 이 "자매 표면 키 축" 수정으로 명시 체크한 `handler-output.adapter.ts` 가 그 자신의 테스트 스위트(`handler-output.adapter.spec.ts`)에서 `csrf_token`/`auth_token`/`session_token`/`id_token` 계열 마스킹을 검증받지 못한다. 현재는 같은 `DEFAULT_SENSITIVE_KEYS` Set 을 공유해 구조적으로 안전하지만, 향후 그 표면이 별도 key set 으로 파라미터화되면 회귀를 잡을 안전장치가 없다 | `codebase/backend/src/modules/execution-engine/handler-output.adapter.spec.ts` (diff 밖 파일) | `'masks credential-like keys in echoed config'` 근처에 token 계열 캐너리 1~2개 추가하여 그 표면 자신의 테스트로 고정 |
| 3 | maintainability | 신설 `redactAssistantFields` 함수와 그 30줄 JSDoc 이 기존 `ExploreToolsService` 클래스 JSDoc 과 클래스 선언 사이에 끼어들어, 클래스 doc 의 닫는 `*/` 바로 다음 줄에 공백 없이 새 `/**` 가 시작 — 두 문서 블록의 소속이 시각적으로 헷갈린다 | `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:53-114` | `redactAssistantFields`(및 JSDoc)를 클래스 doc 위쪽(import/상수 선언부 근처) 또는 클래스 선언 아래(다른 module-level 헬퍼들 자리)로 이동해 클래스 doc 과 클래스 선언을 다시 인접시킬 것 |
| 4 | documentation | `CHANGELOG.md` 에 이번 변경(마스킹 포맷 `****<last4>` → `***`, 값 축 마스킹 신설, `token` 계열 8개 추가) 항목이 없다. 기존 "Unreleased" 항목(116줄 부근)이 바로 이 PR 이 닫는 갭을 명시적으로 예고해 뒀는데, 그 항목을 닫으면서도 대응 CHANGELOG 항목을 추가하지 않았다 | `CHANGELOG.md` | "Unreleased" 섹션에 (a) 값 축 마스킹 신설, (b) 마스킹 포맷 변경(`****<last4>`→`***`, 트레이드오프 근거 포함), (c) `token` 계열 8개 추가(자매 표면 영향 포함) 3가지를 기록하고 기존 항목과 상호 참조 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 자매 표면 `handler-output.adapter.ts` 의 값 축(문자열 안 `Bearer …`/URI 자격증명)이 이번 diff 로 닫히지 않고 여전히 열려 있음. 이미 plan 에 별도 항목으로 등재·추적됨(의도적 범위 밖) | `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts` | 별건 착수 전 재확인만 하면 됨 |
| 2 | security | 마스킹 마커 표기 이원화 — `explore-tools.service.ts` 는 공유 계약 `VALUE_MASK_MARKER`(`"***"`)와 일치하나 `handler-output.adapter.ts` 는 여전히 `****<last4>` 라 `isMaskedMarker` 계약 밖. 재제출 가능 경로로 확장 시 마스킹 값을 새 입력으로 오인할 위험(현재는 그 경로에 없음, 이미 등재됨) | `handler-output.adapter.ts` vs `codebase/packages/masked-markers/src/index.ts` | 해당 표면이 재제출 가능 경로로 확장될 때 재확인 |
| 3 | scope | `DEFAULT_SENSITIVE_KEYS` 확장의 실질 수혜자는 이 diff 에 없는 파일(`handler-output.adapter.ts`)이다 — 정작 `explore-tools.service.ts` 표면은 `deepRedactSecrets` 의 `CREDENTIAL_KEY_PATTERN` 이 이미 token 접두 계열을 덮어 이 리스트 확장이 불필요(뮤테이션 M2 로 확인). 우발적이지 않고 plan 이 의도적으로 포함·정당화함 | `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts:13-27` | PR 설명에 이 비대칭을 한 줄 언급하면 좋음(필수 아님) |
| 4 | maintainability | 내부 컴포즈 함수 이름 `both` 가 무엇을 합성하는지 이름만으로 드러나지 않음 | `explore-tools.service.ts:106` | `redactValue`/`applyBothMaskingLayers` 등으로 개명 검토 |
| 5 | maintainability | "키 축/값 축 이중 마스킹" 트레이드오프 설명이 소스 주석·plan 문서 두 곳에 거의 같은 내용으로 반복 | `explore-tools.service.ts:67-96`, `plan/in-progress/assistant-mask-leak.md` | 상세 트레이드오프는 spec `## Rationale` 을 정본으로, 소스 주석은 `@see` 링크로 경량화 검토 |
| 6 | testing | `redactAssistantFields` 가 비-export 라 전체 서비스 왕복 없이 단위 테스트 불가 | `explore-tools.service.ts` | 마스킹 케이스가 더 늘어나면 export 하여 별도 describe 블록으로 분리 검토 |
| 7 | testing | `MAX_REDACT_DEPTH`(=10) 경계가 이 신규 소비처에서 별도 검증되지 않음(공유 유틸에서는 이미 검증됨) | `explore-tools.service.ts` | 낮은 우선순위, 필수 아님 |
| 8 | testing | `tokenCount` 대조군 캐너리는 현재 구현(Set 완전 일치)에 대해 항상 자명하게 통과 — 정규식으로 바뀌기 전까지는 회귀를 못 잡는 문서적 캐너리(주석이 의도를 명시해 오해 소지 없음) | `mask-sensitive-fields.util.spec.ts` | 없음 |
| 9 | documentation | LLM 도구 설명(`tool-definitions.ts`)·system prompt 문자열이 새 값 축 마스킹 메커니즘을 반영 못 해 "키만 가려진다"는 인상을 줌(과다 마스킹 방향이라 안전 쪽, 기능 결함 아님) | `tool-definitions.ts:170`, `system-prompt.ts:234` | 필수 아님, 짧게 보완 검토 |
| 10 | documentation | `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1 에서 `egress-masking.md` 참조가 텍스트 언급뿐이고 실제 하이퍼링크가 아님(이전 라운드 INFO 제안 미반영) | `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1 | 마크다운 링크로 전환, 급하지 않음 |
| 11 | side_effect | 같은 `DEFAULT_SENSITIVE_KEYS` 확장이 `****<last4>` 마커 계약 밖 값의 표면적(키 가짓수)을 늘림 — 기존 추적 이슈(위 INFO #2)의 증분일 뿐, 새 위험 아님 | `mask-sensitive-fields.util.ts` → `handler-output.adapter.ts` | 별도 조치 불요 |
| 12 | side_effect | `deepRedactSecrets` 의 module-level 캐시가 `redactAssistantFields` 경로에서는 `maskSensitiveFields` 가 항상 새 객체를 반환해 캐시 적중이 발생하지 않음(버그·누수 아님, 무의미한 시도일 뿐) | `sanitize-error-message.ts:202`, `explore-tools.service.ts:106` | 조치 불요 |
| 13 | requirement | 자매 표면 값 축 잔여는 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 별도 체크박스로 명시적으로 등재되어 있어 범위 밖 처리가 정당 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:237-249` | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 취약점 없음, 두 마스킹 레이어 합성 순서·마커 일치 코드 레벨로 검증. 자매 표면 잔여 갭 2건은 이미 추적 중(INFO) |
| requirement | NONE | 기능 완전성·spec fidelity line-level 일치. 실제 jest 실행(36/36 GREEN) + M2 뮤테이션 재현으로 plan 주장 검증 |
| scope | NONE | 27개 파일 diff 전수가 하나의 인과 사슬(마스킹 갭 → impl-prep BLOCK:YES → planner 턴 → spec 동기화)로 정당화됨. 무관 변경·drive-by 없음 |
| side_effect | **MEDIUM** | `DEFAULT_SENSITIVE_KEYS` 확장이 스코프 밖 `handler-output.adapter.ts`(모든 노드 config 영속)에 자동 전파되는데 프로덕션 리스크 실측 없음(WARNING). 나머지는 이미 추적 중이거나 무해 |
| maintainability | LOW | 새 함수/JSDoc 배치가 기존 클래스 JSDoc 과 클래스 선언 사이를 갈라놓음(WARNING). 함수명·문서 중복은 INFO |
| testing | LOW | plan 의 뮤테이션 주장 전부 직접 재현·일치 확인. 자매 표면(`handler-output.adapter.spec.ts`) 자신의 token 계열 테스트 부재(WARNING) |
| documentation | LOW | 코드·spec·plan 문서화는 매우 촘촘. `CHANGELOG.md` 관례 이번만 누락(WARNING) |
| user_guide_sync | NONE | 매트릭스 20개 trigger 매칭 0건. `codebase/frontend/**` 변경 전무 |

## 발견 없는 에이전트

없음 — 8개 reviewer 모두 최소 1건 이상의 INFO 이상 발견사항을 보고함(다수는 정보성 또는 이미 추적 중인 항목).

## 권장 조치사항
1. (side_effect WARNING) `handler-output.adapter.ts` 가 소비하는 실제 노드 `config` 데이터에서 신규 8개 키 이름(`csrfToken` 등)과 충돌하는 프로덕션 사례가 없는지 확인하거나, workflow-assistant 전용 키 목록을 분리해 `DEFAULT_SENSITIVE_KEYS` 확장의 블라스트 반경을 스코프 안으로 좁힐 것.
2. (testing WARNING) `handler-output.adapter.spec.ts` 에 token 계열(`csrf_token` 등) 캐너리를 추가해 "자매 표면 키 축" 수정을 그 표면 자신의 테스트로 고정할 것.
3. (documentation WARNING) `CHANGELOG.md` 에 이번 마스킹 강화(포맷 변경 포함) 항목을 추가하고 기존 예고 항목과 상호 참조할 것.
4. (maintainability WARNING) `redactAssistantFields` 와 그 JSDoc 을 클래스 JSDoc/선언 사이에서 다른 위치로 옮겨 문서 블록 소속 혼동을 해소할 것.
5. (INFO, 선택) 함수명 `both` 개명, spec 내부 하이퍼링크 정리, LLM 도구 설명 문자열 보완 등은 여유 있을 때 처리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync` (8명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨)
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(마스킹 로직 강화, 소규모 함수 합성)에 성능 영향 표면 없음 |
  | architecture | 아키텍처 구조 변경 없음(기존 유틸/서비스 내 함수 추가) |
  | dependency | 신규/변경 의존성 없음 |
  | database | DB 스키마·쿼리 변경 없음(엔티티 필드 값만 read 경로에서 마스킹) |
  | concurrency | 동시성 관련 로직 변경 없음 |
  | api_contract | 외부 API 계약(엔드포인트·요청/응답 스키마) 변경 없음, LLM 도구 내부 응답 포맷 조정뿐 |