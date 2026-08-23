# 요구사항(Requirement) 리뷰 — `rerun-dto-shorthand`

## 검토 범위

- `codebase/backend/src/modules/executions/dto/re-run.dto.ts` — `inputOverride` 의 swagger
  메타데이터를 축약형 `type: Object` 에서 `type: 'object', additionalProperties: true` 로 교체.
- `codebase/backend/src/modules/executions/dto/re-run.dto.spec.ts` — 신규 캐너리(`createDocument`
  산출 문서를 직접 검증).
- `plan/in-progress/rerun-dto-shorthand.md` — 신규 작업 트래커.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 정본 트래커 체크박스 2건
  (`re-run.dto.ts` 축약형 항목, Docker Hub won't-do 항목) `[ ]` → `[x]`.

## 실측 검증

- `re-run.dto.ts` 실제 파일 내용(`git show HEAD:...`, `cat -n`)이 diff 와 정확히 일치 —
  `type: 'object'` + `additionalProperties: true` 둘 다 존재.
- `npx jest re-run.dto.spec.ts` 실행 — **2 passed**. 캐너리가 실제로 통과한다(vacuous 아님).
- `spec/conventions/swagger.md:110` — "열린/동적 map (키 집합이 런타임 결정) —
  `@ApiProperty({ type: 'object', additionalProperties: true })`" 를 이미 규정하고 있고,
  같은 문서 `:505-508` 이 바로 이 `ReRunRequestDto.inputOverride` 사례를 요청 DTO 설명 예외의
  계기로 인용한다 — 코드가 기존 spec 컨벤션을 그대로 따른 것이라 SPEC-DRIFT 도, spec 불일치도
  아니다.
- `spec/5-system/13-replay-rerun.md §8.1` Request body 정의(`useOriginalInput` 기본 `true`,
  `inputOverride` "Manual Trigger 스키마 호환", `dryRun` 기본 `false`) 와 DTO 필드·기본값·설명이
  line-level 로 일치. `MASKED_VALUE_RESUBMITTED` 참조도 §8.1 에러 표·EIA §R17 과 일치.
  `resolveTriggerParametersRejectingMasked` 관련 서버측 마커 거부는 이미 별도 PR(2026-08-21)로
  종결된 항목이라 이 diff 범위 밖.
  `execute-workflow.dto.ts:36,64` 도 같은 `type: 'object'` 패턴 — "형제도 그렇다" 주석 진술과
  일치.
- 저장소 전체 `type: Object` 축약형 실사용(코드, 주석 제외) — grep 0건. 트래커의 "실측 후
  저장소 전체 축약형 0건" 문구와 일치.
- 프런트엔드(`codebase/frontend/src/lib/api/executions.ts`)는 이미 `inputOverride?:
  Record<string, unknown>` 로 손으로 타입돼 있어(생성 클라이언트 미사용) 이번 스키마 정정으로
  인한 프런트 회귀 위험 없음 — 이 fix 의 수혜자는 저장소 밖 OpenAPI 소비자(문서 JSDoc 이 명시한
  대로).
- `class-validator`(`@IsObject`)/`class-transformer` 검증은 TS `design:type` 리플렉션을 쓰고
  swagger `@ApiProperty({ type })` 메타데이터와 독립이라, 이번 변경은 런타임 검증 동작에 영향이
  없다 — 순수 문서화 계층 fix.

## 발견사항

- **[INFO]** `plan/in-progress/rerun-dto-shorthand.md` 의 "미체크 30 → 27" 수치가 실측과 1건
  어긋난다.
  - 위치: `plan/in-progress/rerun-dto-shorthand.md:54` (diff 게이트 기준)
  - 상세: `git show 04fe5962f:plan/in-progress/spec-sync-external-interaction-api-gaps.md | grep
    -c '^\s*- \[ \]'` 로 이 커밋 직전 상태의 열린 체크박스를 세면 **29**건이고, 이 커밋
    (`33b4c8dbb`) 이후는 **27**건이다(diff 가 정확히 2건만 `[x]` 로 뒤집었으므로 29→27 이
    맞다). 플랜 문서·커밋 메시지 모두 시작값을 "30" 으로 적어 실제(29)와 1 차이가 난다.
  - 제안: 기능 코드에는 영향 없는 문서 오기(off-by-one)다. 다음에 이 파일을 손댈 때 "29 → 27"
    로 정정하면 된다 — 별도 diff 를 만들 값은 없다.

## 요약

`ReRunRequestDto.inputOverride` 의 swagger 메타데이터를 축약형(`type: Object`)에서 명시형
(`type: 'object', additionalProperties: true`)으로 바꾼 순수 문서화 계층 fix다. 근거(생성 문서
비교 실측)가 새 캐너리 테스트로 고정돼 있고 실행 결과(2 passed)로 확인했으며, 관련 spec
컨벤션(`swagger.md §1`)·엔드포인트 spec(`13-replay-rerun.md §8.1`)·형제 DTO
패턴(`execute-workflow.dto.ts`)과 line-level 로 정합한다. 런타임 검증·프런트 타입에는 영향이
없어 회귀 위험이 없고, 트래커 체크박스 갱신도 실제 diff 범위(2건)와 일치한다. 유일한 흠은 신규
plan 문서의 체크박스 총계 서술이 1건 어긋난 INFO 수준의 오기다.

## 위험도

LOW
