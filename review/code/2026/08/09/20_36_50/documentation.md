# 문서화(Documentation) Review

## 발견사항

- **[INFO]** 캐너리 JSDoc 의 "142건" 은 다시 stale 해질 값이다 — 같은 패턴이 이미 한 번 드리프트를 냈다
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:26` (게이트 기준, 함수 상단 JSDoc 블록)
  - 상세: 이번 diff 는 "73건"(2026-08-08 실측, 실제로는 `@Roles()` 미부착 서브셋)이 상위집합
    자리에 잘못 적혀 있던 것을 "142건"(전체 `@WorkspaceId()` 소비 라우트, 2026-08-09 부팅 로그
    실측)으로 정정하고, 두 수의 포함관계(`222 ⊇ 142 ⊇ 73`)까지 명문화했다 — 정정 자체는 정확하고
    근거(부팅 로그 실측 + grep 교차검증)도 plan(`plan/in-progress/auth-guard-reflection-hardening.md`)에
    잘 남겨져 있다. 다만 구조적으로 이 숫자는 새 `@WorkspaceId()` 라우트가 추가될 때마다 다시
    stale 해지는 값이라, "73→142" 드리프트가 재발할 여지가 남아 있다. 문서 자체가
    "정상 기동 시 인식한 라우트 수가 부팅 로그에 남습니다" 라고 정본 소스를 이미 안내하고 있어
    실질적 위험은 낮다.
  - 제안: 조치 불요(이미 완화됨). 향후 이 수치가 다시 크게 벌어지면 — 하드코딩된 숫자 대신
    "부팅 로그를 정본으로 삼고 이 주석의 숫자는 마지막 실측 스냅샷일 뿐" 이라는 문구를 앞세우는
    쪽으로 한 번 더 다듬을 수 있다는 정도의 참고 사항.

- **[INFO]** PR #1108 이 만든 `VALIDATION_ERROR` 분기·헤더/경로 UUID 검증 비대칭이 아직
  `spec/5-system/3-error-handling.md` §1.3 · `1-auth.md` §3.3 에 반영되지 않은 spec-lags-code 상태
  — 이번 diff 범위 밖이지만 문서화 관점에서 존재를 재확인해 둔다
  - 위치: 해당 없음(이번 diff 는 이 갭을 만들지도 고치지도 않음) — 근거:
    `plan/in-progress/auth-guard-reflection-hardening.md` `## 후속 (이 PR 밖)` 항목 3건(전부 `[ ]`)
  - 상세: 이 갭은 `review/consistency/2026/08/09/20_02_21/plan_coherence.md`(이번 diff 에 포함된
    새 리뷰 산출물)가 WARNING 으로 이미 정확히 잡아 두었고, plan 도 "planner 턴 필요"로 순서를
    명시해 두었다. 이번 diff(README·픽스처 통합·캐너리 주석 정정·mock 경화·e2e 추가)는 이
    spec 파일들을 건드리지 않으므로 새로 발생한 문제가 아니다.
  - 제안: 별도 조치 불요 — 이미 추적 중. 이 항목을 이번 세션에서 다시 반복 등재하지 않도록
    참고용으로만 남긴다.

## 요약

이번 diff 는 코드 변경이 아니라 **문서화·테스트 위생 정리**가 본체다(README 배포 주의 절 구조화,
공용 워크스페이스 UUID 픽스처 모듈화, 캐너리 주석의 수치 오류 정정, secret-store LIKE 가드
mock 자기-전제 단언 + e2e 신설, dead code 제거). 검토한 신규/변경 파일 전부가 "왜"를 설명하는
JSDoc/블록 주석을 갖추고 있고, 특히 `workspace-id-fixtures.ts`·`workspace-reflection-canary.ts`·
`secret-store-like-prefix.e2e-spec.ts` 는 결정 배경·기각한 대안·실측 근거(뮤테이션 RED 횟수,
부팅 로그 인용)까지 남겨 이례적으로 높은 문서화 수준을 보인다. README 변경도 구조 정리(단일
`> 인용문` → `##`/`###` 계층, 두 검사의 성격 차이 명시)가 실제 코드(`main.ts` 의 호출 순서)와
정확히 일치함을 직접 대조로 확인했다. 오래된 주석·픽스처 이름 잔재(`OWN_WS`/`WS1`)도 전수 grep 으로
남아 있지 않음을 확인했다. 발견한 두 건은 모두 INFO 로, 하나는 구조적으로 재발 가능한 하드코딩
수치에 대한 참고이고 다른 하나는 이미 다른 산출물이 추적 중인 spec-lags-code 갭의 재확인일 뿐
이번 diff 의 결함이 아니다.

## 위험도

NONE
