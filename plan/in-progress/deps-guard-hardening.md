---
title: 의존성 보안 가드 경화 3건 — 오버라이드 바닥 침식 검출 · audit 수용 근거 규약 · dependabot 되돌림 방지
worktree: (unstarted)
started: 2026-07-31
owner: developer
status: in-progress
priority: P2
spec_impact: none
---

## Overview

`#1034`·`#1036`·`#1038` 세 PR 이 각각 같은 뿌리에서 나온 결함을 고쳤다. 개별 증상은 닫았지만
**재발을 막는 장치가 없다**. 세 건 모두 "사람이 다음에도 똑같이 놓칠 것" 이 확실한 클래스라 자동화한다.

## 1. 오버라이드 바닥이 조용히 낮아지는 것을 검출한다 (P1)

### 관측된 사실

`pnpm-workspace.yaml` 의 `overrides` 는 "이 하한 아래로 내려가지 말라" 는 **보안 바닥** 선언이다.
그런데 그 패키지에 **새 CVE 가 공시되면 바닥이 그대로인 채 취약 버전이 다시 해소**된다. 실측 5건:

| 패키지 | 당시 바닥 | 필요 패치 | 발견 PR |
| --- | --- | --- | --- |
| `next>postcss` | `^8.5.14` | `>=8.5.18` | `#1036` |
| `liquidjs` | `^10.27.0` | `>=10.27.1` | `#1038` |
| `protobufjs` | `^7.6.3` | `>=7.6.5` | `#1038` |
| `fast-uri` | `^3.1.2` | `>=3.1.4` | `#1038` |
| `hono` | `^4.12.21` | `>=4.12.27` | `#1038` |

`pnpm audit` 이 사후에 잡아주긴 하지만, **그때는 이미 취약 버전이 설치 트리에 들어와 있다.**
게다가 audit 게이트가 다른 이유로 이미 빨간불이면 이 신호가 묻힌다(실제로 `#1038` 이전 17건 상태에서
4건이 묻혀 있었다).

### 조치

`scripts/check-pnpm-security-config.py` 에 **"오버라이드 하한 < 알려진 패치 하한"** 검출을 얹는다.

설계 메모 (착수 시 판단):

- 패치 하한을 어디서 얻나 — audit advisory 의 `patched_versions` 를 쓰면 네트워크 의존이 생긴다.
  현행 스크립트는 순수 로컬 스냅샷 대조라 **성격이 다르다**. 별도 스크립트/잡으로 분리할지,
  기존 스크립트에 옵셔널 모드로 넣을지 먼저 정할 것.
- CI 배선은 `deps-security-checks.yml` 의 config-guard 잡 옆에 두는 것이 자연스럽다.
- **주의**: `EXPECTED_OVERRIDES` 2-place 동기화 규약(`PROJECT.md`)을 깨지 않을 것.

## 2. audit 수용(`ignoreCves`) 근거 규약 (P1)

### 관측된 사실

`#1038` 에서 `brace-expansion` CVE 를 "두 경로 모두 dev 전용" 이라는 근거로 수용했는데 **틀렸다** —
세 번째 경로가 프로덕션이었다(`@nestjs-modules/mailer > mjml > … > brace-expansion@2.1.4`,
`@nestjs-modules/mailer` 는 `dependencies`, `mjml` 은 pnpm 이 충족한 optional peer).

원인은 검증 절차 자체였다:

1. `pnpm audit` 출력의 `paths` 를 잘라 보고(`[:3]`) 세 번째 경로를 못 봤다
2. `pnpm audit --prod` 를 **돌리지 않았다** — flag 없는 audit 은 dev/prod 를 구분하지 않는다

리뷰가 잡아 실제 해소로 전환했지만, **다음 사람도 같은 방식으로 틀릴 수 있다.**

### 조치

`ignoreCves` 에 항목을 추가할 때 요구할 근거를 규약으로 명문화한다:

- `pnpm audit --prod` 결과 (해당 CVE 가 prod 트리에 **없음**을 보이는 출력)
- 프로덕션 이미지 실물 확인 (`docker run … ls node_modules/.pnpm/<pkg>@*`)
- 경로를 **자르지 않은** 전체 `paths` 목록

문서 위치 후보: `PROJECT.md` 의 의존성 절, 또는 `pnpm-workspace.yaml` 의 `auditConfig` 주석 블록
(현재도 "수용은 반드시 근거·영향경로·해소 조건과 함께" 라고만 적혀 있어 **무엇이 충분한 근거인지**가
비어 있다). 가능하면 `check-pnpm-security-config.py` 가 신규 `ignoreCves` 항목에 대해 주석에
`--prod` 근거 문구가 있는지 정도는 기계적으로 확인할 수 있는지도 검토.

## 3. dependabot 되돌림 방지 (P2)

### 관측된 사실

`#1034` 가 고친 main 빌드 차단의 근본 원인:

- `5898ae13f` (#1029, **보안 그룹**): postcss `^8.5.14` → `^8.5.18` + lockfile 갱신 → CI success
- `395dedc8b` (#1030, next bump): **#1029 이전 base** 에서 만들어져 postcss 를 `^8.5.14` 로 **되돌림**.
  lockfile 은 `^8.5.18` 인 채 남아 `pnpm install --frozen-lockfile` 이 `ERR_PNPM_OUTDATED_LOCKFILE`
  로 실패 → **main CI failure**

즉 "구 base 에서 만들어진 PR 이 최신 보안 bump 를 조용히 되돌리는" 패턴이다. dependabot 이 group 으로
여러 PR 을 동시에 열면 언제든 재발한다.

### 조치 (택1 또는 병행)

- (a) dependabot 설정에 rebase 전략 강제 — 머지 직전 base 재기준화
- (b) `frozen-lockfile` 검증을 **required check** 로 승격 — 되돌림이 머지 전에 빨간불로 드러난다
- (c) `.github/workflows/` 에 "package.json ↔ lockfile specifier 정합" 전용 경량 잡 추가

(b) 가 가장 직접적이다 — 이번 결함의 발현 지점이 정확히 그것이었다. 다만 현재 `frozen-lockfile` 이
어느 잡에서 도는지(`deps-security-checks.yml` 인지 build 인지) 먼저 확인할 것.

## 체크리스트

- [ ] §1 오버라이드 바닥 침식 검출 — 설계 판단(로컬 vs 네트워크) 후 구현 + CI 배선
- [ ] §2 `ignoreCves` 근거 규약 명문화 (+ 가능하면 기계 검사)
- [ ] §3 dependabot 되돌림 방지 — (a)/(b)/(c) 택일
- [ ] TEST WORKFLOW
- [ ] `/ai-review` + Critical/Warning fix
- [ ] push + PR

## Rationale

`spec_impact: none` — CI·스크립트·설정 변경으로 제품 명세와 무관하다.

**왜 묶었나**: 셋 다 "의존성 보안 상태가 **조용히** 나빠지는" 같은 클래스다. §1 은 바닥이 낮아지는 것,
§2 는 수용 근거가 부실해지는 것, §3 은 이미 올린 bump 가 되돌려지는 것 — 셋 다 사후에 audit 이
빨간불로 알려주지만 그때는 이미 취약 상태다. 한 PR 에서 다루면 "왜 이 셋인가" 가 서로를 설명한다.

**왜 P2 인가**: 현재 audit 게이트는 `#1038` 로 exit 0 이라 **지금 당장 뚫린 상태는 아니다**. 다만
장치가 없으면 다음 CVE 공시 때 같은 일이 반복되고, 그 사이 기간은 아무도 모른다.
