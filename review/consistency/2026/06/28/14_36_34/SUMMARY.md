# Consistency Check 통합 보고서 (--impl-prep)

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능.

검토 모드: `--impl-prep spec/7-channel-web-chat/`
일시: 2026-06-28 14:36:34

## 전체 위험도
**LOW** — WARNING 4건. 본 batch 대응:

| # | Checker | 위배 | 처리 |
|---|---------|------|------|
| W-1 | Cross-Spec | `0-architecture §3` EIA 매핑 표에 `execution.message` 행 누락 | **defer** — pre-existing(본 batch 0-architecture 미편집), planner followup |
| W-2 | Cross-Spec | EIA §6.2 wire 필드 drift "별도 backlog" | **defer** — EIA spec(5-system) 영역, 본 batch 밖 |
| W-3 | Convention | `embed-config.dto.ts` 가 swagger `*-response.dto.ts` 미준수 | **defer** — pre-existing(JSDoc 만 추가, 파일명 무변경). DTO 리네임은 범위·위험 → 별도 followup/예외 등록 |
| W-4 | Rationale | `5-admin §2` `[0-architecture R5]`(client-consumer)가 D-phase 재번호화 후 `§R2` 여야 함 | **본 PR 수정** — 63·244행 R5→§R2. §R5 carve-out(170·285)은 정확하므로 유지 |

> 추가: I-4(0-overview §6.1 ✅ vs NAV-WC-06 🚧 라이브 미리보기 불일치) — 본 batch 의 0-overview 이동이 유발 → **이동 revert(보류)**. NAV-WC-06 동시 정합 필요한 별도 항목.

## 참고 (INFO) — 비차단
I-1~I-3·I-5~I-10: sendMessage payload schema·내부 참조 링크·EIA §8.4 이중기술·id area-prefix·Overview 헤딩 등 — 전부 선택/pre-existing.

## Checker별 위험도
Cross-Spec LOW(execution.message·wire drift) · Rationale LOW(5-admin R5→R2, 본 PR 수정) · Convention LOW(embed-config 파일명, defer) · Plan NONE · Naming NONE.

## 권장 조치사항
1. (본 PR) W-4 5-admin R5→R2 수정.
2. (revert) 0-overview 이동 보류 — NAV-WC-06 동시 정합 별도 항목.
3. (defer) W-1 execution.message 행 · W-3 embed-config 리네임 · W-2 EIA §6.2 — pre-existing planner followup.
