# Plan 정합성 검토 — spec-draft-canary-count-relation.md

## 발견사항

- **[INFO]** 체크박스 동기화 — `auth-guard-reflection-hardening.md` §후속 잔여 항목 텍스트 자체는 갱신 대상 아님
  - target 위치: `plan/in-progress/spec-canary-count-relation-f2622b` §체크리스트 4번째 항목
    ("`auth-guard-reflection-hardening.md` §후속 의 해당 항목 체크")
  - 관련 plan: `plan/in-progress/auth-guard-reflection-hardening.md` §후속(이 PR 밖) 미체크 항목
    ("73건(subset) / 142건(superset) 관계를 spec Rationale 에도 미러링 … `1-auth.md` 또는
    `data-flow/12-workspace.md` Rationale 에 한 줄이면 된다")
  - 상세: target 은 두 후보 중 `1-auth.md` 단독으로 결정했고 근거도 명확하다(§Rationale
    "왜 `1-auth.md` 한 곳인가"). 이 자체는 해당 plan 항목이 열어 둔 "둘 중 하나" 선택지를
    정당하게 좁히는 것이라 결정 충돌이 아니다. 다만 그 plan 의 다른 완료 항목들(예: §후속의
    "헤더 vs 경로 파라미터" 항목, "부트 캐너리 설계 근거" 항목)은 체크 후 `**완료 (날짜,
    planner 턴)**` 주석과 실제 반영 위치를 항목 본문에 남기는 관례를 따랐다. target 이 체크박스만
    `[x]` 로 바꾸고 "왜 `data-flow/12-workspace.md` 가 아니라 `1-auth.md` 인지" 근거를 그 plan
    항목 옆에 남기지 않으면, 다음에 그 plan 을 훑는 사람이 왜 두 후보 중 하나만 반영됐는지
    다시 조사해야 한다.
  - 제안: target 실행 시 `auth-guard-reflection-hardening.md` 해당 항목을 체크할 때
    "1-auth.md 단독 채택, data-flow/12-workspace.md 는 붙이지 않음(중복 방지)" 한 줄을
    같이 남길 것. target 문서 자체나 체크리스트 항목 문구를 바꿀 필요는 없음 — 실행 단계의
    부수 기록 권고.

## 검증한 정합 지점 (참고, 문제 없음)

- **미해결 결정과의 충돌 없음**: `auth-guard-reflection-hardening.md` §후속의 해당 항목은
  "1-auth.md 또는 data-flow/12-workspace.md" 를 열어 둔 제안일 뿐 사용자 승인이 필요한
  "결정 필요" 항목으로 표시돼 있지 않다. target 이 `1-auth.md` 단독으로 좁힌 것은 정당한
  실행 판단이며, "**양쪽에 적지 않는다**" 는 target 의 근거(§Rationale)는 이 저장소가 이미
  두 번 겪은 "복제 문단 중 한쪽만 갱신" 클래스(#1113 nil-UUID 앵커, #1112)를 정확히
  피하는 방향이라 오히려 그 plan 이 열어 둔 리스크를 닫는다.
- **선행 조건 충족 확인**: target 의 전제 — "코드 주석(`workspace-reflection-canary.ts`)에는
  이미 73/142 관계가 있으나 spec 에는 없다" — 는 실측으로 참이다.
  `spec/5-system/1-auth.md:773-812` §부트 캐너리, `spec/data-flow/12-workspace.md:313-346`
  §"멤버십 검증은 가드 1곳에서" 를 직접 읽어 확인했고, 둘 다 현재 73건/관계에 대한
  포함관계 서술이 없다. 삽입 지점으로 target 이 지정한 "`단언 대상은 라우트 목록이 아니라
  '0건이 아님'` 문단 뒤, `**알려진 한계**` 앞" 은 `1-auth.md:791`(해당 문단)과 `:795`
  (알려진 한계) 사이로 실제 위치와 정확히 일치한다.
- **후속 항목 누락 없음**: `auth-guard-reflection-hardening.md` §후속(이 PR 밖) 의 정확히
  같은 항목("73건(subset)/142건(superset) 관계를 spec Rationale 에도 미러링")을 target 의
  체크리스트 4번째 항목이 명시적으로 지목해 닫는다 — 별도 plan 이 새로 필요하거나
  무효화되는 다른 plan 도 없다(`spec-data-flow-structural-followups.md` 는 `12-workspace.md`
  의 잔여 작업을 §4 "LLM Config" 표기 통일로 명시적으로 한정하고, 그 문서의 §Rationale
  73건 부분은 "§3 이 남긴 범위 서술 자체라 대상 아님" 이라고 스스로 배제해 두어 겹치지 않음).
  `spec-fix-swagger-forbidden-response.md`(완료) · `spec-sync-stop-editor-and-forbidden-routes.md`
  · `spec-sync-auth-gaps.md` 도 "73건" 을 인용하지만 전부 `@ApiForbiddenResponse`/RBAC
  문서화 맥락이라 target 이 다루는 "캐너리 집합 vs 73건 포함관계" 서술과 다른 축이며 충돌하지 않는다.
- **숫자 미기재 판단도 기존 관례와 일치**: 142 를 spec 에 박지 않는 target 의 판단은
  `auth-guard-reflection-hardening.md` 후속 항목이 이미 남긴 경고("숫자 자체는 미러링하지
  말 것 … 142 는 라우트가 늘면 변하는 스냅샷")와 정확히 같은 결론이라 재확인일 뿐 새 결정이 아니다.

## 요약

target(`spec-draft-canary-count-relation.md`)은 `plan/in-progress/auth-guard-reflection-hardening.md`
§후속에 이미 등재된 미해결 항목을 그대로 이어받아 좁히는 draft로, 미해결 "결정 필요" 항목을
우회하거나 다른 plan 의 선행 조건·후속 항목과 충돌하지 않는다. 삽입 위치·전제(코드 주석에만
있고 spec 에는 없음)·숫자 비기재 판단 모두 실제 spec 파일 상태 및 관련 plan 서술과 실측으로
일치한다. 유일한 권고는 실행 시 `auth-guard-reflection-hardening.md` 쪽 체크박스를 닫으며
"왜 두 후보 중 `1-auth.md` 만 채택했는지" 한 줄을 함께 남기라는 INFO 수준의 기록 권고뿐이다.

## 위험도

LOW
