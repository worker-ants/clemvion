# Consistency Check 통합 보고서

**BLOCK: YES** — plan frontmatter 필수 필드 누락이 build gate(`plan-frontmatter.test.ts`)를 즉시 FAIL 시키는 것으로 실측 확인됨

## 전체 위험도
**HIGH** — target 자체(spec 표 신규 행 등재)의 cross-spec/rationale/naming 위험은 NONE 이지만, target 을 담는 plan frontmatter 스키마 위반이 CRITICAL 이고 build guard 를 실제로 깨는 것으로 실측됨

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | plan frontmatter 필수 필드 `started`/`owner` 누락 — `plan-frontmatter.test.ts` 를 이 파일에 대해 직접 실행해 2개 테스트 FAIL 실측 확인 | `plan/in-progress/spec-draft-nf-ob-07-redis-fail-open.md` frontmatter (status/worktree/spec_impact 3필드만 존재) | `spec/conventions/spec-impl-evidence.md §4.2` (SoT: `.claude/docs/plan-lifecycle.md §4`) | frontmatter 에 `started: <ISO 날짜>` 와 `owner: project-planner` 추가 |

## planner 인계 (권한 밖 Critical)

(없음) — 위 Critical 은 `plan/` 문서 자체의 frontmatter 누락으로, target 을 작성한 주체(project-planner)가 이번 턴에 직접 두 줄을 추가하면 해소되는 권한 내(in-scope) 수정이다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | frontmatter `worktree:` 값에 `.claude/worktrees/` 경로 접두가 붙어 스키마(디렉터리 이름만)와 다름 — `plan-stale-audit.sh` 를 실제로 오작동시켜 존재하는 worktree 를 MISSING 으로 오판하는 것을 실측 확인 | frontmatter `worktree: .claude/worktrees/eia-r8-cache-scope-4ae434` | `.claude/docs/plan-lifecycle.md §4` 스키마 (`worktree: <task_name>-<slug>`) | `worktree: eia-r8-cache-scope-4ae434` 로 접두 제거 |
| 2 | plan_coherence | 미해결 `CCH-SE-02` planner 결정을 이미 구현된 fail-open 서비스처럼 인용 — 이 워크트리 소스에는 `ChatChannelDedupService` 가 존재하지 않음(grep 0건) | "판단이 필요한 지점" 섹션, `ChatChannelDedupService` 언급 | `plan/in-progress/backend-lint-gate-broken-on-main.md` (미해결 `[ ]`) | 해당 클래스명을 제외하고 실존 서비스만 예시로 사용 |
| 3 | plan_coherence | "배선 안 된 Redis fail-open 소비자" 목록이 이미 완료 기록된 두 서비스를 누락하고 `PublicWebhookQuotaService` 를 잘못된 카테고리로 묶음 | "판단이 필요한 지점" 섹션 | `InteractionRateLimiterService`/`OutboundNotificationRateLimiterService` 실측 | 목록에 두 서비스 추가, `PublicWebhookQuotaService` 는 별도 카테고리로 분리 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 다른 영역(EIA/webhook/chat-channel) 의 fail-open 서술과 신규 메트릭 간 교차 링크 부재 | "판단이 필요한 지점"/"비목표" 섹션 | 후속 배선 시 상호 참조 추가 권장 (이번 draft 범위 밖) |
| 2 | rationale_continuity | target 이 `data-flow/15-external-interaction.md` "Fail-open 정책의 일관 표기" Rationale 이 명시적으로 요구해 둔 "Redis 실패율 관측" 갭을 정확히 메움 (긍정 확인) | target "왜" 섹션 | 조치 불요 |
| 3 | rationale_continuity | `component` 유니온을 구현 범위(`idempotency` 단일)로 좁게 유지 — "spec 이 구현보다 넓어지면 안 된다" 프로젝트 관행과 정합 (긍정 확인) | "판단이 필요한 지점" 섹션 | 조치 불요 |
| 4 | convention_compliance | NF-OB-07 표 신규 행(`component`/`reason`)이 기존 `status`/`state` 행과 달리 닫힌 enum 값을 표 셀에 인라인하지 않고 산문으로 뺌 | "무엇을 쓸 것인가 §1" 제안 표 행 | 값 목록을 표 셀에 인라인 |
| 5 | convention_compliance | draft 가 `project-planner/SKILL.md` 의 "본문 끝 `## Rationale`" 문구를 문자 그대로 따르지 않음 — 최근 자매 draft 도 동일해 SKILL.md 문구가 실관행보다 뒤처졌을 가능성 | 문서 섹션 구성 전체 | target 수정보다 SKILL.md 문구 갱신 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 타 영역 fail-open 서술과 실제 모순 없음, 교차 링크 부재만 INFO |
| rationale_continuity | NONE | 기존 Rationale(EIA R8, data-flow, chat-channel R-CC-19)과 완전 정합, 오히려 요구된 관측 갭을 메움 |
| convention_compliance | HIGH | plan frontmatter `started`/`owner` 누락으로 build guard 실측 FAIL(CRITICAL) + `worktree` 값 형식 오류(WARNING) |
| plan_coherence | MEDIUM | "판단이 필요한 지점" 서술이 미해결 planner 결정을 기정사실화하고, 미계측 목록이 부정확 |
| naming_collision | NONE | 신규 식별자(메트릭명/타입명/라벨) 전량이 코드 정의 그대로이며 충돌 없음 |

## 권장 조치사항
1. **(BLOCK 해소)** frontmatter 에 `started`/`owner` 추가.
2. `worktree:` 값에서 `.claude/worktrees/` 접두 제거.
3. `ChatChannelDedupService`(CCH-SE-02) 인용 제거 — 이 브랜치에 없다.
4. 미배선 목록을 실측으로 다시 쓰고 `PublicWebhookQuotaService` 를 별도 카테고리로 재분류.
5. (선택, INFO 4) §NF-OB-07 표의 라벨 값을 표 셀에 인라인.

---

## 이 라운드 처분 (main Claude)

전부 반영했다. **CRITICAL 은 내가 만든 것이 아니라 내가 빠뜨린 것**이다 — draft 를 새로 쓰면서
frontmatter 필수 3필드 중 2개를 안 적었고, build guard 가 그것을 잡는다는 사실을 checker 가
실제로 테스트를 돌려 보여 줬다. 보강 후 `plan-frontmatter.test.ts` **141/141 통과** 재확인.

WARNING 2 가 이 세션에서 반복된 형태다 — draft 에 `ChatChannelDedupService` 를 실존 서비스처럼
썼는데 그 클래스는 **미머지 #1161 에만 있다**. 작업 트리 기억으로 쓰고 브랜치 상태로 확인하지
않았다. 미배선 목록은 이 브랜치에서 실제로 grep 해 다시 썼고, 측정 명령을 draft 본문에 남겼다.
