# Plan 정합성 검토 — `plan/in-progress/eia-error-code-unify.md`

## 방법

1. target 문서(`eia-error-code-unify.md`) 전문을 읽고 결정·동반 개정 표면·검증 기준을 추출.
2. 번들된 `plan/in-progress/**` 전체(약 60개 문서, 컨텍스트 예산 초과로 다수 절단)에서
   target 이 참조하는 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)의 관련 절을
   전문 확인.
3. `grep -rl` 로 `INVALID_INPUT` / `error-codes.md` / `3-error-handling` / `13-replay-rerun` /
   `manual-trigger` / `executions.service.ts` 를 `plan/in-progress/**` 전체에서 재검색해
   절단된 문서 중 관련 가능성이 있는 것(빈도 낮은 후보 8개)을 개별 확인.
4. target 이 인용하는 spec 6곳(실제 라인 번호 포함)을 저장소 현재 상태(`spec/**`)에서 직접
   열어 인용의 정확성과 문맥을 실측 대조.
5. target 이 전제로 삼는 완료 plan(`plan/complete/spec-draft-inputoverride-marker-reject.md`)을
   열어 현재 `INVALID_INPUT` 서술의 출처와 구조를 확인.

## 발견사항

이번 검토에서 CRITICAL/WARNING 급 정합성 결함은 발견되지 않았다. 아래는 INFO 수준 관찰이다.

