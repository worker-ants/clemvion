# 정식 규약 준수 검토 — `spec/5-system/` (impl-prep)

## 발견사항

### [WARNING] `spec/5-system/14-external-interaction-api.md` §R17 잔여③이 문서화한 출력 포맷이 계획된 구현으로 뒤집히는데 spec 갱신이 계획에 없음

- target 위치: `spec/5-system/14-external-interaction-api.md` §R17 "잔여 ③ (범위 밖 유지)" (`explore-tools.service.ts` 관련 문단)
- 위반 규약: 직접적으로는 `spec/conventions/**` 파일이 아니라 target 문서 자신의 서술과, 이를 뒷받침하는 프로세스 규약(루트 `CLAUDE.md` "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임")이다. 소관이 `cross_spec`/`side_effect` 축과 겹칠 수 있으나, 이 문서가 규정하는 **출력 포맷(마스킹 표현)** 이 정식 규약(§R17 은 egress-masking 정책의 SoT)이 규정하는 대상이라 항목 2(출력 포맷 규약) 관점에서도 유효하다.
- 상세:
  - §R17 잔여③(`spec/5-system/14-external-interaction-api.md:1652-1658`)은 현재 `explore-tools.service.ts` 가 `inputData`/`outputData`/`error` 를 `maskSensitiveFields`(**키 이름 기반**)로만 마스킹하며, "값-패턴 마스킹을 **단순 합성하면 안 된다** — 그 함수는 자격증명 키를 `****9876` 처럼 **접미 힌트를 남겨** 어떤 키가 가려졌는지 식별하게 하는데, 값-패턴 마스킹을 겹치면 그 힌트가 사라진다(기존 테스트가 이 회귀를 잡는다). 어느 의미가 우선하는지는 **별도 결정이라 분리했다**" 라고 명시한다.
  - 그 마스킹 함수(`maskSensitiveFields`)의 매칭 키 목록·`"****<last4>"` 포맷은 `spec/3-workflow-editor/4-ai-assistant.md:259` 가 SoT 로 정의한다(`apiKey`/`api_key`/`password`/`token`/`accessToken`/`refreshToken`/`secret`/`clientSecret`/`authorization` 리터럴 나열, 문자열 매치 시 `"****<last4>"`).
  - 그런데 `plan/in-progress/assistant-mask-leak.md` 는 오늘(2026-08-23) 사용자 결정으로 정확히 그 "별도 결정"을 내려 §R17 이 "안 된다"고 적은 것을 실행한다 — `deepRedactSecrets` 를 `explore-tools.service.ts` 6곳에 중첩해 값+키 축을 전면 적용하고, 그 결과 마스킹 값이 전부 `***` 로 바뀌어(기존 단언 6개 갱신 대상으로 plan 도 명시) **`****<last4>` 접미 힌트가 소멸**한다. 즉 §R17 잔여③이 서술하는 현재 동작·트레이드오프 자체가 구현 직후 거짓이 된다.
  - 그런데도 plan frontmatter 는 `spec_impact: none` 이다(`plan/in-progress/assistant-mask-leak.md:7`). §R17 잔여③과 `4-ai-assistant.md:259` 어느 쪽도 갱신 대상으로 지정돼 있지 않다.
- 제안: 구현 착수 전 `project-planner` 턴으로 (a) §R17 잔여③ 문단을 "결정 완료 — 값+키 축 전면 마스킹, 접미 힌트 트레이드오프는 유출 차단 우선으로 폐기" 로 갱신하고 (b) `4-ai-assistant.md:259` 의 `"****<last4>"` 서술을 새 동작(`***`)으로 동기화한 뒤, plan 의 `spec_impact` 를 `none` 에서 두 파일 경로로 정정한다. 이 정정 없이 구현만 진행하면 `spec-code-paths.test.ts` 는 걸리지 않지만(글로브 매치만 검사) 두 spec 문서가 실제 동작과 어긋난 채 남는다.

### [WARNING] `spec/conventions/egress-masking.md` 좌표계 표(2행)·`code:` frontmatter 가 구현 착수 후 새 소비처를 놓칠 위험

