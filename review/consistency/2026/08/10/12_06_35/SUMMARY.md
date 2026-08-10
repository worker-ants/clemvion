# Consistency Check 통합 보고서 (--spec, 웹채팅 증거 포인터 정정)

- 대상: `spec/7-channel-web-chat/2-sdk.md` (동반 편집 `3-auth-session.md`) · diff-base `origin/main`
- checker 5종 전원 실행.

## BLOCK: NO

Critical 0 · **WARNING 1(반영 완료)**.

## 전체 위험도

**LOW**.

## Critical / 경고

| # | checker | 발견사항 | 조치 |
|---|---------|----------|------|
| 1 | rationale_continuity | **WARNING** — §3 `resetSession` 시퀀스 서술이 `closeStream→clearSession→start` 로 적혀 **이전 execution best-effort cancel 단계를 누락**. `1-widget-app.md` R9-B-1 과 실제 코드(`use-widget.ts`)는 그 단계를 수행한다. 그 단계가 없으면 버려진 execution 이 서버에 남는다(orphan) | **반영** — 시퀀스를 `cancel→closeStream→clearSession→start` 로 정정하고, 발동 조건(확립 세션발일 때만)·optimistic 성질·근거 링크(R9-B-1)를 함께 적었다. **이 변경 이전부터 있던 갭**이지만 같은 파일을 여는 김에 닫는다 |

## 참고 (INFO)

| # | checker | 발견사항 | 조치 |
|---|---------|----------|------|
| 1 | rationale_continuity | 내가 새로 넣은 주석의 "부팅 시도 세대" 어휘가 `3-auth-session.md` §R7 이 **두 번 기각한** "boot 세대로 표면 되감기 방어" 와 인접하다. 코드는 두 축을 분리해 두었으나 spec 층위엔 그 구분이 없었다 | **반영** — 주석에 "여기의 세대는 config 적용 경합만 가르며, R7 이 기각한 축과 다르다" 를 명시. 내가 들여온 어휘라 내가 경계를 그어야 한다 |
| 2 | convention_compliance | `2-sdk.md` 의 Rationale 절 번호가 `R2` 부터 시작(`R1` 없음) | 조치 불요 — 이 변경과 무관한 기존 상태. 번호는 이력이라 소급 재배열이 오히려 인용을 깨뜨린다 |
| 3 | plan_coherence | housekeeping 2건 | 조치 불요 |
| 4 | rationale_continuity · cross_spec | `4-security.md`·`0-architecture.md`·`5-admin-console.md` 등이 예산 초과로 번들에서 절단 | 아래 §번들 참조 |

## checker 별 결과

| checker | 위험도 | 핵심 |
|---------|--------|------|
| cross_spec | **NONE** | 번들 절단분을 **직접 Read 로 보완**해 EIA §4/§5·execution-engine §1.1/§7.4·ai-agent §6.2/§7.10·conversation-thread 등과 대조. API 계약·요구사항 ID·상태 전이·RBAC 전 영역에서 모순 없음 |
| rationale_continuity | **LOW** | 기각된 대안(lazy 시작·localStorage·per_trigger 토큰·`/toggle`)의 무단 재도입 없음. WARNING 1 + INFO 2 |
| convention_compliance | **NONE** | 정식 규약 위반 없음 |
| plan_coherence | **LOW** | 형제 webchat plan 5건과 충돌 없음 |
| naming_collision | **NONE** | 실제 변경분에 신규 식별자·엔티티·endpoint·ENV 키가 **전무**(frontmatter 경로 추가 + 주석뿐) |

## 이 라운드에서 확인된 것

**1. 오늘 머지된 "드롭 자리 표식" 이 실제로 값을 했다.**
번들이 관련 spec 을 대량으로 떨궜고(프롬프트에 생략 표식 **109개**), checker 들이 그것을
**"잘렸다" 로 정확히 읽고 파일을 직접 열어 보완**했다. `#1125` 이전에는 이름표만 남아 한
checker 가 그것을 "미치환 placeholder" 로 **오진해 CRITICAL 을 냈다**(2026-08-06). 자리에
"본문 생략됨 · 원래 N자 · 조립 실패 아님" 을 남긴 것이 오진 대신 보완 행동을 낳았다.

**2. 그래도 절단 자체는 남는다.**
`--spec` 모드 `related_specs` 가 여전히 예산을 넘는다. 이번엔 checker 의 우회가 통했지만
그건 checker 마다 불균등한 완화책이다 — 기등재 항목
(`harness-review-gate-followups.md`)의 근거가 한 번 더 쌓였다.

**3. WARNING 은 내 변경이 만든 것이 아니다.**
`resetSession` 서술 갭은 이 브랜치 이전부터 있었다. 그럼에도 고친 이유는 이 티켓 자체가
**"문서가 가리키는 곳과 실제가 어긋난다"** 를 닫는 작업이고, 같은 파일 같은 절에서 같은
클래스의 갭을 보고 지나치는 것이 앞뒤가 안 맞기 때문이다.
