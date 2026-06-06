# Plan 정합성 검토 결과

검토 모드: `--impl-prep`
대상 스코프: `spec/5-system/14-external-interaction-api.md`
트리거 plan: `plan/in-progress/exec-park-b2a-followup.md` (worktree `exec-park-b2a-followup-9fdefc`)
검토 일시: 2026-06-06

---

## 발견사항

### [WARNING] `spec-fix-eia-token-error-codes.md` 의 미해결 결정과 §8.3 충돌 가능

- **target 위치**: `plan/in-progress/exec-park-b2a-followup.md` §② "EIA §8.3 토큰 검증 확인" — `iext_*` secret 이 글로벌인지 trigger 별인지 §8.3 를 명확화(spec 갱신 예정)
- **관련 plan**: `plan/in-progress/spec-fix-eia-token-error-codes.md` §2 "SCOPE_MISMATCH HTTP status 정합 (spec 403 vs 구현 401)" — `SCOPE_MISMATCH` 코드/status 를 어떤 방향으로 통일할지 **결정 미완료** (모든 체크박스 미체크, worktree `(unstarted)`)
- **상세**: `exec-park-b2a-followup.md` §②는 §8.3 의 "JWT HS256, secret 은 trigger 별 분리" 서술을 `itk_*`(per-trigger) vs `iext_*`(글로벌 INTERACTION_JWT_SECRET) 로 분리 명확화할 계획이다. `spec-fix-eia-token-error-codes.md` §2 도 같은 §5.1·§3.3 섹션에 `SCOPE_MISMATCH → TOKEN_SCOPE_MISMATCH` 코드명·status 변경 결정이 필요하며, 이 결정이 내려지면 §8.3 에서 token 종류별 scope 검증 서술도 달라진다. 두 수정이 같은 §8.3 / §3.3 인근 본문에 동시 가해지면 충돌하지 않더라도 최종 spec 상태가 예측하기 어려워진다.
- **제안**: target plan(`exec-park-b2a-followup.md`) §② 작업 착수 전, `spec-fix-eia-token-error-codes.md` §2 의 SCOPE_MISMATCH status 결정을 먼저 처리(또는 명시적으로 "§②는 §8.3 scope 검증 서술 변경 없이 비분리 사실 명확화만"으로 범위를 제한)해야 한다. 그렇지 않으면 §② 수정 후 §2 결정에 따라 §8.3 재수정이 발생해 이중 수정이 된다.

---

### [WARNING] `spec-fix-eia-token-error-codes.md` 와의 후속 항목 누락 (terminal revoke 신뢰성)

- **target 위치**: `plan/in-progress/exec-park-b2a-followup.md` §② — §8.3 token 정책 명확화
- **관련 plan**: `plan/in-progress/spec-fix-eia-token-error-codes.md` §3 "terminal revoke 신뢰성 명시" — `NotificationFanout` 의 단일 in-memory RxJS 구독이 fail-open 되는 트레이드오프가 §3.4/§9.3 에 미명시 (모든 체크박스 미체크)
- **상세**: `exec-park-b2a-followup.md` §② 가 §8.3 token 설명을 수정하면, `spec-fix-eia-token-error-codes.md` §3 이 목표하는 §3.4/§9.3 신뢰성 기술과의 내적 일관성을 확보해야 한다. §3 이 미해결 상태에서 §8.3 을 수정하면 spec 전체의 revoke/token 정책 서술이 단편화될 위험이 있다.
- **제안**: `spec-fix-eia-token-error-codes.md` 의 나머지 항목들과 함께 처리하거나, §② 수정 범위를 §8.3 의 토큰 분류(secret 출처) 명확화로 한정하고 revoke 신뢰성 서술은 `spec-fix-eia-token-error-codes.md` §3 에 위임한다는 경계를 plan 에 명시해야 한다.

---

