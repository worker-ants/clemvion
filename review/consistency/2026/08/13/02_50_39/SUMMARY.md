# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 Critical 없음(cross_spec MEDIUM / rationale_continuity LOW / convention_compliance NONE / plan_coherence LOW / naming_collision NONE). 모든 checker 전문을 인라인으로 확보했으며 재시도 필요 항목 없음.

## 전체 위험도
**MEDIUM** — CCH-SE-02(chat-channel update dedup) 구현 자체는 정합적이나, 신규 Redis 키의 §9.1 네이밍 규약 미해소를 "이미 해소됨"으로 처분한 code-review RESOLUTION 의 근거(PR #1160)가 실측 결과 아직 미병합이라 그 처분이 시기상조이며, data-flow 미러 문서 갱신 누락·spec Rationale 미기재·절차 우회(developer 턴의 spec 직접 재작성) 등 문서 정합성 공백이 네 곳에서 확인됨.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | Redis 키 네이밍 컨벤션(§9.1) 미해소 — 이를 "조치 불요"로 처분한 code-review RESOLUTION(항목4)의 근거(PR #1160)가 `gh pr view 1160` 실측 결과 **아직 OPEN(미병합)** | `spec/5-system/15-chat-channel.md:88` (CCH-SE-02 신규 키 `cc:dedup:<triggerId>:<updateId>`) | `spec/5-system/4-execution-engine.md` §9.1/§9.2 (Redis 키 네이밍 SoT — "모든 Redis 키는 `{service}:{workspaceId}:{resource}:{id}:{sub}`") | PR #1160 병합 전까지는 RESOLUTION 의 "조치 불요" 문구를 "PR #1160 병합 후 해소 예정(그 전까지 §9.1 위반 유지)"으로 정정하거나, §9.1/§9.2 에 chat-channel 전역(워크스페이스 비종속, per-trigger 스코프) 키 예외를 `exec:recover:lock` 등과 동일 방식으로 즉시 명시. 두 PR 간 머지 순서 의존성 존재 |
| 2 | cross_spec | data-flow 미러 문서가 새 dedup 게이트(Redis 키 + 파이프라인 순서)를 반영하지 않음 — 스스로 "source→sink 단일 진실" 이라 선언한 문서에 발생한 갭 | `spec/5-system/15-chat-channel.md:88` (CCH-SE-02) + `hooks.service.ts:328-345` | `spec/data-flow/14-chat-channel.md` §1.1 (inbound sequence diagram) / §2.2 (Redis 스키마 매핑 표) | §1.1 시퀀스에 dedup 단계(parseUpdate 이후·lookup 이전) 추가, §2.2 표에 `cc:dedup:{triggerId}:{idempotencyKey}`(TTL 30s) 행 + (기왕이면) `cc:rl:{triggerId}:{conversationKey}` 행 추가 |
| 3 | rationale_continuity | CCH-SE-02 메커니즘이 "EIA `Idempotency-Key` 자동 발급"에서 독자 `ChatChannelDedupService`(별도 네임스페이스·TTL·트리거 지점)로 실질 전환됐는데, 근거가 CHANGELOG/코드 주석에만 있고 spec canonical `## Rationale` 에는 미반영 | `spec/5-system/15-chat-channel.md` §3.4 CCH-SE-02 행 | `spec/5-system/15-chat-channel.md` `## Rationale`(R1~R9, R-CC-10~19) — 신규 전환에 대응하는 항목 없음 | `## Rationale` 에 신규 `R-CC-2x` 추가: (a) in-process trusted caller(EIA-AU-08)가 `IdempotencyInterceptor` 를 우회하는 구조적 이유, (b) 별도 dedup 서비스 신설 이유, (c) 원문이 EIA 재사용을 전제로 오도적이었다는 점. CHANGELOG 근거 그대로 옮기면 충분 |
| 4 | plan_coherence | plan 이 "planner 결정" 으로 명시 게이팅한 항목(dedup 구현 여부)을 developer 성격의 구현 커밋이 같은 턴에서 자체 결정하고 spec 문면(CCH-SE-02)까지 재작성 — CLAUDE.md "구현 중 spec 변경 필요 시 developer 는 멈추고 planner 위임" 규칙 이탈. 병렬 code review 가 독립 포착·"되돌리지 않기로" 인정했으나 그 인정이 plan 파일 자체에는 반영 안 됨 | `spec/5-system/15-chat-channel.md` CCH-SE-02 행(L88) · `spec/4-nodes/7-trigger/providers/telegram.md` L232-236 | `plan/in-progress/backend-lint-gate-broken-on-main.md` L621-644 (특히 L631-632 "착수 시... planner 결정이다") | 내용(구현 선택) 자체는 되돌릴 필요 없음(필수 요구사항 미이행을 메우는 보수적 선택, CRITICAL 없음 확인됨). 짧은 project-planner 턴으로 사후 추인하거나, 최소한 plan 체크리스트 항목(L634)에 `review/code/2026/08/13/02_38_41/RESOLUTION.md` WARNING #1 포인터를 추가해 "developer 턴에서 spec 을 직접 고쳤다"는 절차상 사실을 plan 자체에 남길 것 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | §7 "구현 파일 구조" 코드 트리에 `chat-channel-dedup.service.ts` 누락 (형제 `chat-channel-rate-limiter.service.ts` 도 기존 누락 — pre-existing gap 반복) | `spec/5-system/15-chat-channel.md:471-493` | 트리에 두 파일 추가 |
| 2 | cross_spec | developer 턴에서 `spec/` 직접 수정 — 이미 커밋 메시지·RESOLUTION 에 자체 인지·수용 기록됨 | `15-chat-channel.md`(commit `312d1d990`), `providers/telegram.md`(commit `faf6a7b1e`) | 조치 불요(이미 처분·기록됨). 향후 세션에서 습관화하지 않도록 참고만 |
| 3 | convention_compliance | CCH-SE-02 표 행이 형제 행(CCH-CV-03/CCH-NF-03)의 `<br>구현: [file.ts](path)` 링크 패턴을 따르지 않고 inline 텍스트로만 서술 | `spec/5-system/15-chat-channel.md` §3.4 CCH-SE-02 행 | `<br>구현: [chat-channel-dedup.service.ts](...)` 링크 추가 (강제 규약 아님, 가독성 제안) |
| 4 | plan_coherence | frontmatter `pending_plans` 가 이미 `plan/complete/` 로 이동된 `spec-sync-chat-channel-gaps.md` 를 여전히 참조 (본 diff 이전부터의 선재 상태, 본 diff 는 건드리지 않음) | `spec/5-system/15-chat-channel.md` frontmatter `pending_plans:` (L23) | 이번 PR 의 blocking 사유 아님. 다음 planner 편집 시 목록에서 제거(하우스키핑) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | §9.1 Redis 키 네이밍 미해소(처분 근거 PR 미병합) + data-flow 미러 문서 dedup 게이트 미반영 |
| rationale_continuity | LOW | dedup 메커니즘 전환의 근거가 spec `## Rationale` 에 미기재(CHANGELOG/코드 주석에만 존재) |
| convention_compliance | NONE | 명명·frontmatter·API 문서·금지 패턴 전 관점 위반 없음. INFO 1건(표 서술 스타일)만 |
| plan_coherence | LOW | "planner 결정" 게이팅 항목을 developer 턴이 같은 커밋에서 자체 종결(내용은 정당, 절차만 이탈) |
| naming_collision | NONE | 신규 식별자 6종(클래스/함수/상수/Redis 키/DI 토큰/파일 2건) 전수 grep, 충돌 없음 |

## 권장 조치사항
1. `review/code/2026/08/13/02_38_41/RESOLUTION.md` 항목4의 "PR #1160 이 해소함" 처분 문구를 "PR #1160 병합 전까지는 §9.1 위반 상태 유지" 로 정정 — 근거가 실측상 사실이 아니므로 우선 처리.
2. `spec/data-flow/14-chat-channel.md` §1.1/§2.2 에 dedup 단계·Redis 키 매핑 추가.
3. `spec/5-system/15-chat-channel.md` `## Rationale` 에 CCH-SE-02 메커니즘 전환 근거(R-CC-2x) 추가.
4. `plan/in-progress/backend-lint-gate-broken-on-main.md` 해당 체크리스트 항목에 절차 이탈 사실(developer 턴에서 spec 직접 재작성) 포인터 한 줄 추가.
5. (선택, 하우스키핑) §7 구현 파일 트리에 신규 파일 2종 추가, CCH-SE-02 행에 구현 링크 추가, frontmatter `pending_plans` 정리.
