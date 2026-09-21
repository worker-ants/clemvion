# Rationale 연속성 검토 — spec/5-system (--impl-prep)

## 발견사항

- **[INFO]** target 문서에 실제 변경분이 없음 — Rationale 연속성 판정 대상이 vacuous
  - target 위치: `spec/5-system/*` 전체 (번들 22개 파일 중 3개 전문 포함·15개 예산 초과로 절단)
  - 과거 결정 출처: 해당 없음 (비교할 신규/변경 서술이 없음)
  - 상세: `git diff origin/main -- spec/` 및 `git status --porcelain` 확인 결과 이 워크트리에서
    `spec/` 하위 파일은 **커밋·미커밋 어느 쪽으로도 전혀 변경되지 않았다**. 이번 `--impl-prep`
    구동의 실제 대상 작업은
    `plan/in-progress/race-helper-guard-tests.md` (frontmatter `spec_impact: none`) 이며, 계획서
    본문(§D "하지 않는 것")도 "프로덕션 런타임 코드 변경 0"·"jest 설정 변경 0" 을 명시한다.
    변경 범위는 `codebase/backend/src/shared/testing/overlap-preconditions.ts`(신규 순수 함수 +
    self-spec)와 `codebase/backend/test/helpers/concurrency.ts` 의 호출 배선, `PROJECT.md:331`
    한 줄 뿐이다. 이 중 어느 것도 `spec/5-system/*` 의 서술을 추가·수정·삭제하지 않는다.
  - 교차 확인: 번들에 포함된 세 전문 파일(`1-auth.md`·`2-api-convention.md`·
    `3-error-handling.md`)의 `## Rationale` 절(각각 L551·L1499·L2199, 총 8개 Rationale 발췌)을
    "동시성/lock/idempotent/테스트" 키워드로 훑었다. 관련 Rationale 은 모두 **프로덕션 동시성
    제어**(WebAuthn `SELECT ... FOR UPDATE` 비관적 락, refresh 토큰 조건부 회전, 웹훅
    `endpoint_path` DB 트리거 유일성, KB 재추출/재임베딩 CAS 컬럼 등)에 관한 것이며, 이번
    계획이 건드리는 **테스트 헬퍼의 배치 위치**(`src/shared/testing/` vs `test/helpers/`)나
    "가드가 실제로 실행되는가" 판별 실험과 겹치는 항목은 없다. 즉 이번 작업이 위반할 수 있는
    spec-level 동시성 invariant 자체가 표면에 없다.
  - 제안: 이번 라운드는 리스크 없음으로 수렴 가능. 향후 이 계획이 진행되며 실제로
    `spec/5-system/*` 서술을 건드리게 될 경우(예: 계획이 뒤집혀 프로덕션 코드나 spec 변경이
    추가되는 경우) 그 시점의 diff 를 대상으로 본 checker 를 다시 구동해야 한다 — 지금 판정은
    "무변경 상태의 정합성" 만 확인한 것이며 계획의 후속 확장분까지 보증하지 않는다.

## 요약

이번 `--impl-prep` 호출의 실제 작업 대상(`race-helper-guard-tests` 계획)은 `spec_impact: none` 이
명시된 순수 테스트 인프라 변경(신규 `src/shared/testing/` 순수 함수 + self-spec, `test/helpers/`
호출 배선, `PROJECT.md` 한 줄)이며, `git diff origin/main -- spec/` 실측 결과 `spec/5-system/*`
을 포함해 `spec/` 전체가 이 워크트리에서 전혀 변경되지 않았다. 따라서 "target 문서가 기존
Rationale 에서 기각된 결정을 재도입하거나 합의 원칙을 위반하는가" 라는 질문 자체가 적용될
대상이 없다 — 비교 가능한 신규/변경 서술이 없으므로 위반도 없다. 번들에 전문 포함된 세 파일의
동시성 관련 Rationale 을 교차 확인해도 이번 작업 범위(테스트 헬퍼 배치·판별 실험)와 충돌하는
지점은 발견되지 않았다.

## 위험도

NONE
