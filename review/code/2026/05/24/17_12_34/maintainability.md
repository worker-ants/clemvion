# 유지보수성(Maintainability) 리뷰

리뷰 대상 PR: form-resubmit-fix (render_form submit 후 동일 form 재호출 회귀 차단)
리뷰 일시: 2026-05-24

---

## 발견사항

### [INFO] `PRESENTATION_TOOLS_GUIDANCE` 상수의 문자열 연결 방식이 장문화되어 가독성 부담 증가
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L183–L203
- 상세: 기존에도 여러 줄 문자열 연결(`+` 연산자) 방식으로 작성된 상수였는데, 이번 변경으로 한 줄이 더 추가되어 총 길이가 더욱 길어졌다. 마지막 추가 라인(L202–203)은 단독으로 약 180자 이상의 긴 문자열이라 에디터에서 수평 스크롤 없이 전체를 읽기 어렵다. 기존 코드베이스 스타일(각 케이스를 `\n-` 으로 구분하는 패턴)은 잘 따르고 있어 구조 일관성은 유지된다.
- 제안: 즉시 변경이 필요한 수준은 아니지만, 장기적으로 이 상수를 별도 파일(예: `presentation-tools-guidance.ts`)이나 tagged template literal 로 분리하면 각 케이스를 독립적으로 읽고 편집하기 쉬워진다.

---

### [INFO] `FORM_SUBMITTED_GUIDANCE_MESSAGE` 상수와 `PRESENTATION_TOOLS_GUIDANCE` 내 `form_submitted` 라인의 표현이 유사하나 동일하지 않아 향후 이중 관리 부담 존재
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L214–L215 vs L202–L203
- 상세: 두 텍스트가 같은 의도를 전달하도록 단일 상수(`FORM_SUBMITTED_GUIDANCE_MESSAGE`)를 추출한 설계 의도(JSDoc 설명 참조)는 올바르다. 그러나 현재 구현을 보면 `FORM_SUBMITTED_GUIDANCE_MESSAGE` 는 tool_result `message` 필드에 직렬화될 때만 쓰이고, `PRESENTATION_TOOLS_GUIDANCE` 의 `form_submitted` 설명 라인은 별도의 독립 문자열 리터럴로 존재한다. 두 위치의 표현이 사실상 독립적으로 유지·변경될 수 있어 "단일 상수로 추출해 두 위치의 표현 어긋남을 방지한다"는 목표가 절반만 달성된 상태다.
- 제안: `PRESENTATION_TOOLS_GUIDANCE` 의 `form_submitted` 라인 내에서 핵심 안내 부분(`같은 form 을 다시 호출하지 마세요` 구문)을 `FORM_SUBMITTED_GUIDANCE_MESSAGE` 변수를 참조하는 방식으로 구성하거나, 또는 상수 이름·JSDoc 주석을 현실에 맞게 "두 위치가 독립적임을 허용하되 의미상 일관성을 유지한다"고 수정하여 오해를 방지한다.

---

### [INFO] `FORM_SUBMITTED_GUIDANCE_MESSAGE` 상수가 `PRESENTATION_TOOLS_GUIDANCE` 선언 이후에 위치하여 의존 방향이 역전된 형태
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L183 (`PRESENTATION_TOOLS_GUIDANCE`) vs L214 (`FORM_SUBMITTED_GUIDANCE_MESSAGE`)
- 상세: 의미상 `FORM_SUBMITTED_GUIDANCE_MESSAGE` 가 `PRESENTATION_TOOLS_GUIDANCE` 의 일부를 공유하는 하위 개념임에도, 선언 순서는 `PRESENTATION_TOOLS_GUIDANCE` 가 먼저 나온다. 이번 변경에서 `PRESENTATION_TOOLS_GUIDANCE` 가 `FORM_SUBMITTED_GUIDANCE_MESSAGE` 를 참조하도록 수정되지 않아(별도 리터럴 유지) 실질적 의존은 없으나, 독자가 두 상수의 관계를 파악하려면 양쪽을 오가며 읽어야 한다. 상수가 추가될수록 이 파일 상단이 관련 없는 상수들로 채워질 수 있다.
- 제안: 두 상수의 선언 순서를 역전(`FORM_SUBMITTED_GUIDANCE_MESSAGE` 먼저)하거나, `PRESENTATION_TOOLS_GUIDANCE` 내의 `form_submitted` 라인이 `FORM_SUBMITTED_GUIDANCE_MESSAGE` 를 보간하도록 연결하면 순서와 의존 방향이 일치한다.

