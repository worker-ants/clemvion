# 문서화(Documentation) 리뷰 — `trigger-workflow-ref-canary` 4라운드

## 검증 방법 요약

오케스트레이터 지시(정량 주장 전수 검증 · `16_26_57` SUMMARY/RESOLUTION 대 원 리포트 대조 · 소스
2파일 주석의 커밋 시점 사실 일치)에 따라 계산·대조를 직접 수행했다. 저장소 파일은 전혀 수정하지
않았다(`git status --short` 로 시작·종료 시점 모두 확인 — 이 세션 산출물 디렉터리 외 변경 없음).

- `codebase/backend/src/shared/testing/trigger-workflow-ref.ts` / `.spec.ts` 를 `Read` 로 전문
  열람하고, `git diff 64334e708 cfd195fb4 -- codebase/**` 로 이번 라운드(3라운드 반영) diff 가
  주석·라벨 전용 2파일뿐임을 확인.
- 헬퍼 함수(`expectTriggerWorkflowRef`)의 `expect(...)` 호출을 한 줄씩 세어 **가드 11개**를
  직접 재구성 — `dto` not-null → 비밀 컬럼 → `present:false` → `present:true` → `workflow`
  not-null → 키셋 → `id` 타입 → `id` UUID → `name` 타입 → `name` 길이 →
  `expectedWorkflowId` — spec.ts 헤더가 주장하는 11단계·라벨과 정확히 일치.
- `grep -c "  it("` 로 self-spec 케이스 수 실측 → **12**(주장과 일치).
- `review/code/2026/09/10/16_26_57/{documentation,maintainability,requirement,scope,security,
  side_effect,testing}.md` 7개 파일 전부에서 `## 위험도`·`[WARNING]`/`[CRITICAL]` 태그를 직접
  세어 집계, `_routing_decision.json`(`selected_count: 7`, skip 7명 목록)과 대조.
- `git show -s --format=%B`로 `f71aa584e`(1R)·`c696ace07`(1R 반영)·`64334e708`(2R 반영)·
  `cfd195fb4`(3R 반영) 커밋 메시지 전문을 읽어 누적 수정 건수 산술(12+1+5+3=21)과 뮤테이션 노출
  건수(2R 2 · 3R 3=5) 를 원문으로 재계산.
- `plan/complete/trigger-workflow-ref-canary.md`, `plan/in-progress/harness-review-gate-followups.md`
  전문을 읽고 이번 커밋(`cfd195fb4`)의 diff 범위(`git diff 64334e708 cfd195fb4 -- <파일>`)를 별도로
  대조해 "이번 라운드가 실제로 쓴 문장"과 "이전 라운드부터 있던 문장"을 구분.

## 이번 라운드 초점 검증 결과 (재지적 아님 — 확인 결과 보고)

