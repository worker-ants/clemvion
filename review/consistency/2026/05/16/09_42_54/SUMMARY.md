# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 호출자 차단 불필요.

- 검토 대상: `plan/in-progress/spec-draft-ai-thread-source-mark.md`
- 검토 모드: spec draft 검토 (`--spec`)
- 검토 일시: 2026-05-16T09:42:54
- Checker 구성: cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision (전원 success, pending 없음)

## 전체 위험도

**LOW** — CRITICAL·FATAL 발견 없음. WARNING 1건(중복 통합)은 spec 본문에 한 문장 추가로 해소 가능. 나머지는 모두 INFO 수준 형식 보완 제안.

## Critical 위배 (BLOCK 사유)

없음

## 경고 (WARNING)

| # | Checker | 위배 | 위치 | 제안 |
|---|---------|------|-----|------|
| 1 | cross_spec / naming_collision (통합) | `messages[].source: 'live'\|'injected'` 와 `ConversationTurn.source` (5값 ConversationTurnSource)가 동일 필드명 `source` 를 서로 다른 객체·타입으로 사용 — 동일 spec 영역에 두 개념이 공존하여 개발자 혼동 위험 | `spec/5-system/6-websocket-protocol.md §4.4.6` 및 `spec/conventions/conversation-thread.md §5.1 보강 문단(2-A)` | §4.4.6 서두와 §2-A 에 "WebSocket 페이로드 전용 2값 마커이며 `ConversationTurnSource` (내부 5값 enum) 와 구별된다" 한 문장 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `execution.ai_message` 행이 `spec/3-workflow-editor/3-execution.md §8` 과 미동기화 가능성 | §4.1 표 | `3-execution.md §8` 에도 `messages[].source` 언급 추가 |
| 2 | cross_spec | §1-E ↔ §2-A 상호 참조 링크가 두 파일 동시 적용 시에만 유효 | §1-E / §2-A 링크 | 단일 PR/커밋으로 원자 반영 |
| 3 | cross_spec | CHANGELOG 문구가 "정합화" 로 기술되나 실제는 §5.1 에 신규 내용 추가 | §9 CHANGELOG (2-B) | "§5.1 에 emit 레이어 연계 설명 신규 추가" 로 수정 |
| 4 | cross_spec / rationale_continuity (통합) | `messages[].source` DB 영속 여부 미확정 — `output.messages` SoT 원칙과 이력 재구성 시 turn 카운팅 정합성 공백 | "변경하지 않는 부분" 마지막 항 | §4.4.6 또는 conversation-thread §4 에 "이력 재구성 시 source 마커 복원 방침" 명시 |
| 5 | rationale_continuity | 기각 안 2번 "injectedContextLength" 의 "단단한 가정" 표현이 v2 로드맵과 미연결 | §4.4 신규 하위절 / 1-F Rationale | `conversation-thread.md §7 v2 로드맵 "Multi-thread"` 교차 참조 추가 |
| 6 | rationale_continuity | 내부 5값 ConversationTurnSource → 외부 2값 축약 매핑 표가 §4.4.6 에 없음 (산문만 존재) | §4.4.6 | ConversationTurnSource 각 값이 `live`/`injected` 중 어느 것으로 축약되는지 매핑 표 추가 |
| 7 | convention_compliance | plan 문서 내 spec 전문 포함 — spec 반영 후 중복 진실 공급원 위험 | spec-draft 전체 | spec 반영 후 "완료, spec 반영됨" 요약으로 대체 |
| 8 | convention_compliance | cross-reference 앵커가 spec 반영 전 broken link 상태 | §1-E / §2-A 앵커 | spec 반영 완료 후 링크 유효성 검증 |
| 9 | plan_coherence | DB 컬럼 신설 plan 착수 시 `source` 영속 정책 명시 항목 필요 | plan §Open Questions | DB 컬럼 plan 작성 시 `output.messages.source` 영속 항목 추가 |
| 10 | plan_coherence | `ai-agent-tool-connection-rewrite.md` 의 `tool_call` source 신설 결정 후 §4.4.6 예시 재확인 필요 | §4.4.6 | tool source 결정 완료 후 매핑 표 재검증 |
| 11 | naming_collision | §4.4.6 절 번호 신설 시 §4.4.1~§4.4.5 존재 여부 미확인 | §4.4 | spec 반영 전 직접 확인 → **확인 완료**: §4.4.5 가 존재하므로 §4.4.6 안전 |

## 권장 조치사항 (반영 계획)

1. **[WARNING] 반영 예정** — §4.4.6 / §2-A 에 ConversationTurnSource 구분 문장 추가.
2. **[INFO #6] 반영 예정** — §4.4.6 에 ConversationTurnSource → 2값 매핑 표 추가 (`ai_tool` / `system` 의 injected 케이스 명확화).
3. **[INFO #2] 반영 예정** — 두 spec 파일을 같은 커밋으로 원자 반영.
4. **[INFO #3] 반영 예정** — CHANGELOG 문구 보정.
5. **[INFO #1] 반영 예정** — `spec/3-workflow-editor/3-execution.md §8` 도 동시 동기화.
6. **[INFO #5] 반영 예정** — Rationale 기각 안 2번에 v2 로드맵 교차 참조.
7. **[INFO #4 / #9] 부분 반영** — §4.4.6 에 "source 마커 영속 정책은 미정, 이력 재구성 시 누락은 'live' 로 간주" 1줄 추가. DB 컬럼 plan 은 본 작업 범위 밖이므로 plan 의 Open Questions 에 남긴다.
8. **[INFO #11] 확인 완료** — §4.4.6 번호 안전.
9. **[INFO #7]** — spec 반영 후 plan draft 를 요약으로 축약.
10. **[INFO #10]** — tool_call source 결정 후 별도 작업 — Open Questions 에 추가.
11. **[INFO #8]** — spec 반영 후 앵커 유효성 검증 단계 거침.
