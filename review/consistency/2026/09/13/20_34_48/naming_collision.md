# 신규 식별자 충돌 검토 — naming_collision

## 전제 재확인

- scope(`spec/conventions/`) 델타: **0개 파일**. 이 브랜치는 `spec/conventions/` 를 바꾸지 않았다 (`plan/in-progress/error-code-emission-axis.md` frontmatter `spec_impact: none` 과 일치). 델타 0 자체는 CRITICAL 근거가 아니다.
- 실제 구현 diff(`git diff origin/main...HEAD -- codebase/`, 4파일/557줄)는 전부 `codebase/frontend/src/lib/docs/__tests__/`(`guide-identifier-scan.ts` + `guide-identifier-existence.test.ts`) 하위 harness 가드 코드와 유저 가이드 문구 2곳(`logic.mdx`/`logic.en.mdx`)이다. 신규 spec ID·엔티티·API endpoint·webhook/queue/sse 이벤트·ENV var·spec 파일 경로는 이 diff 에 **없다** — 절대경로 워킹트리에서 diff 를 직접 재확인했다.
- 따라서 본 checker 가 실질적으로 다룰 후보는 diff 가 도입하는 **코드 식별자**(신규 함수/상수/등록 토큰)로 한정된다.

## 검사한 신규 식별자 전수 (grep 전수, review/ 제외)

| 신규 식별자 | 종류 | 충돌 여부 |
|---|---|---|
| `GUIDE_NON_EMITTED_VOCABULARY` | export const (등록부) | 없음 — 유일 정의처 |
| `QUOTED_LITERAL` / `MESSAGE_PREFIX` / `CATALOG_CODE` | module-local RegExp const (non-export) | 없음 — 타 파일 미참조. `packages/web-chat-sdk/src/types.ts` 의 `WC_MESSAGE_PREFIX` 는 접두사가 달라 별개 식별자, 충돌 아님 |
| `collectMatches` | module-local 함수 (non-export) | 없음 |
| `collectQuotedLiterals` / `collectMessagePrefixes` / `collectCatalogCodes` / `isMessagePrefixOnly` | export 함수 | 없음 |
| `NON_EMITTED_VOCABULARY_CAP` | test-local const | 없음 — 자매 상수 `EXTERNAL_VOCABULARY_CAP` 과 이름·값(5) 모두 별개로 명확히 구분 |
| `parseWhereRefs` | test-local 함수 (non-export) | 없음 |
| `staleEntries` | test-local 함수 (non-export) | **있음 — 아래 발견사항 참조** |

## 발견사항

- **[WARNING]** `staleEntries` 함수명이 기존 repo-guard 헬퍼와 동명이지만 시그니처·계약이 다르다
  - target 신규 식별자: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:64-69`
    ```ts
    function staleEntries(
      list: readonly { token: string }[],
      cited: ReadonlySet<string>,
    ): string[] {
      return list.filter((e) => !cited.has(e.token)).map((e) => e.token);
    }
    ```
    (module-private, `export` 없음. `origin/main` 에는 이 파일에 `staleEntries` 가 없었다 — 이번 diff 의 신규 추가.)
  - 기존 사용처: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:129` (PR #979, `1b5cd636d` — 이번 브랜치가 건드리지 않는 기존 파일)
    ```ts
    export function staleEntries(internal: string[], knownNames: string[]): string[] {
      const known = new Set(knownNames);
      return internal.filter((n) => !known.has(n));
    }
    ```
  - 상세: 두 함수 모두 "집합 B 에 없는 A 의 잔여 항목을 낸다"는 같은 개념이지만 매개변수 shape 이 다르다 — 기존은 `(string[], string[])`, 신규는 `(readonly {token:string}[], ReadonlySet<string>)`. 같은 저장소 안에서 같은 "guard `__tests__` 헬퍼" 아키텍처 패턴(`<name>-guard.ts` + `<name>.test.ts`)에 동명 함수가 서로 다른 계약으로 존재하게 된다. 두 함수는 별개 모듈(파일)이라 TypeScript 컴파일/런타임 충돌은 없고(신규 쪽이 non-export 라 서로 import 되지도 않는다), 실제로 잘못된 파일에서 import 하려 하면 시그니처 불일치로 즉시 타입 에러가 나므로 silent 오작동 위험은 낮다. 다만 `git grep staleEntries` 로 정의를 찾는 다음 작업자가 두 결과 중 어느 쪽이 "그 파일" 계약인지 매번 재확인해야 하는 혼동 비용이 남는다. 직전 라운드 검토(`review/consistency/2026/09/13/20_13_19/naming_collision.md`)는 이 식별자를 "없음"으로 판정했는데, 그 grep 이 `codebase/frontend/src/lib/repo-guards/` 경로까지 훑지 않아 생긴 누락으로 보인다(실제로는 존재).
  - 제안: (a) 신규 쪽 이름을 `staleGuideEntries` 등으로 좁혀 목적(가이드 등록부 전용)을 이름에 반영하거나, (b) 두 함수의 개념이 실제로 같으므로 `internal-package-registration-guard.ts` 의 `staleEntries` 를 제네릭(`staleEntries<T>(list: T[], key: (t: T) => string, known: ReadonlySet<string>)`)으로 승격해 두 호출부가 공유하는 안을 고려. 다만 이 파일이 이미 "판정을 함수로 뽑는 것" 리팩터를 트래커에 별건으로 등재해 두고 이번 배치 범위를 의도적으로 좁혀 두었으므로(§`error-code-emission-axis.md`), (a) 개명 쪽이 이번 diff 범위에 더 맞는 최소 수정이다.

## 등록 토큰 3종 — 신규 식별자가 아니라 기존 문자열의 재등재 (참고, 비충돌)

`GUIDE_NON_EMITTED_VOCABULARY` 에 등재된 `MAKESHOP_UNRESOLVED_PATH_PARAM` · `CONTAINER_MISSING_EMIT` · `CONTAINER_MULTIPLE_EMIT` 세 토큰은 이 PR 이 새로 발급하는 식별자가 아니라 이미 코드(`makeshop.handler.ts:436`, `execution-engine.service.ts:7121·7125·7130`)와 spec 여러 곳(`spec/3-workflow-editor/0-canvas.md`, `spec/4-nodes/1-logic/*.md`, `spec/5-system/4-execution-engine.md`)에서 동일 의미로 쓰이던 메시지 접두 문자열의 재등재다. `spec/conventions/error-codes.md` §3/§4 의 정식 error-code 카탈로그와도 이름이 겹치지 않는다. CRITICAL 조건("동일 식별자가 다른 의미로 이미 사용 중")에 해당하지 않는다.

## 요약

이번 브랜치는 `spec/conventions/` 델타가 0이고, 실제 코드 diff 는 유저 가이드 식별자 실재성 가드에 "발행 축"(`GUIDE_NON_EMITTED_VOCABULARY` 및 보조 함수/정규식)을 추가하는 harness 전용 변경이다. 신규 spec ID·엔티티·API endpoint·이벤트명·ENV·spec 파일 경로 충돌은 없다. 코드 식별자 전수 검사 결과 신규 `staleEntries`(test-local, non-export) 가 기존 `internal-package-registration-guard.ts` 의 export 함수 `staleEntries` 와 동명이지만 시그니처가 달라 실질 충돌은 아니며, 명명 혼동을 낮추는 개명이 권장된다(WARNING 1건). 그 외 등록 토큰 3종은 신규 발급이 아니라 기존 문자열의 재등재로 CRITICAL 대상이 아니다.

## 위험도

LOW
