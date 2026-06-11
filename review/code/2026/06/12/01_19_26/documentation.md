# Documentation Review

## 발견사항

### [INFO] `error-codes.ts` — `DB_HOST_BLOCKED` 주석 대칭 완성도 양호
- 위치: `/codebase/backend/src/nodes/core/error-codes.ts` (추가된 4줄 주석)
- 상세: 새 코드에 opt-out 환경변수(`ALLOW_PRIVATE_HOST_TARGETS=true`), 가드 SoT(`http-request/http-safety.ts`), 대칭 코드(`HTTP_BLOCKED`·`EMAIL_HOST_BLOCKED`) 참조가 명확히 문서화되어 있다. `EMAIL_HOST_BLOCKED` 기존 주석과 동일한 서술 패턴을 따라 일관성을 갖춘다.
- 제안: 현행 유지. 추가 요구 없음.

### [INFO] `execution-failure-classifier.ts` — 모듈 수준 JSDoc SoT 참조 최신성 확인 필요
- 위치: `/codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts`, 모듈 JSDoc (`SoT:` 섹션)
- 상세: JSDoc 에 `spec/conventions/chat-channel-adapter.md §3.1` 과 `spec/5-system/3-error-handling.md §1.4 / §3.2` 가 SoT 로 명시되어 있다. `DB_HOST_BLOCKED` 를 `INTERNAL_CODES` 에 추가한 이번 변경이 해당 spec 참조 섹션들과 실제로 일치하는지 외부 spec 파일에서 확인이 필요하다. 코드 내 인라인 주석(`spec §3.1 DB_* 매핑과 일치`)은 이를 보충하지만, spec 파일 자체에 `DB_HOST_BLOCKED` 가 `DB_*` 내부 분류 항목으로 명시되어 있지 않다면 JSDoc 의 SoT 참조가 부분적으로 오해를 줄 수 있다.
- 제안: `spec/conventions/chat-channel-adapter.md §3.1` 에 `DB_HOST_BLOCKED` 가 `DB_*` 패턴의 internal 분류 대상임을 명시하는 1줄 보충을 검토한다 (planner 도메인). 코드 측 JSDoc 자체는 현재 맥락에서 충분하다.

### [INFO] `execution-failure-classifier.spec.ts` — 테스트 인라인 주석 문서화 품질 양호
- 위치: `/codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.spec.ts` (추가된 `it` 블록)
- 상세: 추가된 테스트 케이스에 달린 인라인 주석(`// DB_HOST_BLOCKED 가 INTERNAL_CODES 에 등재되었으므로 internal 로 분류되며 / unknown-fallback warn 로그(CCH-ERR-04)를 발생시키지 않는다 (spec §3.1 DB_*)`)은 의도를 분명하게 서술하고 spec 참조를 포함하고 있어 적절하다.
- 제안: 현행 유지.

### [INFO] `database-query.handler.ts` — SSRF 가드 인라인 주석 업데이트 완료, `mapDbError` 주석 동기화 확인
- 위치: `/codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` (diff 2개 hunk)
- 상세: 두 번째 hunk(D4 주석 업데이트)는 "SSRF guard 의 plain Error 는 mapDbError 의 fallback(`INTEGRATION_CALL_FAILED`) 로 흐른다" 라는 이전에 사실과 달랐던 설명을 "위에서 `DB_HOST_BLOCKED` IntegrationError 로 승격되므로 더 이상 mapDbError fallback(`INTEGRATION_CALL_FAILED`) 로 흐르지 않는다"로 수정하였다. 기존에 부정확했던 주석이 코드와 일치하도록 수정된 것으로 긍정적이다.
- 제안: 현행 유지.

### [INFO] `database-query.handler.spec.ts` — 신규 describe 블록 인라인 주석 품질 양호
- 위치: `/codebase/backend/src/nodes/integration/database-query/database-query.handler.spec.ts` (추가된 `describe('SSRF host guard ...')`)
- 상세: describe 블록 상단 주석이 HTTP_BLOCKED·EMAIL_HOST_BLOCKED 대칭 근거와 "literal IP/localhost fast-path 라 실제 DNS 없이 결정적으로 차단된다"는 테스트 환경 특성을 설명하고 있다. 각 `it` 블록 내 주석도 단언 의도를 명확히 서술한다. `ALLOW_PRIVATE_HOST_TARGETS=true` opt-out 테스트 역시 환경변수 복원 로직과 함께 명확히 설명되어 있다.
- 제안: 현행 유지.