1. **정량 주장 전수 검산 — 전부 실측과 일치한다.**
   - 누적 코드 수정 **21건**(1R 12 + `--impl-done` 1 + 2R 5 + 3R 3): `c696ace07` 커밋 메시지
     "수정 (12건 + `--impl-done` 이 요구한 1건)" · `64334e708` 커밋 메시지 제목 "2라운드 5건 반영"
     · `cfd195fb4` 커밋 메시지 제목 "3라운드 3건 반영" + `RESOLUTION.md`(`16_26_57`) 헤더 "코드
     수정 3건 — 누적 21건" 이 산술·서술 모두 일치.
   - 가드 **11개**: `trigger-workflow-ref.ts` 의 `expect(...)` 문을 처음부터 끝까지 직접 세어
     ①`dto` not-null ②비밀 컬럼(루프) ③`present:false` ④`present:true` ⑤`workflow` not-null
     ⑥키셋 ⑦`id` 타입 ⑧`id` UUID ⑨`name` 타입 ⑩`name` 길이 ⑪`expectedWorkflowId` — 정확히 11개.
     `.spec.ts` 헤더의 번호 목록·라벨 재번호(가드 6~11)도 실제 코드 순서와 1:1 일치.
   - self-spec **12** 케이스: `grep -c` 실측 = 12.
   - 3라운드 reviewer **7명 중 NONE 4 / LOW 3**: 7개 리포트 원문의 `## 위험도` 를 직접 열람 —
     `maintainability`·`scope`·`security`·`side_effect` = NONE(4), `documentation`·`requirement`·
     `testing` = LOW(3). `SUMMARY.md` "전체 위험도" 서술과 정확히 일치.
   - 3라운드 Warning **3건**: 7개 리포트에서 `[WARNING]` 태그를 직접 세어 `documentation` 1 ·
     `requirement` 1 · `testing` 1 = 3. 나머지 4개 리포트는 WARNING 0(INFO만). `SUMMARY.md` 표의
     3행과 정확히 일치.
   - 뮤테이션 노출 관측 **5건(2R 2 · 3R 3)**: 2R 은 `15_52_06/{requirement,maintainability}.md`
     둘이 각각 "관측된 저장소 이상 상태"를 보고(2건), 3R 은 `16_26_57/{security,side_effect,
     requirement}.md` 셋이 각각 관측을 보고(3건) — `harness-review-gate-followups.md` §N 의
     "5건(2R 2 · 3R 3)" 서술과 정확히 일치.
   - 개수 오류 **"일곱 번"**: `plan/complete/trigger-workflow-ref-canary.md:362-363` 의 열거
     (앵커 116→96 · 헤딩 8/2→9/3 · 길이 표 2회 · Warning 2→4 · 라벨 133→132 · INFO 3→2 · 고아
     JSDoc 3→4)는 `·` 로 구분된 항목이 정확히 **7개**다. 뒤 5개 항목(`Warning 2→4` 이후)은 각각
     `c696ace07`/`64334e708`/`cfd195fb4` 커밋 메시지의 실제 정정 서술과 대응이 확인된다(아래 INFO
     참고 — "번" 의 정의에 관한 사소한 불명확성 하나는 있음).

