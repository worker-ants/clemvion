# 정식 규약 준수 검토 — `spec/data-flow/` (--impl-done)

## 스코프 확인 (선행 사실관계)

`git diff origin/main...HEAD --stat` 실측: 이번 PR 이 건드린 파일은
`.claude/workflows/**`(sub-agent 반환 계약 수정) · `.claude/tests/**` · **`codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
(JSDoc 주석만, 24줄)** · `plan/**` · `review/**` 뿐이다. **`spec/**` 아래 파일은 이번 PR 에서
단 한 줄도 바뀌지 않았다.** 즉 target 으로 지정된 `spec/data-flow/` 자체는 diff 의 대상이 아니며,
scope 지정은 code_areas(execution-engine)와 연관된 spec 영역을 문맥으로 번들링한 것이다.

코드 diff 내용은 `updateExecutionStatus` self-deadlock 방지 근거를 다루는 JSDoc 주석의 수치
정정(호출부 20곳·`.transaction(` 블록 36개 전수 대조로 갱신, 이전 판의 "11곳"·"어휘적 범위만" 표현을
교정)이다. 순수 주석 변경이라 API 계약·명명·출력 포맷에 영향이 없다.

## 검토 방법

1. `spec/data-flow/*.md` 전 파일에 대해 문서 구조 규약(Overview/본문/Rationale) 점검.
2. 번들에 전문 포함된 5개 변경-인접 파일(`2-auth.md`, `3-execution.md`, `9-observability.md`,
   `14-chat-channel.md`, `15-external-interaction.md`)과, 마찬가지로 전문 포함된 관련 conventions
   (`migrations.md`, `node-cancellation.md`, `redis-keys.md`, `secret-store.md`)를 대조.
3. diff 가 건드린 `updateExecutionStatus`/self-deadlock/트랜잭션 서술이 `spec/data-flow/3-execution.md`
   에 반영돼 있는지, 있다면 conventions 와 어긋나는 표현이 새로 들어왔는지 확인.
4. `spec/data-flow/0-overview.md` 의 `0-` prefix 가 CLAUDE.md 규약(루트 전용처럼 읽힘)과 상충하는지
   `spec/conventions/spec-impl-evidence.md` 로 교차 확인.

## 발견사항

이번 diff 로 인해 `spec/data-flow/` 에 새로 유입된 정식 규약 위반은 **없음**.

- **[INFO] `spec/data-flow/0-overview.md` 의 `0-` prefix — 위반 아님, 확인만**
  - target 위치: `spec/data-flow/0-overview.md` (파일명)
  - 위반 규약: 없음 (오탐 방지 차원의 확인)
  - 상세: CLAUDE.md 표는 `0-` prefix 를 "루트, `spec/0-overview.md`" 로 서술해 언뜻 루트 전용처럼 읽힐
    수 있으나, `spec/conventions/spec-impl-evidence.md:53` 이 `spec/<영역>/0-overview.md` (예시로
    `spec/4-nodes/0-overview.md` 명시)를 **루트와 동격으로 면제 basename 등재**하고 있어, 영역 폴더
    진입 문서에 `0-` prefix 를 쓰는 것은 저장소 전역에서 기확립된 정식 패턴이다. `spec/data-flow/0-overview.md`
    는 이 패턴을 정확히 따른다 — 규약 위반이 아니다.
  - 제안: 조치 불요. (참고로 남김 — 향후 checker 가 CLAUDE.md 표만 보고 오탐 처리하지 않도록.)

- **[INFO] diff(JSDoc)가 다루는 `updateExecutionStatus` self-deadlock 서술은 spec/data-flow 비대상**
  - target 위치: `spec/data-flow/3-execution.md` 전체
  - 위반 규약: 해당 없음
  - 상세: 변경된 JSDoc 은 `execution-engine.service.ts` 내부의 트랜잭션 콜백 스코프 확인이라는
    구현 세부(정적 분석 결과)이며, `spec/data-flow/3-execution.md` 는 self-deadlock/`updateExecutionStatus`
    호출부 수를 서술하지 않는다(grep 확인, 매치 없음). 이 정보의 SoT 는
    `spec/conventions/node-cancellation.md` §2.4 소급 각주와 `plan/in-progress/backend-lint-gate-broken-on-main.md`
    이며, `spec/data-flow/*.md` 는 시퀀스 다이어그램 레벨 문서라 이 디테일을 담을 책임이 없다.
    구조 불일치 없음.
  - 제안: 조치 불요.

## 구조·명명 규약 점검 결과 (참고, 이번 diff 와 무관하게 기존 상태)

`spec/data-flow/{2-auth,3-execution,9-observability,14-chat-channel,15-external-interaction,0-overview}.md`
전부 `## Overview` → 본문 → `## Rationale` 3섹션 구조를 준수 확인(라인 grep 실측). redis-keys.md·
secret-store.md 가 규율하는 키/시크릿 네이밍 패턴은 위 5개 파일 본문에 해당 문자열이 등장하지 않아
교차 검증 대상이 없음(negative match 확인).

## 요약

이번 PR 은 `spec/**` 를 전혀 수정하지 않았고(코드 JSDoc 주석 24줄 + harness 워크플로 계약 수정 +
plan/review 산출물뿐), scope 로 지정된 `spec/data-flow/` 는 diff-base 대비 무변경이다. 번들된
5개 인접 spec 문서를 정식 규약(문서 3섹션 구조·`0-` prefix 영역 진입 문서 패턴)에 대조한 결과 위반
없음을 확인했고, diff 가 다루는 구현 세부(`updateExecutionStatus` 호출부 재검증)는 spec/data-flow 의
책임 범위 밖이라 구조적 불일치도 없다. 정식 규약 준수 관점에서 이번 변경은 완전히 무해하다.

## 위험도

NONE