---

### [INFO] e2e 픽스처 SQL 인라인 문자열에 하드코딩된 리터럴 값들이 픽스처 파일 간 중복
- 위치: `codebase/backend/test/chat-channel-discord.e2e-spec.ts` L190, L213 / `codebase/backend/test/chat-channel-slack.e2e-spec.ts` L239, L264
- 상세: `'discord-e2e-trigger'`, `'slack-e2e-trigger'`, `true`, `1` 등 픽스처 행 리터럴이 두 파일에 유사한 패턴으로 하드코딩되어 있다. 두 파일은 `setupDiscordTrigger` / `setupSlackTrigger` 로 이름만 다른 동일 구조 함수를 각각 유지한다. 이번 변경은 기존 패턴을 따른 스키마 동기화 수정이므로 변경 자체는 정확하나, 스키마 컬럼 목록이 두 파일에 병렬로 존재해 향후 스키마 변경 시 두 파일을 모두 수정해야 한다.
- 제안: 이번 변경 범위에서 즉시 리팩토링을 요구하지는 않으나, 두 픽스처 함수를 공유 헬퍼(`test/helpers/e2e-fixture.ts` 등)로 추출하면 스키마 변경 시 단일 위치만 수정하면 된다.

---

### [INFO] 테스트 케이스 내 정규식 패턴이 두 파일에 걸쳐 세 곳에서 반복
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.spec.ts` L47, L64, L105
- 상세: `/재호출|다시 호출|do not call/i` 정규식이 세 개의 테스트 단언(`expect(...).toMatch(...)`)에 동일하게 하드코딩되어 있다. 향후 `FORM_SUBMITTED_GUIDANCE_MESSAGE` 의 표현이 변경될 경우 세 곳의 정규식을 모두 찾아 수정해야 한다. 변경이 누락된 경우 테스트가 거짓 실패하거나 의도한 회귀를 잡지 못한다.
- 제안: 정규식을 테스트 파일 상단의 상수(`const FORM_SUBMITTED_GUIDANCE_PATTERN = /재호출|다시 호출|do not call/i`)로 추출하면 단일 위치에서 관리할 수 있다.

---

### [INFO] 테스트 픽스처 `{ x: 1 }` 의 의미가 불명확한 매직 객체
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.spec.ts` L85
- 상세: `handler.execute({ x: 1 }, ...)` 에서 첫 번째 인자 `{ x: 1 }` 이 무엇을 나타내는지 코드만 보아서는 알 수 없다. 기존 테스트에서 동일 패턴을 공유하고 있다면 컨벤션이지만, 신규 독자에게는 `x: 1` 이 의미 있는 노드 입력인지 단순 placeholder 인지 불분명하다.
- 제안: 인라인 주석(`// node input — not inspected in this test`) 을 추가하거나 `nodeInput` 같은 기명 변수로 추출하면 의도가 명확해진다.

---

## 요약

이번 변경은 `render_form` submit 후 LLM의 동일 form 재호출 회귀를 차단하기 위해 tool_result content에 `ok`, `message` 두 필드를 보강하고, `PRESENTATION_TOOLS_GUIDANCE`에 `form_submitted` 안내 라인을 추가하며, 관련 테스트를 보강한 내용이다. 변경의 의도는 명확하고 JSDoc 주석으로 설계 근거가 잘 기술되어 있으며, 기존 코드베이스 스타일(LLM 가이드라인을 상수 문자열로 관리하는 패턴)과 일관된다. 주요 유지보수성 우려는 (1) `FORM_SUBMITTED_GUIDANCE_MESSAGE` 상수가 `PRESENTATION_TOOLS_GUIDANCE` 본문과 실제 참조 관계 없이 병렬 관리되어 JSDoc 주석과 현실 사이의 괴리가 생기는 점, (2) 동일 정규식 패턴이 세 테스트 단언에 반복되어 향후 메시지 표현 변경 시 누락 위험이 있는 점, (3) Discord/Slack e2e 픽스처 함수가 병렬 파일로 중복 유지되어 스키마 동기화 부담이 누적되는 점이다. 모두 INFO 등급이며 즉각 차단 사항은 없다.

---

## 위험도

LOW
