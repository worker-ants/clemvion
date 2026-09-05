# Rationale 연속성 검토 — `spec/conventions/{migrations,review-citations,spec-impl-evidence}.md` + `codebase/backend/migrations/README.md`

## 검토 방법

`--impl-done` 스코프(`spec/conventions/`, diff-base `origin/main`)의 실 델타 3파일과, 프롬프트
예산 절단으로 누락된 code_areas diff(`codebase/backend/migrations/README.md`, 1파일/63줄)를
워킹트리 절대경로에서 직접 `git diff origin/main...HEAD` 로 재구성해 대조했다.

이 브랜치는 같은 세션 안에서 이미 4개의 `rationale_continuity` 라운드
(`09_13_39` → `09_53_09` → `10_04_12` → `10_13_38`, 전부 NONE)를 거쳤다. 본 라운드는 그 마지막
확인점(`10_13_38`, 커밋 `0509dff6a`) 이후의 신규 커밋 3개(`74d405b07`, `88d037197`,
`8fc648856`)가 만든 델타에 집중하고, 누적 diff 전체도 재확인했다.

- `git diff 0509dff6a...HEAD -- spec/conventions/migrations.md spec/conventions/review-citations.md spec/conventions/spec-impl-evidence.md codebase/backend/migrations/README.md` — 마지막 확인점 이후 실 변경분.
- `codebase/backend/migrations/README.md` §5 "감수하는 비대칭" 재작성(1경로 → 2경로 표) —
  기존 "정상 흐름에서는 발생하지 않는다" 단언이 좁았다는 자기반증(커밋 `74d405b07`)이 §4
  hang 해결 서술이나 §6 다층 안전망 원칙을 뒤집는지.
- `spec/conventions/migrations.md` §3/§5 인용 정정(§5→§6, 절차 목록 밖으로 이동) — 실제
  README 헤더(`grep -n "^## \|^### "`)와 대조해 앵커가 맞는지.
- `spec/conventions/review-citations.md` §3/§4/Rationale — `spec/**` 행의 "위반 0건" 주장을
  "18개 파일·45건 중 36건 bare" 로 정정하고 새 Rationale 항목을 추가한 것이 §4 grandfather
  목록과 수치가 맞는지, 실제 저장소 상태(`grep -rloE` 로 spec/ 전체의 세션 인용 파일 수 재확인,
  18개 일치)와 부합하는지.
- `V110__schedule_workspace_next_run_index.sql` 헤더의 stale 문구 후속 처리가 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 실제로 등재됐는지(라인 457 확인) —
  append-only 원칙(`migrations.md` §3)과 "정정은 어디에 남기나"의 정합.
- `spec-impl-evidence.md` §2.1 신설 예외 각주와 R-1(`code:` 글로브 허용 원칙)·Overview invariant
  ("spec 약속 surface 가 지금 구현됐는가") 충돌 여부 — 이 항목은 `10_13_38` 라운드가 이미
  검토해 "좁은 예외, invariant 우회 아님"으로 판정했고 이번 델타는 해당 문단을 건드리지 않았다
  (재확인만 수행).
- 과거 커밋 이력(`git log --oneline origin/main..HEAD`, `git show --stat` 9건) — 이번 라운드
  대상 파일들에 대한 편집이 전부 "실측 → 반증 → 정정 → 새 Rationale" 패턴을 따르는지, 그 중
  어느 하나라도 과거에 명시적으로 기각된 대안을 이유 없이 재도입하는지.

## 발견사항

(없음 — CRITICAL/WARNING/INFO 모두 신규 발견 없음)

## 확인했으나 문제 없음으로 판정한 항목

- **README §5 "감수하는 비대칭" 재작성(커밋 `74d405b07`)**: 기존 "Flyway 는 성공한 마이그레이션을
  다시 돌리지 않으므로 정상 흐름에서는 발생하지 않는다"는 서술이, "CREATE 성공 후 DROP(old)
  실패 → repair + 재실행"도 재빌드를 유발하는 **정상 절차 안의 경로**임을 놓친 것이었다(리뷰
  `10_20_57` W1). 새 2-경로 표는 그 경로를 추가했을 뿐, "그럼에도 이 순서를 택하는 이유"(재빌드는
  스스로 회복하지만 인덱스 0개는 회복 안 됨)라는 **핵심 Rationale 은 그대로 유지**한다 — 결정
  자체의 번복이 아니라 근거 서술의 정밀화. §4(`FLYWAY_POSTGRESQL_TRANSACTIONAL_LOCK=false` 로
  hang 해결)와는 여전히 다른 실패 모드를 다루므로 §4 를 뒤집지 않는다(`10_13_38` 판정과 동일).
