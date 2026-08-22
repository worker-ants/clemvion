# 요구사항(Requirement) Review — `eia-error-code-unify` (재판정, `17_32_01`)

대상: `POST /executions/:id/re-run` 최상위 `error.code` 를 `INVALID_INPUT` → `INVALID_TRIGGER_PARAMETERS`
로 통일하는 rename PR. 이번 라운드는 직전 리뷰(`17_06_14`, WARNING 6 · Critical 0)에 대한 대응분
(`CHANGELOG.md` 신설, 테스트 코드값 단언 추가, `RESOLUTION.md`/`SUMMARY.md` 등 산출물 커밋)이 diff 에
포함된 재검토다.

## 검토 방법

프롬프트 unified diff 35개 파일을 전부 확인하고, 프롬프트 절단분(파일 7 plan 등)과 핵심 파일은
`Read`/`Bash`(grep, sed)로 저장소 원본을 직접 열어 대조했다. 특히:

- `executions.service.ts` 발행부 전체 컨텍스트(495~520행)를 직접 읽어 diff 와 대조.
- `workflows.controller.ts:324` / `workflows.service.ts:931` 을 직접 grep 해 세 엔드포인트가
  동일 코드값을 내는지 실측 재확인.
- `npx jest executions-rerun.service.spec.ts` 직접 실행 — **20/20 GREEN**.
- `grep -rn "INVALID_INPUT" codebase spec` — 4건, 전부 주석/spec 의 이력 서술(과거형 표현)이고
  발행 지점(`'INVALID_INPUT'` 리터럴)은 0건.
- `rerun-modal.tsx` 의 `ERROR_CODE_TO_KEY` 에 `INVALID_INPUT`/`INVALID_TRIGGER_PARAMETERS` 키가
  없음을 직접 확인(생략 시 generic fallback).
- `error-codes.md` §4 분리 후 H2 헤더 텍스트(`## 4. 내부 전용 분류 코드 (정규화 후 발행)`) 불변 확인
  — 기존 인입 앵커(`webhook.md:313`, `error-handling.md:194`) 유지.
- `codebase/backend/test/` 아래 `INVALID_INPUT` 히트 0건(re-run e2e 는 이 경로 자체를 다루지 않음,
  선존 갭).

## 발견사항

- **[INFO]** `error-codes.md §5` Rename 이력 표 신규 행의 "PR" 컬럼이 여전히 `#TBD_PR` placeholder.
  - 위치: `spec/conventions/error-codes.md:145`
  - 상세: 직전 라운드(`17_06_14`)에서 이미 WARNING 으로 지적됐고, 이번 diff 에 포함된
    `review/code/2026/08/22/17_06_14/RESOLUTION.md`(W4)가 "PR 번호는 생성 전에는 존재하지 않으므로
    placeholder 로 커밋한 뒤 `gh pr create` 직후 같은 브랜치에 치환 커밋을 올린다"고 명시적으로
    지연 사유를 적어 뒀다. 이 재판정 시점에도 PR 이 아직 생성 전이므로 미해결 상태가 그대로인 것은
    **계획대로**이고 새로운 결함이 아니다.
  - 제안: `gh pr create` 직후 치환 커밋 — RESOLUTION 에 이미 적힌 절차 그대로 진행.

- **[INFO]** re-run 트리거 검증 실패 경로의 e2e 커버리지 부재 (선존 갭, 이번 diff 미생성).
  - 위치: `codebase/backend/test/re-run.e2e-spec.ts`
  - 상세: unit(`executions-rerun.service.spec.ts`)만 코드값을 검증하고 e2e 로는
    `GlobalExceptionFilter` 경유 직렬화까지 확인하는 케이스가 없다. 직전 라운드 testing.md 가 이미
    같은 항목을 INFO 로 남겼고 필수 아님으로 판정됨. 이번 diff 가 만든 갭이 아니다.
  - 제안: 조치 불요(선택 사항, 이미 이전 라운드에서 처분 완료).

## 검증 완료 항목 (문제 없음)

- **핵심 코드 변경 실측**: `executions.service.ts:509` `code: 'INVALID_TRIGGER_PARAMETERS'` 가
  diff·저장소 원본과 정확히 일치. 자매 발행처(`workflows.controller.ts:324`,
  `workflows.service.ts:931`) 모두 동일 리터럴 — 세 엔드포인트 코드값 통일 완료.
- **에러 시나리오**: catch 블록은 `TriggerParameterValidationException` 만 특수 처리하고 그 외
  예외는 `throw err`로 재던짐(반환값 누락 없음). `details`(구 `errors`) 배선은 이 diff 범위 밖이며
  변경 없음 — 회귀 없음.
- **W5 재검증 (테스트 vacuous 여부)**: `executions-rerun.service.spec.ts` 의 `throws
  INVALID_TRIGGER_PARAMETERS when …` 테스트가 이제 `err.getResponse()` 를
  `toMatchObject({ code: 'INVALID_TRIGGER_PARAMETERS' })` 로 직접 단언한다(직전 라운드 지적을
  실제로 반영). `npx jest executions-rerun.service.spec.ts` 직접 실행 결과 **20/20 pass** — 회귀
  없이 통과.
- **Swagger**: `executions.controller.ts:274` `@ApiBadRequestResponse` description 이 값 변경과
  함께 갱신, 다른 `INVALID_INPUT` 잔존 없음(grep 확인).
