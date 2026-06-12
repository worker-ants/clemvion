---
worktree: chat-channel-followups-batch-de949d
started: 2026-06-12
owner: developer
---

# chat-channel / WORKSPACE 후속 일괄 (그룹 1+2+3)

> 출처: #566 의 ai-review(`review/code/2026/06/12/15_25_55`) + impl-done(`review/consistency/2026/06/12/15_38_35`)
> + #565 consistency 의 잔여 INFO. 사용자 결정(2026-06-12): 그룹 1+2+3 한 PR 로 일괄, 그룹 4(큰 refactor·perf) 제외.

## 그룹 1 — WORKSPACE fix 직결
- [x] G1-1 `15-chat-channel.md` §Rationale R-CC-18 신설 — `401 WORKSPACE_REQUIRED`→`400 WORKSPACE_ID_REQUIRED` 변경 경위 (공용 데코레이터 통일, 3불일치 해소).
- [x] G1-2 `error-codes.md §5 Rename 이력` — retired `WORKSPACE_REQUIRED` 등재 + preamble "외부 노출" 문구를 "client 코드 분기 노출 없음(문서 목록은 동기화)" 로 정확화.
- [x] G1-3 `backend-labels.ts` `ERROR_KO["WORKSPACE_ID_REQUIRED"]` 한국어 라벨 (공용 canonical 코드 — 다수 엔드포인트 공통).
- [x] G1-4 `workspace.decorator.spec.ts` — `code: 'WORKSPACE_ID_REQUIRED'` 필드 단언 + 빈 문자열 헤더(falsy) 케이스 추가.

## 그룹 2 — 인접 chat-channel
- [x] G2-5 `spec-sync-chat-channel-gaps.md` 비고에 §7 동시 갱신 의무(두 spec 동시 갱신) note.
- (제외) chat-channel-adapter §1.2 EiaEvent 주석 EIA §6.2/§6.5 — 검증 결과 인용 정확 = false positive.

## 그룹 3 — 무관 도메인 doc sync (broad impl-done 표면화)
- [x] G3-6 `11-mcp-client.md §3.1` Internal Bridge 표에 `makeshop`/`MakeshopMcpToolProvider` 행 추가 (§2.3 본문·data-model·overview 와 정합).
- [x] G3-7 `1-auth.md §1.1` resend-verification "인증 토큰 24h 유효" §5 와 동기화.
- (skip) G3-8 `1-auth.md §4.1` model_config SoT — line 374 가 이미 `data-flow §1.1` 을 ground truth 로 cross-ref 중 → 이미 충족, 무변경.

## 검증
- [x] TEST WORKFLOW (lint·unit·build·e2e) — 전부 PASS (unit 40·e2e 188). spec-link-integrity 가드가 R-CC-18 의 §1.3 앵커 오기(`인증-인가`→`유효성-검증`) 1건 잡아 수정 후 green.
- [ ] `/ai-review` + Critical/Warning fix (code 변경: backend-labels·decorator spec)
- [ ] `/consistency-check --impl-done` BLOCK:NO (backend-labels.ts 가 i18n-userguide.md `code:` glob 매칭 — SPEC-CONSISTENCY 게이트)

## 그룹 4 (제외 — 별 작업)
- forwardRef 순환 의존 / isolated-vm Isolate pool perf / 10-graph-rag Overview 구조.
