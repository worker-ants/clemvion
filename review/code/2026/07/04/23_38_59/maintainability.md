# 유지보수성(Maintainability) Review — exec-limits 리팩터 (ARCH#4·ARCH#6·MAINT#9)

## 검토 대상

- `codebase/backend/src/modules/execution-engine/execution-limits.ts` (+ `.spec.ts`)
- `codebase/backend/src/modules/execution-engine/queues/execution-run.processor.ts`
- `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts` (+ `.spec.ts`)
- `codebase/backend/src/modules/system-status/system-status.constants.ts`
- `plan/in-progress/exec-intake-followups.md`, `plan/in-progress/exec-limits-refactor.md` (계획 문서)

동작 보존(behavior-preserving) 응집 리팩터: `resolveExecutionRunWorkerConcurrency` 를
`execution-run.queue.ts` → `execution-limits.ts` 로 이관하고, `system-status.constants.ts`
의 continuation concurrency 파싱을 canonical strict resolver 재사용으로 통일. 값·로직
무변경을 git diff 로 확인함 (이관된 함수 본문 byte-for-byte 동일).

## 발견사항

- **[INFO]** `execution-limits.ts` 가 세 가지 서로 다른 성격의 파서(순수 env 파서 2개 +
  runtime object 파서 1개)를 한 파일에 응집시키는 방향은 타당하나, 자매 모듈
  `continuation-execution.queue.ts` 의 `resolveContinuationWorkerConcurrency` 는
  이번 이관 대상에서 빠져 여전히 큐 파일에 남아 있음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-limits.ts` (이관된
    `resolveExecutionRunWorkerConcurrency`) vs
    `codebase/backend/src/modules/execution-engine/queues/continuation-execution.queue.ts:70-81`
    (`resolveContinuationWorkerConcurrency`, 미이관)
  - 상세: 두 함수는 로직이 byte-for-byte 동일(정규식 `^\d+$` 선검증 → `Number.isInteger &&
    > 0` → fallback)하며, `execution-limits.ts` JSDoc 도 "`resolveContinuationWorkerConcurrency`
    와 동일 규약" 이라고 명시적으로 상호 참조한다. "동시성 한도 파서 응집" 이라는 리팩터
    목표(ARCH#4 취지)만 놓고 보면, worker concurrency 파서가 여전히 두 파일(execution-limits.ts,
    continuation-execution.queue.ts)에 분산돼 있어 "응집"이 절반만 달성된 상태로 보일 수 있다.
    다만 plan 문서(`exec-limits-refactor.md` 스코프 결정 섹션)에 이 비대칭이 의도적 스코프
    축소(저위험 3건만, ARCH#5 는 별도 분리)로 명시돼 있고, MAINT#9 가 반대 방향(continuation
    쪽을 canonical 로 남겨두고 execution-run 쪽이 그걸 재사용하는 형태가 아니라, 둘 다 각자
    파일에서 독립 정의)으로 정합화한 점은 일관성 관점에서 약간의 비대칭을 남긴다.
  - 제안: 이번 라운드 스코프로는 문제 없음(계획 문서에 근거 있음). 다만 후속에서
    `resolveContinuationWorkerConcurrency` 도 함께 `execution-limits.ts` (혹은 공용
    `worker-concurrency-parser.ts`)로 옮겨 "모든 concurrency 파서가 한 곳"이라는 서술과
    실제 파일 배치를 완전히 일치시키는 것을 고려할 만하다 (지금은 defer 해도 무방).

- **[INFO]** `execution-limits.ts`·`continuation-execution.queue.ts` 두 파서 함수의
  JSDoc 이 서로를 문자열로 참조하고 있어 향후 한쪽만 수정 시 문서 drift 위험
  - 위치: `execution-limits.ts` (`resolveExecutionRunWorkerConcurrency` JSDoc) —
    "`resolveContinuationWorkerConcurrency` 와 동일 규약" / `continuation-execution.queue.ts:70`
    부근 JSDoc(상호 대칭 서술 여부는 diff 밖이라 미확인)
  - 상세: 두 함수가 물리적으로 분리된 채 "동일 규약" 이라는 텍스트 앵커로만 동기화를
    보장하는 것은 코드 자체로 강제되는 결합이 아니라 주석 규약이라, 한쪽만 바뀌고 다른 쪽
    JSDoc 이 갱신되지 않으면 잘못된 안내가 될 수 있다.
  - 제안: 중대하지 않음(현재 로직 100% 동일 확인됨). 후속 통합(위 항목) 시 자연 해소.

- **[INFO]** 테스트 이관 시 원본 describe 블록의 "SUMMARY#12" 인라인 주석 근거가
  파일 이동만으로는 추적성이 약해짐
  - 위치: `execution-limits.spec.ts:71` (`// SUMMARY#12 — 공백 전용 문자열 + 극단값 동작 명시`)
  - 상세: 코드 자체는 명확하고 테스트 이름도 의도를 잘 설명하지만, `SUMMARY#12` 라는 식별자가
    어떤 세션·문서를 가리키는지 이 파일만 봐서는 알 수 없다(다른 파일의 `ARCH#4`/`MAINT#9` 도
    동일 패턴). 기존 코드베이스 관행(plan 항목 ID 를 주석에 남기는 패턴)과 일관되므로 규약
    위반은 아니나, 시간이 지나 해당 plan 이 archive 로 이동하면 추적이 어려워질 수 있다.
  - 제안: 현 컨벤션(코드베이스 전반에 이미 존재하는 패턴, 예: "PR2b §8", "W3 ai-review
    SECURITY fix")과 일치하므로 조치 불필요 — 프로젝트가 이미 채택한 스타일.

- **[INFO]** `execution-limits.ts` 모듈 JSDoc 확장(ARCH#6)이 5개 함수의 책임을 나열하는
  방식으로 잘 조직돼 가독성이 좋음. 다만 헤더 주석이 45줄에 근접해(파일 JSDoc 라인
  1-20) 파일 앞부분 스캔 시 실제 코드 도달까지 스크롤이 길어짐
  - 위치: `codebase/backend/src/modules/execution-engine/execution-limits.ts:1-20`
  - 상세: 4개 함수 + SoT 참조 + 소비처 나열을 한 JSDoc 블록에 담아 정보 밀도는 높지만
    가독성 트레이드오프가 약간 있다. 그러나 "모듈 경계 서술"이라는 목적(ARCH#6)과
    "함수별 태그(§8/§11) 정리"라는 실질적 가치를 고려하면 허용 범위.
  - 제안: 현행 유지 가능. 함수가 더 늘어나면(예: 후속에 continuation 파서까지 흡수) 이
    리스트형 JSDoc 을 별도 md 문서로 옮기고 파일 JSDoc 은 짧은 pointer 로 축약하는 것도
    고려할 만하다(지금은 불필요).

- **[INFO]** `execution-run.queue.ts` 이관 흔적 주석이 정확하고 간결함 — 모범 사례
  - 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts:100-101`
  - 상세: 삭제된 함수 자리에 "이관됐다(ARCH#4)"는 1줄 주석만 남기고 재-export 배럴을
    두지 않아 이중 SoT 를 피했다. grep 확인 결과 이 파일에 `resolveExecutionRunWorkerConcurrency`
    관련 export 가 전혀 남아있지 않음 — 단순 이관 원칙을 정확히 지켰다.
  - 제안: 조치 불필요. 다른 이관 작업의 참고 패턴으로 유지할 것.

## 요약

이번 변경은 그 자체로 유지보수성 개선을 목적으로 한 응집(cohesion) 리팩터이며, 목표를
잘 달성했다. 함수/상수 이동은 순수 함수 이관이라 순환 의존이 없고(zero-import 확인),
이관 후 원본 위치에 배럴 재-export 를 남기지 않아 단일 SoT 를 유지했다. 모듈 JSDoc
확장(ARCH#6)은 실제 코드 내용(4개 resolver, §8/§11 커버리지)을 정확히 반영해 문서-코드
정합성을 높였고, MAINT#9 는 loose `Number(...) || 1` 파싱을 canonical strict 파서
재사용으로 교체해 중복 로직을 제거하면서 기존 spec 계약과의 drift 도 함께 해소했다.
가장 눈에 띄는 잔여 포인트는 "동시성 파서 응집"이라는 목표가 `continuation-execution.queue.ts`
쪽 파서를 남겨둔 채로 절반만 달성됐다는 점이나, 이는 plan 문서에 명시된 의도적 스코프
축소(저위험 우선, ARCH#5 는 충돌 회피 위해 별도 분리)에 해당하며 CRITICAL/WARNING 급
문제는 발견되지 않았다. 함수 길이·중첩·매직 넘버·네이밍 컨벤션 모두 기존 코드베이스
스타일과 일관되고, 테스트 이관도 원본 커버리지를 그대로 보존했다.

## 위험도

NONE

STATUS: SUCCESS
