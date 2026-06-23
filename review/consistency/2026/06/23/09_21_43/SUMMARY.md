# Consistency Check 통합 보고서 (--impl-prep spec/7-channel-web-chat/)

**checker 판정: BLOCK: YES (C-1 Critical)** — 단, **C-1 은 main 검증 결과 FALSE POSITIVE** (baseline drift). 아래 참조.

검토 모드: `--impl-prep` · 검토 일시: 2026-06-23

---

## main 검증 (git 실측) — C-1 및 일부 WARNING 은 origin/main baseline drift FP

checker 가 **working tree 가 아니라 origin/main 을 baseline** 으로 비교해, 이미 커밋(`edc233db`·`1716bc63`)된
내용을 "부재"로 오판했다. (`reference_consistency_check_main_baseline_fp` 패턴.)

| 항목 | checker 주장 | git 실측 | 판정 |
|---|---|---|---|
| C-1 (Critical) | `0-architecture §4.1`·`§R8 carve-out` 부재 | working tree line 98(§4.1)·55·165(carve-out) **실재**. origin/main 엔 없음 | **FALSE POSITIVE** |
| W-1 | `NAV-WC-01..06` 부재(dead ref) | `_product-overview.md` 6건 **실재** | FALSE POSITIVE |
| W-3 | 비목표 carve-out 주석 없음 | `_product-overview §2` 에 **실재**(커밋됨) | FALSE POSITIVE |
| W-4 | self-origin 기본값 미기재 | `0-architecture §4` 에 **실재** | FALSE POSITIVE |

→ **C-1 Critical 무효. BLOCK 실질 해소** (working tree 기준 Critical 0).

---

## 실제 actionable (working tree 기준)

| # | 항목 | 조치 | 상태 |
|---|---|---|---|
| W-5 | `_product-overview.md` 헤더 "구성요소 spec" 줄(line 9)에 `5-admin-console` 누락(본문 표엔 있음) | 헤더 줄에 [운영 콘솔] 링크 추가 | 본 턴 처리 |
| W-6 | `channel-web-chat/.env.example:35` basePath `/web-chat/v1/app` ↔ spec `/_widget/web-chat/v1/app` drift | Phase 1(co-deploy) 에서 `.env.example` 정렬 | Phase 1 처리 |
| I-1 | `5-admin-console §2` POST `interaction` top-level ↔ 저장 `config.interaction` 레벨 차이 | §2 비고 한 줄 | 본 턴 처리 |
| I-2 | viewer 스니펫 노출 근거(endpointPath 공개 UUID) implicit | §7 한 줄 | 본 턴 처리 |
| I-8 | `0-architecture` frontmatter `pending_plans` 에 `web-chat-console.md` 미등록 | 추가 | 본 턴 처리 |
| I-9 | plan Phase 0 `EDIT 0-overview §8` 체크박스 `[ ]`(이미 커밋됨) | `[x]` | 본 턴 처리 |

## Follow-up (선재 spec 갭 — console 작업과 무관, 별도 처리)

| W-2 | 위젯 부팅 `GET /api/hooks/:path/embed-config` allowlist 조회 단계가 `3-auth-session §3`·`4-security §3` 에 미문서화. **기존 위젯 동작**(`use-widget.ts:31`)인데 해당 spec 에 누락된 선재 갭 → console 구현과 독립. `plan/in-progress/web-chat-console.md` Follow-up 에 기록, project-planner 후속. |

---

## Checker별
| Checker | 위험도(working tree 보정) | 비고 |
|---|---|---|
| Cross-Spec | LOW | W-1 FP. W-2(선재 갭) follow-up. I-1·I-2 clarity |
| Rationale Continuity | **NONE (C-1 FP)** | C-1·W-3·W-4 모두 baseline drift FP |
| Convention Compliance | LOW | W-5(헤더 링크) real |
| Plan Coherence | NONE | I-8·I-9 minor |
| Naming Collision | LOW | W-6(.env.example) real, Phase 1 |

## 결론
working tree 기준 **Critical 0 → 구현 착수 가능**. 실 actionable(W-5·I-1·I-2·I-8·I-9) 본 턴 spec 정리, W-6 Phase 1, W-2 follow-up.
