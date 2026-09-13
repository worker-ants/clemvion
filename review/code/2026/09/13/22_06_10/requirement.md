# 요구사항(Requirement) 리뷰 — error-code-emission-axis (라운드 8, `22_06_10`)

## 검토 방법

이 배치는 이미 7라운드의 `/ai-review`(`19_23_22`→`21_41_23`) + 대응 `--impl-done` 이
반복 검토·수정한 뒤의 최종 diff다(궤적 W7→W4→W2→W1→W2→W2→W2, MEDIUM→LOW 수렴). 기존
지적을 재추적하는 대신, **실제 코드·spec·테스트를 직접 열어 이전 라운드의 실측 주장들을
독립 재검증**하는 데 집중했다. 저장소 뮤테이션은 하지 않았다(읽기·grep·단일 `vitest run`
만 수행, `git status --short` 로 트리 무변경 확인).

## 독립 재검증 결과

- `codebase/frontend`에서 `guide-identifier-existence.test.ts` 단독 실행 → **79 passed
  (79)**. plan 체크리스트(§K 검증)가 주장한 "76 → 79"와 일치한다.
- `execution-engine.service.ts:7121,7125,7130`에 `CONTAINER_MISSING_EMIT`/
  `CONTAINER_MULTIPLE_EMIT`가 템플릿 리터럴 메시지 접두로만 등장 — `grep -n`으로 직접 확인,
  `GUIDE_NON_EMITTED_VOCABULARY`의 `where` 인용과 정확히 일치한다.
- `execution-engine.service.ts:8017`이 `nodeExec.error = { message }` — `code` 필드
  없음. 라운드 7이 8016→8017로 정정한 인용이 정확하다(8016은 `nodeExec.status`).
- `loop-executor.ts:64,85`의 `MAX_ITERATIONS_EXCEEDED: …` 메시지 접두와
  `execution-failure-classifier.ts:76`의 `'MAX_ITERATIONS_EXCEEDED'` 소비자 리터럴을
  직접 확인 — `isMessagePrefixOnly`가 이 조합에서 `false`를 내는 것(카탈로그 도달 전
  탈락)이 코드·spec 서술과 일치한다.
- `spec/5-system/3-error-handling.md §1.4` 표를 직접 열어 "앵커 없는 7종"·"소비자·분류기
  쪽 어휘" 서술을 대조 — 정확한 인용이다.
- `spec/conventions/user-guide-evidence.md`에 `grep -c guide-identifier` → **0**. 라운드
  7이 SoT 인용을 "착지하지 않는 곳"에서 "착지하는 곳"으로 고친 근거가 실측과 일치하고,
  등재 누락은 `plan/in-progress/spec-draft-nullable-notation-followups.md:3258`에 이미
  planner 트래커 항목으로 걸려 있다(회귀 아님).
- `spec/4-nodes/1-logic/3-loop.md:189-191`의 표 헤더가 "메시지"이고 발행 문자열 전문을
  인용하는 형태 — 이 파일이 SPEC-DRIFT 대상 "6파일" 목록(`plan/in-progress/
  spec-draft-nullable-notation-followups.md:3457-3476`)에서 **의도적으로 제외**된 것과
  일치한다(같은 CONTAINER_* 이름이 등장하는 spec 파일은 실제로 7개이나, `3-loop.md`는
  이미 올바른 "메시지" 형태로 서술하고 있어 정정 대상이 아니다 — 목록 누락이 아니라 올바른
  선례로 인용됨). `spec_impact` 목록(같은 파일 라인 32-42)의 6개 경로도 이 표와 정확히
  일치한다.

## 발견사항

