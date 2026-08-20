STATUS=success naming_collision review complete — 0 CRITICAL, 0 WARNING, 1 INFO
===REPORT_MARKDOWN_BELOW===
# 신규 식별자 충돌 검토 — `spec-draft-inputdata-egress-masking.md`

## 검토 방법

target (`plan/in-progress/spec-draft-inputdata-egress-masking.md`)이 실제로 새로 도입하는
식별자가 있는지부터 확인했다. 이 draft 는 **결정을 뒤집는 것이 아니라 §R17 이 이미 적어 둔
"닫는 조건"이 충족됐다고 판정하고 기존 4개 spec 문서의 서술을 flip 하는 안**이다 — 구조상
신규 엔티티·엔드포인트·이벤트·ENV var·요구사항 ID 를 만들지 않는다. 그래서 여섯 관점 각각에
대해 "target 이 실제로 새로 부여하는 이름이 있는가"를 먼저 실측하고, 있는 것만 기존 사용처와
대조했다.

- 요구사항 ID: §R17 자체 ID 는 유지, 하위 "잔여 ②" 표제만 "해소(2026-08-20)"로 텍스트 변경 —
  신규 ID 아님 (`spec/5-system/14-external-interaction-api.md:1539`)
- 엔티티/타입명: 신규 엔티티·DTO·인터페이스 없음. `MASKED_INPUT_DATA_REASON` 은 **삭제** 방향
  (충돌 아닌 반대 축)
- API endpoint: 신규 endpoint 없음
- 이벤트/메시지명: 신규 webhook/queue/SSE 이벤트 없음
- 환경변수·설정키: 없음
- 파일 경로: 신규 spec 파일 생성 없음(기존 4개 문서 본문 수정), plan 파일명
  `plan/in-progress/spec-draft-inputdata-egress-masking.md` 는 기존 `spec-draft-*` 컨벤션
  (`spec-draft-eia-62-waiting-payload.md`, `spec-draft-eia-notification-payload-contract.md`)을
  따르고 실측상 겹치는 기존 파일 없음

유일하게 target 이 "새로 등재"하는 식별자는 §④ 의 `spec/5-system/14-external-interaction-api.md`
frontmatter `code:` 추가 두 항목(`rerun-modal.tsx`, `editor-toolbar.tsx`)이다. 이를 기존
frontmatter 전수와 대조했다.

## 발견사항

- **[INFO]** `rerun-modal.tsx` 가 §R17(EIA) frontmatter 에만 신규 등재되고 §10.2 를 담고 있는
  `13-replay-rerun.md` 자체 frontmatter `code:` 에는 없음
  - target 신규 식별자: `spec/5-system/14-external-interaction-api.md` frontmatter `code:` 에
    추가되는 `codebase/frontend/src/components/executions/rerun-modal.tsx`
  - 기존 사용처: `spec/5-system/13-replay-rerun.md` frontmatter (`code:` 블록, 1~10행) —
    Re-run 모달의 실제 spec 본문(§10.2)을 담고 있는 문서인데도 `rerun-modal.tsx` 가 등재돼
    있지 않음(backend 5개 파일만 등재)
  - 상세: 이름 충돌은 아니다 — `rerun-modal.tsx` 라는 이름 자체는 어디에도 다른 의미로 쓰이고
    있지 않고, 한 파일이 여러 spec 의 `code:` 에 동시 등재되는 것은 이 저장소의 기존
    관행이다(`editor-toolbar.tsx` 가 이미 `3-execution.md`·`0-canvas.md`·
    `conventions/cross-node-warning-rules.md`·`conventions/node-cancellation.md` 4곳에
    중복 등재돼 있음, 실측 확인). 다만 §10.2 가 이 컴포넌트의 1차 spec 본문인데 그 문서
    frontmatter 에는 빠져 있어, target 적용 후에도 "구현 정본 코드가 어느 spec 에 등재됐는가"를
    찾을 때 EIA 쪽만 보고 13-replay-rerun.md 쪽은 놓칠 여지가 있다(순수 정보성 — 충돌 아님)
  - 제안: (필수 아님) §④ 작업과 같은 커밋에서 `13-replay-rerun.md` frontmatter `code:` 에도
    `rerun-modal.tsx` 를 함께 등재하면 두 문서의 "구현 정본" 참조가 대칭이 된다. target 안건에
    필수는 아니므로 planner 재량

## 별도로 확인했으나 이 관점(식별자 충돌) 밖이라 발견사항에 포함하지 않은 것

- `spec/1-data-model.md:550` (`NodeExecution.input_data` 행)의 *"상위 `Execution.input_data`
  와 **달리** 재제출 소비처가 없어 마스킹한다"* 는 대비 서술은, `Execution.input_data` 도
  이제 마스킹 대상이 되면 "~와 달리"라는 대비 자체가 무의미해진다. 이는 **식별자 이름 충돌이
  아니라 stale cross-reference/서술 정합성 문제**이므로 cross-spec-reference 계열 검토자의
  영역으로 남겨 둔다. (target §① 은 §2.13 의 `Execution.input_data` 행만 손대고 이 형제 행은
  건드리지 않는다.)
- §R17 표면 번호(아라비아 숫자) vs "잔여 ①②③"(원형숫자) 글리프 분리는 이미 spec 이 과거
  naming 리뷰(`23_49_05` naming W1)로 확정해 둔 컨벤션이고, target 은 이를 그대로 보존하도록
  명시하고 있어(§④ "INFO: 아라비아 숫자 유지") 충돌이 아니라 **컨벤션 준수**다.

## 요약

target 은 신규 식별자를 사실상 도입하지 않는다 — §R17 이 조건부로 열어 둔 카브아웃을 조건
충족으로 닫는 **서술 flip** 이며, 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV
var·spec 파일 경로 어느 축에서도 새 이름이 기존 사용처와 부딪히는 사례를 찾지 못했다.
`MASKED_INPUT_DATA_REASON` 삭제는 충돌의 반대 방향(이름 소멸)이라 이 관점에서는 위험이 없다.
유일한 관찰은 frontmatter `code:` 등재 비대칭(INFO, 비차단)이며, 이는 이름이 겹쳐서가 아니라
등재가 한쪽에만 돼 있어서다.

## 위험도

NONE
