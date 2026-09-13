# 신규 식별자 충돌 검토 — naming_collision

## 조사 방법 메모

- `--impl-done` 프롬프트 번들의 scope(`spec/conventions/`) 델타는 0개 파일 — 이 브랜치는 spec
  영역 자체를 바꾸지 않는다(코드 전용 배치이므로 정상, 델타 0 자체를 CRITICAL 근거로 쓰지
  않았다).
- 실제 구현 diff(`origin/main...HEAD`)는 프롬프트 예산에 잘려 있어(diff 본문 자체가 번들에
  없음), 지시대로 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/error-code-emission-axis-56c9ff`)를
  절대경로로 직접 열어 `git diff`/`git log`/`git show` 로 diff 전문을 확인했다.
- `git merge-base HEAD origin/main` = `afaef5befc140cffb6666f1e1881c6d8661e9aeb`. 그 지점부터
  HEAD(`061f5153f`, "라운드 8")까지 `codebase/`·`spec/` 변경은 4개 파일 (846 삽입/11 삭제):
  - `codebase/frontend/src/content/docs/02-nodes/logic.mdx` / `.en.mdx` — 문구 정정만
  - `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` — 신규 상수/함수
  - `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` — 신규
    테스트 + 신규 test-local 헬퍼
- HEAD 는 직전 naming_collision 라운드(`review/consistency/2026/09/13/22_06_21`, 커밋
  `53d29a6f4`, **NONE**) 이후 1개 커밋(`061f5153f`, "라운드 8") 만 추가됐다. 그 라운드가
  누적 13개 신규 식별자를 이미 저장소 전체 grep 으로 검증했으므로, 이번 세션은 (a) 라운드
  8 이 새로 더한 식별자 (b) 누적 인벤토리 재확인 순으로 진행했다.
- 검증 명령: `grep -rn "\b<식별자>\b" --include="*.ts" --include="*.tsx" codebase/` (저장소
  전체, 대상 파일 자신 포함) — 아래 인벤토리 전 항목에 대해 직접 실행.

## 라운드 8 diff 가 새로 더한 것 — 신규 최상위 식별자 2개

| 식별자 | 종류 | 위치 | 저장소 전체 grep 결과 |
|---|---|---|---|
| `SOURCE_ROOTS` | test-local const (`["codebase/backend/src", "codebase/packages"]`) | `guide-identifier-existence.test.ts:55` | 대상 파일 내부(선언 1 + 참조 4)만 — 충돌 없음 |
| `skipBuildDirs` | test-local 함수 (node_modules/dist/build 스킵) | 〃 `:56` | 대상 파일 내부(선언 1 + 참조 4)만 — 충돌 없음 |

두 식별자는 `sourceTexts`(기준집합)와 `resolveSourceLines`(`where` 검증)가 서로 다른 소스
루트를 쓰던 것을 단일 정의로 합친 리팩터(`/ai-review` `review/code/2026/09/13/22_06_10`
architecture WARNING#1 대응)이며, 이름·개념 모두 다른 모듈에 선례가 없다.

`guide-identifier-scan.ts` 쪽 라운드 8 변경분은 헤더 주석 문구 정정(SoT 인용 되돌림 +
"방출 위치를 AST 로 특정" 예고문 취소선 처리)뿐이며 **신규 식별자 선언이 없다**
(`git diff 53d29a6f4 HEAD -- .../guide-identifier-scan.ts` 로 직접 확인).

`parseWhereRefs` 는 라운드 8 에서 반환 타입이 `{file,line}[]` → `{refs, residue}` 로
바뀌었으나 **함수명 자체는 기존 식별자**(라운드 1~7 이미 검증)이고 시그니처 변경은 명명
충돌과 무관하다.

## 누적 인벤토리 재확인 — 충돌 없음

라운드 1~8 이 도입한 아래 15개 최상위 식별자를 다시 `grep -rn`으로 저장소 전체 재확인했다.
**전부 `guide-identifier-scan.ts` / `guide-identifier-existence.test.ts` 두 대상 파일
내에서만 발견되고, 다른 모듈에 동명 식별자는 0건이다:**

| 식별자 | 종류 | 비고 |
|---|---|---|
| `GUIDE_NON_EMITTED_VOCABULARY` | exported const | `GUIDE_EXTERNAL_VOCABULARY` 의 의도된 거울상(제약 반대) |
| `collectQuotedLiterals` / `collectMessagePrefixes` / `collectCatalogCodes` | exported fn | 발행 축 수집기 3종 |
| `isMessagePrefixOnly` | exported fn | 진리표 술어 |
| `computeNonEmittedOffenders` | exported fn | 판정 정본 |
| `collectMatches` | module-private fn | 3 수집기의 공용 헬퍼 |
| `QUOTED_LITERAL` / `MESSAGE_PREFIX` / `CATALOG_CODE` | module-private regex const | `MESSAGE_PREFIX` 는 `codebase/packages/web-chat-sdk/src/types.ts` 의 `WC_MESSAGE_PREFIX` 와 접두어가 달라 실충돌 아님(재확인, grep 0건 교차) |
| `staleGuideEntries` | test-local fn | **첫 판은 `staleEntries`였는데** `repo-guards/__tests__/internal-package-registration-guard.ts:129` 의 기존 export(시그니처 상이 — `(string[], string[])`)와 충돌해 라운드 3에서 개명 완료. 현재 파일에 옛 이름(`staleEntries`)은 남아 있지 않음(grep 재확인) |
| `parseWhereRefs` | test-local fn | 라운드 8에서 반환 타입만 변경, 이름 불변 |
| `sourceLinesCache` / `resolveSourceLines` | test-local (라운드 6) | 대상 파일 1건만 |
| `NON_EMITTED_VOCABULARY_CAP` | test-local const | — |
| `SOURCE_ROOTS` / `skipBuildDirs` | test-local (라운드 8, 신규) | 대상 파일 1건만 — 위 표에서 이미 확인 |

`GUIDE_NON_EMITTED_VOCABULARY` 에 등록된 문자열 3종(`MAKESHOP_UNRESOLVED_PATH_PARAM` ·
`CONTAINER_MISSING_EMIT` · `CONTAINER_MULTIPLE_EMIT`)은 이 diff 가 새로 만든 이름이 아니라
기존 `makeshop.handler.ts:436` · `execution-engine.service.ts:7121/7125/7130` 이 이미
발행하던 메시지 접두이자, 기존 spec(`spec/5-system/3-error-handling.md` §1 카탈로그에는
**미등재** — 정확히 이 목록이 존재하는 이유)와 유저 가이드가 이미 같은 의미로 인용해 온
문자열의 재등재다. `spec/5-system/3-error-handling.md`·`spec/conventions/error-codes.md`
어디에도 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 이 정식 카탈로그 코드로
등재돼 있지 않음을 grep 으로 재확인했다 — 즉 "메시지 접두 전용"이라는 본 diff 의 주장과
정식 카탈로그 사이에 모순(동일 식별자·다른 의미)이 없다.

## 그 외 축 — 신규 도입 없음

- **요구사항 ID**: 신규 없음. `plan/in-progress/error-code-emission-axis.md`·
  `spec-draft-nullable-notation-followups.md` 안의 `#1330`·`#1331`·`3208`·`3407` 등은
  모두 외부 트래커/줄 번호의 기존 참조이지 이 문서가 새로 부여한 ID 가 아니다.
