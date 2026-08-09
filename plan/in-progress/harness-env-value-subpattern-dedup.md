---
title: env-value 서브패턴이 4곳에 복제돼 있다 — 공유 상수로 뺄지 (import 실패 리스크와 상충)
worktree: (unstarted)
started: 2026-07-25
owner: developer
priority: P3
---

## Overview

`review/code/2026/07/25/12_43_15` WARNING 2 (maintainability, side_effect 도 동일 관찰) 에서 분리.
[`harness-push-gate-did-not-fire`](../complete/harness-push-gate-did-not-fire.md) §M 이 **세 번째**
동기화 편집(§J → §L → §M)이었다는 지적이다.

## 문제

하나의 논리적 불변식(env-value 반복 + 닫는 whitespace)이 4곳에 손으로 복제돼 있다:

| 위치 | 무엇 |
| --- | --- |
| `.claude/hooks/guard_review_before_push.py` `_GIT_PUSH` | 정본(차단 게이트) |
| `.claude/hooks/guard_default_branch_bash.py` `_MUTATING` | byte-identical 요구 |
| `.claude/tests/test_push_guard_allowlist.py` `_BLIND_PATTERN` | differential 기준선 pin |
| `.claude/tests/test_guard_default_branch_bash_mutating.py` `_SPLIT_MARKER` | 경계 splice 앵커 |

§M 에서 실제로 네 곳을 모두 손으로 고쳤다. `EnvValueSubpatternSharedTest` 가 drift 를 **사후에**
잡지만, SoT 는 여전히 "N개 복사본 + 비교 테스트" 다.

## 왜 이번 PR 에서 하지 않았나 (반대 근거 — 착수 전 반드시 읽을 것)

리뷰 제안은 `_ENV_VALUE_CLOSER` 류 공유 상수를 `_lib/` 에 두고 두 훅이 import 하는 것이다.
그런데 **정규식이 각 훅 파일 안에 있는 것은 의도된 설계**로 보인다:

- 두 훅 모두 `_lib/*` import 실패를 **fail-open** 으로 흡수한다 —
  `guard_default_branch_bash` 는 `sys.exit(0)`, `guard_review_before_push` 는 게이트별 degraded.
- 그런데 **탐지 정규식이 `_lib` 에 있으면** import 실패 시 `_GIT_PUSH` 자체가 없어 훅이 크래시하고,
  harness 의 "non-0/non-2 = allow" 규칙에 따라 **모든 push 가 무검증 통과**한다.
- 즉 DRY 를 얻는 대신 **"공유 모듈 하나가 깨지면 게이트 전체가 조용히 사라지는"** 실패 모드를 만든다.
  이 저장소가 §J·§L·§M·#1002·#1005 로 반복해서 닫아온 것이 정확히 "조용한 게이트 우회" 클래스다.

## 그래서 판정이 필요하다

- [ ] **(A) 현상 유지 + 근거 명문화** — 복제는 의도이고 drift 테스트가 안전망이라는 것을 두 훅
      주석에 명시(현재는 "keep identical" 만 있고 **왜 공유 모듈이 아닌지**가 없다). 가장 저렴.
- [ ] **(B) 부분 공유** — 테스트 2곳(`_BLIND_PATTERN`·`_SPLIT_MARKER`)만 `_harness` 에서 공유.
      테스트는 import 실패해도 게이트가 아니라 **테스트가** 죽으므로 안전 방향이다. 훅 2곳은 복제 유지.
- [ ] **(C) 전면 공유** — 훅까지 `_lib` import. import 실패 시 **fail-CLOSED**(exit 2) 로 바꿔야
      위 리스크가 없어지는데, 그건 "가드가 깨지면 작업이 멈춘다" 는 정책 반전이라 별도 합의 필요.

## 함께 볼 것 (2회차 리뷰 W4)

