# 정식 규약 준수 검토 — convention_compliance

대상: `spec/5-system/` (--impl-done, diff-base `origin/main`)

## 조사 방법 메모

prompt 번들은 컨텍스트 예산 초과로 `spec/conventions/**` 전량, `git diff origin/main...HEAD -- code_areas`,
`spec/5-system/14-external-interaction-api.md`·`15-chat-channel.md` 등 17개 파일 본문이 생략되어 있었다.
워크트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)에서
`git diff origin/main...HEAD --stat`, 관련 코드 diff, `spec/conventions/*.md`, `spec/5-system/14-external-interaction-api.md`·
`6-websocket-protocol.md` 를 직접 Read/Bash 로 열어 확인했다.

이번 diff(`origin/main...HEAD`)는 **`spec/5-system/**` 를 한 글자도 건드리지 않는다** — 실질 코드 변경은
`codebase/backend/src/modules/external-interaction/interaction.service.ts`,
`codebase/backend/src/modules/websocket/websocket.service.ts`,
`codebase/backend/src/shared/utils/strip-external-only-fields.ts`(신설, deep-recursive strip 유틸)와
그 테스트, 그리고 `CHANGELOG.md`/`plan/**`/`review/**` 산출물뿐이다. HEAD 는 오늘자 직전 라운드
(`14_30_36` 리뷰 시점의 커밋 `34e32e62f`)보다 한 커밋(`7fa12301c` — waiting/terminal `result`/`error` 세 출구를
`redactAndStrip` 헬퍼로 통합) 더 나아가 있다. 따라서 본 점검은 "target 문서(spec/5-system/)가 **지금 상태로**
conventions 를 따르는가", 특히 이 최신 커밋 이후에도 spec 문서가 서술하는 출력 형식·보안 마스킹 계약이
실제 코드와 정합한지에 집중했다.

## 발견사항

### [WARNING] EIA §R17 "표면 제약(보안)"의 `getStatus` 마스킹 서술이 최신 커밋 이후에도 여전히 좁게 남아 있음

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §R17 "표면 제약(보안)" >
  `nodeOutput.conversationConfig` + terminal `result`/`error` 항목 (L1346–1352)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` Overview 의 "spec 문서가 약속한 surface 와 실제
  구현 코드 사이의 정적 증거가 정합해야 한다"는 SoT 원칙(문서 서술 정확성 일반 원칙), 그리고 인접해서
  `2-api-convention.md §5.3`/`§5.4`(출력 형식·부재 표현을 실제 wire 와 정확히 일치하도록 문서화하라는 규약)의
  취지.
- **상세**: 커밋 `7fa12301c`(오늘 14:55 최신)로 `getStatus` 의 waiting `nodeOutput` / terminal `result` /
  terminal `error` 세 출구가 전부 `redactAndStrip`(= `deepRedactSecrets` 값 마스킹 + `stripExternalOnlyFields`
  필드 삭제) 를 거치도록 통일됐다. 그런데 §R17 은 여전히 다음과 같이만 서술한다 — *"`getStatus` 는 `nodeOutput`
  전체 + terminal `result`(COMPLETED)/`error`(FAILED)의 `outputData` 를 `deepRedactSecrets` 로 마스킹한다
  (REST 는 sanitizePayloadForWs 미적용 경로라 필수). **마스킹은 secret-shape 만 치환**(정상 결과 데이터는
  copy-on-change 로 보존)."* `stripExternalOnlyFields`(필드 자체 삭제)는 전혀 언급되지 않고, "secret-shape 만
  치환" 단정은 이제 사실과 다르다 — `llmCalls` 는 값이 아니라 **키가 통째로 사라진다**. 직전 줄(L1349)의
  "(에디터 전용 `turnDebug.llmCalls` 는 건드리지 않음)" 도 waiting emit(WS/SSE) 한정 서술인데 `getStatus`
  서술 바로 앞에 붙어 있어 "getStatus 도 llmCalls 를 안 건드린다"는 오독을 유발하는 배치가 그대로다.
- **이미 추적 중(신규 아님, 여전히 미반영)**: `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 에
  "§R17 정정" 항목이 이미 등재돼 있다 — 커밋 `7fa12301c` 가 그 plan 파일에 "현행은 `getStatus` 를 *secret-shape
  만 치환*으로 서술하는데 실제로는 값 마스킹+필드 삭제를 병행한다. 세 출구 전부에 적용됨을 명시할 것 — 코드가
  spec 을 앞질러 있다" 문구를 정확히 추가했다(재확인: `git show 7fa12301c -- plan/in-progress/spec-draft-eia-62-waiting-payload.md`).
  즉 **정정 필요성 자체는 이번 커밋에서 이미 문서화됐으나, spec 본문(§R17)에는 아직 반영되지 않은 상태**다.
  `developer` 역할은 `spec/` 쓰기 권한이 없어(SKILL 체계) 이 gap 을 본 PR 범위에서 닫을 수 없고, 다음
  `project-planner` 턴을 필요로 한다.
