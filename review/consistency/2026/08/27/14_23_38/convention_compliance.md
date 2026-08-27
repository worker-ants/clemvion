# 정식 규약 준수 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 검토 방법 메모

프롬프트 번들은 컨텍스트 예산 초과로 `spec/5-system/` 대상 파일 19개 전부와 diff 자체가 생략되어
있었다. 지시대로 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/masking-residuals-0b195b`)에서
직접 다음을 확인했다:

- `git diff origin/main...HEAD --stat` — `spec/5-system/` 안에서 실제 변경된 파일은
  `4-execution-engine.md` · `6-websocket-protocol.md` · `14-external-interaction-api.md` **3개**뿐
  (나머지 16개는 이번 PR 에서 무변경, "누락" 오탐 근거 아님).
- 세 파일 + `spec/2-navigation/14-execution-history.md` · `spec/4-nodes/3-ai/1-ai-agent.md` ·
  `spec/3-workflow-editor/4-ai-assistant.md` 의 diff 전문.
- `spec/conventions/egress-masking.md` · `spec/conventions/node-output.md` diff 전문(둘 다
  프롬프트에 완전 포함되어 있었음) + 현재 파일 전체(`grep -n "^## "`로 구조 확인).
- 관련 코드 diff: `handler-output.adapter.ts`(+spec) · `mask-sensitive-fields.util.ts`(+spec) ·
  `execution-context.service.ts`(+spec) · `websocket.service.ts` · `ai-turn-executor.ts`.
- 용어 정합성 grep: `boundary masking parity`(폐기 용어) 전역 0건, `egress masking parity`(신규
  용어) 5곳 전부 하이픈/띄어쓰기 일치, `maskSensitiveFields.*boundary` 잔존 1건은 "폐기된
  boundary" 를 과거형으로 언급하는 의도된 이력 서술.
- 직전 라운드 산출물 대조: 같은 diff 를 대상으로 한 consistency-check 3라운드
  (`08/24 19_26_06`, `08/27 13_25_45`, `08/27 13_47_15`)와 code-review 6라운드가 이미 존재하며,
  전부 CRITICAL 0 로 수렴했고 지적된 WARNING/INFO 는 후속 커밋(`69802a686`, `126609555` 등)에서
  반영되었음을 커밋 로그로 확인.

## 변경 개요

이번 PR 은 "config echo 마스킹을 어댑터(storage 경계)에서 egress(REST/WS)로 이동"하는 변경이다.
`handler-output.adapter.ts` 의 `maskSensitiveFields(config)` 호출을 제거해 `NodeExecution.outputData`
와 표현식(`$node["X"].config.*`)이 원문을 보게 하고, 안전성은 REST/WS 두 egress 가 공유하는
`deepRedactSecrets*` 가 이미 `DEFAULT_SENSITIVE_KEYS` 를 포함한다는 관계(캐너리로 고정)에 위임한다.
`spec/5-system/` 3개 파일 변경은 이 코드 변경을 반영하는 "boundary → egress" 용어 정정 +
자기-반증형 소정정 취소선 정정 수준의 좁은 편집이다.

## 발견사항

### INFO — `node-output.md` mutation-보호 절이 이번 PR 이 만든 반대 방향 aliasing 계약을 아직 다루지 않음 (기추적, 신규 아님)
- target 위치: `spec/conventions/node-output.md` "`context.rawConfig` 의 mutation 보호" 단락
  (Principle 7 절 하단)
- 위반 규약: 명시적 위반 아님 — 문서 커버리지 gap
- 상세: `execution-context.service.ts` 의 신규 JSDoc 은 `maskSensitiveFields` 제거로
  `adapted.config` 가 더 이상 방어적 복제본이 아니라 핸들러가 반환한 객체 그 자체가 장수명
  캐시(`structuredOutputCache`)에 참조로 저장된다는 새 불변식을 코드 주석에만 명시한다.
  `node-output.md` 의 기존 mutation-보호 절은 `context.rawConfig`(엔진→핸들러 입력)의 freeze
  방향만 다루고, 이 반대 방향(핸들러→엔진 캐시, 출력 aliasing)은 다루지 않는다. 이 갭은 이미
  직전 두 라운드(`13_47_15/RESOLUTION.md` INFO 6, `review/code/.../14_10_42/SUMMARY.md` #14)가
  발견해 "정본 트래커 등재, 비차단" 으로 처분한 사안과 동일 — 이번 라운드에서 **재확인**만 하며
  새 처분을 요구하지 않는다.
- 제안: 기존 처분(트래커 등재) 유지. 추가 조치 불요.

### INFO — `node-output.md` 는 CLAUDE.md 의 Overview/본문/Rationale 3섹션 권장 구조를 갖추지 않음 (이번 diff 가 만든 것 아님)
- target 위치: `spec/conventions/node-output.md` 전체 (`## Principle 0` ~ `## Principle 참조 매트릭스`)
- 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장
- 상세: 파일 헤더 직후 소개 문단은 있으나 `## Overview` 헤더가 없고, 파일 끝에 `## Rationale`
  섹션도 없다(자매 문서 `egress-masking.md` 는 `## Overview` → 본문 → `## Rationale` 3섹션을
  갖춘 것과 대비). 다만 이 구조는 이번 PR 이전부터 존재했고(frontmatter `status: partial`,
  `pending_plans: node-output-redesign` 참조), 이번 diff 는 기존 문단 내부에 문장을 추가·정정한
  것뿐이라 **신규 위반이 아니다**.