- **[INFO]** 편집 대상 행이 최근(2026-08-20/21) 완료된 자매 plan 이 정교하게 짜 넣은
  다중-관심사 텍스트라는 점이 target 문서에 명시되지 않음
  - target 위치: `plan/in-progress/eia-error-code-unify.md` §"동반 개정 표면 (실측)" 의
    `5-system/3-error-handling.md`(80·189행) · `5-system/13-replay-rerun.md`(246·377행) 행
  - 관련 plan: `plan/complete/spec-draft-inputoverride-marker-reject.md`
    (worktree `eia-inputoverride-reject-a3f1c9`, 2026-08-20~21 완료, PR #1188/#1189 계열)
  - 상세: 실측 확인 결과 target 이 인용한 6곳(`1-manual-trigger.md:181`,
    `13-replay-rerun.md:246,377`, `3-error-handling.md:80,189`, `12-webhook.md:313`)의 현재
    `INVALID_INPUT` 서술은 이 완료된 자매 plan 이 **불과 1~2일 전** 새로 써넣은 것이다.
    이 행들은 단순 코드명 라벨이 아니라 (a) `error.details[]` 카탈로그 참조,
    (b) "re-run 이 details[] 를 안 싣던 선존 배선 결함을 2026-08-20 에 고쳤다"는 wiring-fix
    각주, (c) `§2 rename-stability` 반대 방향 Rationale 이 한 행/한 절에 뒤섞여 있다.
    target 문서는 이 행들을 편집 대상으로 정확히 지목했고(실측 대조 100% 일치) "함께
    개정한다"고 명시했으나, 그 출처가 되는 자매 plan 을 인용하지 않는다. 토큰만 치환하고
    (a)·(b) 를 실수로 지우면 완료 plan 이 고친 details[] 배선 문서화가 되돌아갈 위험이 있다.
  - 제안: target 문서 "동반 개정 표면" 절에
    `plan/complete/spec-draft-inputoverride-marker-reject.md` 를 출처로 1줄 인용하고,
    각 행 편집 시 "코드명 토큰만 치환, details[]-카탈로그 참조·wiring-fix 각주는 보존"을
    명시하면 다음 실행자(구현 세션)의 실수 여지가 준다. 차단 사유는 아님 — target 의
    "정의 SoT" 서술만으로도 실행자가 파일을 열면 발견 가능한 정보다.

## 정합성 확인 (긍정 결과)

- **미해결 결정과의 충돌 — 없음.** target 이 실행하려는 결정("두 Manual 엔드포인트의
  `error.code` 를 `INVALID_TRIGGER_PARAMETERS` 로 통일, re-run 쪽 변경")은
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md:942-957` 에 **동일 날짜
  (2026-08-22)·동일 커밋 기준점(`7b0e65aa8`)·동일 발행처 라인 번호**로 이미 기록된
  "결정됨 (2026-08-22, 사용자)" 항목과 정확히 일치한다. target 이 이 결정을 우회하거나
  일방적으로 재해석한 흔적이 없다 — 오히려 트래커가 3개로 적어 둔 동반 spec 파일을
  target 이 실측으로 6개로 정확히 넓혔다(`12-webhook.md`·`error-codes.md`·
  `14-external-interaction-api.md` 추가, 아래 grep 으로 재검증 — `INVALID_INPUT` 히트가
  정확히 이 9개 파일에만 존재).
- **선행 plan 미해소 — 없음.** target 이 전제하는 `MASKED_VALUE_RESUBMITTED` /
  `details[]` 배선(§8.1 행·§10.2 콜아웃의 근거)은
  `plan/complete/spec-draft-inputoverride-marker-reject.md` 로 이미 완료돼 있다.
  target 이 가정하는 다른 선행 조건은 없다.
- **후속 항목 누락 — 없음.** target 의 "정본 트래커 4항목 `[x]`" 작업 항목은
  `spec-sync-external-interaction-api-gaps.md` 의 4개 실제 미체크 항목(결정 항목 `:938`,
  wrapper 함수명 `:989`, §R17 볼드 `:994`, `error-codes.md §4` 표 `:996`)과 정확히
  1:1 대응한다 — 더 세거나 덜 셈이 없다. 같은 절의 5번째 항목(egress 마스킹 규약,
  `--impl-prep` 라운드가 별도로 낸 것)은 성격이 다른 별건이라 target 이 의도적으로
  범위 밖에 둔 것이 타당하다.
- **동시 진행 plan 과의 파일 중복 — 저위험, 비차단.** `masked-marker-shared-package.md`
  (별 worktree `masked-marker-contract-7d2e14`) 도 `14-external-interaction-api.md §R17`
  을 건드리지만 target 이 건드리는 문장(wrapper 함수명 등재·4번째 행 볼드)과 자매 plan 이
  건드린 문장(마커 SoT 를 패키지로 재지정)은 서로 다르다. 병렬 worktree 충돌은 본 검토
  범위 밖(`/merge-coordinate` 소관)이므로 findings 에 올리지 않는다.
- **인용의 사실 정확성** — target 이 인용한 `error-codes.md §2`(rename=breaking,
  이름 정확성 향상만을 위한 rename 금지) 문장과 §5 Rename 이력 3건("외부 client 코드에
  분기로 노출된 적이 없다…") 문장은 저장소 현재 `spec/conventions/error-codes.md` 원문과
  **verbatim 일치**한다(지어낸 이력 아님). `3-error-handling.md:80` 의 "RERUN_ prefix 를
  붙이지 않는 것은 의도" Rationale 도 원문과 일치한다.

## 요약

target(`plan/in-progress/eia-error-code-unify.md`)은 정본 트래커
`spec-sync-external-interaction-api-gaps.md` 에 이미 기록된 사용자 결정(2026-08-22)을
그대로 집행하는 계획이며, 결정 충돌·선행 plan 미해소·후속 항목 누락 어느 축에서도 문제가
발견되지 않았다. 인용한 spec 라인 번호·문장은 저장소 현재 상태와 실측 대조해 전부
정확했고, 동반 개정이 필요한 9개 파일(spec 6 + 코드/테스트 3 + 가이드 2, `error-codes.md`·
`14-external-interaction-api.md` 는 신규 등재라 grep 에는 안 잡힘) 목록도 `grep -rn
'INVALID_INPUT' codebase spec` 결과와 정확히 일치한다. 유일한 관찰(INFO)은 target 이 편집할
6개 행 중 다수가 1~2일 전 완료된 자매 plan(`spec-draft-inputoverride-marker-reject.md`)이
정교하게 짜 넣은 다중-관심사 텍스트라는 점을 target 문서가 명시적으로 인용하지 않는다는
것 — 실행 시 코드명 토큰만 바꾸고 곁들여진 details[]-카탈로그 참조·wiring-fix 각주를
보존하라는 안내가 있으면 다음 실행자의 실수 여지가 줄어든다. 차단 사유는 아니다.

## 위험도

LOW
