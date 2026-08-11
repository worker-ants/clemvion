# consistency SUMMARY — `14_39_42` (`--impl-done spec/5-system`)

델타 = 커밋 `d7c6cf668` 하나. **prettier 줄바꿈 2줄**, `spec/**` 무변경.

## BLOCK: NO

Critical **0건**. checker 5/5 착지, **전원 NONE**.

| checker | 위험도 |
|---|---|
| cross_spec · convention_compliance · naming_collision · plan_coherence · rationale_continuity | **NONE ×5** |

## 왜 라운드를 돌았나

CI lint fix 가 `audit-action.const.ts` 를 건드렸고 그 파일이 **spec-linked** 라 게이트가
재무장됐다. spec 은 한 글자도 안 바뀌었지만 게이트의 계약은 "spec-linked 파일 변경이 fresh
리포트로 덮이는가" 이므로 정규 라운드를 돌았다.

## 확인된 것 — 질문은 하나였다

**액션 문자열 값이 문자 단위로 불변인가.** 바뀌었다면 spec 카탈로그·레지스트리와 어긋나
조회 필터·알림 규칙이 조용히 빗나간다.

- **convention_compliance**: 코드 · `audit-actions.md §3` 레지스트리 · `1-auth.md §4.1`
  카탈로그 **세 지점**을 Python 바이트 단위 대조 — 3종 모두 완전 일치. `§3` 표가
  resource/verb 컬럼을 분리해 dotted-full 표기가 아닌 것도 §1 구조 규약과 부합함을 확인.
- **naming_collision**: whitespace-only 라 **식별자 표면 자체가 없다**. 직전 라운드
  (`13_16_21`)의 "충돌 없음" 판정 근거(`integration.rotated` 접두 분리 ·
  `login_history.event` 테이블 분리)가 흔들리지 않음을 확인.
- **cross_spec**: 런타임 상수 값·API shape·상태 전이·RBAC·계층 책임 어느 것도 안 바뀌어
  cross-spec 충돌 소지 자체가 없다.
- **plan_coherence**: `plan/` `spec/` 를 전혀 안 건드림을 `git diff --stat` 으로 확인.
  체크박스는 여전히 실제 상태와 일치하고, 등재된 후속 3건도 유효. **plan 이 `in-progress`
  로 남는 것이 맞다** — §1.3 LDAP/SAML 등 미해결 항목이 있고 spec frontmatter
  (`status: partial`·`pending_plans`)와도 정합.

## rationale_continuity — 기각 근거가 지어낸 것인지 검증했다

이번 리뷰 라운드에서 maintainability 가 **"80자에 맞추려 키 이름을 줄이자"** 를 기각하며
"sub-channel 을 액션명에 담는 의도적 설계이고 `audit-actions.md §3` Rationale 에 문서화돼
있다" 를 근거로 들었다. **그 근거가 실재하는지** 확인시켰다 — 이 저장소는 지어낸 Rationale
로 지적받은 적이 있다.

**실재한다**: `audit-actions.md §3` L74("셋을 가른 축은 폭발 반경이다")·L76("액션명이
sub-channel 을 담는다") 그리고 코드 주석 L87-88 의 포인터가 **인용된 라인 번호까지 일치**.

> 참고(무조치): 그 문단은 공식 `## Rationale` H2(L84-96)가 아니라 §3 본문 인라인 note 다.
> 다만 "§3 Rationale" 이라는 표기가 이미 코드 주석에서 쓰이는 관용 표현이라 문제로 보지 않음.
