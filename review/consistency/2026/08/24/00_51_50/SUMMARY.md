# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — 5개 checker(cross_spec/rationale_continuity/convention_compliance/plan_coherence/naming_collision) 전원 CRITICAL 0건. 잔존 WARNING 1건은 기존 라운드(`23_29_27`)에서 이미 발견돼 planner 소관으로 plan 트래커에 등재·defer 된 항목의 재확인이며, 이번 라운드의 신규 발견이 아니다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `toFanoutEnvelope` 파이프라인에 신설된 `allowlistFanoutNodeOutput` 단계가 `egress-masking.md` §2 의 3단계 순서 서술에 반영되지 않음 | `spec/5-system/6-websocket-protocol.md` §4.4 / `spec/5-system/14-external-interaction-api.md` §R17 | `spec/conventions/egress-masking.md` §2 (`strip → attachRoutingContext` 3단계로 낡음), §1 좌표계 표 4행 소비처 | planner 턴에서 `egress-masking.md` §2 순서 문장에 단계 추가 + §1 표 갱신. 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(176행)에 planner 소관으로 등재·defer 완료 — 이번 target PR 범위 밖, 추가 조치 불요 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `execution.node.completed`/`.failed` 의 `envelope.output` deny-list 잔여가 spec·코드·plan·테스트 전 문서 간 정확히 일치 | `spec/5-system/14-external-interaction-api.md` §R17 / `6-websocket-protocol.md` §4.4 | 조치 불요 |
| 2 | cross_spec | chat-channel wire 전용 4키(`payload`/`title`/`rendered`/`nodeType`) 추가가 `15-chat-channel.md` §(c) 및 렌더러 코드와 1:1 정합 | `node-output-allowlist.ts` `NODE_OUTPUT_ALLOWED_KEYS` | 조치 불요 |
| 3 | rationale_continuity | SSE/fanout `nodeOutput` allowlist 유예→해소 번복이 실측 근거·취소선 보존·캐너리 테스트 고정 등 "번복 시 새 Rationale 동반" 모범 사례 | `spec/5-system/14-external-interaction-api.md` §R17 | 조치 불요 |
| 4 | rationale_continuity | `conversation-thread.md` §8.4 자기-반증형 소정정이 CLAUDE.md 5조건 전부 충족 | `spec/conventions/conversation-thread.md` §8.4 | `--impl-done` 게이트가 이 spec 파일을 scope 로 포함해 재확인했는지 확인 권장 (본 검토 범위 밖) |
| 5 | rationale_continuity | deny-list→allowlist 전환이 `2-switch.md`/`4-security.md` 기존 원칙과 정합 | `node-output-allowlist.ts` 헤더 주석 | 조치 불요 |
| 6 | rationale_continuity | WS §4.4 "strip-only, 값-마스킹 아님" 원칙이 신규 allowlist 에서도 존중됨 | `spec/5-system/14-external-interaction-api.md` §R17 | 조치 불요 |
| 7 | convention_compliance | 신설 `nodeType` legacy carve-out 과 §4.4 표의 "판별자 래퍼 금지" 서술이 같은 절에서 교차 참조 없이 병존(가독성) | `spec/5-system/6-websocket-protocol.md` §4.4 `buttonConfig.nodeOutput` 행 | 차후 편집 기회에 각주로 carve-out 예외 명시 (이번 diff scope 밖) |
| 8 | convention_compliance | `swagger.md` §1-4 open-map 예외와 정합 — 신규 4키에 DTO/Swagger 갱신 불요 | `spec/5-system/14-external-interaction-api.md` §R17 | 조치 불요 |
| 9 | convention_compliance | `spec-impl-evidence.md` frontmatter 스키마(status/pending_plans/code) 준수 확인 | `spec/5-system/14-external-interaction-api.md` frontmatter | 조치 불요 |
| 10 | naming_collision | `23_29_27` 이후 유일 커밋(`fe4d58de7`)은 보장 범위 정정이며 신규 식별자 미도입 | `spec/5-system/14-external-interaction-api.md` §R17 | 조치 불요 |
| 11 | naming_collision | W1(`nodeType`)/W2(`payload`) disambiguation blockquote 가 현재 HEAD 에도 실존 | `spec/5-system/14-external-interaction-api.md` §R17 | 조치 불요 |
| 12 | naming_collision | `spec/5-system/` 14개 파일 전수 재sweep 결과 `nodeType`/`title`/`rendered`/`payload` 미해소 충돌 없음 | `spec/5-system/*` | 조치 불요 |
| 13 | naming_collision | 신규 함수/상수(`allowlistFanoutNodeOutput` 등) codebase 전체 단일 정의·단일 참조 확인 | `websocket.service.ts` | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | WARNING 1건(egress-masking.md §2 순서 stale, 기 등재·defer) + INFO 2건, CRITICAL 없음 |
| rationale_continuity | NONE | 결정 번복 모범 사례, 자기-반증형 소정정 5조건 충족, 원칙 충돌 없음 |
| convention_compliance | LOW | node-output.md/swagger.md/spec-impl-evidence.md 3개 규약 대조, CRITICAL/WARNING 없음, INFO 3건 |
| plan_coherence | NONE | `spec-sync-external-interaction-api-gaps.md` 정본 트래커와 완전 정합, 잔여 갭 전부 planner 소관으로 명시 위임 |
| naming_collision | NONE | 신규 wire 키 4개 + 신규 함수 전수 재sweep, 미해소 충돌 없음 |

## 권장 조치사항

1. (BLOCK 없음 — 즉시 조치 불요) `egress-masking.md` §2 파이프라인 순서 갱신은 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 planner 소관으로 등재돼 있으므로, 다음 planner 턴에서 §2 문장 + §1 표 4행을 함께 갱신할 것.
2. 차후 `6-websocket-protocol.md` §4.4 편집 기회에 `buttonConfig.nodeOutput` 행에 `nodeType` legacy carve-out 각주를 추가해 교차 오독 여지를 줄일 것 (선택, CRITICAL/WARNING 아님).
3. 현재 diff 는 push 를 진행해도 무방하다.