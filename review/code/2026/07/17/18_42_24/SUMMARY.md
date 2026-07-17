# Code Review 통합 보고서

커밋: `3e84d2109bac5b2d580466b09b28094f1fb0ffee` — `fix(run-results): isConversationOutput JSDoc 정정` (직전 `/ai-review` 라운드 `18_02_39` 의 W#1·W#2 후속 정정)

## 전체 위험도

**LOW** — 대상 커밋은 `output-shape.ts` 의 `isConversationOutput` JSDoc 재작성(런타임 코드 무변경, `git show`/grep 으로 7개 reviewer 전원이 독립 실측 확인)과 plan 각주의 커밋 해시 오인용 정정(1줄)으로 구성된 순수 문서/주석 변경이다. CRITICAL 발견 없음. 유일한 WARNING(testing)은 이번 diff 가 새로 만든 문제가 아니라, 새 JSDoc 이 처음으로 정확히 열거한 OR-체인 6분기 중 3개가 기존부터 격리 테스트 없이 방치돼 있었다는 사전 존재 갭이며, 이번 커밋(코드 변경 없음)의 병합을 막을 사유는 아니다. **forced(router_safety) 화이트리스트 7명(security·requirement·scope·side_effect·maintainability·testing·documentation) 전원의 보고서가 인라인으로 확보되었고 누락이 없다** — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음 (7개 reviewer 전원 CRITICAL 0건).

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트(Testing) | 새 JSDoc 이 "authoritative"로 명시한 OR-체인 6분기 중 최소 3개가 격리 테스트 없이 방치됨: (a) `output.interactionType` 직접 경로(`outputInteraction`) — 테스트 스위트에 해당 필드를 `output` 최상위에 직접 넣는 케이스 0건, (b) `output.conversationConfig` nested 경로(`hasConvConfig`) — 테스트 5곳 전부 top-level `raw.conversationConfig` 만 구성, nested 형태 0건, (c) `hasLegacyMessages && (outputInteraction || metaInteraction)` — 이 조건만으로 참이 되는 독립 테스트가 없어 항상 `isCanonicalWaiting` 과 동시 참이 됨(mutation 관점에서 이 분기를 삭제해도 현재 테스트는 green) | `codebase/frontend/src/components/editor/run-results/output-shape.ts:265-297`(OR-체인), `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts:474-628`(대응 테스트) | 3개 분기를 다른 참-조건과 겹치지 않게 고립한 positive 테스트를 각 1개씩 추가(예: `output.interactionType` 만 있고 `meta` 는 비우기 / `output.conversationConfig` 만 있고 `status` 없이 / `messages`+`meta.interactionType` 만 있고 `status` 필드 생략). **이번 커밋(순수 JSDoc 정정, 코드 변경 없음) 자체의 병합을 막을 사유는 아님** — 별건 후속 커밋으로 처리 가능 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화·요구사항·유지보수성 (3개 reviewer 공통 지적) | JSDoc bullet "Legacy flat completed (top-level `messages` + `interactionType`)"가 실제 가드 조건(`raw.interactionType` 화이트리스트 매칭 OR `raw.conversationConfig != null`)과 완전히 1:1 은 아님 — 코드는 `messages` 존재 여부를 전혀 검사하지 않는데 bullet 은 이를 조건인 것처럼 서술. **이번 diff 이전부터 있던 서술이며 이번 정정(W#2)의 대상 범위 밖** | `output-shape.ts:120-121`(JSDoc bullet) vs 실제 조건 `:145-151`/`:244-251` | 조치 불요(범위 밖). 다음에 이 함수를 다시 만질 때 "top-level `interactionType`/`conversationConfig` (관례상 `messages` 동반)" 정도로 다듬으면 더 정밀 |
| 2 | 요구사항(Requirement) | JSDoc bullet "Wrapped completed (`{ config, output: { messages }, meta: { interactionType } }`)"가 `meta.interactionType`(`metaInteraction`) 경로만 예시로 들고, 코드가 동등하게 인정하는 `output.interactionType`(`outputInteraction`) 경로는 별도 언급이 없음 | `output-shape.ts:125-129`(JSDoc bullet) vs 코드 `:164-168` | 조치 불요(범위 밖, 낮은 우선순위) |
| 3 | 테스트(Testing) | `hasConvConfig`(`output.conversationConfig` nested) 분기의 실제 도달 가능성에 대해 테스트 코드베이스 내 진술이 상충: `result-timeline.test.tsx` 주석은 "handler never echoes `output.conversationConfig`"라 명시하는 반면, backend `interaction.service.ts` 는 external-interaction/WS 라이브 이벤트 경로에서 `nodeOutput.conversationConfig`(nested)를 실제로 구성해 내려보내는 지점이 있음 — 서로 다른 producer(persist 된 run-history envelope vs WS 라이브 이벤트)일 가능성이 있어 모순은 아닐 수 있으나, 어느 쪽이 맞는지 확인하는 frontend 테스트가 없음 | `result-timeline.test.tsx:132-135` vs `interaction.service.ts:382`, `execution-status-response.dto.ts:88-91` | 실제 도달 가능한 라이브 경로면 그 경로를 흉내낸 fixture 로 positive 테스트 추가, 정말 죽은 경로면 아키텍처/유지보수 리뷰어와 제거 검토(신중히 — 이 파일은 대화 UI 전체 게이트) |
| 4 | 유지보수성(Maintainability) | 함수 레벨 JSDoc(`:125-129`, "Wrapped waiting … defensive fallback")과 인접 인라인 주석(`:184-187`, "Canonical waiting shape: … defensive fallback")이 동일 분기(`isCanonicalWaiting`)를 각자 독립적으로 서술 — 현재는 내용이 일치하지만, 이 PR 의 근본 동기 자체가 "산문이 코드에서 독립적으로 뒤처져 실제 버그로 이어졌다"(#959)이므로 두 곳에 흩어진 서술은 향후 한쪽만 갱신되고 다른 쪽이 stale 해질 재발 경로가 구조적으로 남음 | `output-shape.ts:125-129` vs `:184-187` | 조치 불요(새 disclaimer 가 위험 상당 부분 완화) — 향후 이 분기 조건을 바꿀 때 두 주석을 동시에 갱신하도록 리뷰 체크리스트에 남겨두는 정도로 충분 |
| 5 | 문서화(Documentation) | 신설 bullet 6("Post-Stage-5 terminal")과 `CONVERSATION_END_REASONS` 상수 JSDoc(`:201-209`) 사이에 #959 배경 설명("`error`/`condition` 누락 → 미리보기 소실 → `@workflow/ai-end-reason` 가 SoT")이 일부 중복 | `output-shape.ts:131-136` vs `:201-209` | 조치 불요 — 각각 다른 열람 지점(상수를 볼 때 / 게이트 함수를 볼 때)에서 맥락을 완결시켜주는 지역성(locality) 이점이 있어 유지해도 무방 |
| 6 | 테스트(Testing) | JSDoc 의 분기 열거 정확성을 강제하는 자동 테스트/린트가 없음 — 이번 diff 자체가 "직전 버전이 두 번째로 부정확해졌다"(1차: "all four shapes"가 `looksLikeConversationEnd` 누락)는 사실의 증거. 새 "branches are authoritative, list does not bound them" disclaimer 는 좋은 완화책이지만 구조적 동기화 검증 장치는 아님 | `output-shape.ts:214-238`(함수 docstring) | 낮은 우선순위, 이번 커밋을 막을 사유 아님 — WARNING #1 의 격리 테스트가 추가되면 `it()` 설명 문자열이 JSDoc 목록의 실행 가능한 대응물이 되어 부분적으로 완화됨 |
| 7 | 부작용(Side Effect) | 현재 브랜치 HEAD(`4374ff5ce`, "plan complete 이동")가 리뷰 대상 커밋(`3e84d2109`)보다 한 커밋 앞서 있음 — 이번 리뷰의 분석 범위(prompt 가 명시한 2개 파일) 밖 | HEAD `4374ff5ce` | 조치 불요 — 별도 리뷰 라운드의 대상이면 그쪽에서 다룰 사항 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | `git show` 로 실측: 로직 코드 0줄 변경, JSDoc/plan 각주만 변경. 인젝션·시크릿·인증/인가·입력검증·암호화·에러처리·의존성 어떤 축도 해당 없음 |
| requirement | NONE | 커밋 메시지의 사실 주장 W#1(plan 각주 SHA 오인용)·W#2(JSDoc "4개 shape" 과장)를 git 아카이브·소스 대조로 독립 재검증 — 둘 다 정확. 새 JSDoc 6개 bullet 이 실제 6분기와 1:1 대응 |
| scope | NONE | 8개 점검 관점(의도 이상 변경/리팩토링/기능확장/무관수정/포맷팅/주석/임포트/설정) 전원 위반 없음. 선언된 범위(W#1·W#2)와 실제 diff 완전 일치 — "모범적 커밋" |
| side_effect | NONE | 전역상태·env·FS·네트워크·이벤트·공개 시그니처 어느 것도 영향 없음. JSDoc 텍스트에 의존하는 테스트/문서생성 파이프라인 없음을 grep 으로 확인 |
| maintainability | NONE | 새 disclaimer("분기가 authoritative, 목록은 bound 하지 않음")가 이 PR 계열이 반복 겪은 "주석-코드 drift" 재발 위험을 구조적으로 낮춤. 잔여 지적은 모두 경미 |
| testing | LOW | 회귀 테스트 32/32(`output-shape.test.ts`) + 89/89(`plan-frontmatter.test.ts`) PASS, lint clean. WARNING: 신규로 authoritative 선언된 OR-체인 6분기 중 3개가 격리 테스트 없이 방치(mutation 무방비) |
| documentation | NONE | W#1·W#2·W#3(CHANGELOG 미채택) 세 판단 모두 git 이력·소스 대조로 독립 재검증 — 전부 정확/타당. 새 disclaimer 를 "좋은 점"으로 명시 |

## 발견 없는 에이전트

- **security** — 보안 관련 발견사항 없음(순수 문서 변경, 실행 표면 없음).
- **scope** — 8개 점검 관점 전원 위반 없음, 선언된 범위와 diff 완전 일치.

## 권장 조치사항

1. (선택적 후속, 이번 커밋 병합 차단 아님) `isConversationOutput` OR-체인 6분기 중 격리 테스트가 없는 3개 분기(`output.interactionType` 직접경로 / `output.conversationConfig` nested 경로 / `hasLegacyMessages && metaInteraction` 단독 케이스)에 다른 참-조건과 겹치지 않는 positive 테스트를 별도 후속 커밋으로 추가.
2. (낮은 우선순위) `hasConvConfig`(`output.conversationConfig` nested) 분기가 실제 도달 가능한 라이브 경로인지(WS 이벤트) backend 팀과 확인하고, 도달 가능이면 fixture 테스트 추가, 죽은 경로로 판명되면 아키텍처 리뷰어와 신중히 제거 검토.
3. (낮은 우선순위, 이번 diff 범위 밖) JSDoc bullet 1("Legacy flat completed")·bullet 2("Wrapped completed")의 잔여 서술 정밀도(`messages` 비검사, `outputInteraction` 경로 미언급)를 다음에 이 함수를 만질 때 다듬기.
4. 이번 커밋 자체는 그대로 병합 가능 — 7개 forced reviewer 전원 CRITICAL 0건, 실행 코드 변경 없음(순수 JSDoc/plan 각주 정정), 회귀 테스트 전부 PASS 로 실측 확인됨.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 즉 실행된 7명 전원이 router_safety 강제 대상이었고, **전원의 보고서가 인라인으로 확보되어 미이행 없음**.
  - **제외**: 아래 표 (7명). prompt 에 개별 사유 텍스트는 포함되지 않았으나, 대상 diff 가 JSDoc 주석·plan 각주 정정에 한정되고 DB/API/동시성/의존성/성능/아키텍처/사용자 가이드 표면을 전혀 건드리지 않는다는 점(7개 forced reviewer 전원이 독립적으로 "런타임 표면 없음"을 재확인)과 정합적이다.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(prompt 에 개별 사유 미포함) — diff 가 JSDoc 주석/문서 정정뿐이라 성능 표면 없음과 정합 |
  | architecture | 라우터 판단(prompt 에 개별 사유 미포함) — 구조/모듈 경계 변경 없음과 정합 |
  | dependency | 라우터 판단(prompt 에 개별 사유 미포함) — 의존성 변경 없음과 정합 |
  | database | 라우터 판단(prompt 에 개별 사유 미포함) — DB/스키마 접촉 없음과 정합 |
  | concurrency | 라우터 판단(prompt 에 개별 사유 미포함) — 동시성 코드 변경 없음과 정합 |
  | api_contract | 라우터 판단(prompt 에 개별 사유 미포함) — API 계약 변경 없음과 정합 |
  | user_guide_sync | 라우터 판단(prompt 에 개별 사유 미포함) — 사용자 가이드 표면 변경 없음과 정합 |