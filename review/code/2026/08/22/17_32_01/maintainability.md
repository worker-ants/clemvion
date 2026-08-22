# 유지보수성(Maintainability) 코드 리뷰

## 개요

이번 브랜치(`origin/main..HEAD`, 5 커밋)는 `POST /executions/:id/re-run` 의 최상위 `error.code`
를 자매 엔드포인트(`POST /workflows/:id/execute` · `POST /workflows/:id/save`)와 동일한
`INVALID_TRIGGER_PARAMETERS` 로 통일하는 좁은 rename 이며, 뒤이은 두 커밋
(`480a6eea3`·`dbd4aa18c`)은 **직전 라운드(`17_06_14`) 리뷰의 WARNING 처분**(테스트 값 미검증
보강 + CHANGELOG 신설 + lint 정합)이다. 실행 코드 변경은 `executions.service.ts` 문자열
리터럴 1곳 + 설명 주석 4줄, `executions.controller.ts` Swagger `description` 1줄이 전부이고,
나머지(spec 6·plan 2·유저 가이드 mdx 2·review 산출물 다수)는 문서다. 새로 만든 함수·분기·중첩은
없으므로 "함수 길이/중첩 깊이/순환 복잡도" 류 지표는 이번 diff에 해당 사항이 없다.

직전 라운드에서 지적된 WARNING 2건 중 1건(테스트 제목-본문 불일치)은 실측(대조군 GREEN/RED
확인)으로 확실히 처분됐음을 코드로 확인했다. 나머지 1건(`#TBD_PR` placeholder)은 PR 번호가
생성 전에는 존재할 수 없다는 구조적 제약 때문에 **의도적으로 미해결 상태로 남아 있다** — 새로운
결함이 아니라 계획된 후속 커밋 대상이다.

## 발견사항

- **[INFO]** 리네임된 테스트의 회귀 방지력이 실측으로 강화됨(직전 WARNING 처분 확인)
  - 위치: `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts:330`
    (테스트: `throws INVALID_TRIGGER_PARAMETERS when inputOverride fails trigger schema validation`)
  - 상세: 직전 리뷰(`17_06_14` W5)가 지적한 "제목만 코드값을 주장하고 본문은
    `toBeInstanceOf(BadRequestException)` 만 본다"는 결함이 `body.code` 단언 추가로 닫혔다.
    `RESOLUTION.md` 가 대조군(무수정=GREEN, 발행부를 `INVALID_INPUT` 으로 되돌림+fix 후=RED,
    같은 되돌림+fix 전 본문=GREEN)으로 판별력을 직접 실증한 점이 특히 견고하다. 이후 커밋
    (`dbd4aa18c`)에서 `.then(() => null, (e) => e)` 형태를 같은 파일의 자매 테스트가 쓰는
    `.catch((err_: unknown) => err_)` 관용구로 재통일해 스타일 일관성도 맞췄다(`unicorn/catch-error-name`
    lint 대응). 조치 불요 — 확인용 기재.

