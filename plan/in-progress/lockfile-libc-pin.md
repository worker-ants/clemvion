---
title: lockfile `libc:` 진동 — pnpm 핀을 10.34.5 로 올린다
status: in-progress
owner: developer
worktree: lockfile-libc-oscillation
spec_impact: none
started: 2026-09-25
---

# dependabot 과 사람이 같은 pnpm 으로 다른 lockfile 을 쓴다

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 developer 항목 «lockfile 의 `libc:` 필드가
dependabot 과 고정 pnpm 사이에서 진동한다»(낮음)를 닫는다. 같은 결함을 `plan/in-progress/deps-guard-hardening.md`
§«후속 — lockfile `libc:` 필드가 커밋마다 진동한다» 가 2026-08-09 부터 추적해 왔고, 그 절이 처방 (b)(핀 상향)를
«별도 PR 로 판단» 하라고 남겼다 — 이 PR 이 그것이다.

## A. 측정 — 트래커의 전제 하나가 반증됐다

트래커는 «고정 pnpm 을 Linux 컨테이너에서 돌려도 같은 63줄이 빠진다 — **그러니 dependabot 이 쓰는 pnpm 이 고정
버전과 다르다**» 고 적었다. **아니다.** dependabot 은 고정 버전을 쓴다. 다른 것은 **메타데이터 모드**다.

재연 방법(`scratchpad/libc_probe*.py`): 부모 커밋의 lockfile 에 그 커밋의 매니페스트를 얹어 임시 디렉터리에서
`npx pnpm@<ver>` 로 다시 쓰고, 그 커밋에 **실제로 들어간** lockfile 과 diff 한다.
`manage-package-manager-versions=false` — 켜 두면 pnpm 이 `packageManager`(10.23.0)로 스스로 갈아타 버전
비교가 무의미해진다.

**A-1. 사람 범프(`#1388`, `@nestjs/typeorm` 12) 재연 — `install --lockfile-only`:**

| pnpm | 추가 옵션 | `libc:` | 커밋된 lockfile 과 |
| --- | --- | --- | --- |
| 10.23.0 (현재 핀) | — | 68 → **5** | +10/-72 (부모 대비) |
| **10.23.0** | `minimumReleaseAge=1` | 68 | **동일** |
| 10.23.0 | `minimumReleaseAge=1440` | 68 | **동일** |
| 10.23.0 | `minimumReleaseAge=0` | 68 | +2/-2 |
| 10.23.0 | `full-metadata=true` | **5** | +5/-93 |
| 11.25.0 (dependabot 이미지의 전역 pnpm) | — | **5** | +2/-65 |
| 11.25.0 | `minimumReleaseAge=1` | 68 | +2/-2 |
| 10.28.1 | `minimumReleaseAge=1` | 68 | +3/-3 |
| 10.34.5 | — | 68 | +3/-3 |
| 10.34.5 | `minimumReleaseAge=1` | 68 | +3/-3 (**위 행과 바이트 동일**) |

- dependabot 의 바이트를 재현하는 것은 **`packageManager` 의 10.23.0 + release-age 게이트**뿐이다. dependabot-core 는
  `packageManager` 버전을 설치하고(`package_manager.rb` `setup`), 명령에 `--config.minimumReleaseAge` 를 붙이는
  경로가 있다(`pnpm_lockfile_updater.rb`). 게이트는 게시 시각이 필요해 **full packument** 를 받는데, `libc` 는 full
  packument 에만 있다(`deps-guard-hardening.md` 의 2026-08-09 실측). `full-metadata=true` 는 `libc` 를 쓰지 않았다 —
  그 절의 실측과 같다.
- 11.25.0 은 게이트가 있어도 importer peer 표기 2줄이 달라 재현하지 못한다 — 전역 pnpm 이 아니라 핀이 쓰인다는 뜻이다.
- **축은 둘이다**: `libc:`(63줄) 와 순환 peer 의 접미사 표기(`eslint-plugin-import` ↔ `eslint-import-resolver-typescript`,
  3줄). 이력으로 확인했다 — dependabot 커밋은 짧은 표기 8 · 긴 표기 4 로 한결같고, 사람 커밋(`1b17701aa` 10.23.0,
  `2886910de` 10.34.5)은 5 · 7 이다(`scratchpad/peer_suffix_history.py`, 25개 커밋).

**A-2. 경계** — 10.23.0 과 10.34.5 사이를 이분해 **사람 경로(게이트 없음)** 가 `libc:` 를 지키는 첫 버전을 찾았다:
10.28.1 은 5 로 빼고 **10.28.2** 부터 68 을 지킨다(10.29.1 · 10.29.2 · 10.30.0 · 10.30.3 · 10.31.0 도 68).

**A-3. 핀을 올린 뒤에도 양쪽이 갈리는가** — 10.34.5 에서 사람 경로와 dependabot 경로를 나란히 돌렸다:

| 명령 | 게이트 없음 vs `minimumReleaseAge=1` |
| --- | --- |
| `install --lockfile-only` (사람) | **0줄 차이** |
| `update next@16.3.5 --lockfile-only --no-save -r` (dependabot 명령) | 2줄 — `caniuse-lite` 해소 하나(게이트가 방금 게시된 버전을 거른 것, 직렬화가 아니다) |

10.34.5 에서는 메타데이터 모드가 직렬화를 바꾸지 않는다. dependabot 이 핀을 따르므로 **핀을 올리면 두 축이 함께
닫힌다.** 현재 lockfile 은 10.23.0 + full 형태라, 다음 재해소 때 peer 접미사 3줄이 **한 번** 긴 표기로 바뀐다 —
변경이 없으면 10.34.5 는 lockfile 을 다시 쓰지 않는다(no-op 재연 **동일**).

## B. 처방

| 파일 | 변경 |
| --- | --- |
| `package.json` | `packageManager: pnpm@10.23.0` → **`pnpm@10.34.5`**. corepack(Dockerfile 셋) · `pnpm/action-setup`(CI) · 로컬 pnpm 10 의 자동 전환 · dependabot 이 모두 이 값을 읽는다 |
| `codebase/frontend/Dockerfile.playwright-e2e` | corepack 폴백 `npm i -g pnpm@10.23.0` → `10.34.5` + «`packageManager` 와 함께 올린다» 주석 |

**왜 10.34.5 인가** — 사람 경로 보존은 10.28.2 부터지만, **두 경로의 바이트 동일**(A-3)을 잰 것은 10.34.5 다. 잰 것을 고른다.
10.x 의 최신 패치이기도 하다. 11.x 는 메이저라(설정 · 기본값 변경) 이 PR 의 축이 아니다.

**가드를 새로 세우지 않는 이유** — `deps-guard-hardening.md` 는 (b) 의 동반으로 «`libc:` 개수 회귀 가드» 를 적었다.
두 가지가 바뀌었다. (1) 두 작성자가 이제 **같은 핀 · 같은 직렬화**를 공유해 진동의 원인이 사라진다. (2) **개수**
가드는 틀린 모양이다 — 의존성을 빼면 정당하게 줄어든다. 정확한 불변식은 «base 와 head 에 **둘 다 있는** `name@version`
엔트리의 `os` · `cpu` · `libc` 가 같다» 다(npm 버전은 불변이라 오탐이 원리적으로 없다). 그 설계를 그 절에 적고
체크박스는 열어 둔다 — CI 에 base lockfile 을 가져오는 잡이 필요해 이 PR 의 축이 아니다.

## C. 검증

- [x] 사전 일관성 검토 — spec 영역이 없는 변경(spec-linked 0건 실측)이라 `--impl-prep` 의 scope 가 성립하지 않는다.
      이 plan 을 target 으로 `--plan` → `review/consistency/2026/09/25/11_14_19` **BLOCK: NO · Critical 0 · Warning 0 ·
      INFO 4**(target 본문 5/5 적재 확인). INFO 3 · 4(아래 마지막 항목을 세 갈래로 · 원문 보존)는 반영했다
- [x] 로컬: 핀 적용 뒤 저장소 안 `pnpm --version` 이 10.34.5(corepack 이 받아 자동 전환) · `pnpm install --frozen-lockfile
      --strict-peer-dependencies` exit 0 · lockfile 무변경. 빌드가 차단되는 패키지 목록이 10.23.0 과 **같은 6개**
      (`@google/genai` · `@parcel/watcher` · `@scarf/scarf` · `msgpackr-extract` · `protobufjs` · `unrs-resolver`), 허용 목록의
      `isolated-vm` · `bcrypt` 가 실제로 로드된다
- [x] TEST WORKFLOW — lint PASS · unit PASS · build PASS(backend · frontend 이미지 빌드 + 위생 스모크) · e2e PASS(380).
      backend builder 단계와 `Dockerfile.playwright-e2e` 이미지 안에서 `pnpm --version` = **10.34.5** 를 따로 확인했다
      (run-test.sh 는 Playwright 이미지를 빌드하지 않는다)
- [x] CHANGELOG 항목(배포 의존성 변경)
- [ ] `/ai-review`
- [ ] 처분 세 갈래(`--plan` INFO 4 — 한 줄로 뭉개면 둘째 체크박스까지 오체크한다):
  - `spec-draft-nullable-notation-followups.md` 의 이 항목 — `[x]` + 종결 메모(반증된 전제 포함)
  - `deps-guard-hardening.md` 첫 체크박스(진동을 한쪽으로 고정) — `[x]`, (b) 채택 근거 A-1 · A-3
  - 같은 절 둘째 체크박스(개수 회귀 가드) — **`[ ]` 유지.** 원문은 취소선으로 남기고(`--plan` INFO 3 — 그 문서의
    관례) §B 의 불변식을 **축약 없이** 인용으로 덧붙인다(INFO 2)
