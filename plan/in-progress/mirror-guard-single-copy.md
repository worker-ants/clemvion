---
title: 미러 가드 사본을 1개로 — 경로 게이팅을 CI 잡으로 푼다
status: in-progress
worktree: repo-guard-utils-extract-9c4b21
started: 2026-08-21
owner: developer
spec_impact: none
---

# 미러 가드 사본을 1개로 — 경로 게이팅을 CI 잡으로 푼다

PR #1190 의 후속. 트래커 항목 *"미러 가드 탐지 로직을 공유 test-utility 로 재추출"* 을 닫되,
**추출이 아니라 중복의 이유를 없애는 쪽**으로 푼다.

## 왜 사본이 둘이었나

`masked-marker-mirror-guard.ts` 가 backend(162줄)·frontend(165줄)에 문자 그대로 복제돼 있다.
이유는 순전히 **CI 경로 게이팅**이었다 — `frontend-checks` 는 `codebase/backend/**` 변경 때
검사를 생략하고 체크는 통과로 보고하므로, 한쪽에만 둔 가드는 반대쪽 방향에 무력하다.

그 중복이 PR #1190 에서 **두 번 실제 결함의 근원**이 됐다:

| 라운드 | 사고 |
| --- | --- |
| `12_50_37` | 접두 경계를 backend 만 고치고 *"양쪽 다 고쳤다"* 고 커밋·RESOLUTION 에 적음 |
| `13_34_34` | 비대칭을 경고하는 문단을 frontend 에만 추가 |

지금은 대칭 캐너리가 기계로 지키지만, **알고리즘이 바뀔 때마다 대칭을 사람이 재보증해야
하는 구조**는 남는다.

## 왜 공유 패키지가 아닌가 — 등록 표면 비교 (실측)

트래커 원안은 `@workflow/repo-guard-utils` devDep 패키지였다. 두 안의 실제 비용:

| 안 | 사본 | 신규 패키지 | 등록 표면 | 그중 **자동 검증** |
| --- | --- | --- | --- | --- |
| 공유 devDep 패키지 | 로직 1 + 러너 2 | 1개 | **8곳** | 2곳 (`test-stages.sh`·`packages-checks.yml`) |
| **전용 CI 잡** | **1** | 0 | 5곳 | **5곳 전부** |

- devDep 패키지도 `packages-checks.yml` 모집단에 잡힌다(실측: `workflowDepsOf` 가
  `devDependencies` 도 본다) — 그건 좋다. 하지만 **Dockerfile 3곳 · package.json 2곳 ·
  lockfile** 은 여전히 수동이고, PR #1190 이 그 비용을 이미 한 번 치렀다.
- 전용 CI 잡의 등록 표면은 **하네스 레지스트리 4곳 + 워크플로 파일**이고
  `test_workflow_yaml_structure.py` 가 전부 강제한다(`_PERMISSIONS`, job 조건, step 조건,
  `pull_request` trigger 형태).

> 결정적인 차이: **패키지 안은 test-only 코드를 위해 프로덕션 배포 경로(Dockerfile)를
> 건드린다.** CI 잡 안은 CI 안에서 끝난다.

기존 `@workflow/*` 8종은 **전부 production dependency** 다 — Dockerfile 등재가 당연하다.
이번 후보만 **devDep-only 테스트 유틸**이라 그 비대칭이 생긴다. 선례를 따르는 것처럼 보이지만
성격이 다르다.

또 하나 — 패키지 안은 **러너를 여전히 둘 유지해야 한다**(경로 게이팅이 그대로이므로).
로직만 1본이 되고 spec 은 둘이다. CI 잡 안은 **로직·러너 모두 1본**이다.

## 설계

- `.github/workflows/repo-guards.yml` 신설. `_changed-paths.yml` 재사용, pathspec 은
  `codebase/**` (+ 가드 파일·워크플로 자신). 즉 **어느 스택이 바뀌든 돈다.**
- 잡은 frontend 워크스페이스만 설치해 **미러 가드 spec 하나**를 돌린다.
- backend 사본(`masked-marker-mirror-guard.ts` · `masked-marker-mirror.spec.ts`)을 **삭제**한다.

