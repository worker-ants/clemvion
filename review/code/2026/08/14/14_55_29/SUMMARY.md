# Code Review 통합 보고서

## 전체 위험도

**MEDIUM** — Critical 없음. 핵심 보안 수정(REST `getStatus` + WS fanout 양쪽에서 `llmCalls` raw 프롬프트를 깊이 무관 strip)은 실제로 유효하고 실행 테스트로 검증됨. 다만 REST 경로(`redactAndStrip`)가 새로 도입한 **strip-먼저·redact-나중** 순서의 깊이 경계 안전성이 코드 논증·직접 실행 확인으로는 참이지만, WS 경로에 있는 것과 대칭인 **자동 회귀 테스트(깊이 경계 sweep)가 REST 쪽에 없다** — 이 저장소가 정확히 이 클래스의 결함(경계 연산자/순서 불일치)을 "리뷰어 다수가 갈렸다가 실행으로 해소" 한 선례를 남긴 만큼(`b49ee4310`), 같은 위험이 REST 쪽에서만 미검증 상태로 남아 있다는 점이 testing 관점에서 MEDIUM으로 판정됐다. forced reviewer 7명 전원(documentation, maintainability, requirement, scope, security, side_effect, testing) 결과 확보 완료 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing / security / architecture (중복 통합) | REST 경로(`redactAndStrip`)가 새로 도입한 strip-먼저→redact-나중 순서의 깊이 경계 안전성이 코드 논증·직접 실행 확인으로는 참이지만(depth 0~12 sweep, `__proto__` 합성 모두 누출 없음 확인), WS 경로에 있는 `it.each` 깊이 경계 sweep 테스트가 REST 쪽엔 없어 향후 순서/경계연산자/상수 변경 시 테스트 실패 없이 조용히 회귀할 수 있음 | `codebase/backend/src/modules/external-interaction/interaction.service.ts:95-104`(`redactAndStrip`) vs `codebase/backend/src/modules/websocket/websocket.service.ts:451-458,525-531`(대칭 경로), 테스트: `interaction.service.spec.ts` (얕은 depth만) vs `websocket.service.spec.ts:830-859`(`it.each([0,MAX-5,...,MAX+2])` sweep) | `interaction.service.spec.ts` 또는 `strip-external-only-fields.spec.ts`에 `MAX_REDACT_DEPTH` 상대값 기준 depth sweep 1건 추가, 가능하면 뮤테이션(순서 반전/strip no-op)에서 RED 판별력도 확인. REST `__proto__` 합성 케이스 1건도 함께 추가 |
| 2 | architecture / documentation (중복 통합) | 공유 유틸(`strip-external-only-fields.ts`)의 깊이-경계 안전성 서술("자매 sanitizer 가 **먼저** collapse 해서 안전하다")이 REST 호출부(`redactAndStrip`, strip이 먼저·redact가 나중)에는 인과가 반대로 적용됨 — 실제로는 안전하지만(나중에 실행되는 자매가 뒤늦게 collapse) 문서의 메커니즘 서술과 반대 방향. 또한 `@param maxDepth` JSDoc(69-72행)이 같은 파일 상단에서 이미 정정된 옛 문구("같은 값·같은 경계 연산자를 쓴다")를 그대로 반복 — 정정한 문장과 정정 안 된 문장이 같은 커밋에 공존 | `codebase/backend/src/shared/utils/strip-external-only-fields.ts:31-40`(모듈 상단, 정정됨) vs `:69-72`(`@param maxDepth`, 미정정) ↔ `interaction.service.ts:95-104` | JSDoc을 순서-무관 서술로 통일("자매가 먼저든 나중이든 그 경계에서 서브트리를 non-object로 collapse하면 무해하다"), `@param maxDepth` 블록도 동일하게 좁혀 상단 절을 참조하도록 갱신 |
| 3 | maintainability | `redactAndStrip` 함수명이 실제 실행 순서(strip 먼저, redact 나중)와 반대로 읽힘 — 바로 위 주석은 정확한 순서를 설명하지만 함수명 자체가 오독 위험을 남김 | `codebase/backend/src/modules/external-interaction/interaction.service.ts:95` | `stripAndRedact` 또는 순서중립적 이름(`sanitizeOutputData`)으로 개명 |
| 4 | maintainability | `websocket.service.ts`에서 `stripExternalOnlyFields`가 공유 유틸로 이관된 자리에 남은 JSDoc 블록(294-304행)이 어떤 선언에도 붙지 않은 채 떠 있음(orphan JSDoc) — 바로 다음에 이어지는 별도 KB 이벤트 union JSDoc과 혼동 유발 | `codebase/backend/src/modules/websocket/websocket.service.ts:294-304` | 블록 삭제(내용은 이미 `strip-external-only-fields.ts` 상단에 더 상세히 존재) 또는 `//` 라인 주석으로 전환 |
| 5 | SPEC-DRIFT (requirement) | `[SPEC-DRIFT]` `spec/5-system/14-external-interaction-api.md` §R17이 `getStatus()` 정화를 "secret-shape만 치환"(값 마스킹)으로만 서술 — 실제로는 `stripExternalOnlyFields`(필드 삭제)를 병행하는데 이번 diff는 이 CRITICAL 보안수정을 정확히 구현했으나 spec 문구는 이전 동작 그대로 남음. 코드가 spec을 앞지른 경우이며 이미 planner 인계 항목으로 등재됨 | `spec/5-system/14-external-interaction-api.md:1349-1352` ↔ `interaction.service.ts` `redactAndStrip` (세 출구 전부) | 코드 변경 불필요 — `project-planner` 턴에서 §R17을 "값 마스킹+필드 삭제 병행, 세 출구 전부 적용"으로 갱신. 처방은 `plan/in-progress/spec-draft-eia-62-waiting-payload.md:119-141` (7)번 항목에 이미 등재 |
| 6 | SPEC-DRIFT (requirement) | `[SPEC-DRIFT]` `spec/5-system/6-websocket-protocol.md` §4.4 blockquote의 "strip 대상은 본 WS 이벤트 필드뿐" 서술이 이제 사실이 아님 — REST `getStatus()`도 같은 헬퍼로 strip됨. 이미 CHANGELOG가 스스로 이 불일치를 지적했고 planner 인계 항목으로 등재됨 | `spec/5-system/6-websocket-protocol.md:519` ↔ `interaction.service.ts` `redactAndStrip` | 코드 변경 불필요 — planner 턴에서 §4.4 Rationale을 "WS fanout + EIA REST getStatus() 양쪽"으로 확장. 처방은 동일 plan draft (7)번 항목에 등재 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | performance | REST `getStatus`가 이제 매 요청마다 `stripExternalOnlyFields` 전체 트리 순회를 추가 지불(llmCalls 없는 non-AI execution에도 예외 없이 적용) — 요청당 1회 실행되는 REST 엔드포인트라 절대 비용 낮음 | `interaction.service.ts` `redactAndStrip` 호출부 3곳 | 조치 불요. 폴링 빈도가 늘거나 대용량 payload가 흔해지면 REST 전용 A/B 측정 권장 |
| 2 | performance | `EXTERNAL_STRIPPED_FIELDS.includes(k)` 멤버십 검사가 REST 경로에도 추가되나 원소 1개라 실질 영향 없음 | `shared/utils/strip-external-only-fields.ts` `stripDeep` | 필드 2개 이상 증가 시 Set 전환 고려 |
| 3 | architecture | `stripDeep`(strip)과 `sanitizeInner`(redact, websocket.service.ts 잔류)가 거의 동일한 재귀 순회+clone-on-write 스켈레톤을 별도 구현, 이번 승격으로 물리적으로 더 멀어져 "짝점검" 관례가 코드에서 약해짐 | `strip-external-only-fields.ts:78-119` ↔ `websocket.service.ts` `sanitizeInner` | JSDoc에 상호 `@see` 참조 추가하여 파일 분리 후에도 짝점검 관례 유지 |
| 4 | testing | `redactAndStrip`의 null/undefined 조기 반환 분기가 현재 테스트로 실행되지 않음(terminal outputData:null fixture 없음) | `interaction.service.ts:96`, 호출부 `:438,442` | `outputData: null` fixture 추가로 회귀 가드 확보(우선순위 낮음) |
| 5 | api_contract | REST 응답에서 `llmCalls` 필드가 제거되어 응답 내용이 변하나, DTO가 애초 해당 필드를 스키마로 약속한 적 없는 열린 map이라 breaking change 아님. spec §4.4가 이미 "모든 외부 수신자에서 strip"이라 선언했던 계약을 뒤늦게 충족시키는 교정 | `CHANGELOG.md:34-35`, `execution-status-response.dto.ts` | 조치 불요 — 외부 통합자 공지가 필요한 조직이면 CHANGELOG를 별도 채널로 전파 |
| 6 | scope | 보안 수정 커밋에 실질과 무관한 빈 줄 하나(자매 파일 관례와 일치, 무해) | `interaction.service.ts:130` | 조치 불요 |
| 7 | scope | 이번 diff는 브랜치명이 가리키는 "terminal payload 정리" 작업과 무관하나, 직전 두 라운드에서 이미 "타당한 범위 밖 긴급 보안 수정"으로 검토·수용된 사안의 연장선 | `plan/in-progress/eia-terminal-payload.md` | 조치 불요 |
| 8 | security | 이미 유출된 데이터 사후 대응은 CHANGELOG + plan 체크리스트에 등재되어 추적 중, 코드 결함 아님 | `plan/in-progress/spec-draft-eia-62-waiting-payload.md` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 핵심 수정 유효성 확인(prototype pollution/비대칭 출구/깊이경계 문제 없음). REST 경로 깊이 sweep 테스트 부재만 WARNING |
| performance | NONE | 직전 라운드 성능 WARNING 2건(순서/비용문서) 모두 해소 확인. 신규 결함 없음 |
| architecture | LOW | 공유 유틸 승격은 구조적으로 올바름. JSDoc 인과 서술이 REST 호출부와 불일치(우연히 안전, 미검증) |
| requirement | LOW | 기능 구현 정확. spec §R17/§4.4 두 곳이 [SPEC-DRIFT]로 낡음(이미 planner 인계됨) |
| scope | LOW | diff 범위 좁고 정확, 무관 변경 없음. 브랜치명과의 표면적 불일치는 기수용 사안 |
| side_effect | LOW | 시그니처 변경(1→2 인자, private→export)·REST 응답 변경 모두 의도적이고 안전 확인됨 |
| maintainability | LOW | 함수명-순서 불일치, orphan JSDoc 2건의 가독성 결함 |
| testing | MEDIUM | REST 경로 깊이 경계 sweep 테스트 부재가 핵심 — 현재는 안전하나 회귀 가드 없음 |
| documentation | LOW | 대부분 이전 지적 정확히 해소. `@param maxDepth` JSDoc만 정정 누락 |
| api_contract | LOW | breaking change 아님, 오히려 기존 spec 계약을 충족시키는 교정 |
| user_guide_sync | NONE | 매트릭스 20행 전수 매칭 0건, 동반 갱신 누락 없음 |