- **migrations.md §3/§5 앵커 정정(커밋 `8fc648856`, `88d037197`)**: `README.md` 실제 헤더를
  직접 grep 한 결과 "migrate-repair" 절차는 §6 안에 있고("### 6. 테이블-rewrite 형 `ALTER COLUMN
  TYPE`" 절 말미), §3 의 "§5 참고" 인용은 사실 오류였다 — 이번 정정("§6 말미")이 맞다. §5 안의
  이름 참조("§인덱스 교체")를 절 앞부분에서 "같은 절(§5) 아래" 로 고친 것도 실제 §5 구조와
  일치. 둘 다 결정 내용을 바꾸지 않고 인용 정확도만 높인 것.
- **review-citations.md §3 `spec/**` 행 정정(커밋 `8fc648856`)**: "위반 사례 0건" 주장이 반증된
  경위(같은 문서 안에서 `codebase/**`·`scripts/**` 는 실측했는데 `spec/**` 만 짐작으로 채움)를
  새 Rationale 항목("`spec/**` 을 '위반 0건' 이라 적었다가 반증됐다")으로 명시 — CLAUDE.md 의
  "결정을 뒤집으면서 새 Rationale 를 함께 쓴다" 원칙을 정확히 충족한다. §3 표의 "36건" 과 §4
  grandfather 목록의 "spec/** 36건" 이 서로 일치하고, `spec/` 전체에서 세션 인용이 있는 파일 수를
  직접 세면 18개로 §3 표의 "18개 파일" 과 부합한다.
- **V110 파일 stale 헤더 처리**: README·`data-flow/8-notifications.md` 본문은 정정했지만
  V110 `.sql` 파일 자신은 append-only 원칙(`migrations.md` §3)에 따라 손대지 않았고, 그 대신
  후속 항목("`V110` 헤더의 '정상 흐름에서는 발생하지 않는다' 서술")을
  `plan/in-progress/spec-draft-nullable-notation-followups.md:457` 에 등재해 처분 선택지(a/b)를
  남겼다 — append-only 원칙을 우회하지 않고 정정 책임을 올바른 곳(문서)에 배치.
- **PR 번호 전환 재기각(review-citations.md Rationale "왜 PR 번호로 전환하지 않았나")**: 실제
  선행 지적(`review/code/2026/09/05/00_06_38` W2, `RESOLUTION.md:27` "W2 — 지적의 전제가 저장소
  실태와 달랐다")을 대조한 결과 인용이 실사례에 부합 — 지어낸 선례가 아니다. 이 규약이 그
  대안을 다시 기각하면서 "전제가 틀렸다"·"전환 비용이 손실"이라는 별도 근거를 제시해 이유 없는
  재기각이 아니다.
- **`spec-impl-evidence.md` §2.1 신설 예외와 R-1/Overview invariant**: 이 문단은 `10_13_38`
  라운드가 이미 검토했고 이번 델타(`0509dff6a` 이후)는 해당 문단을 건드리지 않았다 — 재확인
  결과 판정 유지(좁은 예외, "구현됐는가" invariant 의 적용 대상 자체가 아닌 문서형 convention
  한정, 완전 면제 아님).

## 요약

이번 라운드가 다루는 실 델타(커밋 `74d405b07`·`88d037197`·`8fc648856`, 마지막 확인점
`0509dff6a` 이후)는 전부 **직전 라운드들이 이미 확정한 결정을 뒤집는 것이 아니라, 그 결정을
뒷받침하는 서술의 범위·앵커·수치를 반증에 따라 정밀화**한 것이다. 각 정정은 예외 없이 (1) 무엇이
왜 좁았는지 실측으로 남기고, (2) 기존 Rationale 을 대체하지 않고 보강하며, (3) 손댈 수 없는
append-only 대상(V110 `.sql`)은 plan 트래커로 후속 처리했다. `migrations.md` 의 append-only·다층
안전망 원칙, `spec-impl-evidence.md` 의 `code:` invariant, `review-citations.md` 의 §3 판별
기준·"소급 정리 안 함" 원칙 중 어느 것도 이유 없이 뒤집히거나 과거 기각된 대안(타임스탬프
prefix·`outOfOrder=true`·Merge Queue·PR 번호 전환)이 재도입된 흔적이 없다. 연속 5개 라운드째
(`09_13_39` → `09_53_09` → `10_04_12` → `10_13_38` → 본 라운드) Rationale 연속성 관점의 신규
발견이 없다.

## 위험도

NONE
