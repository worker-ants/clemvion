# 부작용(Side Effect) 리뷰 결과

## 검토 방법

- 프롬프트에 실린 unified diff + 전체 파일 컨텍스트를 기준 판단.
- 예산 절단으로 전체 컨텍스트가 실리지 않은 파일(`executions.service.ts`, `executions-rerun.service.spec.ts`,
  `triggers.mdx`/`.en.mdx`, `spec-sync-external-interaction-api-gaps.md`, spec 5개)은 `git diff origin/main --
  <path>` 및 `Read`/`Grep` 으로 저장소에서 직접 재확인.
- `INVALID_INPUT` / `INVALID_TRIGGER_PARAMETERS` 리터럴을 `codebase/`, `spec/` 전체에서 grep 해 마이그레이션의
  완전성(잔존 분기 유무)을 실측.

## 발견사항

- **[WARNING]** 공개(내부) REST 응답 계약 변경 — `POST /executions/:id/re-run` 실패 시 최상위 `error.code` 값이
  `INVALID_INPUT` → `INVALID_TRIGGER_PARAMETERS` 로 바뀐다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:510` (diff 게이트, `code:
    'INVALID_TRIGGER_PARAMETERS'`), Swagger 서술 `codebase/backend/src/modules/executions/executions.controller.ts:274`.
  - 상세: 이 엔드포인트는 워크스페이스 JWT 만 있으면 공식 UI 밖에서도 호출 가능한 내부 API 다. 응답 바디의
    `error.code` **문자열 값 자체**가 바뀌므로, 이 리터럴로 분기하는 외부/서드파티 호출자가 있다면 이번 배포로
    조용히 깨진다(HTTP status 는 400 으로 유지되므로 상태 코드 기반 처리에는 영향 없음). 이것은 카테고리
    "5. 인터페이스 변경 — 공개 API 변경이 기존 사용자에 미치는 영향" 에 정확히 해당하는 부작용이다.
  - 완화 근거(실측): 이 위험은 미검출이 아니라 **이미 인지·문서화·사용자 결정으로 인수**된 상태다.
    `plan/in-progress/eia-error-code-unify.md` 가 이 변경을 규약(`spec/conventions/error-codes.md §2` rename =
    breaking) 의 명시적 예외로 다루며, `spec/conventions/error-codes.md §5` Rename 이력에 신규 행을 추가하고
    "본 표에서 리스크 등급이 가장 높은 행" 이라고 명기했다. 프런트 소비 표면도 실측됨:
    `codebase/frontend/src/components/executions/rerun-modal.tsx` 의 `ERROR_CODE_TO_KEY` 는 `RERUN_*` 4종만
    매핑하므로 신·구 값 모두 generic fallback 으로 떨어져 **자사 클라이언트의 분기 로직에는 영향이 없음**을
    확인했다(직접 grep 재현: `ERROR_CODE_TO_KEY` 에 `INVALID_INPUT`/`INVALID_TRIGGER_PARAMETERS` 키 모두 없음).
  - 제안: 코드 변경 자체는 문제 없으나, 배포 노트/API 변경 로그에도 이 breaking change 를 명시할 것을 권장
    (spec 문서에는 이미 기록됨). 이 리뷰 관점에서는 추가 조치 불요 — 위험이 알려진 채로 수용된 상태임을 확인.

- **[INFO]** 마이그레이션 완전성 확인 (긍정 관찰) — `INVALID_INPUT` 리터럴 분기가 코드베이스에 하나도 남아있지
  않음을 grep 으로 확인했다. `grep -rn "INVALID_INPUT" codebase spec` 결과 5건 전부 주석/문서의 이력 서술이며,
  실제 `'INVALID_INPUT'` 문자열 리터럴로 값 비교/switch 하는 코드는 0건이다(`grep -rn "'INVALID_INPUT'"
  codebase` = 0건). 즉 "반쪽만 rename 되어 신·구 코드가 혼재하는" 형태의 부작용은 없다.
  - 위치: 저장소 전역 (grep 결과, 특정 파일 아님).

## 카테고리별 점검 결과 (해당 없음 확인)

- **의도치 않은 상태 변경 / 전역 변수**: 해당 diff 는 문자열 리터럴 1개 치환 + 주석 추가뿐. 함수 로직·분기·상태
  변경 없음. 전역 변수 신설/수정 없음.
- **파일시스템 부작용**: `plan/in-progress/eia-error-code-unify.md`(신규), `review/consistency/2026/08/22/
  16_34_50/*`(신규) 는 프로젝트 워크플로 규약(`consistency-checker`, planner 세션)이 지정한 산출 경로에 생성된
  기대된 파일이다 — 예상치 못한 파일 생성 아님.
- **시그니처 변경**: `ExecutionsService` 의 메서드 시그니처(매개변수/반환 타입) 변경 없음. `BadRequestException`
  생성자에 넘기는 객체 리터럴의 `code` **값**만 바뀌었고 shape(`code`/`message`/`details`)는 그대로.
- **환경 변수**: 읽기/쓰기 없음.
- **네트워크 호출**: 신규/변경된 외부 호출 없음.
- **이벤트/콜백**: 이벤트 발행·콜백 배선 변경 없음(diff 범위 내 `emit`/`on`/구독 관련 코드 없음).

## 요약

이번 변경의 실질 코드 diff 는 `executions.service.ts` 한 곳에서 에러 응답의 `code` 문자열 리터럴을
`INVALID_INPUT` → `INVALID_TRIGGER_PARAMETERS` 로 바꾼 것이 전부이며, 나머지 파일(controller Swagger 설명,
테스트 단언/제목, 프런트 유저가이드 mdx, 다수의 spec/plan/review 문서)은 이 rename 을 동반 반영하는 문서·테스트
동기화다. 유일하게 의미 있는 부작용은 카테고리 5(인터페이스 변경)에 해당하는 `POST /executions/:id/re-run`
응답 바디의 breaking change 인데, 이는 미검출 리스크가 아니라 규약 예외로 처리되어 plan 문서에 근거·잔여
위험·완화 실측(프런트 미분기 확인)까지 상세히 기록되고 사용자가 명시적으로 결정한 사항이다. grep 실측 결과
구·신 코드가 혼재하는 부분 마이그레이션 결함도 없다. 전역 상태·파일시스템·시그니처·환경변수·네트워크·이벤트
콜백 관점에서는 이상 없음.

## 위험도

LOW
