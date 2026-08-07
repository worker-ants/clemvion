# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 정상 응답(전문 확보), Critical 발견 없음.

## 전체 위험도
**LOW** — 코드 diff 자체(패키지 `prepare` 빌드 스크립트 견고성 수정)는 spec/7-channel-web-chat 표면과 무관하며 위반 없음. 다만 **target 번들 스코프 산정 결함**(diff 와 무관한 spec 전체를 싣고, 이 branch 를 실제 지배하는 plan 문서는 예산 초과로 누락)이 5개 checker 중 3개(cross_spec/rationale_continuity/plan_coherence)에서 공통 관측됐고, plan_coherence 는 이를 MEDIUM 으로 판정 — 검증 대상 부재로 인한 거짓-안전(false safety) 위험이 있어 별도 조치가 필요하다.

## Critical 위배 (BLOCK 사유)
없음.

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | (해당 없음) | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | target 번들 스코프 산정이 diff 와 무관한 spec(`spec/7-channel-web-chat` 전체)을 통째로 싣고, 이 branch 를 실제 지배하는 governing plan(`plan/in-progress/harness-review-gate-ci-backstop.md`, worktree frontmatter 가 이 세션과 일치)은 예산 초과로 번들에서 누락됨 | 프롬프트 `## 검토 모드`/`## Target 문서` 전체 | `plan/in-progress/harness-consistency-summary-downgrade-rule.md` 의 미해결 체크리스트 2건(scope 사전확인 보강, spec_impact 우선 포함) — 이미 이 결함 클래스를 추적 중이나 "governing-plan 최상위 계층 승격" 축은 미등재 | `harness-consistency-summary-downgrade-rule.md` 에 "governing-plan(worktree frontmatter 일치) 최상위 계층 승격" 항목을 추가 등재 (코드 변경 불요, 문서 관측만) |
| 2 | plan_coherence | 실제 diff 가 고친 결함(packages `prepare` stale-dist 미재빌드)이 `harness-review-gate-ci-backstop.md` 가 예견한 "CI 활성화 후 실결함 발견" 패턴의 실례인데도, `#1091`(playwright-runner mount) 발견과 함께 그 plan 문서에 등재되지 않음 | 실제 diff(`.github/workflows/harness-checks.yml`, `codebase/packages/*/package.json` 7개, `.claude/tests/test_packages_prepare_contract.py`) | `plan/in-progress/harness-review-gate-ci-backstop.md` "이 계획이 서 있던 전제가 거짓이었다" 섹션 | 다음 관련 커밋(또는 이 PR)에서 해당 plan 에 `#1091`+이번 stale-dist 발견을 1~2줄로 등재 |
| 3 | convention_compliance | convention 번들 선정이 target 이 실제 참조하는 규약(`conversation-thread.md`·`swagger.md`·`i18n-userguide.md`·`interaction-type-registry.md`·`error-codes.md`·`frontend-layering.md`·`spec-impl-evidence.md`)을 누락하고 무관한 규약(audit-actions·cafe24-api-catalog)만 번들에 포함 — 파일시스템 직접 열람 없는 실행 경로였다면 거짓 음성(false negative) 위험 | `spec/7-channel-web-chat/*.md` 전체 | orchestrator convention bundling 단계 | bundling 로직이 target 문서 frontmatter `code:`/본문 `../conventions/*.md` 링크를 파싱해 실제 참조 규약을 우선 포함하도록 개선 |
| 4 | naming_collision | SDK 의 `ChatInstance`(런타임 제어 핸들, `2-sdk.md` §5)와 운영 콘솔의 `WebChatInstance`(webhook trigger 엔티티, `use-web-chat.ts`) 간 "Instance" 어휘 중복으로 잠재적 혼동 — 문자열 자체는 다르므로 CRITICAL 아님 | `spec/7-channel-web-chat/2-sdk.md` §5 vs `codebase/frontend/src/components/web-chat/use-web-chat.ts:17` | `spec/7-channel-web-chat/5-admin-console.md` §2 "웹채팅 인스턴스 모델" | spec 산문에서 최초 언급 시 괄호로 구분 표기, 또는 코드 타입명을 `WebChatDeployment` 류로 재명명(현재 implemented 상태라 문서 명확화가 비용 대비 적절) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 검토 대상 diff(패키지 6~7건 `prepare` 스크립트 변경 + CI 테스트/워크플로)가 target spec 영역(`spec/7-channel-web-chat`)과 무관 — 스코프 불일치. 참고 삼아 수행한 target spec 텍스트 spot-check(Trigger 엔티티 NOT NULL, RBAC 역할 집합, EIA endpoint, CORS 이중 표면)는 전부 정합 | `spec/7-channel-web-chat/**` vs 실제 diff | 조치 불필요(스코프 불일치 자체는 아래 plan_coherence WARNING #1과 동일 근본 원인) |
| 2 | rationale_continuity | target(diff)이 spec/7-channel-web-chat 의 어떤 Rationale(R1~R10, admin R1~R7)과도 접점 없음 — "해당 없음" 판정, 결함 아님 | 전체 | 조치 불필요 |
| 3 | convention_compliance | `4-security.md` frontmatter `id: web-chat-security` 의 슬러그 충돌 방지 주석은 현재 실재하지 않는 가상 충돌을 선제 방어하는 것(spec-impl-evidence.md §2.1 규칙 준수 모범 사례) | `spec/7-channel-web-chat/4-security.md` frontmatter | 조치 불필요, 향후 유효해질 수 있는 선제 조치로 유지 |
| 4 | naming_collision | 동일한 `id: web-chat-security` 방어적 주석 — 검증 결과 현재 실제 충돌 없음(`grep -rhn "^id: " spec/` 전수 확인, `web-chat-*` 6개 ID 모두 유일) | `spec/7-channel-web-chat/4-security.md` | 조치 불필요 |
| 5 | naming_collision | 핵심 식별자(ENV: `WEB_CHAT_WIDGET_ORIGINS`/`NEXT_PUBLIC_WIDGET_CDN_BASE`/`UNIDENTIFIED_IP_BUCKET`, 요구사항 ID `NAV-WC-01~06`, 타입 `BootConfig`/`WidgetEvent`, endpoint, 이벤트명 `wc:*`) 전수 스팟체크 — 충돌 없음 | 코드베이스 전체 | 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | diff 와 target spec 무관(스코프 불일치, INFO). spot-check 정합 확인 |
| rationale_continuity | NONE | diff 가 spec/7-channel-web-chat Rationale 어느 것과도 접점 없음(해당 없음) |
| convention_compliance | LOW | target 자체는 실제 규약과 정합. convention 번들 선정 gap 은 WARNING(harness 단계 문제, target 결함 아님) |
| plan_coherence | MEDIUM | 스코프 산정 결함으로 governing plan 누락 + 발견 결함의 plan 미등재, 둘 다 WARNING |
| naming_collision | LOW | `ChatInstance`/`WebChatInstance` 어휘 중복 WARNING, 나머지 식별자 충돌 없음 |

## 권장 조치사항

1. (스코프 산정 근본 원인, BLOCK 사유는 아니지만 가장 시급) `plan/in-progress/harness-consistency-summary-downgrade-rule.md` 의 미해결 체크리스트에 "governing-plan(worktree frontmatter 일치)을 target 번들 최상위 계층으로 승격" 항목 추가 — plan_coherence WARNING #1.
2. `plan/in-progress/harness-review-gate-ci-backstop.md` 에 이번 diff 가 고친 stale-dist `prepare` 결함 + `#1091`(playwright-runner mount) 발견을 1~2줄로 등재 — plan_coherence WARNING #2.
3. convention bundling 로직이 target frontmatter `code:`/본문 링크 기반으로 실제 참조 규약을 우선 포함하도록 개선 — convention_compliance WARNING #3 (harness 개선 항목, 이번 PR 코드와는 무관).
4. spec 산문에서 `ChatInstance`(SDK)와 `WebChatInstance`(콘솔) 어휘를 최초 언급 시 구분 표기 — naming_collision WARNING #4 (저비용 문서 수정, 급하지 않음).

---