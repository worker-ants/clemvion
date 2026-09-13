# 신규 식별자 충돌 검토 — naming_collision

## 전제 확인

- **target 문서(`spec/conventions/`) 델타: 0개 파일** — `git diff origin/main...HEAD -- spec/conventions` 는 비어 있다. 이 브랜치는 그 spec 영역을 바꾸지 않았다.
- **실제 검토 대상은 `code_areas`(`codebase/**`) diff** — `git diff origin/main...HEAD -- codebase` 로 직접 재확인: 4개 파일 / 989줄 (프롬프트 번들의 예산 절단 안내와 일치).
  - `codebase/frontend/src/content/docs/02-nodes/logic.en.mdx` (문구 정정, 신규 식별자 없음)
  - `codebase/frontend/src/content/docs/02-nodes/logic.mdx` (문구 정정, 신규 식별자 없음)
  - `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (신규 함수·상수·타입)
  - `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` (신규 함수·상수 + 테스트)
- HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/error-code-emission-axis-56c9ff`)를 절대경로로 직접 `git grep` 하여 아래 결과를 냈다 — CWD 상대 조회에 의존하지 않았다.
- 커밋 로그 확인: HEAD(`d39d91a84`, "라운드 9")는 `guide-identifier-scan.ts` 주석 2줄만 바꿨고 식별자 변경은 없다. 직전 라운드(`22_38_43` 세션)의 naming_collision 판정도 NONE 이었다 — 이번 세션은 그 판정 이후 diff 가 comment-only 임을 재확인하는 성격이다.

## 신규 식별자 전수 목록과 grep 결과

`guide-identifier-scan.ts` / `guide-identifier-existence.test.ts` 두 파일 **밖에서** 동명 식별자가 있는지 `git grep -n "<식별자>" -- codebase spec` 로 전수 확인했다 (아래는 두 대상 파일 자신의 매치를 제외한 결과).

| 신규 식별자 | 종류 | 타 위치 매치 |
|---|---|---|
| `collectQuotedLiterals` | export function | 0건 |
| `collectMessagePrefixes` | export function | 0건 |
| `collectCatalogCodes` | export function | 0건 |
| `isMessagePrefixOnly` | export function | 0건 |
| `computeNonEmittedOffenders` | export function | 0건 |
| `GUIDE_NON_EMITTED_VOCABULARY` | export const | 0건 |
| `collectMatches` | module-private function | 0건 |
| `QUOTED_LITERAL` / `MESSAGE_PREFIX` / `CATALOG_CODE` | module-private regex const | 0건 (아래 근접 사례 별도 서술) |
| `staleGuideEntries` | test-local function | 0건 (아래 서술) |
| `parseWhereRefs` | test-local function | 0건 |
| `resolveSourceLines` / `sourceLinesCache` | test-local function/const | 0건 |
| `SOURCE_ROOTS` / `skipBuildDirs` | test-local const | 0건 (근접 사례 별도 서술) |
| `NON_EMITTED_VOCABULARY_CAP` | test-local const | 0건 (거울상 `EXTERNAL_VOCABULARY_CAP` 은 의도된 짝, 충돌 아님) |

### 근접 사례 (충돌 아님으로 판정)

