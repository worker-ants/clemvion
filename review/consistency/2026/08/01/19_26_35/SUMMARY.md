# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance /
plan_coherence / naming_collision) 전원 CRITICAL 0건. 발견은 전부 WARNING/INFO.

검토 모드: `--impl-done` (scope=`spec/5-system`, diff-base=`origin/main`). 이번 브랜치는
`spec/**` 를 변경하지 않고, `1-auth.md §4.1` 이 "Planned(미구현)" 로 남겨둔 감사 로깅 액션
13개(`workflow.*`/`trigger.*`/`schedule.*`/`model_config.*` CRUD)를 코드에서 구현했다.

> 본 문서는 main 이 작성했다 — 하네스가 sub-agent 의 `SUMMARY.md` basename Write 를
> 차단하므로 `consistency-summary` 가 전문을 반환했고 그것을 여기 영속화했다.

## 전체 위험도

**MEDIUM** — Critical 급 기능/런타임 충돌 없음. 다만 "구현 현황 SoT" 를 자처하는 spec 3곳이
실제 코드와 정반대 사실("미구현")을 주장하는 상태다. `developer` 는 `spec/` read-only 라
이 PR 범위에서 고칠 권한이 없고, `plan/in-progress/spec-sync-auth-gaps.md` 가 "planner 턴
필요" 로 이미 추적 중이다.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | 제안 |
|---|---|---|---|
| 1 | cross_spec · convention_compliance · plan_coherence | 감사 액션 13개 구현 완료 vs spec 3곳(`1-auth.md §4.1` Planned 표 + L438 각주 · `data-flow/1-audit.md §1.1` · `conventions/audit-actions.md §3`)의 "미구현" 서술 — 직접 사실 모순. `AuditLogDto.action` description 의 §4.1 교차참조도 같은 이유로 stale | planner 턴에서 **한 커밋으로 동시** 갱신 |
| 2 | cross_spec · naming_collision | `trigger.delete`/`trigger.update`(현재형) 오기 잔존 — 실제 구현·규약은 과거분사. **3곳** | 아래 표 참조 |

### WARNING #2 상세 — 오기 3곳 (전수 재확인 완료)

| 위치 | 정정 | 주의 |
|---|---|---|
| `2-navigation/2-trigger-list.md:182` | 한 줄에 `trigger.delete` 가 **2회**, **둘 다 틀림** | 뒤쪽(audit action) → `trigger.deleted`. 앞쪽은 "`trigger.delete` permission 으로 보호" 라 쓰지만 **그런 permission 이 없다** — spec §3·코드 모두 0건, 인가는 역할 기반(`@Roles('editor')`) → `§3.2 리소스별 권한 매트릭스` 인용으로 교체 |
| `2-navigation/2-trigger-list.md:252` | `trigger.update` → `trigger.updated` | — |
| `5-system/15-chat-channel.md:377` | `trigger.update` → `trigger.updated` | **naming_collision 이 이번에 새로 발견** — 기존 plan 체크리스트에 없던 세 번째 지점 |

## 참고 (INFO) 요약

- 트리거 자격증명 회전 3종은 여전히 감사 미기록 — 대응 action 이 카탈로그에 없어 developer 가
  선행조건 미비를 인지하고 **우회하지 않았음**을 plan_coherence 가 확인. 같은 planner 턴에서
  카탈로그 정의 후 별도 PR.
- 신규 설계 결정 2건("1:1 결합 리소스는 주 리소스만 기록", "고빈도 액션은 보존정책 확정 전
  유예")이 코드 주석에만 존재 → spec Rationale 승격 필요. **plan 체크리스트에 추가 완료.**
- Swagger `AuditLogDto.action` description 이 `swagger.md §3` 길이 소프트 가이드 초과(비차단).
- 신규 식별자(`AUDIT_ACTIONS` 13개 값 · `AuditActionFor<P>`)는 코드베이스 전체에서 유일 — 충돌 0.

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---|---|---|
| cross_spec | MEDIUM | spec 3곳이 구현 완료된 13개 액션을 "미구현" 으로 서술 |
| rationale_continuity | LOW | 기존 Rationale(명명·workspace 귀속·toggle=update·기각 대안 비재도입) 전부 준수. 신규 결정 2건 미승격 |
| convention_compliance | LOW | 명명 규약·frontmatter·error-codes 준수. Swagger 길이 + 교차참조 stale |
| plan_coherence | LOW | plan 이 인지한 미해결 결정 전부 우회 없이 준수 |
| naming_collision | LOW | 신규 식별자 충돌 0. 오기 3번째 지점 신규 발견 |

## 이 세션에서 정정된 내 오류

`2-trigger-list.md:182` 의 permission `trigger.delete` 를 나는 인계 문서에 "정당하니 건드리지
말 것" 으로 적었다. **틀렸다** — 그 permission 은 spec §3 에도 코드에도 존재하지 않는다(실측
0건). 인가는 역할 기반이다. plan·PR 본문을 정정했다. 그대로 뒀다면 planner 를 잘못 인도했을 것이다.