`_MUTATING` 은 `re.VERBOSE` 인데 env-prefix 서브패턴만 163자 한 줄로 압축돼 있어 같은 패턴
안에서 포맷이 갈린다(리뷰 지적). 육안 대조가 안 되니 drift 를 테스트로만 잡을 수 있다는 점에서
본 티켓과 같은 뿌리다 — **표현 통일**은 위 (A)/(B)/(C) 중 무엇을 고르든 함께 처리한다.

## 함께 볼 것 — 같은 클래스의 두 번째 사례 (2026-08-09 이관)

`test_changed_paths_reusable.py` 와 `test_pnpm_workspace_action.py` 가 **`STUB` 상수와
`argv()` 헬퍼를 바이트 단위로 중복**한다. 둘 다 "워크플로 YAML 의 `run:` 블록을 꺼내 bash 로
돌리고 스텁이 받은 인자를 센다" 는 같은 기법을 쓰기 때문이다. 스텁 프로토콜(`ARGC=`/`ARG=`)을
바꾸면 두 파일을 손으로 맞춰야 한다.

- 출처: `#1120` ai-review INFO 2 (`review/code/2026/08/09/21_53_16`).
- **트리거가 걸린 조건부 항목이다** — `#1106`→`#1111` 이 `changes` 잡 추출에 쓴 것과 같은
  방식으로, **세 번째 사례가 생기는 시점**에 공유 헬퍼 모듈로 뽑는다. 2개 시점에 추상화하면
  아직 안 드러난 변형을 추측으로 설계하게 된다는 것이 그때 얻은 교훈이다.
- 지금 착수할 일은 **없다**. 세 번째가 생기기 전에는 이 항목이 열려 있어도 무조치가 정답이다.
- **여기로 이관한 이유**: 원래 등재처(`ci-required-check-skip-jobs.md`)가 완료됐고, 본 plan 이
  harness 내부 중복 판정을 다루는 자리다.

## 함께 볼 것 — 같은 "DRY vs 안전성" 축의 다른 plan

[`docs-guard-walker-dedup.md`](docs-guard-walker-dedup.md) — `codebase/frontend/src/lib/docs/__tests__/`
문서 가드들의 디렉터리 순회 walker 3벌 통합 판정.

> **주제 유사성뿐이라 편입하지 않았다.** 한때 그 항목들을 이 plan 안에 이관했는데,
> 이 plan 은 `.claude/hooks/*.py` 의 **정규식 상수** 중복이고 저쪽은 TypeScript 문서 가드의
> **디렉터리 순회 필터** 중복이다 — 코드베이스·언어·실패 모드가 전부 다르다. 그 자리에
>두면 walker 중복을 찾는 사람이 발견하지 못한다(consistency plan-coherence WARNING).
> 두 plan 이 공유하는 것은 "복제를 남길 것인가, 합쳐서 표면을 만들 것인가" 라는 **판단
> 기준**뿐이다.
>
> (`#970`(blind 정규식 vs 정밀 파서)을 그 기준의 출처로 적었다가 **인용 범위를 좁혔다** —
> 그 사건이 세운 원칙은 "막는 쪽은 무지하게, 푸는 쪽만 정밀하게" 라는 **security 게이트
> 설계** 원칙이지, 일반 코드 중복을 문서상 어떻게 나눌지의 기준이 아니다. 이 분리 결정은
> 그 인용 없이도 성립한다 — 코드베이스·언어·실패 모드가 다르다는 독립 근거가 있다.
> consistency rationale-continuity 관찰.)

## Rationale

**왜 P3.** 활성 결함이 아니다. drift 는 매번 테스트가 잡았고(§M 에서도 `_SPLIT_MARKER` 는
IndexError 로, `_BLIND_PATTERN` 은 frozen-pin 으로 즉시 발각됐다), 비용은 "편집 시 4곳" 뿐이다.

**왜 그래도 티켓인가.** 세 번 반복됐다는 관찰 자체는 옳고, 네 번째가 오면 그때는 안전망이
없는 자리가 생길 수 있다. 최소한 (A) 는 해두는 것이 맞다 — **왜 복제인지**가 코드에 없으면
다음 사람이 "정리" 라는 이름으로 (C) 를 해버릴 수 있다.