- 제안: 차단 사유 아님. `plan/in-progress/node-output-redesign/README.md` 개정 시 함께 정리할
  후보로만 기록.

## 확인된 준수 사항 (참고)

- **용어 교체 완결성 재확인**: "boundary masking parity" → "egress masking parity" 치환이
  `spec/2-navigation/14-execution-history.md` · `spec/5-system/14-external-interaction-api.md` ·
  `spec/5-system/6-websocket-protocol.md` · `websocket.service.ts` JSDoc 전부에 일관 반영되어
  있고(전역 grep 잔존 0건), 신규 용어의 표기(하이픈·띄어쓰기)도 5곳 전부 동일하다.
- **좌표계 SoT 정합**: `egress-masking.md` §1 좌표계 표는 이번 PR 로 바뀌지 않았고, 신규 콜아웃
  ("`maskSensitiveFields` 는 이 좌표계 표에 행이 없다")이 `mask-sensitive-fields.util.ts` 주석
  ("소비처는 이제 `explore-tools.service.ts` 하나다")과 정확히 일치한다. frontmatter `code:`
  목록도 `handler-output.adapter.ts` 를 (올바르게) 배제하고 있다 — 그 파일은 더 이상 마스킹을
  수행하지 않으므로.
- **egress-only 원칙 문구 정합**: `node-output.md` Principle 7 신규 블록과
  `spec/5-system/4-execution-engine.md` "Engine Raw Config Exposure" 신규 블록이 같은 근거(REST
  `redactStoredDataForResponse` / WS `maskWireEnvelope`, 공유 `deepRedactSecrets*`)를 문구
  단위로 정합하게 서술하고, 앵커(`#principle-7--config-echo-원칙-nodehandleroutputconfig`)도
  포함되어 있다(직전 라운드 INFO 5 로 지적된 뒤 보강됨).
- **금지 패턴(마커 리터럴) 미위반**: `egress-masking.md` 는 "마커 리터럴을 문서에 적지 않는다"
  규칙을 갖는데, 이번 diff 가 스친 `****abcd` 문자열은 `masked-markers` 패키지의
  `VALUE_MASK_MARKER`(`"***"`)/`DEPTH_MASK_MARKER`(`"[REDACTED_DEPTH]"`) 상수 값이 **아니라**
  별개 유틸 `maskSensitiveFields` 의 서술 포맷(`"****<last4>"`)을 가리키는 illustrative
  placeholder다 — 두 마스킹 메커니즘이 다르므로 혼동이 아니다.
- **자기-반증형 소정정 형식 준수**: 취소선(`~~구문~~`) + 굵게 정정문 + 날짜(2026-08-24) 패턴이
  `node-output.md` · `4-execution-engine.md` · `ai-agent.md` · `14-execution-history.md` 등
  전 대상 문서에서 동일 스타일로 적용되고, 인접 서술(TTL·재구성 로직 등)은 건드리지 않았다 —
  CLAUDE.md §자기-반증형 소정정 조건 4를 만족.
- **거버넌스 경로 준수**: `plan/complete/masking-expression-egress-split.md` 의 `spec_impact`
  에 이 3개 `spec/5-system/` 파일이 포함된 6개 파일이 등재되어 있고, 코드 변경은 developer 가
  아닌 planner 턴(spec drift 정정)으로 처리되었음이 커밋 이력(`57fb83592`)으로 확인된다.
- **API 문서 규약(Swagger/OpenAPI)**: 이번 diff 범위에 컨트롤러/DTO/데코레이터 변경이 전혀
  없어 이 관점의 신규 위반 없음.
- **명명 규약**: 신규 export `DEFAULT_SENSITIVE_KEYS` 는 기존 상수 명명(SCREAMING_SNAKE_CASE)
  관례와 일치. 신규 파일·엔드포인트 없음.

## 요약

`spec/5-system/` 에서 이번 PR 로 실제 변경된 파일은 3개(`4-execution-engine.md` ·
`6-websocket-protocol.md` · `14-external-interaction-api.md`)뿐이며, 모두 "config echo 마스킹을
storage 경계에서 egress 로 이동"하는 코드 변경을 반영하는 용어 정정·자기-반증형 취소선 정정
수준의 좁은 편집이다. `spec/conventions/egress-masking.md` 및 `node-output.md` 의 좌표계·Principle 7
서술과 문구 단위로 정합하며, "boundary masking parity → egress masking parity" 용어 교체가 관련
전 문서·코드에 누락 없이 전파되었음을 독립적으로 재확인했다. 이 diff 는 이미 3라운드의
consistency-check 와 6라운드의 code-review 를 거쳤고, 그 라운드들이 지적한 항목은 후속 커밋에서
반영되었거나 비차단으로 처분되어 정본 트래커에 등재된 상태다. 이번 4번째 convention-compliance
라운드에서도 CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다. INFO 2건은 모두 (1) 기존에
이미 등재·처분된 사안의 재확인, (2) 이번 diff 가 만들지 않은 `node-output.md` 의 선재 구조
갭이며, 둘 다 차단 사유가 아니다.

## 위험도

NONE
