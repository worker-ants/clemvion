# Consistency Check 통합 보고서 (--impl-prep spec/7-channel-web-chat/)

**BLOCK: NO** (journal 복구 후 재판정) — Workflow raw 반환은 disk-write gap 으로 BLOCK:YES 였으나, 미기록된 `plan_coherence`·`naming_collision` 을 journal.jsonl 에서 복구한 결과 **5개 checker 전부 Critical 0**. 최고 등급은 WARNING 1(pre-existing spec 정밀도).

> **disk-write gap 재판정 근거** ([[feedback_workflow_disk_write_gap_false_counts]]): `plan_coherence`·`naming_collision` 이 `status=success` 인데 output 파일 미기록 → summary 가 "미검증 → 보수적 BLOCK:YES" 로 처리. main 이 journal.jsonl 에서 두 checker 결과를 복구 → 둘 다 INFO 만(Critical 0) 확인 → 실제 BLOCK: NO.

## Critical 위배
없음 (5/5 checker Critical 0).

## 경고 (WARNING)

| # | Checker | 발견 | 조치 |
|---|---------|------|------|
| W1 | cross_spec | widget-app §3.1 "토큰 만료/서버 타임아웃" 행의 "→ 410 Gone" 라벨이 EIA 상태코드 구분과 어긋남 — refresh 실패=401, idle-wait backstop 회수 후 재로드=`200 status:cancelled`, 410 은 §5.3 상 *명령* 응답 전용. 같은 영역 auth-session §3.1 은 정확히 구분. **pre-existing**(내가 미편집한 행), B-2 로 200+cancelled 경로가 새로 관련됨 | **정정**: 해당 행을 auth-session §3.1 을 SoT 로 참조하도록 정밀화(docs commit). PR-1 코드(coalesce/cancel)와는 무관하나 구현자 오독 방지 |

## 참고 (INFO)

| # | Checker | 항목 | 조치 |
|---|---------|------|------|
| I1 | plan_coherence | `spec-draft-webchat-execution-residuals.md` 체크리스트 "commit + PR" stale(#916 머지됨) | `[x]` 갱신 |
| I2 | plan_coherence | eia-command-waiting-surface-guard F-3(외부 EIA 클라 breaking 공지)가 위젯과 잠재 접점 — 위젯은 `isTextInputSurface` 로 이미 방어. 비차단 | 조치 불요(추적성 기록) |
| I3 | plan_coherence | presentation-followups(총개수·카루셀 배너) 미결 결정을 target 이 침범 안 함 | 조치 불요(정합 확인) |
| I4 | naming_collision | `ChatInstance`(SDK) ↔ `WebChatInstance`(콘솔) 명명 근접 — 다른 계층, 실충돌 아님(`Web` 접두 구분) | 조치 불요 |
| I5 | naming_collision | `WEBCHAT_IDLE_TIMEOUT`·EIA-RL-07·이벤트명·env 전량 대조 → **실충돌 0** 확인 | — |
| I6 | convention_compliance | `EmbedConfigDto` 접미사 drift(pre-existing, web-chat 미유발) | 본 PR 범위 밖 |
| I7 | rationale_continuity | §R9-A "옛 gen guard"·§R2 원출처 링크 미부기(비차단) | 여유 시 부기 |

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| cross_spec | LOW | §3.1 "410 Gone" 정밀도 WARNING 1. 그 외 EIA/webhook/engine/data-model 전 영역 정합 |
| rationale_continuity | NONE | 연속성 위반 0. 원문 대조 9건 정확. INFO 2(원출처 링크) |
| convention_compliance | LOW | 규약 광범위 준수. EmbedConfigDto drift INFO(pre-existing) |
| plan_coherence | LOW (journal 복구) | 병렬 plan 충돌 0. INFO 3(체크박스 stale·F-3·presentation) |
| naming_collision | LOW (journal 복구) | 신규 식별자 실충돌 0. INFO 2(명명 근접·id 회피 확인) |

## 결론
BLOCK: NO — 구현 착수 가능. W1(spec 정밀도)은 정정하고, I1(plan 체크박스)은 갱신. 나머지 INFO 는 비차단.
