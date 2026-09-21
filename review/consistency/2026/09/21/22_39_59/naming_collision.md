# 신규 식별자 충돌 검토 — `spec/5-system` (--impl-prep)

## 사전 확인 — target 에 실제로 "신규" 식별자가 있는가

`--impl-prep spec/5-system` 로 번들된 target 은 `spec/5-system/*.md` 17개 파일(가용 3개: `1-auth.md`·
`2-api-convention.md`·`3-error-handling.md`, 나머지 15개는 컨텍스트 예산 초과로 절단)이다. 그러나
실제 작업 범위는 `plan/in-progress/race-helper-guard-tests.md` 이며, 그 frontmatter 는
`spec_impact: none` 을 명시한다. 실측:

- `git diff origin/main --stat` → 변경분은 `plan/in-progress/race-helper-guard-tests.md` 와
  이전 `--impl-prep` 실행(`review/consistency/2026/09/21/22_25_20/**`) 산출물뿐 — **`spec/5-system` 및
  `codebase/**` 변경 0줄**.
- 즉 이번 호출에서 `spec/5-system` 자체는 "새로 도입"되는 문서가 아니라 이미 main 에 존재하는
  기존 spec 이다. 신규 식별자는 **spec 이 아니라 plan 이 예고하는 코드 변경**에서만 나온다.

plan 은 직전 판(22:25 실행, `plan_coherence` Critical 로 BLOCK)에서 처방을 교체했다 — 원래
`test/helpers/concurrency.spec.ts` 신설 + `jest.config.ts` `roots` 확장안이었으나, 지금은
**순수 함수 두 개를 `src/shared/testing/` 로 추출**하는 안으로 바뀌었다. 아래는 이 새 처방이
실제로 도입하는 식별자를 기준으로 재검증한 결과다.

## 검토한 신규 식별자

| 유형 | 식별자 | 위치(예고) |
| --- | --- | --- |
| 파일 경로 | `codebase/backend/src/shared/testing/overlap-preconditions.ts` | 신규 |
| 파일 경로 | `codebase/backend/src/shared/testing/overlap-preconditions.spec.ts` | 신규(self-spec) |
| 함수명 | `assertEnoughFiresForOverlap(fireCount: number): void` | 신규 export |
| 함수명 | `assertGuardBelowKnownTimeouts(guardMs, timeouts): void` | 신규 export |
| 문서 표기 | `PROJECT.md` §e2e 파일 위치에 self-spec 동반 헬퍼 예외 한 줄 추가 | 신규 문장(신규 식별자 아님) |

## 발견사항

교차 검증한 후보 전부 **충돌 없음**.

- **[INFO]** 파일 경로 `overlap-preconditions.ts` — 신규 파일, 기존 미사용 확인
  - target 신규 식별자: `codebase/backend/src/shared/testing/overlap-preconditions.ts`(+`.spec.ts`)
  - 기존 사용처: 없음. `find . -iname "*overlap-preconditions*"` 전체 저장소 0건.
  - 상세: `src/shared/testing/` 안의 기존 5쌍(`pg-error-fixtures`·`response-contract`·
    `schedule-trigger-ref`·`swagger-probe`·`trigger-workflow-ref`·`user-secret-absence`)과
    kebab-case 명명 컨벤션이 일치하고, 겹치는 이름도 없다.
  - 제안: 없음(현행 유지).

- **[INFO]** 함수명 `assertEnoughFiresForOverlap` / `assertGuardBelowKnownTimeouts` — 신규 export
  - target 신규 식별자: 위 두 함수명
  - 기존 사용처: `grep -rn` 전체 `codebase/` 0건 — 재사용된 이름 아님.
  - 상세: 같은 디렉터리의 기존 `assertMatchesContract`(`response-contract.ts:374`)와 "assert 접두어
    = 위반 시 throw" 라는 동일 명명 패턴을 따른다. 컨벤션과 정합적이며 의미 충돌 없음.
  - 제안: 없음.

- **[INFO]** 상수 `KNOWN_LOCK_TIMEOUTS_MS` — 이관 대상이지 신규 식별자 아님
  - target 신규 식별자: 아님(기존 `codebase/backend/test/helpers/concurrency.ts:12`에 이미 존재,
    plan 은 이를 검사하는 로직만 `assertGuardBelowKnownTimeouts` 로 추출)
  - 기존 사용처: `codebase/backend/test/helpers/concurrency.ts:12,24,29`
  - 상세: 이름 자체는 옮겨지지 않고 호출부만 추가되므로 충돌 검토 대상 아님. 참고로만 기록.
  - 제안: 없음.

- **[INFO]** `PROJECT.md:331` 부근 문서 문장 — 새 요구사항 ID/식별자 아님
  - target 신규 식별자: 없음 — "신규 헬퍼: `codebase/backend/test/helpers/<name>.ts`" 옆에
    self-spec 동반 헬퍼 예외를 설명하는 산문 한 줄 추가일 뿐, 새 키·ID 를 도입하지 않는다.
  - 기존 사용처: `PROJECT.md:331`(현재 예외 없음 확인), 트래커
    `plan/in-progress/spec-draft-nullable-notation-followups.md:1895`(동일 처방 이미 등재)
  - 상세: 문서 문장 추가이지 식별자 신설이 아니므로 이 checker 의 충돌 관점(요구사항 ID·엔티티·
    endpoint·이벤트·env var·파일 경로) 어디에도 해당하지 않는다.
  - 제안: 없음.

컨텍스트 예산 초과로 절단된 `spec/5-system` 15개 파일과 `plan/in-progress/` 다수 파일은 본문을
열지 못했다. 다만 "사전 확인"에서 실측했듯 이번 diff 는 그 파일들을 전혀 건드리지 않고, plan 이
예고하는 유일한 신규 식별자(파일 경로 2개 + 함수명 2개)는 이미 저장소 전체 grep 으로 0건임을
확인했으므로, 절단된 파일들에 이 결론이 좌우될 위험은 낮다.

## 요약

이번 `--impl-prep spec/5-system` 호출의 실제 diff 범위는 `spec/5-system` 을 전혀 변경하지 않는
test-harness 전용 작업이며, plan 은 직전 BLOCK 이후 처방을 `src/shared/testing/overlap-preconditions.ts`
(+ self-spec) 신설로 교체했다. 이 신규 파일 경로·함수명(`assertEnoughFiresForOverlap`,
`assertGuardBelowKnownTimeouts`) 은 저장소 전체에서 grep 0건으로 기존 사용처와 충돌하지 않고,
같은 디렉터리의 기존 `assert*` 명명 컨벤션과도 정합한다. `PROJECT.md` 예외 문장 추가는 새 식별자를
도입하지 않는다. 신규 식별자 충돌 위험은 없다.

## 위험도
NONE
