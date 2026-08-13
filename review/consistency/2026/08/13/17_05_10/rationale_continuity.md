# Rationale 연속성 검토 결과

## 사전 확인 — 페이로드/실제 diff 불일치

`_prompts/rationale_continuity.md` 에 번들된 "관련 Rationale 발췌" (`spec/2-navigation/4-integration.md`(cafe24) · `spec/4-nodes/7-trigger/providers/{discord,slack,telegram}.md` · `spec/data-flow/9-observability.md` · `spec/data-flow/1-audit.md` · `spec/1-data-model.md` · `spec/2-navigation/1-workflow-list.md` 등 약 1,480줄)은 실제 리뷰 대상 diff(`origin/main...HEAD`, 4 커밋)와 도메인이 겹치지 않는다. 실측(`git diff origin/main...HEAD --stat`, 워크트리 절대경로 기준):

- `spec/**` 변경 **0건** — 이번 4 커밋은 `spec/5-system/` 을 포함해 spec 어디도 건드리지 않는다.
- 실제 코드 변경은 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`(+16), `codebase/backend/src/modules/executions/executions.service.ts`(+1/-1), `codebase/backend/test/.../chat-channel.dispatcher.spec.ts`(test-only), `.../execution-engine.service.spec.ts`(test-only), `.../executions.service.spec.ts`(test-only) 뿐이다.

번들이 생략 목록 43번째 항목으로 `spec/5-system/4-execution-engine.md` 자체(정작 리뷰 대상 도메인)를 컨텍스트 예산 초과로 빠뜨린 상태였다. 이 checker 는 프롬프트의 발췌본을 근거로 삼지 않고, 지시된 impl-done 규약에 따라 워크트리 절대경로로 `spec/5-system/4-execution-engine.md` 를 직접 열어 실제 diff 와 대조했다.

## 발견사항

없음 — CRITICAL/WARNING 없음.

### 검토한 변경과 Rationale 대조 (참고, 비차단)

- **target 위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `admitExecutionOrDefer()` 의 `UPDATE ... RETURNING` 결과에 대한 `Array.isArray(rows)` 가드. 같은 세션 내 두 커밋(`4fcc1b43a`→`return false`(defer) 도입, `c31c96529`→`throw`(트랜잭션 롤백)로 번복)의 최종 상태.
  - **과거 결정 출처**: `spec/5-system/4-execution-engine.md` `## Rationale` §"retry 재진입의 원자 claim" 인근(L1351–1356) — "**프로젝트의 fail-open 선례는 인프라 가용성(Redis/DB) 시나리오 한정**이고, **데이터 정합성 게이트는 fail-closed 가 원칙**이다(sub-workflow workspace 격리 fail-closed 전환 선례와 동방향)."
  - **상세**: `admitExecutionOrDefer` 는 PENDING→RUNNING 전이를 결정하는 데이터 정합성 게이트(§8 admission gate, L1694–1704)다. 최종 채택된 `throw`(트랜잭션 롤백 → 행은 `pending` 그대로, 예외로 종결)는 spec 이 이미 명시한 "데이터 정합성 게이트는 fail-closed" 원칙과 **정합**한다. 직전 라운드의 `return false`(defer) 는 반환값만 닫혔을 뿐 트랜잭션이 커밋돼(코드리뷰가 지적) 원칙과 어긋난 상태였고, 그 번복은 커밋 메시지(`c31c96529`)에 상세 근거가 남아 spec 원칙과의 정합을 회복한 것 — "무근거 번복" 이 아니다.
  - **부수 확인**: `execution-run` 큐는 `attempts:1`(spec §9.3, L1194)이라 이 예외는 BullMQ 재시도 없이 job 을 즉시 실패시킨다. 남은 `pending` 행은 boot-only orphan backstop(§Rationale "orphan pending backstop", L1705–1713)이 재시작 시점에만 회수한다는 기존 설계의 사각(운영 중 즉시 회수 없음)에 그대로 들어간다. 다만 이 사각은 이 가드가 새로 만든 것이 아니다 — `admitExecutionOrDefer` 호출부(`runExecutionFromQueue` L3669)는 이 가드 도입 이전부터 try/catch 밖에 있어, `rows`가 배열이 아니면 원래도 `rows.length` 에서 `TypeError` 가 나 동일하게 uncaught 로 job 을 실패시켰다. 즉 최종 동작(throw→job 실패→boot-only 회수)은 이 PR 이전부터 있던 status quo 를 진단 메시지만 개선해 복원한 것이라 **신규 회귀가 아니다**.
  - **제안 (INFO, 선택)**: 이 가드가 "데이터 정합성 게이트=fail-closed" 원칙의 새 적용처라는 점을 spec Rationale 에 한 줄 교차 참조로 남기면(예: §8 admission gate Rationale 블록에 "TOCTOU 원자화" 항 각주로) 추후 동일 패턴 재변경 시 참조점이 된다. 다만 이번 변경 자체가 방어적 구현 디테일(드라이버 타입 계약 위반 시 진단) 수준이라 spec 개정을 요구할 정도는 아니라고 판단한다 — 강제 아님.

- **target 위치**: `codebase/backend/src/modules/executions/executions.service.ts` L63 — `const SNAPSHOT_CACHE_MAX_ENTRIES = 256` → `export const SNAPSHOT_CACHE_MAX_ENTRIES = 256`.
  - **과거 결정 출처**: 같은 파일 L43 `MAX_EXECUTION_PATH_ROWS` 의 export 선례("테스트에서도 동일 상수를 참조하도록 export").
  - **상세**: 단순 테스트 접근성을 위한 export 로 기존 선례와 동일 패턴. 상수가 표현하는 "인스턴스 수직 캐시"(L52–61 주석, 멀티 인스턴스 cross-hit 비보장) 의미·범위에 변화 없음. Rationale 위반 없음.

- **target 위치**: `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 EIA CRITICAL 체크박스 종결(`258b7691d`, `6570ca3bb`) — 이전 세션에서 열어 둔 (a)/(b) 택일을 PR #1166(이미 `origin/main` 에 병합된 `spec/5-system/14-external-interaction-api.md` §6 재작성)이 (b)로 집행했다는 사실을 반영.
  - **상세**: 결정 이력을 `<details>` 로 보존하고 실행 근거(엔진에 개념 자체가 없음을 실측)를 명시해 정본 Rationale 연속성 관행(과거 결정 보존 + 새 근거 명시)에 부합한다. 위반 없음 — 오히려 프로젝트의 "결정 이력 보존" 관례를 잘 지킨 사례.

## 요약

이번 세션(17_05_10)의 실제 diff(`origin/main` 대비 4 커밋)는 `spec/5-system/` 을 전혀 건드리지 않으며, 코드 변경도 execution-engine admission gate 의 방어적 가드 하나(throw 로 확정)와 테스트용 상수 export 하나로 제한적이다. 두 변경 모두 `spec/5-system/4-execution-engine.md` 의 기존 Rationale(데이터 정합성 게이트=fail-closed 원칙, export 선례)과 정합하며, 기각된 대안의 재도입·합의 원칙 위반·무근거 번복·암묵적 invariant 우회 중 어느 것도 관측되지 않았다. 다만 오케스트레이터가 조립한 "관련 Rationale 발췌" 번들이 실제 diff 도메인과 무관한 파일(cafe24/discord/slack/telegram/observability 등)로 채워지고 정작 대상 spec(`4-execution-engine.md`)은 예산 초과로 빠져 있었다는 번들링 결함은 별도로 기록해 둔다(판정 자체는 워크트리 직접 열람으로 보완했다).

## 위험도
NONE
