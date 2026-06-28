# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — 이번 변경(e2e 테스트 인프라 `X-Forwarded-For` 헤더 주입)은 spec 파일을 수정하지 않았다. 발견된 전체 항목은 기존 spec에 이미 내재된 표현상 비일관성이며, 모두 WARNING 이하 등급이다.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `slack.md`·`discord.md` 가 MDX 가이드 파일을 `code:` 필드에 등재 — convention 예시(`spec-impl-evidence.md §5.3`)는 `user_guide:` 위치 권고. **이번 변경이 유발한 것 아님 (spec 파일 미수정), 후속 spec-sync plan 대상** | `slack.md`/`discord.md` frontmatter `code:` 내 `.mdx`/`.en.mdx` | `spec/conventions/spec-impl-evidence.md §2.1·§5.3` (`telegram.mdx` 는 `user_guide:` 위치) | `.mdx` 항목을 `user_guide:` 키로 이동 (project-planner 위임) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | Discord/Slack §5.5 절 번호가 `15-chat-channel.md §5.5` 와 동일 번호 — provider 간 번호 체계 비일관 (이번 변경 유발 아님) | providers/discord.md·slack.md §5.5 | 선택 |
| 2 | Cross-Spec | Slack §8 retry("1s/2s, 4s 미발생") vs Discord §8("1s/2s/4s") 기술 차이 | providers/slack.md·discord.md §8 | discord-client.ts 대조 권장 |
| 3 | Cross-Spec | Discord §5.1 "(b) Modal 미구현" vs `_overview.md §1` "supported (v1)" 미세 불일치 | discord.md §5.1 | 선택 |
| 4 | Rationale Continuity | Slack §5.3 modal type 수용이 Discord §5.3 degrade 와 대조적이나 플랫폼 차이로 정합 | slack.md §5.3 | 선택 |
| 5 | Rationale Continuity | Discord frontmatter `status: partial` vs `_overview.md supported` — 용어 공간 차이, 실질 모순 아님 | discord.md | 선택 |
| 6 | Convention Compliance | `telegram.md §5.5` 결번 | telegram.md §5 | 선택 |
| 7 | Convention Compliance | `_overview.md §1 supported (v1)` vs frontmatter `partial` — 도메인 용어 공간 차이 | _overview.md §1 | 선택 |
| 8 | Naming Collision | `nextE2eClientIp()` 반환 범위(`203.0.113.1~254`)가 기존 고정 IP(`.9`,`.21`)와 수치 중첩 — **jest 모듈 격리 + 다른 endpoint/guard/Redis 키 namespace + 카운터 ≤6 으로 실질 충돌 없음** | helpers/e2e-client-ip.ts | 필수 아님 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 절 번호 명명·retry 기술·_overview 상태 표기 — 모두 기존 spec 내재, 이번 변경 유발 아님 |
| Rationale Continuity | NONE | 기각된 설계 재도입 없음 |
| Convention Compliance | LOW | slack/discord MDX `code:` 혼입(WARNING, 기존), telegram §5.5 결번(INFO) |
| Plan Coherence | NONE | spec 파일 변경 없음. 선행 D-12 충족 |
| Naming Collision | NONE | 신규 식별자 실질 충돌 없음 |

## 권장 조치사항 (전부 이번 PR 범위 밖 / 선택)

1. (WARNING, 후속 spec-sync) slack.md·discord.md frontmatter `.mdx` 를 `code:`→`user_guide:` 이동 — project-planner 위임.
2~5. (INFO, 선택) provider spec 표현 정합 — 본 e2e fix 와 무관.

---

STATUS=done BLOCK=NO