- **엔티티/DTO/인터페이스명**: 신규 없음 — 위 표가 전부이며 모두 함수/상수/정규식, DTO·
  엔티티가 아니다.
- **API endpoint**: 신규 없음 — diff 는 `codebase/frontend/src/content/docs/`(가이드
  문서)·`.../__tests__/`(테스트)·`plan/`·`review/`뿐이며 backend 라우트·컨트롤러 변경이
  전혀 없다.
- **이벤트/메시지명**: 신규 없음. `logic{,.en}.mdx` 의 문구 정정(`CONTAINER_MISSING_EMIT`/
  `CONTAINER_MULTIPLE_EMIT` 이 "코드"가 아니라 "메시지 접두"라고 고침)은 기존 두 토큰의
  **표기 정정**이지 신규 이벤트명 도입이 아니다. `process.env` 읽기·네트워크 호출·이벤트
  발행/구독 변경도 diff 전체에 없다.
- **환경변수·설정키**: 신규 없음.
- **파일 경로**: 라운드 8 이 `plan/in-progress/spec-draft-nullable-notation-followups.md`
  에 서술을 추가했으나 신규 spec 파일 경로 도입은 없다(라운드 6~7 이 이미 확인한 5개 spec
  경로 참조 그대로, 신규 파일 생성 없음). `spec/conventions/` 자체는 이번 라운드도 델타 0.

## 요약

라운드 8(HEAD `061f5153f`)이 diff 에 새로 더한 최상위 선언은 `SOURCE_ROOTS`·
`skipBuildDirs` 2개뿐이며, 저장소 전체 grep 결과 두 대상 테스트 파일 밖에 동명 식별자가
없어 충돌이 없다. `guide-identifier-scan.ts` 쪽 변경은 주석 문구 정정뿐으로 신규 식별자가
없다. 직전 라운드(`22_06_21`, NONE)까지 누적 검증된 13개 식별자도 이번 세션에서 다시 grep
해 결과가 그대로임을 확인했다(`GUIDE_NON_EMITTED_VOCABULARY` 등록 3종 포함, 카탈로그·spec
어디에도 다른 의미로 등재돼 있지 않음). `staleEntries`→`staleGuideEntries` 개명(라운드 3)도
여전히 유지돼 옛 이름의 잔여 충돌이 없다. `spec/conventions/` 델타는 0이고, 요구사항 ID·
엔티티/DTO·API endpoint·이벤트명·ENV 변수·config key·파일 경로 6개 축 모두 이번 diff 가
새로 도입한 것이 없다(순수 harness 테스트 보강 + 주석/문서 정정 + plan 서술 갱신). 신규
식별자 충돌 관점에서 이 배치를 막을 사유가 없다.

## 위험도

NONE
