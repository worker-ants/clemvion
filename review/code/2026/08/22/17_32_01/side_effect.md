# 부작용(Side Effect) 리뷰 결과

## 검토 방법

- 프롬프트에 실린 unified diff 35개 파일 전부 확인. 프롬프트 절단 구간은 `git diff 7b0e65aa8..HEAD`
  (`--stat` 및 대상 파일별) 로 저장소에서 직접 재확인.
- `codebase/` 전역에서 `process.env` / `globalThis` / 파일시스템 API(`fs.write*`, `mkdir`, `rm`) /
  네트워크 호출(`fetch`, `axios`, `http.`) 패턴을 diff 범위 내에서 grep — 신규 도입 0건.
- `grep -rn "'INVALID_INPUT'" codebase` = 0건 — 구 코드 리터럴 잔존(반쪽 마이그레이션) 없음.
- 이전 라운드(`17_06_14`)의 `side_effect.md` 판정(LOW, 동일 breaking change 를 이미 인지·문서화·
  사용자 인수)과 대조 — 이번 라운드는 그 판정의 근거를 강화하는 변경(CHANGELOG 신설, 테스트 값
  단언 보강)만 추가했는지 확인.

## 발견사항

- **[WARNING]** 공개(내부) REST 응답 계약 변경 — `POST /executions/:id/re-run` 실패 시 최상위
  `error.code` 값이 `INVALID_INPUT` → `INVALID_TRIGGER_PARAMETERS` 로 바뀐다 (dual-emit 없음).
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (diff 게이트 510, `code:
    'INVALID_TRIGGER_PARAMETERS'`) / Swagger 서술 `codebase/backend/src/modules/executions/executions.controller.ts`
    (diff 게이트 274).
  - 상세: 이 엔드포인트는 워크스페이스 JWT 만 있으면 공식 UI 밖에서도 호출 가능한 내부 API 다.
    `error.code` 문자열 값 자체가 바뀌므로 이 값으로 분기하는 서드파티 호출자가 있다면 이번
    배포로 조용히 깨진다(HTTP status 는 400 유지, `error.details[].code` 는 불변이라 필드별
    사유로 분기하던 클라이언트는 영향 없음). 카테고리 "5. 인터페이스 변경" 에 해당.
  - 완화 근거(실측, 이전 라운드와 동일): `plan/in-progress/eia-error-code-unify.md` 가 이를
    `spec/conventions/error-codes.md §2`(rename=breaking) 의 명시적 예외로 다루고, §5 Rename
    이력에 "본 표에서 리스크 등급이 가장 높은 행" 으로 등재했다. 프런트 소비 표면도 재확인:
    `rerun-modal.tsx` 의 `ERROR_CODE_TO_KEY` 는 `RERUN_*` 4종만 매핑해 신·구 값 모두 generic
    fallback 이다. 이번 라운드에서 `CHANGELOG.md` 에 `## Unreleased` 섹션(breaking 고지)이
    신설됐고, 회귀를 잡는 유일한 자동 검증인 `executions-rerun.service.spec.ts` 테스트가 이제
    `body.code` 값을 직접 단언(`toMatchObject({ code: 'INVALID_TRIGGER_PARAMETERS' })`)하도록
    보강돼, 이 값이 향후 다시 조용히 바뀌는 것을 기계가 잡는다. 마이그레이션 완전성도 재확인:
    `codebase` 전역에 `'INVALID_INPUT'` 리터럴 잔존 0건.
  - 제안: 코드 변경 자체는 추가 조치 불요 — 위험이 알려진 채로 사용자 결정(2026-08-22)으로
    인수됐고, 이번 라운드가 그 완화 증거(CHANGELOG, 실제 값 단언 테스트)를 보강했다.

- **[INFO]** 리뷰/일관성 검토 산출물 다수(`review/code/2026/08/22/17_06_14/*` 9개,
  `review/consistency/2026/08/22/16_34_50/*` 8개, `RESOLUTION.md` 1개)가 신규 파일로 커밋됨 —
  예상치 못한 파일시스템 부작용이 아니라 프로젝트 규약(`code-review-agents`/`consistency-checker`
  산출 경로)이 지정한 위치에 생성된 기대된 파일.
  - 위치: `review/code/2026/08/22/17_06_14/**`, `review/consistency/2026/08/22/16_34_50/**`.
  - 상세: 이 중 `_retry_state.json`(두 세트 모두)은 sub-agent 호출 전 스냅샷이 그대로 커밋된
    harness 부산물(이전 라운드 INFO #1 과 동일 성격) — application 런타임과 무관.

- **[INFO]** 마이그레이션 완전성 재확인 (긍정 관찰) — `spec/conventions/error-codes.md:145` 의
  Rename 이력 신규 행 "PR" 컬럼이 여전히 `#TBD_PR` placeholder. 이는 side-effect 관점 문제가
  아니라(PR 미채번 시점의 예정된 임시 상태이고 documentation 리뷰가 이미 추적 중) 기록용으로만
  남긴다.

## 카테고리별 점검 결과 (해당 없음 확인)

- **의도치 않은 상태 변경 / 전역 변수**: 실질 코드 diff(`executions.service.ts`)는 문자열 리터럴
  1곳 + 설명 주석 4줄뿐. 함수 로직·분기·전역 상태 변경 없음.
- **파일시스템 부작용**: 위 INFO 항목 외 예상 밖 생성·수정·삭제 없음.
- **시그니처 변경**: `ExecutionsService`/컨트롤러 메서드 시그니처 불변. `BadRequestException` 에
  넘기는 객체의 `code` **값**만 바뀌고 shape(`code`/`message`/`details`)는 그대로.
- **환경 변수**: diff 범위 내 `process.env` 읽기/쓰기 0건(grep 재확인).
- **네트워크 호출**: 신규/변경된 외부 호출 없음(grep 재확인, `fetch`/`axios`/`http.` 0건).
- **이벤트/콜백**: 이벤트 발행·콜백 배선 변경 없음.

## 요약

이번 라운드의 실질 코드 diff 는 이전 라운드(`17_06_14`)에서 이미 LOW 로 판정한 것과 동일한
breaking 변경(`POST /executions/:id/re-run` 의 최상위 `error.code` rename)이며, 이번엔 그 위험을
줄이는 방향의 보강만 추가됐다 — `CHANGELOG.md` breaking 고지 신설, 테스트가 실제 `code` 값을
단언하도록 보강, `error-codes.md §5` 근거 강화. 신규 코드가 도입한 전역 상태·환경 변수·파일시스템·
네트워크·이벤트 부작용은 grep 으로 재확인해도 0건이다. 함께 커밋된 대량의 review/consistency
산출물은 프로젝트 규약이 지정한 경로의 기대된 문서 파일이다. 유일한 실질 부작용(WARNING)은 이미
인지·문서화·사용자 인수된 breaking API 변경이며, 잔여 조치는 side-effect 리뷰 범위 밖(PR 번호
placeholder 치환)이다.

## 위험도

LOW