- **[INFO]** 최상위 에러 코드 문자열이 여전히 3곳에 컴파일 타임 공유 SoT 없이 독립 리터럴로
  중복돼 있다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:510`,
    `codebase/backend/src/modules/workflows/workflows.controller.ts:324`,
    `codebase/backend/src/modules/workflows/workflows.service.ts:931` (grep 으로 직접 확인)
  - 상세: `'INVALID_TRIGGER_PARAMETERS'` 라는 동일 문자열이 세 파일에 각각 하드코딩돼 있다.
    이번 PR 이 고친 drift(re-run 쪽만 값이 갈라져 있던 것) 자체가 "세 곳의 독립 리터럴이
    시간이 지나며 서로 어긋난" 사례라, 통일 후에도 같은 실패 모드가 재발할 여지는 구조적으로
    남아 있다. 이 패턴은 이번 diff 가 새로 만든 것이 아니라 코드베이스 전역 기존 관례이고,
    직전 라운드에서도 동일하게 INFO 로 남기고 이 PR 범위 밖으로 명시적으로 defer 됐다 —
    새 지적이 아니라 잔존 확인.
  - 제안: 지금 당장 조치 불필요. 후속 별도 plan 으로 "HTTP 최상위 에러 코드 공유 상수화"
    검토 여지는 여전히 유효.

- **[INFO]** `error-codes.md §5` 신규 행의 "PR" 컬럼이 여전히 `#TBD_PR` placeholder 다
  - 위치: `spec/conventions/error-codes.md:145`
  - 상세: 직전 라운드(`17_06_14` WARNING)가 지적했던 항목이며, `RESOLUTION.md`(W4)에
    "PR 번호는 생성 전에는 존재하지 않으므로 placeholder 로 커밋한 뒤 `gh pr create` 직후
    같은 브랜치에 치환 커밋을 올린다"는 명시적 처리 계획이 이미 적혀 있다. 실측(`grep -n
    TBD_PR spec/conventions/error-codes.md`)으로 현재도 placeholder 상태임을 재확인했다 —
    다만 이는 미해결 결함이 아니라 **PR 생성 시점이 아직 오지 않아서** 계획대로 보류된 상태다.
  - 제안: 조치 불요(이미 추적 중). `gh pr create` 직후 치환 커밋이 예정대로 따라오는지만
    확인.

- **[INFO]** `error-codes.md §5` 신규 행 "비고" 셀이 여전히 표의 다른 행보다 훨씬 길다
  - 위치: `spec/conventions/error-codes.md:145`
  - 상세: 직전 라운드에서 이미 INFO 로 지적됐고 이번 라운드에서 셀 내용이 줄지 않았다.
    다만 이 행은 "본 표에서 리스크 등급이 가장 높은 첫 사례"라 근거 보존이 표 스캔성보다
    값지다는 판단(직전 리뷰의 INFO #3 사유)이 그대로 유효하다 — 재지적이되 우선순위를 올릴
    사유는 없다.
  - 제안: 강한 조치 불요. 후속 편집 기회에 각주 분리 검토.

- **[INFO]** `review/consistency/2026/08/22/16_34_50/_retry_state.json` 이 여전히 "호출 전"
  스냅샷 상태로 커밋돼 있다
  - 위치: `review/consistency/2026/08/22/16_34_50/_retry_state.json`
  - 상세: `agents_success`/`agents_fatal` 이 빈 배열이고 `agents_pending` 에 5개 checker 가
    그대로 남아 있는데, 같은 세션의 `SUMMARY.md`·5개 checker 리포트는 전부 완료된 내용을
    담고 있어 실제로는 전원 성공했음이 분명하다. `review/code/2026/08/22/17_06_14/_retry_state.json`
    도 동일 패턴(직전 라운드 requirement 리뷰가 이미 지적). application 코드와 무관한
    harness 부산물이라 기능적 영향은 없다.
  - 제안: application 조치 불요. harness 세션이라면 `subagent-call-contract.md` 의
    완료 후 상태 파일 갱신 로직 재검토 가치가 있다는 점만 반복 기록.

## 요약

이번 라운드의 실질 diff 는 (1) 직전 라운드가 지적한 테스트 회귀 방지력 결함을 대조군 실증까지
동원해 견고하게 닫았고, (2) 그 과정에서 catch 관용구를 같은 파일 자매 테스트와 통일해 스타일
일관성을 오히려 개선했으며, (3) breaking change 를 위한 CHANGELOG 신설로 문서 추적선을
완결했다. 새로 만든 함수 길이·중첩·순환 복잡도 문제는 없다. 남은 항목은 전부 "새로 발견된
문제"가 아니라 "직전 라운드에서 이미 인지·추적 중이며 의도적으로 지금 처리하지 않는" 잔존
사항(`#TBD_PR` 은 PR 생성 시점 대기, 리터럴 중복은 별도 plan 후보, `_retry_state.json` 은
harness 부산물)이다. 유지보수성 관점에서 이 브랜치는 실질적으로 개선(drift 제거 + 테스트
정합성 강화)만 있고 새로 도입된 결함은 없다.

## 위험도

LOW