### 남기는 것과 지우는 것

backend `repo-guards/__tests__/` 의 나머지 가드는 **그대로 둔다** —
`masked-reject-callers`·`production-build-devdep`·`eslint-unicorn-peer` 는 backend 트리·backend
tsconfig 만 읽으므로 backend 트리거로 충분하다. 경로 게이팅이 문제가 되는 것은 **저장소
전체를 훑는** 미러 가드뿐이다.

## 작업

- [x] `/consistency-check --plan` — **BLOCK: NO**(W1 반영, INFO 2·3 반영)
- [x] `.github/workflows/repo-guards.yml` 신설 + 하네스 레지스트리 4곳 등록
- [x] backend 미러 가드 사본 2파일 삭제
- [x] **`frontend-checks.yml` 의 `codebase/channel-web-chat/**` pathspec 정리** — 그 줄은
      *"미러 가드가 이 잡에 산다"* 는 이유로 넣은 것이라(`11_53_49` W1) 전용 잡이 생기면
      근거가 소멸한다. 되돌리고 주석도 함께 지운다.
      > 가드는 frontend vitest 에도 계속 포함되므로 **CI 에서 두 번 돈다**(frontend-checks
      > + repo-guards). 의도적 수용이다 — 그래야 로컬 `run-test.sh unit` 이 그대로 돌린다.
- [x] frontend 가드 헤더에서 "backend 쌍둥이와 함께 고쳐라" 규칙 제거 → **왜 이제 1본인지**로 대체
- [x] **`plan/in-progress/masked-marker-shared-package.md:165`** 항목 `[x]` + 대체 근거
      (구현 커밋과 같은 턴). PR #1190 이 머지돼 그 plan 은 `origin/main` 의 `in-progress/`
      에 있다(실측) — 착수 직전 병렬 세션이 `complete/` 로 옮기지 않았는지 재확인한다.
      > checker 가 그 plan 을 *"/ai-review 1건만 남은 거의 완료 단계"* 로 서술했는데
      > **stale 이다** — 이미 머지됐다. 에이전트 서술을 그대로 받지 않고 실측했다.
- [x] TEST WORKFLOW 4단계 + 타입체크 ratchet + 하네스 테스트
- [ ] `/ai-review`

## 검증 기준

**동작 무변경**이어야 한다 — 삭제되는 backend spec 이 검사하던 불변식을 frontend spec 이
그대로 검사한다(둘은 같은 로직·같은 스캔 범위였다). 새 CI 잡이 실제로 **backend-only 변경에서
도는지**가 이 PR 의 핵심 주장이므로, 그것을 PR 에서 실측해 적는다.

> **캐너리를 잃지 않는다 — 대조 완료(실측)**: backend spec 의 `it` 제목 **9종**이 frontend
> spec 에 **전부** 있다. 주 단언 1(재선언 없음) + 캐너리 8(vacuous 방지 · 파생 비지 않음 ·
> 패키지 src 포함 · 합성 fixture · 함수 선언 · 경로 접두 겹침 · 심볼별 · 오탐 방지).
> backend 에만 있는 것은 없으므로 삭제해도 잃는 검사가 없다.

## Rationale

트래커 원안(공유 패키지)을 **등록 표면 실측으로 뒤집었다.** 사본을 1개로 만드는 것이 목적인데,
패키지 안은 로직만 1본이 되고 러너는 둘로 남으며 그 대가로 프로덕션 배포 경로를 건드린다.
중복의 **원인**(경로 게이팅)을 없애면 로직·러너 모두 1본이 되고 변경은 CI 안에서 끝난다.

**기각한 대안**:

- *`frontend-checks` pathspec 에 `codebase/backend/**` 추가* — 잡 하나로 끝나지만 backend PR
  마다 frontend 전체 vitest + next build 가 돈다. 가드 spec 하나를 위해 지나치다.
- *공유 devDep 패키지* — 위 표. test-only 코드가 Dockerfile 을 건드리는 것이 결정적이다.
