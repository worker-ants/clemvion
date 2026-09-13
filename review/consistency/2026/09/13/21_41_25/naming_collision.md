# 신규 식별자 충돌 검토 — naming_collision

## 조사 방법 메모

- `--impl-done` 프롬프트 번들의 scope(`spec/conventions/`) 델타는 0개 파일 — 이 브랜치는 spec
  영역 자체를 바꾸지 않았다(코드 전용 배치이므로 정상, 델타 0 자체를 근거로 CRITICAL 을 내지
  않았다). 실제 구현 diff(`origin/main...HEAD`)는 프롬프트 예산에 잘려 있었고, `error-codes.md`
  도 예산 초과로 생략돼 있어 지시대로 워킹트리
  (`/Volumes/project/private/clemvion/.claude/worktrees/error-code-emission-axis-56c9ff`)를
  절대경로로 직접 열어 diff·spec 원문을 확인했다.
- HEAD 는 `eb53aba1c`("라운드 6")이며, 직전 검토 라운드
  (`review/consistency/2026/09/13/21_19_52`, naming_collision **NONE**)가 다룬 커밋
  `2931d921f`("라운드 5")**이후** 추가된 유일한 커밋이다. 그 라운드가 누적 13개 신규
  식별자를 이미 전수 grep 검증했으므로, 이번 세션은 **라운드 6 이 diff 에 새로 더한 것**에
  집중하고 나머지는 재확인만 했다.
- 검증 명령: `grep -rln -E "\b<식별자>\b" --include="*.ts" --include="*.tsx" codebase` (대상
  파일 자신 포함 저장소 전체) — 아래 인벤토리 전 항목에 대해 직접 실행, 결과를 표에 반영.

## 라운드 6 diff 가 새로 더한 것

`git diff origin/main...HEAD -- 'codebase/*'` 를 최상위 선언 패턴으로 전수 grep 해
누적본을 재확정한 결과, 라운드 6 이 새로 추가한 최상위 선언은 아래 2개뿐이다(나머지는
라운드 1~5 가 이미 도입해 직전 라운드가 검증 완료).

| 식별자 | 종류 | 위치 | 저장소 전체 grep 결과 |
|---|---|---|---|
| `sourceLinesCache` | module-level `Map` (test-local) | `guide-identifier-existence.test.ts` | 대상 파일 1건만 — 충돌 없음 |
| `resolveSourceLines` | function (test-local) | 〃 | 대상 파일 1건만 — 충돌 없음 |

`where` 검증을 참조마다 `backend/src`(1,304 파일) 재순회하던 것을 `basename` 캐시로
파일당 1회로 줄인 성능 리팩터이며, 두 이름 다 이 테스트 파일 밖에서 동명 식별자가 없다.

## 누적 인벤토리 재확인 — 충돌 없음 (라운드 1~5, 직전 라운드 검증분 재실행)

`GUIDE_NON_EMITTED_VOCABULARY` · `collectQuotedLiterals` · `collectMessagePrefixes` ·
`collectCatalogCodes` · `isMessagePrefixOnly` · `computeNonEmittedOffenders` ·
`collectMatches` · `QUOTED_LITERAL` · `MESSAGE_PREFIX` · `CATALOG_CODE` ·
`parseWhereRefs` · `staleGuideEntries` · `NON_EMITTED_VOCABULARY_CAP` — 총 13개를 다시
grep 했다. **전부 `guide-identifier-scan.ts`/`guide-identifier-existence.test.ts` 두 대상
파일 내에서만 발견되고, 다른 모듈에 동명 식별자는 0건이다.** (`MESSAGE_PREFIX` 와
`codebase/packages/web-chat-sdk/src/types.ts` 의 `WC_MESSAGE_PREFIX` 는 접두어가
달라 실제 충돌이 아님 — 직전 라운드가 이미 확인한 사항.)

`GUIDE_NON_EMITTED_VOCABULARY` 에 등록된 문자열 3종(`MAKESHOP_UNRESOLVED_PATH_PARAM` ·
`CONTAINER_MISSING_EMIT` · `CONTAINER_MULTIPLE_EMIT`)은 이 diff 가 새로 만든 이름이 아니라
기존 `makeshop.handler.ts:436` · `execution-engine.service.ts:7121/7125/7130` 이 이미
발행하던 메시지 접두이자, 기존 spec 6곳과 유저 가이드가 이미 같은 의미로 인용해 온
문자열을 harness 예외 목록에 **등록**만 한 것이다. 다른 의미로 쓰이는 곳은 없다.

## 그 외 축 — 신규 도입 없음

- **요구사항 ID**: 신규 없음. `plan/in-progress/error-code-emission-axis.md` 의 "3208"은
  외부 트래커의 기존 참조 번호이지 이 문서가 새로 부여한 ID 가 아니다.
- **엔티티/DTO/인터페이스명**: 신규 없음 — 위 표가 전부다(모두 함수/상수, DTO·엔티티 아님).
- **API endpoint**: 신규 없음 — diff 는 `codebase/frontend/src/content/docs/`(문서)·
  `.../__tests__/`(테스트)·`CHANGELOG.md`·`PROJECT.md`·`plan/`뿐이며 backend 라우트·컨트롤러
  변경이 전혀 없다.
- **이벤트/메시지명**: 신규 없음 — `process.env` 읽기, 네트워크 호출, 이벤트 발행/구독 변경이
  diff 전체에 없음을 grep 으로 재확인(이전 라운드들의 side_effect 점검과 일치).
- **환경변수·설정키**: 신규 없음.
- **파일 경로**: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의
  `spec_impact` 목록에 5개 spec 경로(`spec/3-workflow-editor/2-edge.md` ·
  `spec/3-workflow-editor/0-canvas.md` · `spec/4-nodes/1-logic/0-common.md` ·
  `spec/4-nodes/1-logic/7-map.md` · `spec/4-nodes/1-logic/9-foreach.md`)가 추가됐으나,
  전부 워킹트리에 **기존에 이미 존재하는** spec 파일이다(신규 생성 아님, 단순 참조 등재) —
  5파일 전부 `Read`/`ls` 로 존재 확인.

## 요약

라운드 6(HEAD `eb53aba1c`)이 diff 에 새로 더한 최상위 선언은 `sourceLinesCache`·
`resolveSourceLines` 2개뿐이며, 저장소 전체 grep 결과 대상 테스트 파일 밖에 동명 식별자가
없어 충돌이 없다. 직전 라운드(`21_19_52`, naming_collision NONE)가 이미 검증한 누적 13개
식별자도 이번 세션에서 다시 grep 해 결과가 그대로임을 확인했다(`GUIDE_NON_EMITTED_VOCABULARY`
등록 3종 포함, 의미 충돌 없음). `spec/conventions/` 델타는 0이고, 요구사항 ID·엔티티/DTO·
API endpoint·이벤트명·ENV 변수·config key 축에서는 이번 diff 가 아무것도 새로 도입하지
않았다(순수 harness 성능 리팩터 + 주석 정정 + 문서 문장 정정 + plan 서술 보강). spec_impact
에 추가된 5개 spec 경로도 신규 파일이 아니라 기존 파일 참조다. 신규 식별자 충돌 관점에서
이 배치를 막을 사유가 없다.

## 위험도

NONE
