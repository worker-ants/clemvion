# 문서화(Documentation) Review — masking-gate-consolidation (재검토 라운드 `14_46_46`)

## 검토 범위 메모

이번 라운드는 이전 `/ai-review`(`14_23_44`, WARNING 2건) 이후 발생한 후속 커밋을 포함한
전체 diff(27개 파일)를 대상으로 한다. 실질적 코드/문서 변경은 다음으로 좁혀진다:

- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts`
- `codebase/backend/src/modules/executions/executions.service.ts`
- `codebase/backend/src/shared/utils/redact-stored-error.ts` (신규 함수 3개)
- `codebase/backend/src/shared/utils/redact-stored-error.spec.ts` (WARNING #1 수정 — 신규 테스트 2 스위트)
- `plan/complete/masking-gate-consolidation.md` (신규, 완료된 plan)
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (트래커 갱신 — 항목 종결 + WARNING #2 대응 신규 planner 항목)
- `spec/conventions/egress-masking.md` §3 (stale 예고 취소선 정정)

나머지 20개 파일(`review/code/2026/08/23/14_23_44/**`, `review/consistency/2026/08/23/13_55_36/**`)은
직전 리뷰/컨시스턴시 라운드의 산출물이 이번 커밋에 그대로 편입된 것이다 — 코드/문서 "변경"이
아니라 검토 기록이므로 문서화 관점 점검 대상에서 제외했다(`review/` 는 gitignored 대상이 아니라
정상적으로 커밋되는 산출물이라는 점도 확인).

소스 파일은 프롬프트 예산 절단 없이 직접 `Read` 로 전문을 대조했다
(`redact-stored-error.ts`, `redact-stored-error.spec.ts`, `executions.service.ts` 관련 JSDoc,
`background-runs.service.ts` 관련 주석, `plan/complete/masking-gate-consolidation.md` 전문).

## 직전 라운드(`14_23_44`) WARNING 반영 여부 — 실측 확인

- **WARNING #1(신설 헬퍼 co-located 테스트 부재)**: `redact-stored-error.spec.ts`에
  `describe('redactStoredFieldsForResponse', ...)`(게이트 183~233)·
  `describe('redactNodeExecutionRow', ...)`(게이트 243~301) 두 스위트가 실제로 추가됐다.
  각 스위트 상단에 "왜 이 스위트가 필요한가"(fragmentation 재발 방지)와 "왜 두 스위트의
  부재/참조 처리가 반대인가"를 설명하는 docstring이 있고, 3필드 각각의 마스킹·동시 적용·
  부재 정규화·copy-on-change 참조 보존을 개별 케이스로 고정했다 — plan이 기록한 M1/M2
  뮤테이션 실측과 1:1 대응. **문서화 관점에서 결함 없음.**
- **WARNING #2(developer의 `spec/` 직접 수정)**: 이 PR에서 되돌리지 않고, 대신
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md`에 판단을 이관하는 신규
  planner 항목(게이트 321~331)을 추가했다. 항목 문구가 쟁점(권한 경계 판단 필요)과 근거
  (이미 실측으로 반증된 예고임)를 명확히 서술하고 있어, 이관 자체는 문서로 잘 남았다.
  **문서화 관점에서 결함 없음** — 절차적 판단(권한 경계)은 scope 리뷰의 소관이지 문서화
  결함은 아니다.

## 발견사항

- **[INFO]** `redact-stored-error.ts` 신설 함수(`redactStoredFieldsForResponse`,
  `redactNodeExecutionRow`)가 같은 파일의 기존 두 함수와 달리 `@param`/`@returns` 형식
  태그 없이 산문 docstring만 사용 — 직전 라운드(`14_23_44`)의 동일 지적이 이번 커밋에서도
  **아직 수정되지 않았다**(소스 직접 대조로 확인).
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts`
    `redactStoredFieldsForResponse` (게이트 73~111) · `redactNodeExecutionRow`
    (게이트 134~159). 비교 대상 `redactStoredErrorForResponse`(게이트 6~35)·
    `redactStoredDataForResponse`(게이트 37~71)는 `@param`/`@returns` 태그를 갖는다.
  - 상세: plan 문서(`plan/complete/masking-gate-consolidation.md` 게이트 141~143)가 이
    항목을 "우선순위 낮음 · 이번 diff 를 넓히지 않기 위해 보류"로 명시적으로 처분해 둔
    상태이며, 이 라운드에서 다시 다뤄지지 않았다는 사실이 그 처분과 정합적이다. 기능적
    이해에는 지장 없음(산문이 파라미터·반환 의미를 이미 충분히 설명).
  - 제안: 이전과 동일 — 이 PR을 막을 사안 아님. 다음에 이 파일을 손댈 때 4개 export 함수의
    JSDoc 형식을 통일할 것.

## 정합성 확인 (문제 없음 — 참고로 기록)

- **주석-코드 일치**: `background-runs.service.ts` 게이트 296~301의 "읽기 표면 전체 목록은
  `ExecutionsService.toResponseExecution` 의 표가 정본" 주석을 실제 `executions.service.ts`
  게이트 1030~1041의 표와 대조 — 표 5행이 `redactNodeExecutionRow`로 최신 심볼을 반영하고
  있어 여전히 정확하다.
- **plan-트래커 동기화**: `plan/complete/masking-gate-consolidation.md`(신규, `status: complete`)와
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md`의 해당 항목(게이트 333~354, `[x]`)이
  서로 반증 근거(M1 5 RED·M2 2 RED, 표 무변경 실측)를 동일한 내용으로 미러한다 — 드리프트 없음.
  `plan/complete/` 파일의 `../in-progress/spec-sync-external-interaction-api-gaps.md` 상대링크도
  실제 경로와 일치해 유효하다.
- **spec 정정 형식**: `spec/conventions/egress-masking.md` §3의 정정이 취소선 + 날짜 있는
  블록쿼트(원인·실측 근거·교훈)로 구성돼 규약 문서의 소급 정정 관례를 따른다. 표 자체는
  건드리지 않고 잘못된 "예고" 문장만 정정해 diff 범위가 타이트하다.
- **README/CHANGELOG**: 순수 리팩터(동작 무변경, 응답 shape 동일, 신규 env/설정 없음)이므로
  README·CHANGELOG 갱신 불요 — plan 문서의 "동작 무변경" mutation 검증(M1/M2/M3 전부 RED,
  `tsc` 선검증 통과)이 이 판단의 근거로 문서화돼 있다.
- **날짜 정합성**: `plan/complete/masking-gate-consolidation.md` frontmatter의
  `started: 2026-08-23` / `completed: 2026-08-23`가 오늘 날짜와 일치.

## 요약

이번 라운드의 diff는 직전 `/ai-review`(`14_23_44`)가 지적한 WARNING 2건(신설 헬퍼 co-located
테스트 부재 · developer의 spec 직접 수정) 중 문서화가 관여하는 부분을 모두 잘 처리했다 —
새 테스트 스위트에는 "왜 필요한가"를 설명하는 docstring이 붙었고, spec 수정 건은 되돌리는
대신 판단을 트래커의 신규 planner 항목으로 명시적으로 이관했다. plan 문서와 트래커 항목이
서로 동일한 실측 근거(뮤테이션 결과·표 무변경 검증)를 미러해 드리프트가 없고, 관련 주석·
JSDoc 표는 모두 최신 심볼명을 반영한다. 유일한 잔존 발견은 직전 라운드에서 이미 INFO로
분류되고 의도적으로 보류된 JSDoc `@param`/`@returns` 태그 스타일 불일치뿐이며, 이번 라운드에서
새로 발견된 CRITICAL/WARNING 급 문서화 결함은 없다.

## 위험도

LOW
