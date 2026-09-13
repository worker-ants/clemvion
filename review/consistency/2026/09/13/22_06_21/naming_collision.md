# 신규 식별자 충돌 검토 — naming_collision

## 조사 방법 메모

- `--impl-done` 프롬프트 번들의 scope(`spec/conventions/`) 델타는 0개 파일 — 이 브랜치는 spec
  영역 자체를 바꾸지 않는다(코드 전용 배치이므로 정상, 델타 0 자체를 CRITICAL 근거로 쓰지
  않았다). 실제 구현 diff(`origin/main...HEAD`)는 프롬프트 예산에 잘려 있었고
  `error-codes.md`·`git diff origin/main...HEAD -- code_areas` 항목도 예산 초과로 생략돼
  있어, 지시대로 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/error-code-emission-axis-56c9ff`)를
  `git diff origin/main...HEAD`(pathspec 없이, 절대경로 CWD 기준)로 직접 열어 diff 전문을
  확인했다.
- HEAD 는 `53d29a6f4`("라운드 7")이며, 직전 naming_collision 라운드
  (`review/consistency/2026/09/13/21_41_25`, **NONE**)가 다룬 커밋 `eb53aba1c`("라운드 6")
  **이후** 추가된 유일한 커밋이다. 그 라운드가 누적 13개 신규 식별자를 이미 전수 grep
  검증했으므로, 이번 세션은 (a) 라운드 7 diff 가 새로 더한 것 (b) 누적 인벤토리 재확인 두
  단계로 진행했다.
- 검증 명령: `git grep -n "<식별자>"`(저장소 전체, 대상 파일 자신 포함) — 아래 인벤토리 전
  항목에 대해 직접 실행.

## 라운드 7 diff 가 새로 더한 것 — 신규 최상위 식별자 0개

`git show 53d29a6f4 -- codebase/... plan/... PROJECT.md` 전문을 확인한 결과, 라운드 7 은:

- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` —
  라운드 6 이 이미 도입한 `resolveSourceLines` 를 재사용하는 `describe("resolveSourceLines —
  유일성 가드")` 블록(3 `it`) 추가 + JSDoc 문장 보강. **새 top-level 식별자 없음.**
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` — 헤더 주석의 SoT
  인용 문구만 정정(`user-guide-evidence.md` → `error-codes.md` + `3-error-handling.md §1`,
  "아직 §2 표에 없다" 명시). **식별자 변경 없음, 산문 정정.**
- `PROJECT.md:300` — 같은 SoT 인용 정정 1줄. **식별자 변경 없음.**
- `plan/in-progress/error-code-emission-axis.md` / `spec-draft-nullable-notation-followups.md`
  — 라운드 7 자체의 서술(뮤턴트 분기 보강·줄 번호 정정 8016→8017·역참조) 추가. plan 서술
  이지 신규 식별자 선언이 아니다.

즉 라운드 7 은 기존에 이미 검증된 `resolveSourceLines`(라운드 6 도입, 직전 라운드가 저장소
전체 grep 으로 충돌 없음 확인)를 **호출만** 하며, 이 라운드가 새로 만든 이름은 없다.

## 누적 인벤토리 재확인 — 충돌 없음

라운드 1~6 이 도입한 아래 13개 최상위 식별자를 다시 `git grep`으로 전수 확인했다. **전부
`guide-identifier-scan.ts` / `guide-identifier-existence.test.ts` 두 대상 파일 내에서만
발견되고, 다른 모듈에 동명 식별자는 0건이다:**

| 식별자 | 종류 | 비고 |
|---|---|---|
| `GUIDE_NON_EMITTED_VOCABULARY` | exported const | `GUIDE_EXTERNAL_VOCABULARY` 의 의도된 거울상(제약 반대) |
| `collectQuotedLiterals` / `collectMessagePrefixes` / `collectCatalogCodes` | exported fn | 발행 축 수집기 3종 |
| `isMessagePrefixOnly` | exported fn | 진리표 술어 |
| `computeNonEmittedOffenders` | exported fn | 판정 정본 |
| `collectMatches` | module-private fn | 3 수집기의 공용 헬퍼 |
| `QUOTED_LITERAL` / `MESSAGE_PREFIX` / `CATALOG_CODE` | module-private regex const | `MESSAGE_PREFIX` 는 `web-chat-sdk/src/types.ts` 의 `WC_MESSAGE_PREFIX` 와 접두어가 달라 실충돌 아님(직전 라운드가 이미 확인) |
| `staleGuideEntries` | test-local fn | **첫 판은 `staleEntries`였는데** `repo-guards/__tests__/internal-package-registration-guard.ts:129` 의 기존 export(시그니처 상이)와 충돌해 라운드 3에서 개명 완료 — 현재 상태는 개명 후이며 재확인 결과 잔여 충돌 없음 |
| `parseWhereRefs` | test-local fn | — |
| `sourceLinesCache` / `resolveSourceLines` | test-local (라운드 6) | 대상 파일 1건만 |
| `NON_EMITTED_VOCABULARY_CAP` | test-local const | — |

`GUIDE_NON_EMITTED_VOCABULARY` 에 등록된 문자열 3종(`MAKESHOP_UNRESOLVED_PATH_PARAM` ·
`CONTAINER_MISSING_EMIT` · `CONTAINER_MULTIPLE_EMIT`)은 이 diff 가 새로 만든 이름이 아니라
기존 `makeshop.handler.ts:436` · `execution-engine.service.ts:7121/7125/7130` 이 이미
발행하던 메시지 접두이자, 기존 spec 6곳과 유저 가이드가 이미 같은 의미로 인용해 온 문자열을
harness 예외 목록에 **등록**만 한 것이다. 다른 의미로 쓰이는 곳은 없다.

## 그 외 축 — 신규 도입 없음

- **요구사항 ID**: 신규 없음. plan 안의 "3208"·"`#1330`"·"`#1331`" 등은 모두 외부 트래커의
  기존 참조 번호이지 이 문서가 새로 부여한 ID 가 아니다.
