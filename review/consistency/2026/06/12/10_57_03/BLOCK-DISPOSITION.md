# consistency-check --spec BLOCK 처분 노트 (PR-B: 1-auth.md 위생)

- 세션: `review/consistency/2026/06/12/10_57_03/` (재검증 2차)
- 1차(`10_47_09`): BLOCK YES, Critical 2건. 2차(본 세션): BLOCK YES, **Critical 1건** (Critical 2 해소됨).
- 처분: **PR 진행** — 잔존 Critical 1 은 git 으로 검증한 false alarm 이며 PR-B 로 해소 불가.

## Critical 처분

### Critical 1 — PR #558(`pr4b-kb-embedding-retire`) stale base → **false alarm (회귀 없음)**
checker 는 OPEN PR #558 이 #552 squash-merge 이전 베이스의 1-auth.md 를 포함해 머지 시
§4.1 Rationale §4.1.A·user.* 정규화·읽기측 계약이 **되돌아간다**고 Critical 판정.

**git 검증 결과 — 회귀 없음:**
- `git log origin/main..HEAD -- spec/5-system/1-auth.md` (pr4b worktree): **commit 0개**.
- `git diff --stat origin/main...HEAD -- spec/5-system/1-auth.md` (3-dot, PR #558 이 *introduce* 하는 실제 변경): **빈 diff (0 변경)**.

→ PR #558 은 1-auth.md 를 **전혀 수정하지 않는다**. 정상 merge 는 branch 가 introduce 한
변경분만 적용하므로(파일 스냅샷 덮어쓰기가 아님) §4.1 을 되돌리지 않는다. checker 의 판정은
2-dot stale-base 뷰(낡은 베이스의 파일 내용)를 "능동적 되돌림 편집"으로 **오해**한 것이다.
본 PR-B 의 결함이 아니며, 남의 branch(PR #558)라 PR-B 에서 해소할 수 없다.

**권고(선택, 기능 무해):** PR #558 을 `origin/main` 에 rebase 하면 stale-base 플래그가
사라진다. rebase 하지 않아도 #558 머지가 §4.1 을 회귀시키지는 않는다(3-dot 검증). 단 PR #558
이 향후 §4.1 의 `model_config.*` 행을 *실제로* 편집하면 그 시점에 PR-B/#554 와 라인 충돌이
생길 수 있으므로, 머지 순서 직렬화 + rebase 시 §4.1.A 보존을 #558 담당자가 확인해야 한다.

### Critical 2 — §1.5.4 `forbidden`/`rate_limited` lowercase 근거 주석 → **해소**
1차 Critical 이었으나, §1.5.4 에 **이미 historical-artifact blockquote 가 존재**했다(checker 가
1차에 놓침 — v1 정착·error-codes.md §3 cross-ref·"신규 코드 선례 금지" 모두 기술). 유효한
잔여 핵심(generic 명칭 `forbidden`/`rate_limited` 의 **초대 흐름 전용 한정** 미명시)만 1절 보강.
재검증 2차에서 **INFO-13 "규약 위반 아님" 으로 강등** → 해소 확인.

## WARNING 처분 (비차단)

- **W-1 reveal 엔드포인트 §5 행 누락**: 의도적 cross-ref 선택. auth-configs API 의 canonical
  catalog 는 `6-config.md §A.4`(reveal 포함 완비)다. §5 에 행을 복제하면 dual-SoT 가 되어
  consistency-check 가 반복 penalize 하는 패턴에 빠진다. 대신 §5 표 직후에 "auth-configs CRUD
  (reveal 포함) 는 6-config.md 가 단일 SoT, 본 문서는 권한·감사만" cross-ref 문단을 추가해
  **discoverability(plan §3 의도)는 충족하되 SoT 중복은 회피**했다.
- **W-2 ip_whitelist fail-closed §2.3 명시**: `auth-config-webhook-followups.md §3` 의 별도
  항목으로, 본 PR-B 의 4개 범위(§5 API·§4.1 시제·prod-guards) 밖. 해당 plan 후속으로 이월.
- **W-3·W-4 WebAuthn availability/credentials 응답 `{data:...}` 래퍼 표기**: §5 의 **기존 행**
  표기 불일치(본 PR 미신설 행). pre-existing 이라 본 PR 범위 밖 — 별도 §5 envelope 표기 정리
  후속으로 이월.

## INFO

INFO 17건은 모두 동기화 편의·선택 보강·정합 확인(충돌 없음)으로 본 PR 범위 밖. 특히 I-10·I-13 은
본 PR 변경(§4.1 시제·§1.5.4)이 **정합 확인됨**을 명시.

## 결론

본 PR-B 의 §4.1 시제 정규화·§5 엔드포인트 보완·prod-guards Rationale·§1.5.4 보강은 모두
현재 main(a17b34c1, #554 포함) 기준 정합하다. 잔존 BLOCK 은 PR #558 stale-base 오해(3-dot
검증상 회귀 없음)이며 PR-B 로 해소 불가하므로, 사용자 인지 하에 PR 진행한다.