### [INFO] `fix-webchat-sse-field-map.md` 의 EIA §6.2/§6.5 비차단 followup 잔존

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §6.2/§6.5 SSE wire 필드 note
- **관련 plan**: `plan/in-progress/fix-webchat-sse-field-map.md` §비차단 followup — "EIA §6.2 drift (W-1/I-1): §6.2 abstract jsonc 블록을 wire 로 교체하는 정식 EIA 이슈는 backlog", "이중 SoT 문구(W-4): EIA §6.2/§6.5 의 소유 영역 명확화 다듬기"
- **상세**: target plan(`exec-park-b2a-followup.md`) §② 가 §8.3 만 수정하므로 §6.2/§6.5 와 직접 충돌은 없다. 그러나 `fix-webchat-sse-field-map` plan 이 in-progress 상태를 유지하는 이유가 이 §6.2/§6.5 followup 때문임을 인지하고, target plan 이 EIA 전반을 재검토할 때 해당 섹션을 건드리지 않도록 범위를 명시해야 한다.
- **제안**: `exec-park-b2a-followup.md` §② 에 "§6.2/§6.5 는 fix-webchat-sse-field-map followup 대상, 본 항목은 §8.3 한정" 을 명기하면 경합 리스크를 완전히 제거할 수 있다.

---

### [INFO] `spec-sync-external-interaction-api-gaps.md` 의 미구현 항목 중복 수정 가능성

- **target 위치**: 해당 없음 (target plan §②는 구현 갭이 아닌 spec 서술 명확화)
- **관련 plan**: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — backoff 배율·분산 SSE·rate-limit·getStatus placeholder 등 미구현 surface 추적. worktree `spec-sync-audit`(STALE — §stale skip 목록 참조).
- **상세**: target plan 이 §8.3 만 수정하므로 `spec-sync-external-interaction-api-gaps.md` 와의 직접 충돌은 없다. 단, 이 plan 이 가리키는 `spec-sync-audit` worktree 는 이미 STALE (PR #440, #443 MERGED) 이라 실질적 active 작업이 없다. 추적 plan 자체를 cleanup 해야 할 수 있다.
- **제안**: `spec-sync-external-interaction-api-gaps.md` 의 worktree 를 `(unstarted)` 로 갱신하거나, 미구현 항목이 다른 plan/PR 에 흡수됐는지 확인 후 plan 상태를 정리한다.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 §worktree stale 판정 으로 skip 된 항목:

| worktree | branch | 판정 근거 |
|---|---|---|
| `spec-sync-audit` | `claude/spec-sync-audit` | Step 2 PR #440 MERGED + PR #443 MERGED — squash merge 로 Step 1 ACTIVE 이지만 모든 PR 종결. STALE 처리. |
| `fix-webchat-sse-field-map-22cd94` | `claude/fix-webchat-sse-field-map-22cd94` | Step 2 PR #491 MERGED. STALE 처리. |
| `exec-park-b2a-followup-9fdefc` | `claude/exec-park-b2a-followup-9fdefc` | 현재 target worktree. Step 1 에서 ancestor 판정(no diverged commits yet)이나 PR 없음. 대상에서 제외(자기 자신). |

`spec-sync-audit` 및 `fix-webchat-sse-field-map-22cd94` worktree 가 물리적으로 남아있지 않음(`.claude/worktrees/` 에 미존재 — `git worktree list` 기준). 단, `claude/spec-sync-audit` 브랜치 자체는 remote 에 존재하므로 필요하면 `git branch -d claude/spec-sync-audit` 로 로컬 정리. PR 머지로 실질 작업은 종결됨.

---

## 요약

`exec-park-b2a-followup.md` 의 §② (EIA §8.3 토큰 검증 명확화) 는 `spec-fix-eia-token-error-codes.md` 에서 **결정 미완료** 상태인 SCOPE_MISMATCH status·코드명 통일 결정(§2) 및 terminal revoke 신뢰성 명시(§3)와 같은 §8.3·§3.3·§3.4 인근 영역을 동시에 수정하는 위험이 있다. 직접 worktree 충돌은 없으나(no other active worktree touches `14-external-interaction-api.md`), 미완료 결정을 우회하는 편향이 생길 수 있다. worktree 충돌 후보 2건(spec-sync-audit, fix-webchat-sse-field-map)은 stale 판정으로 skip, active 0건.

---

## 위험도

LOW
