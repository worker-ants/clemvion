# 유지보수성(Maintainability) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (3차 재검토, 01_15_47)

## 검토 범위

실질 프로덕션 코드 변경 8개 파일 — 이전 두 라운드(`00_03_57`, `00_39_27`)가 이미 검토·처분한
동일 파일들이다. 이번 diff 는 그 두 라운드의 처분(WARNING 5건 fix)까지 포함한 브랜치 전체
누적분이다.

- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (신규)
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts` (신규)
- `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts`
- `codebase/backend/src/modules/executions/executions.service.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.spec.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.ts`
- `codebase/backend/src/shared/utils/sanitize-error-message.ts`

나머지(CHANGELOG, plan/spec 문서, `review/code/**`·`review/consistency/**` 산출물)는 코드가
아니라 이전 라운드의 처분 기록이거나 근거 문서라 유지보수성(코드) 관점의 대상에서 제외했다.

직접 소스를 열어 `00_03_57`/`00_39_27` 라운드가 지적한 WARNING(중복 `find+throw` 3줄 복붙,
`isPlainRecord`↔`isRecord` 재구현)이 실제로 해소됐는지 재확인했다 — 두 호출부
(`executions.service.ts:496-503`, `workflows.controller.ts:313-317`)는 이제
`resolveTriggerParametersRejectingMasked(...)` 한 줄 호출로 축약돼 있고, 순서 소유권이 헬퍼
안(`reject-masked-resubmission.ts`)으로 이동했다. `findMaskedResubmissions` 도 자체
`isRecord` 를 재구현하지 않고 `to-record.ts` 의 기존 `isRecord` 를 import 해서 쓴다. 둘 다
확인 완료.

## 발견사항

- **[INFO]** 신규 한국어 인라인 주석과 인접한 기존 영어 인라인 주석이 같은 `try/catch` 블록에 공존 (이전 라운드부터 미해결, 강제 아님)
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:314-316`(신규,
    한국어 — "마스킹된 값이 그대로 재제출됐는가...") 바로 아래 `:320-322`(기존, 영어 —
    "`details` so GlobalExceptionFilter surfaces the per-field breakdown...")
  - 상세: `00_03_57` 라운드에서 이미 INFO 로 지적됐고 강제 사안이 아니라고 명시된 항목으로,
    이번 라운드까지 그대로 남아 있다. 이 저장소 최근 커밋들은 근거형 인라인 주석을 한국어로
    쓰는 쪽으로 수렴하는 추세라, 이 블록만 언어가 섞여 다음에 이 자리를 여는 사람이 어느
    언어로 이어써야 할지 헷갈릴 수 있다. 해당 영어 줄은 이번 diff 의 컨텍스트 라인(미변경)
    이라 이번 PR 이 새로 만든 문제는 아니다.
  - 제안: 필수 아님. 다음에 이 블록을 편집할 기회가 있으면 함께 한국어로 통일 검토.

- **[INFO]** `ExecutionsService.reRun` 이 여전히 137줄(§420-556)로 길고, 이번 변경이 그 안의
  입력 해석 블록에 책임을 하나 더 얹은 상태가 유지된다 (이전 라운드부터 지적, 강제 아님)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `reRun` 메서드
    (420행 시작 ~ 556행 종료), 마스킹 검사 호출은 §496-503
  - 상세: `00_03_57` 라운드 INFO 를 재확인한 결과 구조는 그대로다 — (1) 권한/404, (2) dry-run
    pre-flight, (3) chain depth 체크, (4) 입력 해석(원본 재사용 vs `inputOverride` 검증 +
    마스킹 거부), (5) 실행 트리거, (6) audit log 까지 6가지 책임이 한 메서드에 순차 배치돼
    있다. 신규 로직 자체는 작지만(8줄), 계속 조건 분기가 누적되는 패턴이다.
  - 제안: 이번 PR 스코프에서 강제할 사안 아님. 다음에 `reRun` 을 손댈 일이 생기면 입력 해석
    블록(§433-514)을 `resolveRerunInput(...)` 류 private 헬퍼로 추출하는 것을 고려.

- **[INFO]** `reject-masked-resubmission.ts` 는 실행 코드(약 50줄)보다 doc comment(약 90줄)가
  더 길다
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`
    전체(141줄)
  - 상세: 함수별 JSDoc 이 "왜 이렇게 짰는가" 근거(초판이 뚫렸던 세 갈래, phase 분리 이유,
    깊이 상한 off-by-one 등)를 상세히 남긴다. 이 저장소의 최근 보안류 PR 들이 공통으로 쓰는
    문서화 밀도이고, 실제로 각주 하나하나가 과거 CRITICAL 재발을 막는 근거를 담고 있어 코드만
    보고 순서를 되돌리는 실수를 막는 효과가 있다 — 결함이 아니라 이 코드베이스의 확립된
    컨벤션에 부합하는 형태다.
  - 제안: 조치 불필요. 참고로만 기록.

## 요약

이번 라운드는 신규 코드 변경이 아니라 두 차례 리뷰(`00_03_57`, `00_39_27`)에서 지적된
WARNING(호출부 3줄 중복, `isPlainRecord` 재구현)이 실제로 해소됐는지 재확인하는 성격이었고,
직접 소스를 읽어 둘 다 정상 해소됨을 확인했다. 핵심 헬퍼(`reject-masked-resubmission.ts`)는
검사 순서 소유권을 한 곳에 모으고(raw 우선 → resolve → 재검사), 두 호출부는 각각 한 줄
호출로 축약돼 세 번째 Manual 경로가 생겨도 순서를 다시 틀릴 자리가 없다. 네이밍(`reason`
snake_case ↔ `code` UPPER_SNAKE_CASE)·에러 매핑 테이블 패턴은 기존 3항목과 동일한 형태를
그대로 따르고, `coerce_failed` 재사용을 기각한 결정도 doc comment 로 근거를 남겼다. 테스트는
경계값(깊이 상한 자리·상한+1·배열 분기)·왕복 통합(실제 마스커 산출물을 판정기에 먹이는
캐너리)·phase 분리 캐너리까지 캡션으로 의도를 명시해 가독성이 높다. 남은 발견사항은 전부
이전 라운드부터 있었고 강제 아님으로 처분된 INFO(주석 언어 혼재 1곳, `reRun` 메서드 길이)의
재확인이며, 이번 diff 가 새로 만든 유지보수성 문제는 없다.

## 위험도

NONE
