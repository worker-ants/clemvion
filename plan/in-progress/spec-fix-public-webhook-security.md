---
worktree: claude/channel-web-chat-followups-1feff2
started: 2026-06-02
owner: resolution-applier
---
# Spec Fix Draft — public-webhook security notes

## 원본 발견사항

SUMMARY#W2: Fixed-Window 경계 버스팅 — 윈도우 경계에서 최대 2배 트래픽 허용.
  제안: spec 에 fixed-window 버스팅 허용을 명문화; 더 강한 방어 시 sliding-window 전환 검토.

SUMMARY#W5: spec §4 v1 기본인 "동시 ≤3 캡" 미구현 — spec과 코드 범위 간 갭 잔존.
  제안: spec §4에 v1.1 이연 사유 명문화하도록 project-planner 위임.

SUMMARY Info#8: spec `2-sdk §1` 메서드 목록에 `off()` 미반영 (코드가 spec 앞서 있음).
  제안: project-planner가 `off(event, cb?)` 추가 및 Rationale 명문화.

SUMMARY Info#9: spec §4 "메시지 4KB 제한" 적용 레이어 불명확.
  제안: spec에서 적용 레이어(EIA interact vs webhook gate) 명시하도록 위임.

## 제안 변경

### 1. spec/7-channel-web-chat/4-security.md §4

현재 §4 에 v1 기본으로 "동시 ≤3 캡" 이 명시되어 있으나, 대화 종료 신호 연동이 없어 구현 불가.
아래 내용을 §4 본문에 추가:

```markdown
> **v1.1 이연 사항**: 동시 ≤3 캡은 대화 종료 신호(`conversationEnded`) 연동이 필요하며
> 현재 widget SPA 와 backend 간 신호 흐름이 미구현 상태. 구현은 followups 로 이연.
> v1 에서는 분당 시작 rate-limit(10/IP) + 시간당 누적 상한(20/IP) + body 32KB 제한이 적용됨.

> **Fixed-window 버스팅**: v1 은 Redis fixed-window 카운터 사용. 윈도우 경계에서 최대 2배
> 트래픽이 허용되는 버스팅 특성이 있음. rate-limit 은 best-effort defense-in-depth 로 설계 —
> 강한 방어가 필요하면 sliding-window 전환 검토 (followup 후보).

> **메시지 4KB 제한**: 공개 webhook body 크기 제한(32KB) 은 webhook gate 레이어
> (PublicWebhookThrottleGuard) 에서 적용. EIA interact(대화 중 메시지) 에는 별도 body
> 크기 검증 레이어가 없으며, 네트워크·proxy 계층에서 처리.
```

### 2. spec/7-channel-web-chat/2-sdk.md §1

메서드 목록에 `off(event, cb?)` 추가:

```markdown
| `off(event, cb?)` | 이벤트 구독 해제. cb 지정 시 해당 핸들러만, 생략 시 이벤트 전체 해제. |
```

Rationale 에: `on()` 이 `Unsubscribe` 를 반환하므로 편의 목적으로만 필요 — SPA 언마운트 시
이벤트 전체 해제 패턴에 유용. v0.x 시점 추가로 breaking change 없음.

## 상태

- 코드 변경 없음 — spec 문서 변경만 필요.
- project-planner 위임: spec/ 쓰기 권한.
- 개발자 구현: W5 동시 캡 — channel-web-chat-followups.md 에 followup 항목 기존 등재됨.