- **제안**: 다음 `project-planner` 턴에서 §R17 "표면 제약(보안)"의 `getStatus` 서술을 "`getStatus` 는
  `deepRedactSecrets`(값 마스킹)에 더해 `stripExternalOnlyFields`(`llmCalls` 등 debug 전용 필드를 깊이
  무관으로 **삭제**)를 waiting `nodeOutput`·terminal `result`·terminal `error` **세 출구 모두**에 동일하게
  적용한다"로 갱신. WS §4.4 Rationale ↔ EIA §R17 상호 역참조를 추가하면 plan 항목의 "역참조" 요구도 함께
  충족된다.

## 그 외 확인한 사항 (위반 없음)

- 이번 diff 는 신규 DTO·API endpoint·WS 메시지 타입을 추가하지 않아 `swagger.md`(§1 DTO 패턴/§2 컨트롤러
  데코레이터) 대상 변경이 없다.
- `stripExternalOnlyFields(value, maxDepth)` 의 호출부별 깊이 상한 — WS 는 `MAX_SANITIZE_DEPTH`, REST(신규
  `redactAndStrip`)는 `MAX_REDACT_DEPTH` — 모두 동일 값(10)이며, 파일 자신의 JSDoc 이 주장하는 계약
  ("경계 연산자는 이 함수가 항상 `>` 로 고정하고, 안전의 근거는 '자매가 그 깊이에서 이미 객체를 없앤다'")과도
  실제 구현(REST 자매 `deepRedactSecrets` 의 `>=` 경계 자체 인정)이 일치한다. 이전 라운드(`14_30_35` W3)가
  지적한 "계약 문구가 거짓" 이슈는 이번 커밋에서 실제 성질에 맞게 재서술돼 해소됐다.
- 신설 공용 유틸 `strip-external-only-fields.ts` 가 `6-websocket-protocol.md`/`14-external-interaction-api.md`
  frontmatter `code:` 목록에 개별 열거되지 않은 점은 `spec-impl-evidence.md` R-1 의 glob 기반 하위 커버리지
  허용 범위 안이라(가드 `spec-code-paths.test.ts` 는 glob ≥1 매치만 요구) 위반 아님 — 두 문서 모두 다른 공용
  유틸(`sanitize-error-message.ts` 등)도 개별 열거하지 않는 기존 관행과 일치한다.
- `2-api-convention.md`/`6-websocket-protocol.md`가 인용하는 `swagger.md §1-3`/`§2-5`/`§6`, `node-output.md
  Principle 1.1.4`/`3.2`, `error-codes.md` 앵커는 실제 헤딩과 일치해 broken-link 없음(직접 grep 대조).
- 명명 규약(URL 케밥케이스·복수형 리소스, 에러 코드 `UPPER_SNAKE_CASE`, 상수 `SCREAMING_SNAKE_CASE`) 관점에서
  이번 코드가 추가한 식별자(`EXTERNAL_STRIPPED_FIELDS`, `redactAndStrip`, `stripExternalOnlyFields`,
  `MAX_REDACT_DEPTH`)는 기존 관용을 그대로 따르며 신규 API 표면·에러 코드를 도입하지 않는다.
- 문서 구조 규약(Overview/본문/Rationale, `_product-overview.md`) — `2-api-convention.md`/
  `6-websocket-protocol.md` 는 명시적 `## Overview` 헤딩이 없으나, 이는 오늘 앞선 라운드(`10_32_29`)가 이미
  확인했듯 `project-planner/SKILL.md §Spec 문서 구조`가 다중 spec 파일 영역에 `_product-overview.md` 분리를
  허용하고 `spec/5-system/_product-overview.md` 가 실재·상단에서 링크되므로 위반이 아니다. 두 문서 모두
  `## Rationale` 종결 섹션을 갖춰 3섹션 취지를 충족한다. 이 판단은 이번 PR 과 무관한 기존 구조이기도 하다.

## 요약

이번 PR(HEAD 최신 커밋 `7fa12301c` 포함)은 spec 문서를 전혀 건드리지 않고 백엔드 코드만 바꾼 보안 강화
패치다 — `getStatus` REST 스냅샷의 waiting/terminal 세 출구를 공용 `redactAndStrip` 헬퍼로 묶어 `llmCalls`
등 debug 전용 필드가 값 마스킹뿐 아니라 필드 삭제까지 일관되게 받도록 했다. `spec/conventions/**` 의
명명·출력 포맷·API 문서(swagger)·문서 구조·금지 패턴을 직접 위반하는 신규 지점은 찾지 못했다. 유일한
잔존 이슈는 `spec/5-system/14-external-interaction-api.md` §R17 이 `getStatus` 마스킹을 "secret-shape 만
치환"으로 좁게 서술해 실제 동작(값 마스킹+필드 삭제 병행)보다 뒤처져 있다는 점(WARNING, 신규 아님·
이전 두 라운드부터 지속) — 이 최신 커밋이 정정 필요성 자체를 `plan/in-progress/spec-draft-eia-62-waiting-payload.md`
에 명시적으로 등재했으나 `developer` 권한 밖이라 spec 본문 자체는 아직 미수정 상태다. 이전 라운드(`14_30_35`
W3)가 지적했던 JSDoc 계약 문구 오류는 이번 커밋에서 해소됐다.

## 위험도

LOW