1. **`MESSAGE_PREFIX` vs `WC_MESSAGE_PREFIX`** — `codebase/packages/web-chat-sdk/src/types.ts:52`에 `WC_MESSAGE_PREFIX = "wc:"` 가 있다. 완전히 다른 식별자(접두사 `WC_` 포함), 다른 패키지, 다른 의미(postMessage 채널 prefix vs 에러 메시지 접두 정규식)이고 신규 상수는 module-private(비-export)이라 실제 이름 충돌·타입 충돌 가능성이 없다.
2. **`SOURCE_ROOTS` vs `CODEBASE_SOURCE_ROOTS`** — `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:462`에 이미 있는 상수. 값(`backend/src, frontend/src, channel-web-chat/src, packages`)과 목적(spec 링크 검증용 코드 소스 루트)이 신규 `SOURCE_ROOTS`(`backend/src, packages` — 가이드 기준집합용)와 다르고, 두 상수 모두 각자 파일의 module-private 스코프라 이름이 완전히 겹치지도 않는다.
3. **`staleGuideEntries` vs `staleEntries`** — `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:129`에 export 된 `staleEntries(internal, knownNames)` (다른 시그니처: 두 `string[]`을 받아 unknown internal package 를 찾는 함수)가 이미 존재한다. **이 충돌은 이전 라운드(`review/consistency/2026/09/13/20_34_48` naming_collision WARNING#5)가 이미 지적했고, 현재 diff 는 그 지적을 반영해 이름을 `staleGuideEntries` 로 바꾼 뒤 커밋됐다** — `guide-identifier-existence.test.ts:96-103`의 자기 서술 주석이 그 경위를 남기고 있다. 재확인 결과 옛 이름 `staleEntries`는 신규 코드 어디에도 남아 있지 않다 (`git grep staleEntries`는 원래 파일의 export만 낸다). **이미 해소됨 — 재발 없음.**

### `GUIDE_EXTERNAL_VOCABULARY` ↔ `GUIDE_NON_EMITTED_VOCABULARY` 토큰 교집합 점검

두 레지스트리는 제약이 정반대(전자는 "기준집합에 없을 것", 후자는 "있을 것")이므로 같은 토큰이 양쪽에 동시 등재되면 논리적 자기모순이 된다. 실측: `GUIDE_EXTERNAL_VOCABULARY` = `{MESSAGE_CREATE}`, `GUIDE_NON_EMITTED_VOCABULARY` = `{MAKESHOP_UNRESOLVED_PATH_PARAM, CONTAINER_MISSING_EMIT, CONTAINER_MULTIPLE_EMIT}`. 교집합 없음.

## 점검 관점별 결론

1. **요구사항 ID 충돌** — 신규 요구사항 ID 도입 없음 (해당 없음).
2. **엔티티/타입명 충돌** — 위 표대로 전수 grep 완료, 실질 충돌 0건. `staleGuideEntries` 개명 건은 이미 해소된 상태로 재확인만 됨.
3. **API endpoint 충돌** — diff 에 backend 라우트/컨트롤러 변경 없음 (해당 없음).
4. **이벤트/메시지명 충돌** — `logic.mdx`/`logic.en.mdx` 의 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 문구는 신규 이벤트/메시지명 도입이 아니라 기존 두 토큰의 **의미 표기 정정**("전용 코드 아님, 메시지 접두")이다. 두 토큰 자체는 `execution-engine.service.ts`(2026 이전부터)·다수 spec(`0-canvas.md`·`2-edge.md`·`0-common.md`·`3-loop.md`·`7-map.md`·`9-foreach.md`·`4-execution-engine.md`)에 이미 존재하며 diff 가 새로 만든 이름이 아니다.
5. **환경변수·설정키 충돌** — 신규 ENV/config key 없음 (해당 없음).
6. **파일 경로 충돌** — target(`spec/conventions/`) 델타 0. 코드 diff 도 기존 파일 2개(`guide-identifier-scan.ts`, `guide-identifier-existence.test.ts`)에 대한 수정이며 신규 파일 경로 도입 없음.

## 요약

target(`spec/conventions/`)은 이 브랜치에서 델타 0이며, 실제 검토 대상인 `codebase/**` diff(4파일/989줄)가 도입하는 신규 식별자(함수 5종 export·상수 1종 export·module-private 함수/정규식/상수 다수)를 전수 나열해 저장소 전체(`codebase`, `spec`) 대상으로 `git grep` 했다. 유일하게 발견된 과거 충돌(`staleEntries`)은 이전 라운드 지적을 받아 `staleGuideEntries`로 개명되어 이미 해소된 상태이고, 재확인 결과 옛 이름의 잔존 충돌은 없다. 근접 이름(`WC_MESSAGE_PREFIX`, `CODEBASE_SOURCE_ROOTS`)은 스코프·의미가 명확히 분리되어 있어 혼동 가능성이 낮다. `GUIDE_EXTERNAL_VOCABULARY`/`GUIDE_NON_EMITTED_VOCABULARY` 두 레지스트리 간 토큰 교집합도 없어 상호 제약 모순이 없다. 신규 API endpoint·이벤트명·ENV 변수·spec 파일 경로 도입은 이번 diff 에 없다. 신규 식별자 충돌 관점에서 이 배치를 막을 사유가 없다.

## 위험도

NONE
