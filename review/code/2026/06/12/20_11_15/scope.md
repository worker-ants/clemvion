# 변경 범위(Scope) 리뷰 결과

## 발견사항

### [INFO] `plan/in-progress/spec-sync-chat-channel-gaps.md` — worktree 필드 수정 포함
- 위치: 파일 7, frontmatter `worktree: spec-sync-audit` → `worktree: chat-channel-gaps`
- 상세: worktree 필드가 실제 작업 worktree 명칭과 다르게 기록되어 있어 정정했다. plan lifecycle 규약상 frontmatter 의 `worktree` 필드는 현재 작업 worktree 와 일치해야 하므로 이 수정은 plan 파일 갱신의 필수 부수 작업이다.
- 제안: 범위 내 정당한 수정으로, 별도 조치 불필요.

### [INFO] `spec/5-system/15-chat-channel.md` — spec 갱신은 구현 계약 반영으로 범위 내
- 위치: 파일 16, CCH-CV-03 미구현 주석 제거 및 구현 상태로 교체, §5.4 성공 응답 예시 갱신
- 상세: SDD 규약상 구현 완료 시 spec 본문과 plan 을 동기 갱신해야 한다. 변경된 구현(CCH-CV-03 (b) 분기, §5.4 응답 3필드 동봉)이 spec 에 정확히 반영되었다. spec 표의 "미구현(Planned)" 주석 제거와 구현 현실 기술은 SDD 필수 요건이다.
- 제안: 범위 내 정당한 수정.

### [INFO] `review/consistency/2026/06/12/19_25_12/` — consistency-check 산출물 신규 추가
- 위치: 파일 8~15 (SUMMARY.md, _retry_state.json, convention_compliance.md, cross_spec.md, meta.json, naming_collision.md, plan_coherence.md, rationale_continuity.md)
- 상세: CLAUDE.md 규약상 developer 는 구현 착수 직전 `consistency-check --impl-prep` 을 의무 수행해야 한다. 이 파일들은 그 결과물이며, `review/consistency/` 는 코드 리뷰 산출물 지정 경로이다. 코드 변경과 분리된 파일처럼 보이지만 developer workflow 의 필수 단계 산출물이다.
- 제안: 범위 내 정당한 파일. 단, `_retry_state.json` 은 워크플로우 내부 상태 파일로 일반적으로 커밋 대상이 아닌 경우가 있으나, 이 프로젝트의 `review/` 경로가 gitignored 되지 않으므로 (MEMORY.md 참고: "review/ 는 gitignored 아님") 커밋에 포함하는 것이 규약과 일치한다.

### [INFO] `hooks.service.ts` 주석 확대 — 범위 내 설명
- 위치: 파일 4, 라인 292~301, 라인 510~517, 라인 462~469, 라인 495~504
- 상세: 추가된 주석들은 모두 신규 구현 로직(`getActiveExecutionStatus`, `sendExecutionStillRunningNotice`, `hasActiveExecution` 재정의, CCH-CV-03 (b) 분기)에 직접 귀속된다. 기존 코드에 무관한 주석을 추가하거나 기존 주석을 재포맷하는 변경은 없다.
- 제안: 범위 내 정당한 주석.

### [INFO] `triggers.service.ts` — `TriggerChatChannelHealth` 임포트 추가
- 위치: 파일 6, 라인 1537
- 상세: `rotateBotToken` 반환 타입에 `TriggerChatChannelHealth` 를 사용하기 위한 임포트 추가다. 기존에 사용 중이던 `Trigger` 임포트와 동일 경로에서 named import 로 추가되었으며, 신규 기능(§5.4 응답 타입 확장)에 직접 필요한 임포트이다.
- 제안: 범위 내 정당한 임포트.

### [INFO] `chat-channel.controller.ts` — 반환 타입 `Promise<Awaited<ReturnType<...>>>` 패턴
- 위치: 파일 2, 라인 169
- 상세: `{ rotatedAt: string }` 을 `Awaited<ReturnType<TriggersService['rotateBotToken']>>` 으로 교체했다. 이는 수동 타입 중복을 제거하고 서비스 반환 타입을 단일 진실로 삼는 정당한 타입 동기화이다. §5.4 구현 범위 내 변경이다.
- 제안: 범위 내 정당한 수정.

---

## 요약

16개 파일의 변경 전체가 plan 에 명시된 두 구현 항목(CCH-CV-03 (b) 분기, §5.4 rotate-bot-token 성공 응답 3필드 동봉)에 직접 귀속된다. 코드 변경(hooks.service.ts, triggers.service.ts, chat-channel.controller.ts)은 해당 기능 구현에 필요한 최소 범위이며, 테스트 파일(hooks.service.spec.ts, triggers.service.spec.ts, chat-channel.controller.spec.ts)은 신규 동작을 검증하는 테스트 케이스 추가로 구성되어 있다. spec 갱신(15-chat-channel.md), plan 상태 갱신(spec-sync-chat-channel-gaps.md), consistency-check 산출물(review/consistency/)은 SDD + developer SKILL 규약상 필수 수반 파일이다. 무관한 파일 수정, 불필요한 리팩토링, 요청 외 기능 확장, 의미 없는 포맷팅 변경은 발견되지 않았다.

## 위험도

NONE
