# Cross-Spec 일관성 검토 — `spec/conventions/` (impl-done)

## 검토 범위 요약

- 검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`
- `spec/conventions/**` 델타: **0 파일** — 이 PR 은 spec 을 바꾸지 않는다 (코드 전용 PR, 정상).
- 실제 변경: `codebase/frontend/src/lib/docs/__tests__/` 의 가드 5파일 (`guide-error-code-existence.test.ts` +
  `guide-error-code-scan.ts` 삭제 → `guide-identifier-existence.test.ts` + `guide-identifier-scan.ts` 신설,
  `guide-sanitized-message-parity.test.ts` 각주 갱신) + `PROJECT.md`/`CHANGELOG.md` 각 1개소.
  워킹트리(`guide-identifier-existence`)에서 diff 직접 확인 완료.
- 변경 성격: 유저 가이드가 인용하는 **에러 코드 전용** 실재성 가드를, **에러 코드 + 환경변수**를 아우르는
  **식별자** 실재성 가드로 일반화(축 3 을 "실패 문맥 산문"→"백틱 전수"로 교체, 기준집합에 env 선언처 병합,
  외부 어휘 허용목록 도입). spec 정의(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC)에는 손대지 않는
  **harness 테스트 전용 변경**이다.

## 발견사항

- **[INFO]** `user-guide-evidence.md §2` 가 자칭 SoT 인데 이번 가드(구·신 이름 모두)를 여전히 등재하지 않음
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 상단 주석
    ("SoT: spec/conventions/user-guide-evidence.md (가드 가족)") 및 `PROJECT.md` 가드 카탈로그 행
    ("SoT: `spec/conventions/user-guide-evidence.md §2`")
  - 충돌 대상: `spec/conventions/user-guide-evidence.md §2` "Build-time 가드 (3건)" 표 — `impl-anchor-existence.test.ts` ·
    `integrations-coverage.test.ts` · `triggers-coverage.test.ts` **3건만** 열거하며 `guide-identifier-existence.test.ts`
    (구 `guide-error-code-existence.test.ts`)는 어느 쪽에도 없음
  - 상세: 코드 주석과 `PROJECT.md` 는 이 가드의 SoT 가 `user-guide-evidence.md §2` 라고 명시하지만, 그 절 자체는
    이 가드가 존재한다는 사실도, 어떤 계약을 강제하는지도 서술하지 않는다 — SoT 라고 부르는 문서가 실제로는
    그 대상을 소유(governs)하지 않는 상태다. **이 PR 이 만든 gap 은 아니다** — 원판(`guide-error-code-existence`,
    `#1330`) 때부터 이미 미등재였고, 이번 PR 은 이름만 바꿔 그 미등재 상태를 그대로 이어받는다.
    이 정확한 지적은 이미 `--impl-prep` 단계(`review/consistency/2026/09/13/12_33_41`)에서 **checker 3명이 수렴**해
    지적했고, `plan/in-progress/guide-identifier-existence.md §D 항목 1·2` 에 planner 등재로 명시 처분돼 있다
    (developer 는 `spec/` 쓰기 권한이 없어 여기서 직접 고칠 수 없음 — CLAUDE.md 권한 경계상 정당한 처분).
  - 제안: 새 CRITICAL/WARNING 은 아님 — 이미 추적 중이므로 **중복 등재 불필요**. 다만 해당 planner 턴이 실행될 때
    `user-guide-evidence.md §2` 표에 `guide-identifier-existence.test.ts` 행을 추가하고, 동시에 "허용목록 없음" 원칙이
    번복된 배경(`GUIDE_EXTERNAL_VOCABULARY`)을 Rationale 에 반영해야 한다(plan §D 항목 2, 같은 턴으로 묶여야 함).

- **[INFO]** (참고, 이번 diff 와 무관 — 선재 결함) `cafe24-api-metadata.md §4` 가 envelope 정의 절을
  `i18n-userguide.md` "Principle 7" 로 오인용 (실제로는 Principle 0)
  - target 위치: 해당 없음 — 이번 target(`guide-identifier-*` 가드)과는 무관
  - 충돌 대상: `spec/conventions/cafe24-api-metadata.md §4` ↔ `spec/conventions/i18n-userguide.md`
  - 상세: `plan/in-progress/guide-identifier-existence.md §D 항목 4` 가 이미 발견·검증(`git log -S` 로 2026-05-16
    작성 시점부터의 오인용임을 확인)하고 planner 항목으로 별도 등재한 선재 결함이다. 이번 PR 의 스코프 밖이며
    새로 만든 문제가 아니므로 완전성을 위해서만 언급한다.
  - 제안: 이미 등재됨 — 추가 조치 불필요, 중복 등재 금지.

- **[없음] 데이터 모델 / API 계약 / 요구사항 ID / 상태 전이 / RBAC 충돌** — 이번 diff 는 harness 테스트
  스캐너(정규식 기반 순수 함수)만 바꾸며 어떤 엔티티·엔드포인트·요구사항 ID·상태 머신·권한 구조도 정의하지
  않는다. `spec/conventions/error-codes.md`(에러 코드 명명·historical exception 레지스트리)와
  `spec/5-system/3-error-handling.md §1`(카탈로그)의 기존 정의와는 **판정 방향이 반대**(가이드→코드 존재
  검사)이며 그 문서들의 명명 규칙·예외 목록을 재정의하거나 모순되게 인용하지 않는다. 새로 도입된
  `GUIDE_EXTERNAL_VOCABULARY` 허용목록(`MESSAGE_CREATE`, Discord Gateway 이벤트명) 은 error-codes.md 의
  카탈로그·명명 원칙과 겹치지 않는 외부 어휘라 충돌 없음.

- **[없음] 계층 책임 충돌** — 신규/변경 파일은 전부 `codebase/frontend/src/lib/docs/__tests__/` 안에 머무는
  frontend 전용 harness 테스트이며, `frontend-layering.md` 가 규정하는 런타임 레이어 경계(컴포넌트/훅/서비스
  분리)와는 무관한 빌드타임 문서 검증 스크립트다. 기준집합에 `codebase/backend/src`·`codebase/packages` 만
  쓰고 frontend 소스를 제외한 것은 기존(`#1330`) 결정을 그대로 계승한 것으로 신규 계층 결정이 아니다.

## 요약

이번 target 은 `spec/conventions/` 를 전혀 수정하지 않는 코드 전용(harness 테스트) PR 이며, 에러 코드 전용
가이드-실재성 가드를 에러 코드+환경변수를 아우르는 식별자 가드로 일반화한 것이다. 데이터 모델·API 계약·요구사항
ID·상태 전이·RBAC 등 spec 이 정의하는 영역과는 표면이 겹치지 않아 신규 CRITICAL/WARNING 급 cross-spec 모순은
없다. 유일하게 실질적인 항목은 "이 가드의 자칭 SoT(`user-guide-evidence.md §2`)가 실제로는 이 가드를 열거하지
않는다"는 구조적 gap 인데, 이는 이번 PR 이전(`#1330`)부터 있었고 이미 `--impl-prep` 3-checker 수렴 지적을 거쳐
`plan/in-progress/guide-identifier-existence.md §D`에 developer 권한 밖 planner 항목으로 정당하게 등재·추적되고
있어 재차단 사유가 아니다.

## 위험도

LOW
