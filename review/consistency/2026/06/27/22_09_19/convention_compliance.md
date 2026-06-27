# 정식 규약 준수 검토 결과

검토 대상: `spec/7-channel-web-chat/` (구현 완료 후 검토, diff-base=origin/main)

---

## 발견사항

### **[INFO]** `_product-overview.md` 의 Overview 섹션 헤더가 권장 형식과 다름
- target 위치: `/Volumes/project/private/clemvion/spec/7-channel-web-chat/_product-overview.md` — 최상위 섹션 `## 1. 개요 / 문제`
- 위반 규약: `project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` — Overview 섹션 헤더는 `## Overview (제품 정의)` 형식 권장
- 상세: `5-admin-console.md`·`4-security.md` 는 `## Overview (제품 정의)` 를 정확히 따르는 반면, `_product-overview.md` 는 번호 붙은 `## 1. 개요 / 문제` 형식을 사용한다. `_product-overview.md` 는 `_*` prefix 로 frontmatter 가드 면제 대상이지만 3섹션 구조 권장은 여전히 적용된다. 실제 prod overview 역할을 하므로 `spec-area-index` 가드에는 index doc 로 정상 인식된다.
- 제안: `## 1. 개요 / 문제` 를 `## Overview (제품 정의)` 로 변경하고 하위 내용을 그대로 유지. 또는 규약 문서에 `_product-overview.md` 의 numbered-section 허용을 명시적으로 carve-out 한다.

---

### **[INFO]** `0-architecture.md`·`1-widget-app.md`·`2-sdk.md`·`3-auth-session.md` — `## Overview` 섹션 부재
- target 위치: `spec/7-channel-web-chat/0-architecture.md`, `1-widget-app.md`, `2-sdk.md`, `3-auth-session.md` — 각 파일에 `## Overview` 섹션 없음
- 위반 규약: `project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` — Overview / 본문 / Rationale 3섹션 권장
- 상세: 4개 파일 모두 본문과 `## Rationale` 는 갖추고 있으나 `## Overview` 섹션이 없다. 이 영역은 `_product-overview.md` 가 존재하므로 CLAUDE.md 의 "다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일" 조항과 맞아떨어진다 — 즉 개별 파일의 Overview 생략이 의도된 설계일 수 있다. 단 `4-security.md`·`5-admin-console.md` 는 동일 영역 내에서 `## Overview` 를 포함하고 있어 영역 내 일관성이 부족하다.
- 제안: `_product-overview.md` 가 있는 영역에서 개별 파일의 `## Overview` 생략을 공식 carve-out 으로 규약에 명시하거나, 4개 파일에도 짧은 `## Overview` (단락 수준) 를 추가해 영역 내 통일성을 맞춘다. 규약 갱신이 더 간결한 해결책이다.

---

## 적합 확인 항목 (위반 없음)

다음 규약 항목들은 모두 정상 준수 확인되었다:

1. **frontmatter `id` 명명 (kebab-case)**: 모든 6개 파일이 `web-chat-architecture`·`web-chat-widget-app`·`web-chat-sdk`·`web-chat-auth-session`·`web-chat-security`·`web-chat-admin-console` 로 kebab-case 를 따른다. `4-security.md` 의 인라인 YAML 주석(`# basename...`)은 `spec-impl-evidence.md` 예시(`# kebab-case. 파일 basename 기반 권장`)와 동일 패턴으로 정상.

2. **frontmatter `status` 값**: 모든 파일이 `implemented` — `spec-impl-evidence §3` 에 정의된 유효한 라이프사이클 값.

3. **frontmatter `code:` 경로 존재 의무 (`spec-impl-evidence §4`)**: `status: implemented` 인 모든 파일이 `code:` 글로브를 1개 이상 보유. 워크트리 내 실제 파일 존재 확인(`embed-config.dto.ts`·`web-chat-cors.ts` 등).

4. **`_product-overview.md` frontmatter 면제**: `_*` prefix 파일은 `spec-impl-evidence §1` 명시 면제 대상 — frontmatter 없음이 정상.

5. **spec-area-index 가드 (`spec-impl-evidence §4.2`)**: `spec/7-channel-web-chat/` 의 index docs(`_product-overview.md` → `_.*overview` 패턴 일치, `0-architecture.md` → `0-.*` 패턴 일치)가 모든 sibling spec(`1-widget-app.md`·`2-sdk.md`·`3-auth-session.md`·`4-security.md`·`5-admin-console.md`)을 링크. 가드 통과.

6. **postMessage 네임스페이스 (`2-sdk §3`)**: `wc-protocol.ts` 의 `WC_PREFIX = "wc:"` 상수·`WcMessageType` 유니온이 spec 의 `wc:boot`·`wc:command`·`wc:ready`·`wc:resize`·`wc:event` 와 1:1 일치.

7. **i18n 규약 (`i18n-userguide Principle 1`)**: diff 의 신규 한국어 문자열은 모두 테스트 fixture 내부(`it("...")` 설명, 테스트 assertion 문자열) — `i18n-userguide` 명시 허용 범주. UI 렌더 경로에 하드코딩된 한국어 없음.

8. **에러 코드 명명 (`error-codes.md §1`)**: 구현 변경사항(diff)에 신규 에러 코드 없음. `widget-state.ts` 의 `error` 필드는 자유 문자열 메시지이며 `error-codes.md` 의 `UPPER_SNAKE_CASE` 에러 코드 enum 과 별개 레이어.

9. **Swagger/DTO 규약 (`swagger.md`)**: diff 는 frontend/backend DTO 를 건드리지 않음. `embed-config.dto.ts` 는 기존 파일이며 4-security.md `code:` 에 등재된 상태.

10. **`## Rationale` 섹션 존재**: 6개 모든 파일이 `## Rationale` 포함.

11. **`interaction-type-registry` 정합**: diff 가 신규 `WaitingInteractionType` 값을 추가하지 않음. `isTextInputSurface` 는 기존 `buttons`·`form` 값만 참조하며 registry 매트릭스 갱신 불필요.

12. **`_product-overview.md` spec-area-index 역할**: `_product-overview.md` 가 `_.*overview` 패턴에 매칭돼 index doc 로 인식되며, 모든 sibling 링크 포함. 가드 통과 요건 충족.

---

## 요약

`spec/7-channel-web-chat/` 의 정식 규약 준수 상태는 양호하다. frontmatter 스키마(`id`/`status`/`code:`)·postMessage 네임스페이스·에러 코드 명명·spec-area-index 가드 등 주요 hardening 규약은 모두 준수된다. 발견된 사항은 모두 INFO 등급으로, `_product-overview.md` 의 Overview 섹션 헤더가 권장 형식과 다른 점과 일부 파일에 `## Overview` 가 없어 영역 내 일관성이 부족한 점이다. 이 두 항목은 `_product-overview.md` 가 영역 Overview 역할을 대리하는 설계 의도와 충돌하지 않으므로 규약 carve-out 명시로 해결하는 것이 적절하다.

---

## 위험도

NONE