2. **`16_26_57/{SUMMARY,RESOLUTION}.md` 의 집계·인용 — 7개 원 리포트와 전부 일치한다.**
   - `SUMMARY.md` 의 Warning 표 3행(가드 순서 목록 10→11 · ⑤ 비판별성 · 고아 JSDoc 세→네 번)을
     각각 `documentation.md:30-56`·`testing.md:124-141`·`requirement.md:48-74` 원문과 대조 —
     발견 내용·위치·근거가 표의 요약과 정확히 일치.
   - `SUMMARY.md` "에이전트별 위험도 요약" 표의 C/W/I 열을 7개 리포트에서 직접 재계산한 값과
     대조 — 전부 일치(`documentation` 0/1/0, `testing` 0/1/2, `requirement` 0/1/0, 나머지 4개
     0/0/N).
   - `SUMMARY.md` "라우터 결정" 의 skip 7명 목록(`performance`·`architecture`·`dependency`·
     `database`·`concurrency`·`api_contract`·`user_guide_sync`)을 `_routing_decision.json` 의
     `selected: false` 항목과 대조 — 정확히 일치.
   - `RESOLUTION.md` 표(#19~21)의 수정 내용을 실제 소스 diff(`git diff 64334e708 cfd195fb4`)와
     줄 단위로 대조 — 라벨 재번호(5→6·6→7·7→8·8→9·9→10·10→11), ⑤ 예외 명시, "세 번"→"네 번"
     정정이 표의 서술과 정확히 일치.

3. **소스 2파일 주석의 커밋 시점 사실 일치 — 발견 없음.**
   - `trigger-workflow-ref.ts:24-29` 의 "이미 **네 번** 겪었다 ... 처음 여기 '세 번' 이라
     적었다" 자기 정정 서술은 `review/code/2026/09/10/16_26_57/requirement.md` W1 의 지적과
     정확히 대응하고, `15_52_06/maintainability.md:18` 의 W1(고아 JSDoc)이 그 "네 번째 사례"라는
     주장도 사용자 memory(`feedback_my_own_fix_is_the_next_defect.md`, orphan JSDoc 3건, 다른
     세션 `#1292`)와 모순되지 않는다(3+1=4).
   - `trigger-workflow-ref.spec.ts:15-32` 의 11단계 규약·⑤ 예외 서술은 실제 헬퍼 코드(위 1번
     검증)·`testing.md` W1 의 뮤테이션 실측(⑤ 삭제 시 12/12 GREEN 유지)과 문자 그대로 일치한다.
   - `trigger-workflow-ref.ts:36-43` 의 "정본의 세 번째 독립 사본" 서술을 `triggers.service.ts`
     의 `TRIGGER_RESPONSE_STRIP_COLUMNS` 및 `schedule-trigger-ref.ts` 의 `TRIGGER_SECRET_COLUMNS`
     와 직접 대조 — 세 목록 모두 `['notificationSecretV2', 'chatChannelTokenV2']` 로 값·순서
     완전 일치, "실측 확인했다"는 주장이 사실이다.
   - `test/trigger-workflow-ref.e2e-spec.ts` 의 case E docstring 이 인용하는
     `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 정확한 문구(*"CRITICAL:
     chatChannel PATCH 가 bot token single-path 를 우회한다"*)가 해당 트래커에 실제로
     존재함을 `grep` 으로 확인.

## 발견사항

- **[WARNING]** `harness-review-gate-followups.md` 의 재작성된 "현재 상태" 요약이 해결하려던
  바로 그 결함 클래스(같은 날 추가된 신규 항목이 요약에 반영되지 않음)를 §N 에서 다시 재현하고
  있다.
  - 위치: `plan/in-progress/harness-review-gate-followups.md:40-56`(요약 각주 + "열려 있는 것의
    성격" 목록), 대조 대상은 `:1235-1284`(`## §N.` 전체 섹션).
  - 상세: 이번 세션이 새로 쓴 각주(`:40-45`)는 정확히 *"개수 단정 문장이 새 항목 추가를 반영하지
    못해 두 번 낡았다"* 는 문제를 지적하고, 그 처방으로 개수 대신 "열린 것의 *성격*" 목록으로
    바꿨다고 밝힌다. 실제로 그 목록(`:49-56`)은 §11 잔여 · "origin 기본 브랜치 해석 4곳" ·
    "승격은 됐는데 굶는다"(2026-09-10, 문서 끝) · §M(2026-09-10, 문서 끝) 네 항목을 나열하는데,
    **같은 날(2026-09-10) 등재돼 문서 맨 끝(§M 바로 다음, `:1235`)에 위치하고 지금도 미체크
    `- [ ]` 4개를 가진 §N 은 이 목록에 없다.** §N 은 §M 과 물리적으로 인접하고 등재 경위(이 PR
    자신의 `/ai-review` 라운드에서 실시간 관측)까지 같은데, 목록에는 §M 만 들어갔다. 각주 자신이
    *"tier 굶주림은 같은 날 오전에 등재됐는데 이 요약에 없었다"* 를 정정 사유로 든 것과 정확히
    같은 형태의 누락이 §N 에 대해서는 아직 남아 있다.
  - 제안: "열려 있는 것의 성격" 목록에 §N 을 한 불릿으로 추가한다(예: `- **§N** (문서 끝,
    2026-09-10 실측) — 「리뷰어 뮤테이션」 종결 문구가 실제 계약(2절 폴백)보다 넓다 + 백업이
    차단되고 뮤테이션만 진행되는 축이 3라운드에 추가로 드러났다`). 목록이 "성격만 적고 개수는
    안 담는다"는 설계 의도상 완전한 색인일 필요는 없지만, 같은 날 같은 위치에 등재된 형제 항목
    §M 이 들어간 이상 §N 을 뺄 근거가 없다.

- **[INFO]** "개수를 틀린 것이 이것으로 일곱 번째다" 목록의 "번" 이 항목 수인지 발생 횟수인지가
  불명확하다 — 그 목록 자신이 "2회"라는 표현으로 발생 횟수를 언급하기 때문이다.
  - 위치: `plan/complete/trigger-workflow-ref-canary.md:362-363`.
  - 상세: `·` 로 구분한 항목은 정확히 7개(앵커·헤딩·길이 표·Warning·라벨·INFO·고아 JSDoc)이므로
    "목록이 7개인가"라는 축자적 질문에는 그렇다고 답할 수 있다. 다만 그중 "길이 표 2회" 항목은
    스스로 같은 유형의 실수가 **두 번** 있었다고 적어, "일곱 **번**" 을 발생 횟수로 읽으면 실제
    총 발생 횟수는 7이 아니라 8(1+1+2+1+1+1+1)이 될 수 있다. 다만 같은 관례(하나의 카테고리가
    "N 회"를 내부에 접어 넣고 목록 길이로 "번째"를 세는 방식)가 이 문서의 `:135`("이것으로
    다섯 번째다" — 앵커·헤딩·길이 표 2회·Warning·"여기" 5항목)에서부터 이미 쓰이고 있어, 이번에
    새로 도입된 모호성은 아니다. 이 세션이 "개수를 세지 않고 적었다"를 자기 결함 클래스로 명시적
    으로 추적하고 있다는 점에서, 정확한 의미(항목 수 vs 발생 횟수)를 한 번은 명시해 두는 편이
    이 클래스의 재발을 막는 취지에 부합한다. "앵커 116→96"·"헤딩 8/2→9/3"·"길이 표 2회" 자체는
    이 워크트리의 git 이력(1R 커밋 `f71aa584e` 이전)에 남아 있지 않아 독립적으로 재현 검증하지는
    못했다.
  - 제안: 조치 불요에 가깝다(기존 관례의 연장이고 CRITICAL 성격이 아님). 다음에 이 목록을 갱신할
    기회가 있으면 "7개 유형(그중 하나는 2회 발생)" 처럼 단위를 명시하면 이 모호성이 사라진다.

## 요약

이번 라운드에서 지시된 핵심 검증 축 — 누적 수정 21건 산술, 가드 11개, self-spec 12케이스, 3라운드
NONE 4/LOW 3, Warning 3건, 뮤테이션 노출 5건(2R 2·3R 3), "일곱 번" 목록의 항목 수 — 을 전부 원본
소스·커밋 메시지·7개 리포트 원문과 직접 대조했고 모두 실측과 일치했다. `16_26_57/{SUMMARY,
RESOLUTION}.md` 의 표·인용도 그 세션 7개 리포트의 발견·위치·근거와 줄 단위로 일치해 새로운 집계
오류를 찾지 못했다. 소스 2파일(`trigger-workflow-ref.ts`/`.spec.ts`)의 새 주석은 라벨 재번호·
11단계 규약·"세 번→네 번" 자기 정정 모두 실제 코드·인용 리포트와 어긋나는 자리가 없었다. 다만
`harness-review-gate-followups.md` 의 재작성된 "현재 상태" 요약이 정확히 스스로 고치려던 "같은 날
추가된 신규 항목이 요약에 반영되지 않는다" 결함을 §N 에 대해서는 여전히 재현하고 있어 WARNING 으로
등재했고, "일곱 번" 목록의 단위(항목 수 vs 발생 횟수) 불명확성은 이 문서의 기존 관례 연장선이라
INFO 로만 남긴다. 코드 로직·판정력에 영향을 주는 문서 결함은 없다.

## 위험도

LOW — 두 발견 모두 트래커/메타 문서의 완결성·정확도 문제이며 코드 동작·테스트 판정력·spec 계약에는
영향이 없다. WARNING 은 같은 문서 안에서 자기 자신이 명시한 처방("새 항목은 요약에 반영")을 §N 에
아직 적용하지 못한 완결성 결함이라 무시하기보다 이번 턴에 반영할 가치가 있다.

STATUS: success