# 신규 식별자 충돌 검토 — spec-draft-swagger-401-drift.md

## 검토 범위
target: `plan/in-progress/spec-draft-swagger-401-drift.md` (spec draft, `--spec` 모드)
대상 spec 편집 2건:
1. `spec/5-system/13-replay-rerun.md` §8.1·§8.2 — 401 코드 `UNAUTHORIZED` → `AUTH_REQUIRED`
2. `spec/conventions/swagger.md §3` — 길이-예외 문면을 응답→응답/요청 양방향으로 확장

## 발견사항

이 target 은 **정의상 새 식별자를 도입하지 않는다** — 두 편집 모두 "이미 존재하는 정본 이름을 문서에 반영"하는 drift 정정이라, 통상적인 신규 식별자 충돌 6개 관점(요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV/설정키·파일 경로) 중 실제로 적용되는 항목이 없다. 실측 결과는 다음과 같다.

- **① `AUTH_REQUIRED` — 신규 아님, 기존 표준과 일치 확인**
  - target 신규 식별자: 없음 (기존 코드 `AUTH_REQUIRED` 를 문서에 재사용)
  - 기존 사용처: `spec/5-system/2-api-convention.md:171` (`401=AUTH_REQUIRED` 상태코드별 기본값), `spec/5-system/3-error-handling.md:42` (401 카탈로그 행)
  - 상세: `13-replay-rerun.md:240,269` 두 곳의 `UNAUTHORIZED` 는 스스로 "표준 [Spec 에러 처리] 규약" 이라 자칭하면서 실제로는 그 규약과 다른 이름을 쓰고 있었다. `AUTH_REQUIRED` 로 정정하면 두 문서가 정확히 일치하게 되므로 **충돌이 아니라 충돌 해소**다. 코드베이스 실측(`grep -rn UNAUTHORIZED spec/`)으로도 `UNAUTHORIZED` 는 정확히 이 2곳(같은 파일)에만 존재 — 자매 사본 없음, target 의 자기 서술과 일치.
  - 판정: 충돌 없음.

- **② `MASKED_VALUE_RESUBMITTED` — 신규 아님, 이미 같은 파일·같은 spec 트리에 정의·사용 중**
  - target 신규 식별자: 없음 (기존 에러 코드를 swagger 예외 문면에 인용)
  - 기존 사용처(모두 target 편집 이전부터 존재): `spec/1-data-model.md:471`, `spec/3-workflow-editor/3-execution.md:90-91`, `spec/5-system/13-replay-rerun.md:246,385`(**같은 파일 §8.1 에 이미 등재**), `spec/5-system/14-external-interaction-api.md:1580`(정의 SoT, EIA §R17), `spec/5-system/3-error-handling.md:195-199`, `spec/conventions/error-codes.md:129`, `codebase/backend/src/modules/executions/dto/re-run.dto.ts:21` 등
  - 상세: target 의 swagger.md §3 제안 diff("요청 값이 정책으로 거부될 수 있는 필드... 예약어·재제출 금지 값 등")는 새 코드를 만드는 게 아니라 이미 EIA §R17 이 SoT 로 정의하고 `re-run.dto.ts` 가 이미 문면(333개 description 중 하나)에 쓰고 있는 코드를 swagger 컨벤션의 "길이 예외" 근거로 승인하는 것뿐이다. `13-replay-rerun.md` §8.1 표에는 이미 이 코드가 등재돼 있어(`INVALID_TRIGGER_PARAMETERS` 행) 신규 도입이 아니다.
  - 판정: 충돌 없음.

- **③ 표 내부 중복 행 여부 (401 정정 후)**: `13-replay-rerun.md` §8.1·§8.2 각 표는 401 행이 **각각 1개씩**(현재 `UNAUTHORIZED`)뿐이라, `AUTH_REQUIRED` 로 치환해도 같은 표 안에 다른 401 행과 충돌하지 않는다. 실측 확인 완료.

- **④ plan 파일 경로 컨벤션**: `plan/in-progress/spec-draft-swagger-401-drift.md` 는 git 미추적 신규 파일이며 동일 경로에 기존 파일 없음. `spec-draft-*` 접두는 같은 배치의 `spec-draft-eia-62-waiting-payload.md`·`spec-draft-eia-notification-payload-contract.md` 와 명명 패턴 일치 — 컨벤션 위반 없음.

- **⑤ swagger.md §3 예외 문단 제목 재사용**: 제안 diff 는 기존 문단 `> **예외 — 보안·정책 캐비엇 (2026-08-17 규약화)**` 를 그 자리에서 `(2026-08-17 규약화, 2026-08-22 요청 필드까지 확장)` 으로 in-place 확장하는 것이라, 동일 문서 내 다른 곳에 같은 제목의 예외 블록이 새로 생기는 것이 아니다(제목 중복 없음, 확인 완료).

target 이 스스로 밝힌 전제("계약 변경이 아니다", "새로 만든 관행이 아니라 이미 굳은 관행의 추인")는 실측과 일치한다 — 둘 다 신규 식별자가 아니라 기존 정본 식별자를 문서에 사후 반영하는 편집이다.

## 요약
target 문서는 새 요구사항 ID·엔티티명·endpoint·이벤트명·환경변수·파일 경로를 전혀 도입하지 않는다. 두 편집 모두 이미 코드/타 spec 문서에 확립된 식별자(`AUTH_REQUIRED`, `MASKED_VALUE_RESUBMITTED`)를 drift 가 있던 문서에 사후 정합화하는 작업이며, 실측 결과 어느 쪽도 다른 의미로 이미 쓰이고 있지 않다. 신규 식별자 충돌 관점에서 우려할 사항이 없다.

## 위험도
NONE
