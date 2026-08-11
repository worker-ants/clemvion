# consistency SUMMARY — `13_16_21` (`--impl-done spec/5-system`)

diff-base `origin/main`. checker 5/5 착지 (디스크 파일로 확인).

## BLOCK: NO

Critical **0건**.

| checker | 위험도 | 발견 |
|---|---|---|
| cross_spec | **NONE** | 없음 — CRITICAL·WARNING·INFO 전부 0 |
| naming_collision | **NONE** | INFO 3 |
| convention_compliance | **NONE** | INFO 2 |
| rationale_continuity | **NONE** | WARNING 1 · INFO 1 |
| plan_coherence | LOW | INFO 2 |

## 판정 요지

- **cross_spec**: 6개 spec 파일이 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임
  6축 전부에서 충돌 0. `2-api-convention.md §2.2` 의 RPC sub-channel 예외 표에 세 endpoint 가
  이미 등재돼 있어 API 규약과도 정합. **"매우 깨끗한 spec 동기화 PR"**.
- **convention_compliance**: 세 액션명이 §1 구조 + §2.1 합성 과거분사를 충족.
  `15-chat-channel.md:378` 의 옛 표기(`chat-channel.rotate-bot-token`)는 dot-prefix 미충족 ·
  하이픈 · 감사 모델에 없는 resource 세 가지를 동시에 어겼고, **정정값이 구현과 문자 그대로
  일치**함을 확인 — "정정은 옳다".
- **naming_collision**: 세 문자열·세 상수 키 모두 전역 유일. `integration.rotated` 와는
  resource prefix 와 데이터 모델이 애초에 분리돼 실질 충돌 없음. **직전 스냅샷(11:48:48)의
  유일한 WARNING(`bot_token_rotated` 접두 누락)이 현 target 에서 해소됨을 확인.**
- **rationale_continuity**: 3분리 결정이 **기각된 대안의 무근거 재도입이 아니다** — 결합
  선례(`integration.rotated`)와 분리 선례(`user.*`)를 **둘 다 인용**한 뒤 "폭발 반경" 이라는
  새 축으로 선택했고, 규약은 그 축을 규정한 적이 없다(최초 도입 커밋 `b1b0fa3bd` 확인).
  근거 문장이 커밋 메시지와 동일 문구로 남아 **사후 윤색이 아님**도 확인.
- **plan_coherence**: 체크박스가 실제 상태와 일치, 후속 3건 전부 코드로 재확인해 사실 부합.

## Warning 1건 — 등재 (spec 무수정)

| 출처 | 내용 | 처분 |
|---|---|---|
| rationale_continuity | 신규 Rationale 이 `## Rationale` 헤딩이 아니라 §3 본문 블록쿼트에 있다 | **등재.** 리뷰어 스스로 "이 문서의 기존 관례와 일치, 실질 문제로 보지 않음 · 이번 PR 범위 밖으로 봐도 무방" 으로 판정했다. 배치 관례를 Overview 에 명문화하는 제안은 `spec/` 편집이라 지금 하면 **이 consistency 게이트를 다시 무장시킨다** — 다음 conventions 편집 때 함께 처리 |

## INFO 2건 — **고쳤다** (둘 다 `plan/**` 이라 게이트 무관)

| 출처 | 내용 | 처분 |
|---|---|---|
| plan_coherence | `harness-review-gate-followups.md` 상단 요약이 "이유는 이제 **둘**" 인데 이 PR 이 세 번째를 append 했다 — 내가 만든 drift | **셋**으로 갱신 + 목록에 항목 추가 |
| plan_coherence | `spec-sync-auth-gaps.md` 의 "`rotateBotToken` 은 `@Roles()` 가 없다" 예시가 stale — `#1103`(2026-08-08)이 이미 해소 | 실측(`triggers.controller.ts:239` 에 `@Roles('editor')`) 후 **취소선 묘비** + 해소 출처 명기 |

두 번째는 이 저장소가 반복해 낸 형태다 — **plan 서술은 다른 PR 에 의해 거짓이 될 수 있고,
살아 있는 예시로 읽히면 이미 닫힌 구멍을 다시 조사하게 만든다.**

## 남은 INFO (조치 불요)

`revoked` 가 "재발급" 효과의 절반만 표현한다(convention_compliance — 다만 트레이드오프가
이미 규약에 명문화됨) · `login_history.event` 어휘 유사(네임스페이스 다름) · `trigger` 행이
2행으로 분리(구현 일자 구분 의도가 읽힘).