- **엔티티/DTO/인터페이스명**: 신규 없음 — 위 표가 전부이며 모두 함수/상수, DTO·엔티티가
  아니다.
- **API endpoint**: 신규 없음 — diff 는 `codebase/frontend/src/content/docs/`(가이드 문서)·
  `.../__tests__/`(테스트)·`CHANGELOG.md`·`PROJECT.md`·`plan/`뿐이며 backend 라우트·
  컨트롤러 변경이 전혀 없다.
- **이벤트/메시지명**: 신규 없음. `logic{,.en}.mdx` 의 문구 정정(`CONTAINER_MISSING_EMIT`/
  `CONTAINER_MULTIPLE_EMIT` 이 "코드"가 아니라 "메시지 접두"라고 고침)은 기존 두 토큰의
  **표기 정정**이지 신규 이벤트명 도입이 아니다. `process.env` 읽기·네트워크 호출·이벤트
  발행/구독 변경도 diff 전체에 없음.
- **환경변수·설정키**: 신규 없음.
- **파일 경로**: `spec-draft-nullable-notation-followups.md` 의 `spec_impact` 에 추가된
  5개 spec 경로(`spec/3-workflow-editor/2-edge.md` · `0-canvas.md` ·
  `spec/4-nodes/1-logic/{0-common,7-map,9-foreach}.md`)는 전부 워킹트리에 **기존에 이미
  존재하는** spec 파일 참조이며 신규 생성이 아니다(라운드 6에서 5파일 존재 확인 완료,
  라운드 7에서 신규 파일 경로 추가 없음).

## 요약

라운드 7(HEAD `53d29a6f4`)은 라운드 6이 도입한 `resolveSourceLines` 에 판별 fixture 3건을
얹고 SoT 인용 문구·줄 번호 인용을 정정했을 뿐, **새 top-level 식별자를 하나도 추가하지
않았다.** 누적 13개 식별자(발행 축 함수·상수군 + `staleGuideEntries` 개명분 + 라운드 6의
`resolveSourceLines`/`sourceLinesCache`)를 저장소 전체 기준으로 다시 grep 한 결과도 대상
두 파일 밖에 동명 식별자가 없어 직전 라운드 판정과 동일하다. 요구사항 ID·엔티티/DTO·API
endpoint·이벤트명·ENV 변수·config key·파일 경로 6개 축 모두 이번 diff 가 새로 도입한 것이
없다(순수 harness 테스트 보강 + 주석·문서 정정 + plan 서술 갱신). 신규 식별자 충돌 관점에서
이 배치를 막을 사유가 없다.

## 위험도

NONE
