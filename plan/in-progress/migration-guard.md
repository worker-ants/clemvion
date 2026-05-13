# Migration V번호 가드 도입

## 배경

여러 PR 이 병렬로 진행될 때 Flyway 의 `V<번호>` 가 같은 번호를 동시에 점유할 수 있다. 사후에 발견되면 한쪽 PR 의 마이그레이션 V번호를 재할당해야 하며, 운영 사고로 이어지면 `flyway repair` 까지 필요해진다. 이를 PR CI 단계에서 fail-fast 로 잡아낸다.

## 도입 산출물

- [x] `scripts/check-migration-versions.py` — V번호 중복·단조성·연속성·`.conf` 페어 검사. python3 표준 라이브러리만 사용.
- [x] `.github/workflows/migration-check.yml` — `pull_request` 이벤트에서 위 스크립트를 실행. `actions/checkout@v5` (fetch-depth: 0) + `actions/setup-python@v6`.
- [x] `.github/workflows/migration-recheck-on-main.yml` — `push: branches: [main]` 사후 안전망. `sanity` job (`--base HEAD~1` 전수검사) + `nudge-open-prs` job (열린 migration PR 자동 코멘트).
- [x] `.github/PULL_REQUEST_TEMPLATE.md` — Migration checklist 섹션으로 작성자 self-confirmation 강제.
- [x] `spec/conventions/migrations.md` — Flyway 운영 규약 정립. 명명·V번호 정책·append-only·`outOfOrder=false`·CI 가드 + 머지 직전 rebase 규약 + 사후 안전망·새 마이그레이션 추가 절차·폐기 대안 (branch protection 포함).
- [x] `spec/0-overview.md` §8 문서 맵 — 기존 `conventions/` 행이 이미 존재해 추가 변경 불필요.

## 검증

- `python3 scripts/check-migration-versions.py --base origin/main` (worktree): exit 0, 40 migrations, max V040.
- 임시 dry-run 케이스 4종:
  - 중복 (V040 dup) → exit 1, `FAIL: V040 is duplicated`.
  - gap (V042 only) → exit 1, `FAIL: V042 leaves a gap (expected V041 ...)`.
  - 정상 (V041 add) → exit 0.
  - `.conf` mismatch (V041__correct.sql + V041__wrong_name.conf) → exit 1, `FAIL: V041 .conf base name does not match its .sql`.
- `python3 scripts/check-doc-links.py` — spec/ 내부 cross-link 정합성 확인.

## 사용자 수동 작업 (본 PR 외)

- 없음. (이전 안: branch protection 의 "Require branches to be up to date" 옵션 활성화. → 본 repo 가 무료 플랜의 private 저장소여서 해당 옵션 / `gh api` CLI 모두 사용 불가로 폐기. §6.2 의 작성자 책임 규약 + §6.3 의 `migration-recheck-on-main` 사후 안전망으로 대체. 향후 유료 플랜 전환 시 §7 대안 4 의 승격 절차 참고.)

## 결정 기록

- **setup-python 메이저**: v6 채택. 2026-05 시점 최신 메이저로 확인 (https://github.com/actions/setup-python/releases). 본 repo 의 `actions/checkout@v5` 와 메이저 라인 일관.
- **타임스탬프 prefix / `outOfOrder=true` / Merge Queue** 는 모두 폐기. 근거는 `spec/conventions/migrations.md` §7.
- **Branch protection 의존 제거 (2026-05-13)**: 무료 private 저장소 호환을 위해 머지 race 안전망을 §6.2 (운영 규약) + §6.3 (`migration-recheck-on-main` 워크플로) + PR template 의 Migration checklist 다층 방어로 교체. branch protection 자체는 §7 대안 4 로 격하 — 유료 전환 시 재승격 후보.
- 본 스크립트는 V번호 충돌·연속성에 집중하고, **내용 변경 (append-only 위반)** 은 Flyway checksum 검증 + 정책 문서로만 다룬다. (Git diff 기반 내용 변경 감지를 가드에 넣을 수도 있지만 false positive 가 잦아 현재 단계에서는 보류.)

## Follow-up

- 작업·검증 완료 후 `plan/complete/` 로 `git mv`.