### [INFO] `spec/4-nodes/4-integration/2-database-query.md` — spec 업데이트 적정, 예제 코드 보완 검토 가능
- 위치: `/spec/4-nodes/4-integration/2-database-query.md` §4 SSRF 가드 callout, §5.3 필드 표, §6.2 에러 코드 표
- 상세: §4 SSRF 가드 callout 이 `DB_HOST_BLOCKED` 코드 신설, 메시지 일반화 정책, `ALLOW_PRIVATE_HOST_TARGETS` opt-out 을 모두 반영하여 업데이트되었다. §5.3 출력 필드 표의 `output.error.code` 열거에 `DB_HOST_BLOCKED` 가 추가되었고, §6.2 에러 코드 표에 신규 행이 삽입되었다. 전반적으로 spec 이 구현과 동기화되어 있다. 단, §5.3 에 SSRF 차단 시의 구체적인 JSON 출력 예제(`5.3.x DB_HOST_BLOCKED` 케이스)가 없다 — 기존 구문 오류/커넥션 drop/제약 위반/권한 부족 네 케이스는 각각 JSON 예제가 있으나 SSRF 차단 케이스는 없다.
- 제안(INFO 수준): §5.3 에 `DB_HOST_BLOCKED` 케이스 JSON 예제 1개를 추가하면 워크플로우 작성자가 분기 코드를 바로 복사할 수 있어 일관성이 높아진다. 필수는 아니나 기존 패턴과의 대칭을 위해 권장.

### [INFO] `plan/in-progress/http-ssrf-all-auth-followups.md` — 체크박스 업데이트 충분, 잔존 항목 문서화 명확
- 위치: `/plan/in-progress/http-ssrf-all-auth-followups.md`
- 상세: `DB_HOST_BLOCKED` 신설 항목이 `[x]` 로 체크되고 사용자 결정 경위, 구현 범위, PR 그룹명이 상세히 기재되어 있다. 잔존 미완 항목(`[ ]`)은 그대로 유지되어 후속 작업 추적이 명확하다.
- 제안: 현행 유지.

### [WARNING] `spec/5-system/3-error-handling.md §1.4 / §3.2` — `DB_HOST_BLOCKED` 동기화 여부 미확인
- 위치: plan 항목에서 참조된 `spec/5-system/3-error-handling.md §1.4` / `§3.2` 및 `spec/conventions/chat-channel-adapter.md §3.1`
- 상세: `plan/in-progress/http-ssrf-all-auth-followups.md` 의 기완료 항목에 "spec `2-database-query §4/§5.3/§6.2`·`3-error-handling §1.4/§3.2` 동기"가 완료 사항으로 기술되어 있으나, 이번 diff 에 포함된 파일은 `2-database-query.md` 뿐이다. `3-error-handling.md §1.4`(ErrorCode SoT 열거) 와 `§3.2`(입력 enum SoT)에 `DB_HOST_BLOCKED` 가 실제로 추가되었는지는 제공된 diff 범위 안에서 확인되지 않는다. `execution-failure-classifier.ts` 의 JSDoc 이 이 파일들을 SoT 로 명시하고 있어, 미동기화 시 문서 불일치가 된다.
- 제안: `spec/5-system/3-error-handling.md §1.4` 와 `§3.2` 에서 `DB_HOST_BLOCKED` 가 열거되었는지 확인한다. 누락 시 `DB_*` 그룹에 1행 추가가 필요하다. (`spec/conventions/chat-channel-adapter.md §3.1` 의 `DB_*` internal 분류 확인도 동일).

## 요약

이번 변경은 `DB_HOST_BLOCKED` 에러 코드 신설에 따른 코드·spec·plan 문서화를 전반적으로 잘 수행했다. `error-codes.ts` 의 인라인 주석은 대칭 코드들과 동일 패턴으로 opt-out 환경변수와 SoT 경로를 명시했고, `database-query.handler.ts` 의 이전에 부정확했던 SSRF 가드 경로 설명 주석이 현실에 맞게 수정되었다. `spec/4-nodes/4-integration/2-database-query.md` 도 §4·§5.3·§6.2 세 위치 모두 동기화되었다. 주요 미결 사항은 `spec/5-system/3-error-handling.md §1.4/§3.2` 와 `spec/conventions/chat-channel-adapter.md §3.1` 에 `DB_HOST_BLOCKED` 가 실제로 반영되었는지 이번 diff 범위 밖에서 확인이 안 된다는 점이며, 이것이 누락되면 `execution-failure-classifier.ts` 의 JSDoc SoT 참조와 불일치가 발생한다. 또한 `spec §5.3` 에 `DB_HOST_BLOCKED` 케이스 JSON 예제가 없어 기존 에러 케이스들과의 대칭이 약하다.

## 위험도

LOW