- **[SPEC-DRIFT]** spec 6파일(`5-system/4-execution-engine.md`·`3-workflow-editor/
  {0-canvas,2-edge}.md`·`4-nodes/1-logic/{0-common,7-map,9-foreach}.md`)이
  `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`을 여전히 구조화된 "코드"처럼
  서술한다(예: `4-execution-engine.md:332-333` "→ `CONTAINER_MISSING_EMIT` 에러로 실행
  실패"). 이 PR이 실측으로 반증했다(`execution-engine.service.ts:7121·7125·7130`이
  메시지 접두일 뿐이고 `:8017`의 `nodeExec.error`엔 `code` 필드가 없다) — 코드(가이드
  mdx 정정 + 가드)가 옳고 spec 서술이 낡았다.
  - 위치: `spec/5-system/4-execution-engine.md:332-333`, `spec/3-workflow-editor/
    2-edge.md:202`, `spec/3-workflow-editor/0-canvas.md:636`, `spec/4-nodes/1-logic/
    0-common.md:83`, `spec/4-nodes/1-logic/7-map.md:179-180`, `spec/4-nodes/1-logic/
    9-foreach.md:209-210`
  - 상세: 이미 라운드 1에서 `plan/in-progress/spec-draft-nullable-notation-followups.md:
    3457` 항목으로 planner 트래커에 등재됐고(`--impl-done` `review/consistency/2026/09/13/
    19_23_31` cross_spec WARNING#1), 라운드 5~7에 걸쳐 `error-code-emission-axis` plan과
    상호 역참조까지 걸어 뒀다(트래커 항목 처분이 이 배치의 `GUIDE_NON_EMITTED_VOCABULARY`
    등록 2건의 존속 여부를 좌우한다는 조건부 관계 포함). `spec/` 은 이 리뷰어·이 developer
    권한 밖이므로 본 PR이 직접 고칠 대상이 아니다.
  - 제안: 코드 유지, spec 반영은 `project-planner`가 위 트래커 항목 처리 시 수행 —
    택일은 (a) `CONTAINER_*`를 `3-error-handling.md §1.4`에 backfill 하거나 (b) 6파일의
    서술을 `3-loop.md`가 이미 쓰는 "메시지 접두 전문 인용" 형태로 통일. 이미 등재·역참조
    완료 상태라 재등재 불요.

- **[INFO]** `where` 검증이 `hits.length !== 1`(파일 0건/2건 이상) 분기의 합성 fixture를
  아직 갖지 않는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:287`
    (`if (lines === null) { broken.push(...) }` — `resolveSourceLines`의 null 반환 분기)
  - 상세: `resolveSourceLines` 자신의 0건/2건 이상 분기는 별도 `describe("resolveSourceLines
    — 유일성 가드")`에서 합성 fixture(`index.ts` 46개 다중매치 등)로 검증되지만, 그 결과를
    소비하는 `broken.push` 쪽 분기는 실코퍼스 경로로만 간접 검증된다. 라운드 3에서 지적되고
    라운드 4에서 "순수 함수 분리 시 함께"로 명시적으로 유예된 항목이 그대로 남아 있다 —
    새로 발견한 결함이 아니라 기존 유예의 재확인이다.
  - 제안: 조치 불요(기존 유예 유지). 재발 방지용 재등재도 불필요 — 이미 4라운드 연속 문서화됨.

- **[INFO]** `catalogCodes`용 `spec/5-system/3-error-handling.md` 읽기가 다른 소스(`envExampleTexts`)와
  달리 `readIfPresent`의 존재 가드를 거치지 않는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:143-148`
  - 상세: 대상 파일 실존은 확인했고(`spec/5-system/3-error-handling.md` 존재), 같은 패턴이
    `guide-sanitized-message-parity.test.ts`에도 이미 있어 신규 위험이 아니다. 5라운드
    연속 처분(기존 관행 유지)과 일치한다.
  - 제안: 조치 불요.

## 요약

7라운드의 `/ai-review`가 축적한 실측 주장(소스 줄 번호·메시지 접두 여부·카탈로그 등재
여부·SoT 인용의 착지 여부)을 독립적으로 재현했고 전부 일치했다 — 새로운 CRITICAL/WARNING은
발견하지 못했다. 기능 완전성 관점에서 이 배치는 (1) 유저 가이드 두 문장을 "코드처럼
읽히는 서술"에서 "메시지 접두, 전용 코드 없음"으로 정확히 정정하고, (2) 그 회귀를 막는
가드에 "존재" 축과 분리된 "발행" 축을 추가하며, (3) 그 축의 판정 정본(`computeNonEmittedOffenders`)이
네 항(인용·접두-전용·카탈로그·등록) 각각을 합성 진리표로 겨눈 대조군을 갖췄고 실측 뮤테이션으로
검증됐다. 유일하게 남은 불일치는 spec 6파일이 이 PR이 반증한 옛 서술을 아직 담고 있는
SPEC-DRIFT인데, 이는 이미 `project-planner` 트래커에 정확한 파일·줄 번호와 함께 등재·
역참조돼 있어 이 리뷰어가 새로 등재할 것이 없다. 남은 두 INFO는 4~5라운드 연속 문서화된
기존 유예 항목의 재확인이다.

## 위험도

LOW