- **유저 가이드 KO/EN**: `triggers.mdx:33` / `triggers.en.mdx:22` 모두
  `INVALID_TRIGGER_PARAMETERS` 로 갱신 — 선존 오류(주 실행 경로 코드와 불일치하던 서술) 정정 확인.
- **CHANGELOG**: `CHANGELOG.md:3-27` 신규 `## Unreleased` 절이 breaking 값 변경·영향 엔드포인트·
  `details[]` 불변 사실·규약 예외 근거·§5 리스크 등급 차이·유저 가이드 정정을 모두 정확히
  서술 — 실제 코드/spec 상태와 대조해 불일치 없음.
- **spec fidelity — line-level 대조, 전부 코드와 일치**:
  - `1-manual-trigger.md:181-201` 경로별 코드 표 교체 + wrapper 함수명·CI 가드 콜아웃 신설,
    frontmatter `code:` 에 `reject-masked-resubmission.ts` 추가(파일 실존 확인).
  - `13-replay-rerun.md:246-253,384` §8.1 표 값 교체 + `RERUN_` prefix 미사용 각주.
  - `3-error-handling.md:80,91-95,194-195` 카탈로그 행 교체(세 엔드포인트 공용 명시) + 반대 방향
    Rationale 을 삭제 대신 "무엇이 기각되고 뒤집혔는지" 콜아웃으로 개정.
  - `12-webhook.md:313` "Manual re-run `INVALID_INPUT`" → 세 경로 공용 서술로 교정.
  - `14-external-interaction-api.md:1576-1584` §R17 wrapper 구현 위치 콜아웃 신설.
  - `error-codes.md:80-135` §4→§4.1(Code 노드)/§4.2(trigger-parameter, 신설) 분리 — 목적지 필드
    (`output.error.code` vs `details[].code`)가 다른 두 파이프라인을 구분해 기존 scope 선언과의
    모순을 해소. H2 앵커 텍스트 불변으로 기존 인입 참조(`webhook.md:313`,
    `error-handling.md:194`) 정상 유지 확인.
  - `error-codes.md:145` §5 Rename 이력 신규 행 — 선례 3행과 리스크 등급이 다름을 명시(값 자체는
    INFO 로 위에서 별도 처리).
- **잔존 `INVALID_INPUT` 실측**: `codebase`, `spec` 전역 4건 전부 이력 서술("2026-08-22 이전엔 …
  이었다" 류), 발행 리터럴(`'INVALID_INPUT'`) 0건. `codebase/backend/test/` 에도 0건.
- **프런트 미분기 실측**: `rerun-modal.tsx` `ERROR_CODE_TO_KEY` 는 `RERUN_*` 4종만 키로 가짐 —
  신·구 코드 모두 generic fallback, breaking 영향이 plan 서술대로 사내 프런트에는 없음.
- **TODO/FIXME/HACK/XXX**: 변경된 코드 3파일에서 0건.
- **비즈니스 로직**: "세 엔드포인트가 동일 검증 실패에 동일 최상위 코드를 낸다"는 이번 통일의
  핵심 규칙이 코드(3개 발행처) + 테스트(3개 spec 파일, 전부 코드값 직접 단언 확인) + spec(6개 문서)
  전 계층에서 line-level 로 일관되게 반영됨.
- **반환값**: `BadRequestException` 생성자에 넘기는 객체의 shape(`code`/`message`/`details`) 는
  그대로이고 `code` 값만 바뀜 — 모든 경로에서 적절한 형태의 예외가 던져짐, 누락 경로 없음.

## SPEC-DRIFT 여부

없음 — 사용자가 명시적으로 결정한 rename 을 코드·spec·테스트·유저 가이드 전 계층에 정규 절차
(사용자 결정 → planner 턴 → `/consistency-check --plan` → 코드 반영 → `/ai-review`)로 동시
반영한 사례다. `error-codes.md §2`(rename=breaking) 의 명시적 예외로 §5 에 등재됐고 근거·잔여
위험이 spec 에 그대로 남아 있다.

## 요약

핵심 코드 diff(`executions.service.ts` 의 최상위 `error.code` rename)는 자매 두 엔드포인트와
line-level 로 정확히 일치하며, 이번 라운드가 추가한 두 항목 — `CHANGELOG.md` breaking 공지 신설과
`executions-rerun.service.spec.ts` 의 코드값 직접 단언 — 은 직전 라운드(`17_06_14`)의 WARNING
W3·W5 를 실제로 해소한다(테스트 20/20 GREEN 직접 실행 확인, vacuous 아님). spec 6개 문서·Swagger·
유저 가이드 KO/EN 은 전부 line-level 로 코드와 일치하고, 잔존 `INVALID_INPUT` 참조는 4건 모두
의도된 이력 기록일 뿐 발행 지점은 0건이다. 유일한 잔여 항목은 `error-codes.md §5` 의
`#TBD_PR` placeholder인데, 이는 PR 생성 전이라는 구조적 이유로 이번 라운드에도 남아 있는 것이
계획대로이며(RESOLUTION W4 에 명시된 "PR 생성 직후 치환" 절차 대기 중) 기능적 결함이 아니다.
Critical 발견 없음.

## 위험도

NONE
