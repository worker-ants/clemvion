# Convention Compliance Review

**Target**: `spec/2-navigation/6-config.md`
**Mode**: spec draft 검토 (--spec)
**Date**: 2026-06-16

---

## 발견사항

### 1. **[CRITICAL]** R-1 에 기재된 에러 코드 `LLM_MODEL_NOT_FOUND` 가 error-codes 규약에 미등록

- **target 위치**: `## Rationale > R-1. 기본 모델 선택을 select-only 로 한정` (line 293)
- **위반 규약**: `spec/conventions/error-codes.md §1` (의미 기반 명명 원칙) 및 `§2` (안정성 정책)
- **상세**: target 은 `LLM_MODEL_NOT_FOUND`(404) 를 "Planned" 코드로 언급하고 해당 코드가 `LLM Client §5` 에 존재한다고 링크한다. 그러나 `spec/conventions/error-codes.md` 의 §3 historical-artifact 레지스트리·§5 rename 이력 어디에도 이 코드가 등재돼 있지 않다. 또한 `codebase/backend/src/nodes/core/error-codes.ts`(규약 §1의 "대표 surface")에도 해당 식별자가 없다. `spec/5-system/7-llm-client.md §6`(에러 처리) 은 이 코드를 Planned 로만 정의하며 `error-codes.md` 로의 교차 등재는 없다. 에러 코드 명명 규약 §1은 "프로젝트 전체의 에러 코드 문자열" 에 적용되며, Planned 코드도 신설 전에 의미 정확한 이름을 규약에 따라 사전 정의해야 클라이언트 계약이 안정된다. 현재 상태는 규약 카탈로그(SoT: `spec/5-system/3-error-handling.md`)에 미등재인 채 target 문서에서 독립적으로 명명하고 있어, 향후 신설 시 코드 이름과 HTTP 상태값(target 에서 404 로 명시)의 정합을 보증할 단일 SoT 가 없다.
- **제안**: R-1 본문에서 `LLM_MODEL_NOT_FOUND` 를 참조하는 방식을 `spec/5-system/7-llm-client.md §6 (Planned 세분화 에러 코드)` 로 단일화하거나, 해당 Planned 코드를 `spec/5-system/3-error-handling.md §1.4` 에 Planned 항목으로 공식 등재한 뒤 cross-link 한다. target 자체의 수정은 `[LLM Client §5](../5-system/7-llm-client.md)` 링크를 `[LLM Client §6 Planned 에러](../5-system/7-llm-client.md#6-에러-처리)` 로 정정해 실제 섹션을 정확히 가리키도록 한다(현재 §5 는 "프로바이더별 매핑"이며 에러 처리는 §6임).

---

### 2. **[WARNING]** R-1 의 `[LLM Client §5]` 링크가 잘못된 섹션을 가리킴

- **target 위치**: `## Rationale > R-1` (line 293): `[LLM Client §5](../5-system/7-llm-client.md)`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4.2` (`spec-link-integrity.test.ts` — in-repo 링크 타깃 존재 + `#anchor` heading slug 대조)
- **상세**: target 은 `LLM_MODEL_NOT_FOUND` 의 Planned 근거로 `[LLM Client §5]`를 참조하나, `spec/5-system/7-llm-client.md` 의 `## 5.` 는 "프로바이더별 매핑"이다. Planned 에러 코드 서술은 `## 6. 에러 처리` (line 331–348) 에 있다. 앵커 없는 링크(`../5-system/7-llm-client.md`)라 build 가드가 false-positive 로 통과시킬 수 있으나, 독자가 §5 본문에서 언급 내용을 찾지 못하는 가독성·추적성 문제가 있다. `spec/conventions/error-codes.md §1` 도 에러 코드의 진실을 SoT 문서로부터 참조하도록 요구한다.
- **제안**: `[LLM Client §5](../5-system/7-llm-client.md)` → `[LLM Client §6 에러 처리](../5-system/7-llm-client.md#6-에러-처리)` 로 정정.

---

### 3. **[WARNING]** `## 3. API` heading 이 문서 body 섹션 번호 체계와 불일치

