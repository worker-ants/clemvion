# 변경 범위(Scope) 검토 — exec-limits-refactor (ARCH#4·ARCH#6·MAINT#9)

## 검증 메모

- payload 는 `_prompts/scope.md` 16개 파일 전부. `git diff --stat origin/main...HEAD` 와 대조한 결과
  파일 목록·개수(16)가 정확히 일치 — mis-scope 아님, fallback 불필요.
- `resolveExecutionRunWorkerConcurrency` 함수 본문을 이관 전(`execution-run.queue.ts`@origin/main)과
  이관 후(`execution-limits.ts`)로 diff 대조 — byte-for-byte 동일 (로직/정규식/분기 전부 무변경).
- `execution-limits.spec.ts` 로 이동한 테스트 블록도 원본(`execution-run.queue.spec.ts`@origin/main)과
  대조 — 들여쓰기(외부 `describe` 제거로 인한 자연스러운 2-space dedent) 외 내용 무변경.
- `continuation-execution.queue.ts` 자체는 diff 0 — `resolveContinuationWorkerConcurrency` 는 기존
  export 를 그대로 재사용(신규 로직 추가 아님), MAINT#9 는 소비 측(`system-status.constants.ts`)만 변경.

## 대상 계획

`plan/in-progress/exec-limits-refactor.md` — ARCH#4(resolver 이관) + ARCH#6(모듈 JSDoc 확장) +
MAINT#9(continuation concurrency canonical resolver 재사용). 전부 "동작 보존" 명시. ARCH#5(error-codes
레이어 분리)는 계획 문서 자체에 **의도적 분리 defer** 로 명기되어 있고, 실제로 코드 변경 어디에도
`error-codes.ts` 또는 관련 파일 손질이 없음 — 스코프 이탈이 아니라 정확히 계획대로 배제됨.

## 발견사항

- **[INFO]** `system-status.constants.ts` JSDoc 확장이 코드 변경 대비 다소 장문
  - 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts` L38-46 (변경분)
  - 상세: MAINT#9 는 1줄 로직 교체(`Number(...) || 1` → `resolveContinuationWorkerConcurrency()`)지만,
    그 위 JSDoc 주석이 drift 배경·계약 근거까지 상세 서술하도록 확장됐다. 실질 코드 변경 대비 주석
    비중이 크나, 이는 "왜 canonical resolver 로 바꿨는지"(spec §11 계약과의 기존 loose-parsing drift)
    를 남기는 근거 문서화이며 계획(ARCH#6 JSDoc 확장 취지, MAINT#9 rationale)이 명시적으로 요청한
    성격의 주석이다. 무관한 정보 추가가 아니라 이번 3건 변경 자체의 배경 설명이므로 scope 이탈로
    보지 않음.
  - 제안: 조치 불필요(의도된 범위 내 문서화).

- **[INFO]** `execution-limits.ts` 모듈 JSDoc 이 파일 전체 책임 서술로 확장(ARCH#6)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-limits.ts` L1-21 (변경분)
  - 상세: 기존 "PR2a — §8 한정" 서술을 "§8+§11 전 resolve* 응집 모듈" 로 재서술. 계획에 ARCH#6 항목으로
    명시된 작업과 정확히 일치. 파일 내 실제 로직(4개 resolve* 함수)과도 부합 — 과장된 재서술 아님.
  - 제안: 조치 불필요.

- **[INFO]** 계획·리뷰 산출물(plan/*.md, review/consistency/**) 다수가 코드 변경과 함께 커밋됨
  - 위치: `plan/in-progress/exec-intake-followups.md`, `plan/in-progress/exec-limits-refactor.md`,
    `review/consistency/2026/07/04/23_21_53/**` (SUMMARY/checker 6개 + `_retry_state.json`/`meta.json`)
  - 상세: 코드 변경(파일 1-6) 외 10개 파일이 plan 추적·impl-prep consistency-check 산출물이다. 이는
    CLAUDE.md 정보 저장 위치 규약("진행 중 작업" → `plan/in-progress/`, "일관성 검토 산출물" →
    `review/consistency/**`) 및 "plan 체크박스 = 실제 상태(리뷰 산출물도 커밋 대상)" 관례와 일치하는
    표준 워크플로 부산물이며, 코드 변경과 무관한 임의 수정이 아니다. scope 이탈 아님.
  - 제안: 조치 불필요.

- **[INFO]** `execution-run.queue.ts` 에 이관 안내 주석만 남고 재-export 없음
  - 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts` L100-101
  - 상세: 이관 후 원 위치에 함수를 그대로 남기거나 재-export 배럴을 만들지 않고, 1줄 안내 주석
    (`// resolveExecutionRunWorkerConcurrency ... 는 ... execution-limits.ts 로 이관됐다`)만 남겼다.
    이는 이중 SoT 를 만들지 않는 "단순 이관" 원칙에 부합 — consistency-check(convention_compliance)도
    동일 결론으로 "재-export 배럴 남기지 말 것" 을 권고했고 실제 구현이 그 방향과 일치한다.
  - 제안: 조치 불필요.

## 요약

파일 1(`execution-limits.spec.ts`)·2(`execution-limits.ts`)·3(`execution-run.processor.ts`)·
5(`execution-run.queue.ts`) 는 ARCH#4(순수 함수+테스트 이관, import 경로 갱신)와 ARCH#6(JSDoc 확장)
범위에 정확히 대응하고, 파일 6(`system-status.constants.ts`)는 MAINT#9(canonical strict resolver 재사용)
범위에 정확히 대응한다. 이관된 함수 본문·테스트 내용을 origin/main 대비 직접 diff 대조한 결과 로직·값
변경 없이 위치만 이동했음을 확인했다(behavior-preserving 주장이 사실과 일치). ARCH#5 는 계획서에
명시된 대로 완전히 배제되어 있고 관련 파일(error-codes.ts 등) 어디에도 손대지 않았다. 파일 7-16
(plan 문서·consistency 산출물)은 프로젝트 표준 워크플로 산출물로 코드 변경과 직접 연동되며 무관한
수정이 아니다. 포맷팅-only 변경, 미사용 임포트, 설정 파일 변경, 요청 외 기능 추가는 발견되지 않았다.
전체적으로 계획서에 정의된 3-item 번들 범위를 정확히 지켰다.

## 위험도

NONE

STATUS: SUCCESS
