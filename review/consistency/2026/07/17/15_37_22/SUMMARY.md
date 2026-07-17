# Consistency Check 통합 보고서 — `--impl-done spec/7-channel-web-chat/`

**BLOCK: NO**

*5개 checker 전원 실행(cross_spec · rationale_continuity · convention_compliance · plan_coherence · naming_collision). Critical 0.*

## 판정

**Critical 위배 없음 → 진행 가능.** WARNING 1건(두 checker 독립 발견)은 **조치 완료**, 나머지는 전부 INFO 로 target 결함이 아니다.

## Critical

없음.

## Warning

| # | checker | 발견사항 | 처분 |
|---|---------|----------|------|
| 1 | **rationale_continuity · plan_coherence (독립 발견)** | **spec-impl drift**: 이 branch 의 코드 변경이 `seedWaitingFromStatus` 에 terminal 분기를 추가해 **"`200`+종료 REST 분기"를 사실상 구현**했는데, 인접 문서 `spec/7-channel-web-chat/3-auth-session.md §3.1` 의 "v1 구현 현황(부분)" 콜아웃은 여전히 그것을 **"미구현(Planned)"** 이라 선언한다. 더구나 같은 콜아웃의 "종료는 SSE terminal 이벤트(버퍼 5분 내 replay)로 도달한다"는 서술은 **이 PR 이 고친 바로 그 갭**이다(버퍼 만료 시 terminal 이벤트도 함께 유실돼 도달하지 못한다). 두 checker 가 코드 대조로 각각 확인했고, `404`·복구불가 `401`·낙관적 refresh 는 **여전히 미구현이 맞다**는 것도 함께 확인. `/ai-review` 6라운드가 이 지점을 놓쳤다(`06_53_03` requirement 가 이 문서를 대조했으나 다른 문장만 확인). | **조치됨** — 콜아웃을 정정: `200`+종료 분기를 "구현됨"으로 flip 하고, 버퍼 만료 gap 에선 **이 REST 분기가 유일한 종료 도달 경로**임을 EIA `R-replay-unavailable` 링크와 함께 명시. `404`/`401`/낙관적 refresh 는 Planned 유지. |

## 참고 (INFO)

| # | checker | 발견사항 | 처분 |
|---|---------|----------|------|
| 1 | cross_spec | `git diff origin/main..HEAD` 2-dot 비교 시 target 범위 밖 5개 파일(`conversation-thread.md` 등)에 큰 diff 가 보이나, `git merge-base` 로 재확인 결과 **이 branch 가 건드린 적 없는 파일**이며 origin/main 이 fork point 이후 별도 PR 로 독자 전진한 **stale-base 효과**임을 git 근거로 반증. | target 수정 불요. 병합 전 rebase 로 해소(이 branch 는 이미 `#957` squash 반영 rebase 를 마쳤고, 그 뒤 main 이 또 전진했다). |
| 2 | naming_collision | 짧은 라벨 `M1`/`M2` 가 channel-web-chat(공식 사용 모드 레이블)과 agent-memory(지역 각주)에서 재사용됨. 두 도메인 간 상호 참조가 없어 혼동 가능성 낮음. | **본 target 의 결함 아님.** agent-memory 문서를 차후 손볼 때 지역 각주 표기를 바꾸는 것을 권장(별도 트랙). |
| 3 | naming_collision | `4-security.md` 의 `id:` basename-충돌 방지 주석이 ad hoc — "frontmatter `id:` 는 영역 prefix 로 전역 유일" 규칙이 `spec/conventions/` 에 명문화돼 있지 않다. | **본 target 의 결함 아님**(이 문서의 자체 방어는 잘 돼 있고 현재 실충돌 0). 규약 승격은 별도 트랙. |
| 4 | convention_compliance | Rationale 항목 번호(`### R<n>`)가 문서마다 1부터 시작하지 않고 서로 중복(`R4` 가 세 문서에 다른 내용으로 존재). | **위반 규약 없음**(번호 체계를 규정한 convention 문서 부재). 모든 상호 참조가 `[<파일> §R<n>]` 로 파일명을 동반해 링크 오귀속 없음. 규약 신설 실익 낮음 — 조치 없음. |

## checker 별 요약

| checker | 위험도 | 핵심 |
|---------|--------|------|
| cross_spec | **NONE** (C0/W0/I1) | `spec/7-channel-web-chat/` 6개 문서와 타 영역 13개+ 를 anchor 단위 대조 — 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 6개 관점 **전부 충돌 없음**(교차참조 20여 개 근거 기록). stale-base 착시를 git 으로 반증. |
| rationale_continuity | LOW (W1) | target diff 는 **기각된 대안 재도입·원칙 위반 없음** — EIA `R-replay-unavailable` 과 정확히 정합하며 origin/main 이 예고한 TODO 를 이행. `3-auth-session` drift 발견(위 W1). |
| plan_coherence | LOW (W1) | `[x]` flip 이 이 branch 자신의 merge 와 **원자적**이라 "머지 전까지 `[ ]` 유지" 규칙 위반 없음. plan 서술·실제 코드·target spec **삼자 일치** 확인(#957 의 "머지 전 판단 필요 — 구조 문제" 노트에 대한 답이 실재함). 타 `plan/in-progress/**` 와 결정 충돌 없음. `3-auth-session` drift 독립 발견(위 W1). |
| convention_compliance | NONE (I1) | frontmatter 스키마 6개 파일 전부 적합 — `id` kebab-case·`web-chat-` prefix 전역 유일(grep 확인)·`status: implemented`·`code:` 글로브 **전 경로 실존 확인**(`test -e`). |
| naming_collision | NONE (I2) | 요구사항 ID·엔티티/타입명·API endpoint·이벤트/메시지명·환경변수·파일 경로 6개 축 전부 실충돌 없음. |

## 이월

- `M1`/`M2` 토큰 재사용(agent-memory 지역 각주) · frontmatter `id:` 명명 규약 승격 — 둘 다 본 target 밖 별도 트랙(INFO#2·#3).
- 병합 전 rebase — main 이 fork point 이후 전진(INFO#1).
