# 신규 식별자 충돌 검토 — naming_collision

## 조사 방법 메모

- `--impl-done` 프롬프트 번들의 `scope`(`spec/conventions/`) 델타는 0개 파일이었다(정상 — 이
  브랜치는 spec 을 바꾸지 않았다). 실제 구현 diff(`origin/main`..HEAD)는 4개 파일·671줄이며
  프롬프트 예산에 잘려 있었으므로, 지시대로 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/error-code-emission-axis-56c9ff`)를
  절대경로로 직접 읽어 실제 diff 를 확인했다.
- 대상 4파일: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`,
  `.../guide-identifier-existence.test.ts`, `codebase/frontend/src/content/docs/02-nodes/logic.mdx`,
  `logic.en.mdx`. 그 외 `plan/in-progress/error-code-emission-axis.md`(신규 plan)와
  `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커 보강)도 신규 식별자
  단서를 찾기 위해 확인했다.
- `spec/conventions/error-codes.md` 는 이 브랜치에서 **변경되지 않은 기존 파일**임을 직접
  확인했다(diff 없음) — 프롬프트 번들에는 예산 초과로 생략 표시만 있었다.

## 신규 식별자 인벤토리 (이번 diff 가 실제로 도입한 것)

| 종류 | 이름 | 위치 |
|---|---|---|
| exported const | `GUIDE_NON_EMITTED_VOCABULARY` | `guide-identifier-scan.ts` |
| exported function | `collectQuotedLiterals` · `collectMessagePrefixes` · `collectCatalogCodes` · `isMessagePrefixOnly` | `guide-identifier-scan.ts` |
| module-private | `collectMatches` · `QUOTED_LITERAL` · `MESSAGE_PREFIX` · `CATALOG_CODE` | `guide-identifier-scan.ts` |
| test-local | `staleGuideEntries` · `parseWhereRefs` · `NON_EMITTED_VOCABULARY_CAP` | `guide-identifier-existence.test.ts` |
| 등록 항목(문자열, 신규 "식별자 취급"은 아님) | `MAKESHOP_UNRESOLVED_PATH_PARAM` · `CONTAINER_MISSING_EMIT` · `CONTAINER_MULTIPLE_EMIT` | `GUIDE_NON_EMITTED_VOCABULARY` 목록 항목 |

요구사항 ID·엔티티/DTO·API endpoint·webhook/queue/SSE 이벤트명·ENV 변수·config key·spec 파일
경로는 이번 diff 에서 **신규 도입되지 않았다** — 이 배치는 순수 harness(테스트 스캐너) 확장 +
가이드 문장 정정이다. 아래는 위 인벤토리에 대한 충돌 검사 결과다.

## 발견사항

### 이미 발생했고 이미 해소된 충돌 (참고용, 액션 불필요)

- **[INFO]** `staleEntries` → `staleGuideEntries` 개명 이력 확인
  - target 신규 식별자: `staleGuideEntries` (`guide-identifier-existence.test.ts:73`)
  - 기존 사용처: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:129` 의 `export function staleEntries(internal: string[], knownNames: string[])`
  - 상세: 라운드 3 에서 이 헬퍼를 처음 `staleEntries` 로 만들었을 때 기존 export 된 동명
    함수(시그니처 상이)와 충돌했다. 라운드 4(`review/consistency/2026/09/13/20_34_48`
    naming_collision WARNING#5)가 이를 지적했고, plan(`error-code-emission-axis.md` §H)에
    개명 경위와 "24파일 3,419건 GREEN" 재검증 기록이 남아 있다.
  - 검증: 현재 워킹트리에서 `staleGuideEntries` / `staleEntries` 를 전체 grep 했다 —
    `staleGuideEntries` 는 대상 테스트 파일에만, `staleEntries` 는 기존
    `internal-package-registration-guard.ts` 에만 있다. **현재 상태에는 충돌이 없다.**
  - 제안: 없음 — 이미 해소됨. 과거 라운드의 발견이 이번 라운드에 재열거되지 않도록 참고만 남긴다.

### 신규 항목에 대한 독립 재검증 결과 — 충돌 없음

라운드 1~4 에서 새로 도입된 모든 exported/module-scope 식별자
(`GUIDE_NON_EMITTED_VOCABULARY`, `collectQuotedLiterals`, `collectMessagePrefixes`,
`collectCatalogCodes`, `isMessagePrefixOnly`, `collectMatches`, `parseWhereRefs`,
`staleGuideEntries`, `QUOTED_LITERAL`, `MESSAGE_PREFIX`, `CATALOG_CODE`,
`NON_EMITTED_VOCABULARY_CAP`)을 `codebase/` 전체(`*.ts`/`*.tsx`, 대상 파일 자신 제외)에
전수 grep 했다. **12개 전부 0건** — 다른 모듈에 동명 식별자가 없다.

- **[INFO]** `MESSAGE_PREFIX`(module-private regex 상수, `guide-identifier-scan.ts`) 와
  `WC_MESSAGE_PREFIX`(`codebase/packages/web-chat-sdk/src/types.ts:52`, postMessage 프로토콜
  접두 `"wc:"`) 는 이름이 근접하지만 접두어(`WC_`)가 다르고 export 되지 않으며(전자),
  서로 다른 패키지·의미(정규식 vs 프로토콜 상수)라 실제 충돌은 아니다. 문서화 목적으로만 남긴다.
  - 제안: 없음(액션 불필요) — 명명 명확화가 필요할 만큼 근접하지도, 같은 소비자층에 노출되지도 않는다.

### `GUIDE_NON_EMITTED_VOCABULARY` 등록 3종의 의미 충돌 여부

`MAKESHOP_UNRESOLVED_PATH_PARAM` · `CONTAINER_MISSING_EMIT` · `CONTAINER_MULTIPLE_EMIT` 는
이번 diff 가 **새로 만든 이름이 아니다** — 기존에 `makeshop.handler.ts:436`,
`execution-engine.service.ts:7121/7125/7130` 이 이미 발행하던 메시지 접두이자, 기존
spec 6곳(`0-common.md`·`3-loop.md`·`7-map.md`·`9-foreach.md`·`2-edge.md`·`4-execution-engine.md`)
과 유저 가이드가 이미 같은 의미로 인용해 온 문자열이다. 이번 배치는 그 기존 문자열을
harness 예외 목록에 **등록**했을 뿐이며, 같은 이름이 다른 의미로 쓰이는 곳은 발견되지 않았다
(전수 grep 결과 위 표와 spec 6곳 외 다른 의미의 사용처 없음). 충돌 없음.

## 요약

이번 target 배치(구현 diff 4파일)는 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV
변수·spec 파일 경로 어느 것도 신규 도입하지 않는 순수 harness 확장(가이드 식별자 스캐너에
"발행 축" 을 추가)이며, spec/conventions 스코프의 변경분은 0이다. 도입된 신규 함수·상수 12종을
`codebase/` 전체에 전수 grep 해 다른 모듈과의 동명 충돌이 없음을 직접 확인했다. 유일하게
실재했던 충돌(`staleEntries` vs 기존 `internal-package-registration-guard.ts` 의 동명
export)은 이미 이전 리뷰 라운드(20_34_48)에서 지적·개명·재검증까지 끝난 상태이며, 현재
워킹트리에는 그 흔적(개명 이력)만 plan 문서에 남아 있고 코드상 충돌은 없다. 새로 등록된
`GUIDE_NON_EMITTED_VOCABULARY` 3종도 기존 코드·spec 이 이미 써 온 문자열을 그대로 등록한
것이라 의미 충돌이 없다. 신규 식별자 충돌 관점에서 이번 배치를 막을 사유가 없다.

## 위험도

NONE
