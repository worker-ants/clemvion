# Plan 정합성 검토 — target: `spec/conventions/`

검토 모드: `--impl-prep` (scope=`spec/conventions/`). 번들된 `spec/conventions/**` 자체는 대부분
읽기전용 참조 문서(카페24/메이크샵 카탈로그 등 무관 영역 포함)라 직접적인 "target 이 미해결
결정을 우회" 사례는 없었다. 실질적으로 이 impl-prep 이 지원하는 작업은 현재 worktree 의
`plan/in-progress/trigger-canary-hardening.md` (트리거 캐너리 하드닝 4건)이므로, 그 plan 과
① 원 출처 tracker(`plan/in-progress/spec-draft-nullable-notation-followups.md`) ②
`spec/conventions/secret-store.md`·EIA §7.1 의 교차 정합을 중점 검토했다.

## 발견사항

- **[WARNING] 출처 tracker 의 항목이 완료돼도 tracker 체크박스에 반영되는 절차가 없다**
  - target 위치: (간접) `spec/conventions/secret-store.md` §1.1 보강 이력이 참조하는 트리거 비밀
    컬럼 스트립 서사 — 실질적으로는 `plan/in-progress/trigger-canary-hardening.md` 전체
    (넷 다 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 항목을 그대로 가져옴)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` L3935, L3952, L3982,
    L3998 (2026-09-10 등재 4건, 현재 전부 `[ ]`)
  - 상세: `trigger-canary-hardening.md` 는 이 4건을 "닫는다" 고 명시하고 항목 서술이 tracker 원문과
    1:1 대응하지만, `trigger-canary-hardening.md` 의 자체 체크리스트(§체크리스트)에는 tracker
    쪽 항목을 `[x]` 로 갱신하거나 tracker 문서에서 해당 4줄을 지우는 단계가 없다. 이 worktree가
    자기 체크박스만 채우고 `complete/` 로 이동해도, tracker 문서에는 여전히 4건이 `[ ]` 로 남아
    "미해결 follow-up" 으로 다시 포착돼 다음 세션이 중복 작업을 시도하거나(또는 반대로 이미
    끝난 항목인지 판단하기 위해 diff 를 재조사해야 하는) 위험이 있다. 프로젝트 메모에도 동일
    실패 패턴("체크와 `complete/` 이동은 한 동작, 한 세션 3회 놓침")이 기록돼 있다.
  - 제안: `trigger-canary-hardening.md` 체크리스트에 "tracker 4건 체크 처리 + 근거(커밋/PR) 각주"
    단계를 추가하고, 실제 완료 커밋에서 `spec-draft-nullable-notation-followups.md` L3935/3952/
    3982/3998 을 `[x]` + 완료 각주로 갱신한다.

- **[WARNING] tracker 항목 「캐너리 두 파일의 주석 표기·성격」의 세 번째 지적이 `trigger-canary-hardening.md` 범위에서 누락**
  - target 위치: (관련 없음 — `spec/conventions/` 자체는 이 항목을 언급하지 않음)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` L3982-3996 (표의 3번
    행: `"keys [] ≠ ['id','name']"` 인용이 Jest 실제 출력이 아니라 의역이라는 지적, 처방 =
    "의역임을 표시하거나 실제 출력 형태로 교체") vs `plan/in-progress/trigger-canary-hardening.md`
    §A.3·§B.3
  - 상세: `trigger-canary-hardening.md` 의 "3 — 캐너리 주석 표기" 항목은 tracker 표의 1번(표기
    갈림)·2번(리뷰 이력 누적) 지적만 실측·처방으로 재서술하고, 3번(의역 인용 부정확) 은 어디에도
    언급하지 않는다. tracker 원문은 "세 건 다" 처리 대상으로 등재했으므로, 이 항목을 tracker 에서
    체크 완료 처리하면 3번이 미반영인 채로 조용히 닫힐 위험이 있다.
  - 제안: `trigger-canary-hardening.md` §B.3 에 3번(의역 인용 표시/교체) 을 명시적으로 추가하거나,
    의도적으로 제외한다면 그 판단 근거를 §B.3 또는 "하지 않는 것" 절에 적어 tracker 종결 시
    누락이 아니라 결정임을 구분한다.

- **[INFO] 신규 repo-guard(항목 1)는 코드 3중 사본 정합만 보장 — spec 문서 2곳의 "함께 갱신"
  의무는 별도 축으로 남는다**
  - target 위치: `spec/conventions/secret-store.md` §1 비대상 등재 하단 (2026-09-10 보강 콜아웃:
    "단언 자리는 이제 둘이다 … 이 문단과 EIA §7.1 이 같은 나열을 갖고 있어 한쪽만 보강하면
    다른 쪽이 낡는다 — 함께 갱신한다"), `spec/5-system/14-external-interaction-api.md` §7.1
    동일 콜아웃
  - 관련 plan: `plan/in-progress/trigger-canary-hardening.md` §B.1 (repo-guard 로 정본
    `TRIGGER_RESPONSE_STRIP_COLUMNS` ↔ `schedule-trigger-ref.ts` ↔ `trigger-workflow-ref.ts`
    3자 동일성만 강제)
  - 상세: 실측 결과 현재 두 spec 문서(`secret-store.md`·EIA §7.1)의 컬럼 목록 서술은 이미
    2026-09-10 시점에 두 단언 자리(스케줄 조인 축·트리거 직접 축)를 모두 반영해 정합 상태다 —
    지금 당장 충돌은 없다. 다만 신규 repo-guard 는 **코드 내부 3중 사본**만 비교하므로, 향후
    네 번째 비밀 컬럼이 추가돼도 그 사실이 코드 쪽에서만 일관되게 반영되면 가드는 통과하고
    spec 문서 두 곳의 "함께 갱신" 의무는 여전히 사람 손에 의존한다. `spec/` 편집은 developer
    권한 밖이라 이번 plan 범위는 아니지만, 다음 컬럼 추가 시 이 갭이 재발할 수 있다는 점을
    기록해 둔다.
  - 제안: 조치 불요(현재 정합). 향후 트리거 비밀 컬럼이 추가되는 PR 의 plan 에서 "repo-guard
    통과 ≠ spec 문서 갱신 완료" 를 체크리스트 항목으로 명시하도록 참고.

## 요약

`trigger-canary-hardening.md` 의 4개 항목은 출처 tracker(`spec-draft-nullable-notation-followups.md`)
및 `spec/conventions/secret-store.md`·EIA §7.1 의 현재 서술과 실질적으로 충돌하지 않는다 — 특히
항목 4(teardown)의 두 처방 후보 중 택일을 "착수 시 실측 후" 로 명시적으로 미룬 것은 tracker 의
결정 대기 상태를 정확히 존중한다. 다만 tracker 항목을 "닫는다" 고 선언하면서도 tracker 문서 자체의
체크박스 갱신 절차가 plan 에 없고, 캐너리 주석 정리 항목의 세부 지적 3개 중 1개가 재서술에서
빠져 있어, 완료 후 tracker 가 stale 상태로 남거나 부분 미해결 상태로 조용히 닫힐 위험이 있다.
CRITICAL 급 충돌(미해결 결정 우회)은 없다.

## 위험도

LOW
