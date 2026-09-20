# 문서화(Documentation) 리뷰 — schedule-cron-flake (4라운드 / 누적 diff, 검증 라운드)

## 발견사항

- **[WARNING]** `codebase/**` 에 영구히 남는 JSDoc 안에서, 같은 문단의 다른 인용은 전체 경로(날짜 포함)를 쓰는데 한 군데만 경로 없는 순번("1라운드·2라운드")만 남아 자기-해소되지 않는다
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:293` (`* 거짓 실패한다 — 연 1회 cron 도 12/31 23:59 KST 에는 분 단위 cron 과 같은 시각을 가리킨다(1라운드·2라운드 리뷰가 두 번 잡았다).`)
  - 상세: 같은 JSDoc 블록의 바로 위·아래 문장(:287 `실측: plan/in-progress/spec-draft-nullable-notation-followups.md 의 해당 항목 · review/code/2026/09/20/09_35_16/RESOLUTION.md`, :299 `트래커 plan/in-progress/spec-draft-nullable-notation-followups.md 의 «cron 재계산 happy-path 의 결정적 단위 테스트» 항목`)는 전체 경로(날짜 포함)로 인용해 `spec/conventions/review-citations.md` §2("날짜를 포함한다" — bare 시각·순번 금지, 전체 경로 권장)·§3(`codebase/**` 는 "적용" 대상 — "몇 달 뒤 아무 맥락 없이 읽힌다")을 그대로 따르는데, 293행의 "(1라운드·2라운드 리뷰가 두 번 잡았다)"만 어느 세션의 어느 지적인지 가리키는 경로·날짜가 전혀 없다. `plan/**` 문서는 이 규약에서 명시적으로 제외되지만(§3 표 — "인용하는 라운드와 같은 세션에서 쓰이고, 문서 자체가 그 맥락을 담는다") 그 예외는 `plan/**`에만 적용되고 `codebase/**`에는 적용되지 않는다. 실측: 이 사실관계 자체는 정확하다 — `review/code/2026/09/20/11_54_10/RESOLUTION.md` W1("«연 1회 cron 은 분 단위 cron 과 겹칠 수 없다»가 참이 아니다")과 `review/code/2026/09/20/12_17_18/RESOLUTION.md` W1("1라운드에 내가 새로 넣은 «옛 값은 창 밖» 단언이 같은 종류의 창을 다시 만들었다")이 정확히 이 겹침을 두 번 잡았다. 문제는 사실이 아니라 **인용 형태**다 — 이 테스트 파일이 몇 달 뒤 이 cron 겹침 로직을 다시 건드릴 사람에게 읽힐 때, "1라운드·2라운드"는 어떤 세션도 특정하지 못해 `git log -S`로 추적하는 것 외엔 해소 방법이 없다(같은 문단의 다른 두 인용은 그 수고 없이 바로 찾아진다).
  - 제안: `(1라운드·2라운드 리뷰가 두 번 잡았다)`를 `` (`review/code/2026/09/20/11_54_10` W1 · `review/code/2026/09/20/12_17_18` W1 이 두 번 잡았다) `` 로 정정 — 같은 문단의 다른 두 인용과 형태를 맞춘다.

## 확인했으나 문제 없음

- 3라운드 documentation.md 가 지적한 WARNING 3건(JSDoc 290행의 "이 창 밖으로 떨어진다" 단정 vs 292-294행 모순, 인라인 주석 315-317행의 삭제된 단언 근거 잔존, plan "할 것"§2·체크리스트의 1라운드 중간 설계 잔존)은 커밋 `5d551ad73`에서 실제로 정정됐음을 직접 재확인했다. 현재 JSDoc(`schedule-trigger.e2e-spec.ts:290`)은 "거의 언제나 이 창 밖이다"로 단정을 낮췄고 바로 아래(296-299행)에 남는 반대 방향 창을 명시하며, 인라인 주석(320-321행)은 남은 두 단언(1분 안 · 분 경계)만 설명하고, plan(`schedule-cron-flake.md:37`)은 취소선(`~~생성 cron 의 값은 그 창 밖임을 함께 단언한다~~`)과 폐기 근거를 남겨 세 문서(JSDoc·인라인 주석·plan) 사이에 더 이상 모순이 없다.
- 1·2라운드가 지적한 "실측" 인용 오류(`plan/complete/ssrf-catch-instanceof.md`를 잘못 가리킴)·트래커 조기 "해소" 선인용·`NAV-WF-02` 플래너 등재 누락도 여전히 정정된 상태로 남아 있다 — `schedule-trigger.e2e-spec.ts:287`·`schedule-cron-flake.md:21-22` 모두 `plan/in-progress/spec-draft-nullable-notation-followups.md`(4960-4965행 부근)와 `review/code/2026/09/20/09_35_16/RESOLUTION.md`(27행 — `_test_logs/e2e-20260920-095855.log`·09:58/10:02 KST 재실행 366 통과 기록을 직접 열어 재확인)를 정확히 가리킨다. `spec-draft-nullable-notation-followups.md:4927-4939`에 `NAV-WF-02`·`NAV-WF-06`(planner)와 cron 재계산 단위 테스트(developer) 두 항목이 실제로 등재돼 있고, 각각의 회차·발견번호 인용(`11_54_10` INFO 2 · `12_45_31` WARNING 1, `11_21_16` cross_spec WARNING 1)도 대응하는 산출물과 일치한다.
- **[INFO]** `spec-draft-nullable-notation-followups.md:4933-4939`의 신규 트래커 항목은, 같은 목록의 다른 항목(예: 4927-4931행)이 메타데이터 괄호 `(developer/planner, 낮음, 날짜 · 세션 인용)`를 짧게 닫고 설명은 괄호 밖 평문으로 두는 것과 달리, 연말 잔여 실측 설명 전체(`후자가 이 항목이 닫는 잔여를 실측했다: 연말 ... 닫지 못한다`)를 메타데이터 괄호 **안에** 중첩시켜 괄호가 4줄 넘게 이어지고 `(거짓 통과)`라는 중첩 괄호까지 겹친다. 내용은 정확하지만 이 목록의 다른 항목들과 형식이 달라 어디까지가 "등재 메타데이터"고 어디부터 "실측 설명"인지 시각적으로 갈리지 않는다. 조치는 선택적 — 급하지 않다.
- README·API 문서·CHANGELOG·환경변수 문서·예제 코드: 이번 누적 diff(`codebase/backend/test/schedule-trigger.e2e-spec.ts` 26줄 추가·3줄 삭제, 그 외 `plan/**`·`review/**` 산출물)는 e2e 테스트의 비교식·cron 리터럴만 바꾸는 테스트 전용 수정이다. 저장소 루트 `CHANGELOG.md`의 기존 "Unreleased" 항목들은 모두 사용자에게 보이는 동작 변경(API·SSRF 정책·웹훅 예약 등)을 다루는데, 이 작업은 plan 자체가 "비대상: 서비스 코드(`schedules.service.ts`) — 바꾸는 것은 테스트의 비교뿐이다"라고 명시하며 실제로 서비스 코드·API 계약·설정에 변경이 없어 CHANGELOG 대상이 아니다.
- `review/code/2026/09/20/{11_54_10,12_17_18,12_45_31}/*`·`review/consistency/2026/09/20/11_21_16/*`는 워크플로가 그 시점 상태를 기록한 1회성 산출물이며 `spec/conventions/review-citations.md` §3이 인용 규약 적용 대상에서 제외한다("시점 기록" — 사후 편집 대상 아님). 문서화 관점 조치 불요.

## 요약

3라운드에 걸쳐 지적된 JSDoc 자기모순·인용 오류·plan 잔존 서술은 모두 실제로 정정된 상태로 재확인됐다 — 핵심 코드(`schedule-trigger.e2e-spec.ts`)와 plan(`schedule-cron-flake.md`) 사이에 더 이상 설계 불일치가 없다. 다만 그 정정 과정에서 손대지 않고 남은 한 문장(:293 "1라운드·2라운드 리뷰가 두 번 잡았다")이 이 저장소 자신의 `review-citations.md`가 요구하는 자기-해소형 인용 형태(전체 경로+날짜)를 따르지 않는다 — 같은 문단의 다른 두 인용은 정확히 그 형태를 쓰고 있어 형식 불일치가 두드러진다. 내용 자체(두 번 겹침이 실제로 있었다는 사실)는 정확하므로 영향은 낮지만, `codebase/**`에 영구히 남는 주석이라 정정 비용도 낮다. 그 외 README/API/CHANGELOG/설정 문서 갱신은 이번 범위(테스트 전용 수정)에 해당하지 않으며, 신규 트래커 항목 하나의 괄호 중첩은 선택적 가독성 개선 사항일 뿐이다.

## 위험도

LOW