- target 위치: (간접) `spec/5-system/14-external-interaction-api.md` §R17 이 인용하는 마스킹 좌표계의 SoT
- 위반 규약: `spec/conventions/egress-masking.md` §1 좌표계 표 · §3 "이 문서는 기계가 지키지 않는다"
- 상세: `egress-masking.md` §1 표 2행(`MAX_REDACT_DEPTH`/`deepRedactSecrets`)의 "소비처(심볼)" 열은 현재 `deepRedactSecrets(REST 응답·저장 에러·conversation thread)` 만 열거하고, frontmatter `code:` 목록에도 `explore-tools.service.ts` 가 없다. `assistant-mask-leak.md` plan 은 이 함수를 `explore-tools.service.ts` 에 신규로 중첩 호출한다 — 표가 열거식(총칭이 아님, §1 "값 열은 깊이 값이지 행 번호가 아니다" 문단과 같은 결의 정밀함을 표방)이라는 문서 자신의 태도에 비추면, 이 신규 소비처가 등재되지 않는 한 표는 착수 직후 **불완전**해진다. §3 은 이 표가 사람이 갱신해야 하며 기계가 검사하지 않는다고 이미 자인하고 있고, 바로 이틀 전 병합된 PR(#1202, marker 게이트 통합)에서 "표가 낡을 것"이라는 예고가 실측 결과 틀렸던 사례를 §3 에 정정 기록해 두었다 — 즉 이 표의 갱신 여부를 **실측 없이 넘겨짚지 말라**는 것이 문서 자신의 최근 교훈이다.
- 제안: 구현 완료 직후(코드 리뷰 전) `deepRedactSecrets` 호출 사슬을 실측해 `egress-masking.md` §1 표 2행 소비처 열에 `explore-tools.service.ts`(LLM 도구 read 경로) 추가 여부를 판단하고, 필요 시 `code:` frontmatter 에도 반영한다. §3 의 "왜 낡는가" 교훈("마스커가 늘거나·합쳐지거나·상한/연산자가 바뀌는 것"이 진짜 트리거)에 비추면 이번 변경은 마스커 자체가 아니라 **소비처 확장**이므로 표 갱신이 필요 없다고 판단될 수도 있으나, 그 판단 자체를 §3 에 한 줄로 남겨야 다음 사람이 같은 조사를 반복하지 않는다(문서가 스스로 요구하는 패턴).

### [INFO] `spec/5-system/2-api-convention.md` — `## Overview` 섹션 부재

- target 위치: `spec/5-system/2-api-convention.md:16-22` (frontmatter 직후 관련 문서 blockquote → 곧바로 `## 1. 기본 원칙`)
- 위반 규약: 루트 `CLAUDE.md` "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 권장"
- 상세: 같은 번들에 포함된 `1-auth.md`(§Overview 존재, `1-auth.md:27`)·`3-error-handling.md`(§Overview 존재, `3-error-handling.md:19`)와 달리 `2-api-convention.md` 는 명시적 `## Overview` 헤더 없이 바로 본문(§1)으로 진입한다. `status: implemented` 로 오래 정착된 문서라 이 자체가 기능적 문제는 아니며 "권장" 수준 위반이라 INFO 로 등급.
- 제안: 이번 masking 작업과 직접 관련은 없으나, 같은 파일을 만질 기회가 있으면 §1 앞에 2~3문장 Overview(현재 §1~§12 목록을 요약) 를 추가해 형제 문서들과 구조를 맞출 수 있다. 급하지 않음.

## 요약

`spec/5-system/` 번들 중 전문이 포함된 세 파일(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md`)의 명명·에러코드 표기(`UPPER_SNAKE_CASE`)·Swagger DTO 규약 참조는 `spec/conventions/error-codes.md`·`swagger.md`·`node-output.md` 와 정합했고 뚜렷한 위반은 찾지 못했다. 다만 이번 작업(`assistant-mask-leak`)이 실제로 건드릴 마스킹 표면은 target 문서 자신(§R17 잔여③, `14-external-interaction-api.md`)이 "값-패턴 마스킹을 단순 합성하면 안 된다"고 명시적으로 적어 둔 자리이고, 오늘자 사용자 결정이 바로 그 보류된 결정을 내려 정반대로 뒤집는데도 plan 의 `spec_impact` 가 `none` 으로 선언돼 있다 — 구현 착수 전 이 지점의 spec 갱신 필요성을 project-planner 턴으로 재확인할 것을 권한다. 이 발견은 순수 `spec/conventions/**` 위반이라기보다 target 문서의 자기서술·`CLAUDE.md` 역할분리 규약에 걸치므로 다른 축(cross_spec 등) 리포트와 중복 여부를 통합 시 대조하는 것이 좋다. 그 외 egress-masking.md 좌표계 표의 사후 동기화 필요성(WARNING)과 `2-api-convention.md` 의 Overview 섹션 부재(INFO)는 경미하다.

## 위험도

MEDIUM
