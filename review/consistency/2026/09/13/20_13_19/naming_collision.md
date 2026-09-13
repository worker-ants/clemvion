# 신규 식별자 충돌 검토 — naming_collision

## 전제 재확인

- scope(`spec/conventions/`) 델타: **0개 파일**. 이 브랜치는 `spec/conventions/` 를 바꾸지 않았다(`plan/in-progress/error-code-emission-axis.md` frontmatter `spec_impact: none` 과 일치).
- 실제 구현 diff(4파일, `origin/main...HEAD`)는 모두 `codebase/frontend/src/lib/docs/__tests__/` 하위 harness 가드 코드(`guide-identifier-scan.ts` + `guide-identifier-existence.test.ts`)와 사용자 가이드 문구 2곳(`logic.mdx`/`logic.en.mdx`)이다. 신규 API·엔티티·엔드포인트·이벤트·ENV·spec 파일은 이 diff 에 없다.
- 따라서 본 checker 가 다룰 실질 후보는 diff 가 도입하는 **코드 식별자**(신규 함수/상수/등록 토큰)로 한정된다. 아래는 그 전수에 대한 충돌 검사 결과다.

## 검사한 신규 식별자 전수

절대경로 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/error-code-emission-axis-56c9ff`)에서 `git grep`으로 저장소 전체(코드+spec+plan, review 산출물 제외)를 훑었다.

| 신규 식별자 | 종류 | 충돌 여부 |
|---|---|---|
| `GUIDE_NON_EMITTED_VOCABULARY` | export const (등록부) | 없음 — 유일 정의처, 다른 곳은 전부 인용/문서화 |
| `QUOTED_LITERAL` / `MESSAGE_PREFIX` / `CATALOG_CODE` | module-local RegExp const | 없음 — `guide-identifier-scan.ts` 내부 전용, 타 파일 미참조 |
| `collectMatches` | module-local 함수 | 없음 |
| `collectQuotedLiterals` / `collectMessagePrefixes` / `collectCatalogCodes` / `isMessagePrefixOnly` | export 함수 | 없음 |
| `NON_EMITTED_VOCABULARY_CAP` | test-local const | 없음 — 자매 상수 `EXTERNAL_VOCABULARY_CAP` 과 이름·값(5) 모두 별개 상수로 명확히 구분되어 있고 서로 다른 리스트를 가리킨다 |
| `parseWhereRefs` / `staleEntries` | test-local 헬퍼 함수 | 없음 |

grep 결과 위 식별자들은 모두 이번 diff 에서 최초로 등장하며, 저장소 내 다른 위치(코드·spec·plan·CHANGELOG)에서는 전부 이 정의를 **인용**만 하고 있다. 다른 의미로 선점된 이름은 발견되지 않았다.

## 등록 토큰 3종 — 신규 식별자가 아니라 기존 문자열의 재등재

`GUIDE_NON_EMITTED_VOCABULARY` 에 등재된 `MAKESHOP_UNRESOLVED_PATH_PARAM` · `CONTAINER_MISSING_EMIT` · `CONTAINER_MULTIPLE_EMIT` 세 토큰은 이 PR 이 새로 발급하는 식별자가 아니라, 이미 존재하는 메시지 접두 문자열을 가드 목록에 **등재**한 것이다.

- `MAKESHOP_UNRESOLVED_PATH_PARAM`: `#1330`(선행 PR, `ce454e046`)에서 이미 `makeshop.handler.ts:436` 및 두 언어 가이드 문서에 자리 잡았다. 본 PR 은 이를 재확인할 뿐 새로 도입하지 않는다.
- `CONTAINER_MISSING_EMIT` / `CONTAINER_MULTIPLE_EMIT`: `spec/3-workflow-editor/0-canvas.md:636`, `spec/3-workflow-editor/2-edge.md:202`, `spec/4-nodes/1-logic/0-common.md:83`, `spec/4-nodes/1-logic/3-loop.md`, `7-map.md`, `9-foreach.md`, `spec/5-system/4-execution-engine.md:332`, 그리고 `execution-engine.service.ts:7121·7125` 에 이미 동일 의미(컨테이너 `emit` 검증 실패 메시지 접두)로 일관되게 쓰이고 있다. `spec/conventions/error-codes.md` §3(historical-artifact 예외 레지스트리)·§4(내부 전용 분류 코드) 어느 표에도 이 두 토큰은 **등재돼 있지 않다** — 즉 정식 `error.code` 카탈로그와 이름이 겹치지도 않는다.
- 본 PR 의 실제 변경은 `logic.mdx`/`logic.en.mdx` 두 곳의 **문구 정정**(코드처럼 읽히던 서술 → "메시지 접두일 뿐 전용 코드가 없다"로 명확화)뿐이며, 새 토큰을 발급하지 않는다.

세 토큰 모두 소스 코드·spec 여러 곳에서 **동일한 의미**로만 쓰이고 있어, "동일 식별자가 다른 의미로 이미 사용 중"이라는 CRITICAL 조건에 해당하지 않는다.

## 참고 — 기존 컨벤션의 동명 코드 관리 사례 (충돌 아님, 확인만)

`spec/conventions/error-codes.md` §4.1 에는 `EXECUTION_TIMEOUT` 이 (a) Code 노드 내부 분류 문자열과 (b) 엔진 레벨 EIA `execution.failed.error.code` 양쪽에 동명으로 존재한다는 것을 문서가 이미 명시적으로 각주 처리해 두었다. 이번 PR 은 이 문서를 건드리지 않으며, 새로 등재하는 토큰도 이 레이어들과 이름이 겹치지 않는다. 기존 관례(동명 발생 시 "레이어 주의" 각주로 명시)와 대비했을 때 이번 PR 이 새로 만드는 동명 충돌은 없다.

## 발견사항

없음. 등급 부여 대상 항목 없음.

## 요약

이번 브랜치는 `spec/conventions/` 델타가 0이고, 실제 코드 diff 는 유저 가이드 식별자 실재성 가드(harness 테스트)에 "발행 축"(메시지 접두 전용 토큰 등록부 `GUIDE_NON_EMITTED_VOCABULARY`와 그 보조 함수/정규식)를 추가하는 것이 전부다. 새로 도입된 함수·상수 이름은 저장소 전체에서 grep 결과 유일한 정의처만 존재해 다른 의미로 선점된 이름이 없고, 등록되는 토큰 3종(`MAKESHOP_UNRESOLVED_PATH_PARAM`·`CONTAINER_MISSING_EMIT`·`CONTAINER_MULTIPLE_EMIT`)은 신규 식별자가 아니라 이미 코드·spec 여러 곳에서 동일 의미로 쓰이던 기존 메시지 접두 문자열의 재등재이며 정식 error-code 카탈로그(§3/§4)와도 이름이 겹치지 않는다. 신규 식별자 충돌 관점에서 지적할 사항이 없다.

## 위험도

NONE