- **target 위치**: line 252: `## 3. API`
- **위반 규약**: CLAUDE.md "정보 저장 위치" — spec 문서 3섹션 권장(Overview / 본문 / Rationale). `spec/2-navigation/` 인접 문서(`1-workflow-list.md`, `2-trigger-list.md`, `5-knowledge-base.md`, `7-statistics.md`)는 모두 `## 1.`, `## 2.`, `## 3. API` 순의 정렬된 숫자 섹션 체계를 따른다.
- **상세**: target 은 body 섹션을 `## Part A:` / `## Part B:` 로 구성하다가 갑자기 `## 3. API` 로 전환한다. `## Part A/B` 는 번호가 없으므로 `## 3.` 이 "3번째 섹션" 이라는 의미를 잃고 독자에게 혼란을 준다. `## 3. API` 앞에 `## 1.`·`## 2.` 가 없다. 인접 spec 과 비교 시 body part 도 `## 1.`·`## 2.` 로 표기하거나, `## Part A/B` 를 유지하면서 API 섹션을 번호 없이 `## API` 로 정렬하는 것이 일관적이다.
- **제안**: (a) body 를 `## 1. Authentication (인증 설정)` / `## 2. Models (모델 설정)` 로 번호 정렬한 뒤 `## 3. API` 유지, 또는 (b) `## 3. API` → `## API` 로 변경해 현재 Part A/B 체계와 충돌을 피한다. 인접 파일 패턴(`1-workflow-list.md` 등) 준용 시 (a) 권장.

---

### 4. **[INFO]** `auth_config.reveal` 감사 액션 표기 — 따옴표·점 구분자 혼용

- **target 위치**: line 117: `audit_log 에 action='auth_config.reveal' 기록`
- **위반 규약**: `spec/conventions/audit-actions.md §1` — `<resource>.<verb>` 구조, resource·verb 내부 어절은 언더스코어. 규약 §3 레지스트리: `auth_config | 현재형 (§2.2) | reveal`
- **상세**: 표기 자체(`auth_config.reveal`)는 규약과 일치한다. 다만 target 이 `action='auth_config.reveal'` 형태로 작은따옴표 할당식을 쓰는 반면, `spec/conventions/audit-actions.md` 전반은 코드 backtick 형식(`\`auth_config.reveal\``)을 사용한다. 기능적 위반이 아닌 스타일 불일치로 INFO 수준.
- **제안**: `action='auth_config.reveal'` → `action=\`auth_config.reveal\`` 로 backtick 표기 통일 (또는 `action: auth_config.reveal`).

---

### 5. **[INFO]** frontmatter `id` 값 `config` — 타 문서 충돌 가능성 확인 권고

- **target 위치**: frontmatter `id: config` (line 2)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — id 는 kebab-case, 동일 basename 이 영역을 달리해 중복될 때 후발 문서는 영역 prefix 로 충돌 회피
- **상세**: `spec-impl-evidence.md §2.1` 는 id 가 basename 기반 권장이라 이 문서는 `config` 가 자연스럽다. 현재 `spec/` 내 다른 영역에 `id: config` 가 중복 존재하는지 확인이 필요하다. `spec-frontmatter.test.ts` 가 id unique 를 강제하지 않으므로 build 가드가 이를 잡지 않는다. 현재 보이는 범위에선 충돌이 없어 INFO 수준.
- **제안**: `spec-frontmatter.test.ts` 에 id unique 검증이 없는 점을 인지하고, 동명 id 가 다른 영역에 없는지 일회성으로 확인한다.

---

## 요약

`spec/2-navigation/6-config.md` 는 frontmatter 스키마(id/status/code)·3섹션 구성(Overview/본문/Rationale)·감사 액션 명명(`auth_config.reveal`)을 대체로 정식 규약에 맞게 기술하고 있다. 주요 위반은 두 가지다. 첫째, Rationale R-1 이 `LLM_MODEL_NOT_FOUND`(404) 를 Planned 에러 코드로 언급하면서 `error-codes.md` 카탈로그나 `3-error-handling.md` SoT 에 미등재된 상태로 단독 명명해, 향후 신설 시 HTTP 상태 코드·의미 정합을 보증할 단일 SoT 가 없다(CRITICAL). 둘째, 해당 참조가 `[LLM Client §5]` 로 링크되어 있으나 실제 에러 처리 내용은 §6 에 있다(WARNING). 부수적으로 body 섹션이 `## Part A/B` 로 시작해 `## 3. API` 로 이어지는 숫자 불연속이 인접 파일 패턴과 어긋난다(WARNING).

## 위험도

**MEDIUM** — CRITICAL 항목이 에러 코드 SoT 누락이라 신설 시 코드명·HTTP status 정합 보증이 없음. 현재 동작(select-only 정책)에는 영향이 없으나 Planned 코드 신설 시 규약 위반 리스크가 잠재한다.
