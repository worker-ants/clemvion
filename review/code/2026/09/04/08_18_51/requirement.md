# 요구사항(Requirement) 리뷰 — `entity-nullable-column-type-mismatch` 배치 3 후속 (관계 데코레이터 동명 충돌 캐너리)

## 검증 방법

- `nullable-type-lie-cast.spec.ts` 전체(31 tests)를 실제로 `pnpm exec jest` 로 실행 — **31/31 통과**.
- 신규 추가 2건([대조군] 관계끼리의 동명 충돌 / [대조군] `@Column`+관계 혼재 충돌)의 판정 대상
  실제 값을 `nullable-type-lie-cast-guard.ts` 의 `WIDENED_DECL`·`widenedEntityFields` 로직을
  손으로 추적해 기대값과 대조 — 일치.
- plan 이 주장하는 뮤테이션 결과 두 가지를 scratch 백업 후 **저장소 파일에 직접 뮤테이션**해
  재현: (1) 동명 충돌 제거(`widened.delete`) 삭제 → **3건 RED**(claim 과 일치), (2) `WIDENED_DECL`
  에서 관계 데코레이터 제거 → **2건 RED**(claim 과 일치).
- plan 이 "저장소에 3건 실재" 라 주장하는 실제 관계 충돌 3건을 엔티티 소스에서 직접 grep 대조:
  `integration`(`integration-oauth-state.entity.ts:50` nullable ↔ `integration-usage-log.entity.ts:26`
  non-null), `trigger`(`execution.entity.ts:40` nullable ↔ `schedule.entity.ts:30` non-null),
  `user`(`login-history.entity.ts:31` nullable ↔ `audit-log.entity.ts:27` non-null) — **셋 다 실재
  확인**, 과장 없음.

### 뮤테이션 절차상 사고와 복구 (투명성 고지)

2차 뮤테이션(`WIDENED_DECL` 관계 데코레이터 제거) 검증 후 scratch 백업(`nullable-type-lie-cast-
guard.ts.orig`, 세션 scratch 디렉터리)에서 `cp` 로 원복을 시도했으나, **원복 직후 대상 파일과
백업 파일의 md5 가 모두 뮤테이션된 값(`4d05d6f1…`)으로 일치**하는 현상을 발견했다 — 즉 원복에
쓰려던 백업 자체가 오염돼 있었다(scratch 디렉터리 안에 이 세션과 무관해 보이는 다수의 이전
세션 산출물이 섞여 있었다 — 병렬 실행 중인 다른 프로세스가 같은 파일명 관례로 같은 경로를 썼을
가능성). `git status --short` 로 저장소에 뮤테이션이 실제로 남아 있음을 확인한 뒤, `git show
HEAD:<path>` 로 받은 내용이 뮤테이션 전 원본과 diff 상 정확히 일치함을 확인하고(1줄 diff만
있었고 diff 대상이 정확히 내가 넣은 뮤테이션 라인) 그 내용을 `cp` 로 되돌렸다(`git checkout`/
`restore`/`stash` 는 쓰지 않음). 최종적으로 `git status --short` = 리뷰 산출물(`review/code/...`)
디렉터리 외 clean, 전체 spec 재실행 31/31 통과로 원복을 확인했다. 이 사고 자체는 이번 diff 의
결함이 아니라 리뷰 절차(scratch 격리) 상의 사고이며, 최종적으로 저장소는 clean 상태다.

## 발견사항

- **[INFO]** 신규 대조군은 `@ManyToOne`+`@JoinColumn` 조합만 검증하고 `@OneToOne` 조합은 별도로
  커버하지 않는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:387`,
    `:417` (신규 두 `it`)
  - 상세: `WIDENED_DECL` 정규식(`nullable-type-lie-cast-guard.ts:169`)은 `@Column|@ManyToOne|
    @OneToOne` 을 모두 대상으로 하는데, 이번에 추가된 대조군은 `@ManyToOne` 조합만 쓴다.
    docstring 이 밝힌 저장소 실측 3건(`integration`·`trigger`·`user`)이 모두 `@ManyToOne` 이라
    실사용 범위는 커버하지만, `@OneToOne` 경로 자체는 이 diff 로 캐너리가 생기지 않는다.
  - 제안: 필수는 아님(실재 사례가 없어 캐너리 대상 자체가 없음). 다음에 `@OneToOne` 실충돌이
    저장소에 생기면 `it.each` 로 추가하는 것으로 충분 — plan 의 "넓히는 것은 검증 없이 표면만
    키우는 일" 원칙과도 일치한다.

- **[INFO]** 관련 spec 문서 없음(spec fidelity 축, 정상).
  - 위치: N/A — 대상 파일은 `codebase/backend/src/repo-guards/__tests__/` (내부 개발 가드) 와
    `plan/in-progress/entity-nullable-column-type-mismatch.md`.
  - 상세: `spec/` 전수 검색(`nullable-type-lie`, `WIDENED_DECL`, `widenedEntityFields`,
    `repo-guards`) 결과 이 가드를 정의하는 spec 문서가 없다. 이는 plan 자신이 frontmatter 상단에
    "이 작업 자체는 `spec/` 을 1줄도 바꾸지 않는다(코드 전용)" 라고 명시한 것과 일치 — 결함이
    아니라 예상된 상태다.

## 요약

두 파일 모두 순수 **테스트 추가 + plan 문서 갱신**이며 프로덕션 동작을 바꾸지 않는다. 신규 대조군
2건은 `widenedEntityFields`/`findStaleSpecCasts` 의 기존 로직(수정 없음)에 대해 정확한 기대값을
단언하고 있음을 실제 jest 실행(31/31 통과)과 로직 수기 추적으로 확인했다. plan 이 제시한 정량
주장(저장소 관계 충돌 3건, 뮤테이션 시 3건/2건 RED) 을 전부 독립적으로 재현·대조해 과장이나 허위
없음을 확인했다. plan 체크리스트의 `[x]` 전환도 실제로 수행된 작업(대조군 2건 추가)과 정확히
일치하고, 아직 미해결인 두 "후속(planner 턴)" 항목은 여전히 `[ ]` 로 남아 있어 완료 상태를
과장하지 않는다. TODO/FIXME/HACK 성 잔재 없음, 반환값·에러 시나리오·엣지 케이스 모두 이 diff 의
범위(순수 대조군 테스트) 안에서 적절히 처리된다. 관련 spec 문서는 존재하지 않으며 이는 plan 이
스스로 명시한 대로 예상된 상태다(코드 전용 변경). 유일한 발견사항은 `@OneToOne` 조합이 새
대조군에 없다는 완결성 관점의 INFO 하나이며, 이는 저장소에 해당 실사례가 없어 캐너리 대상
자체가 없는 상태이므로 조치가 필요하지 않다.

## 위험도
NONE