## 발견 없는 에이전트

user_guide_sync (해당 없음 판정), performance (Critical/Warning 없음, 신규 결함 없음)

## 권장 조치사항

1. `interaction.service.spec.ts` 또는 `strip-external-only-fields.spec.ts`에 `MAX_REDACT_DEPTH` 기준 깊이 경계 `it.each` sweep 테스트를 추가해 REST 경로(`redactAndStrip`)의 안전성을 "코드 논증"에서 "실행 증거"로 전환한다 (testing/security/architecture 공통 지적, 가장 우선).
2. `strip-external-only-fields.ts`의 깊이-경계 안전성 JSDoc을 순서-무관 서술로 통일하고, `@param maxDepth` 블록의 미정정 문구("같은 값·같은 경계 연산자를 쓴다")도 상단 절과 일치시킨다.
3. `redactAndStrip` 함수명을 실제 실행 순서와 일치하는 이름으로 변경한다.
4. `websocket.service.ts`의 orphan JSDoc 블록(294-304행)을 삭제하거나 라인 주석으로 전환한다.
5. (project-planner 턴) `spec/5-system/14-external-interaction-api.md` §R17과 `spec/5-system/6-websocket-protocol.md` §4.4를 코드 구현(값 마스킹+필드 삭제 병행, REST+WS 양쪽 적용)과 일치하도록 갱신 — 처방은 `plan/in-progress/spec-draft-eia-62-waiting-payload.md` (7)번 항목에 이미 등재됨.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced 전원 결과 확보됨 — 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터 판단상 이번 diff 범위와 무관 (신규 의존성 추가 없음) |
  | database | 라우터 판단상 이번 diff 범위와 무관 (DB 스키마/쿼리 변경 없음) |
  | concurrency | 라우터 판단상 이번 diff 범위와 무관 (동시성 관련 로직 변경 없음) |