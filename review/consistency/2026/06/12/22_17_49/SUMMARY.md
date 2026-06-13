# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 모든 위배는 WARNING 이하 등급.

## 전체 위험도
**LOW** — 5개 checker 전체 LOW/NONE. 핵심 설계(skip + degraded, Redis fixed-window, fail-open)는 기존 spec invariant 와 직접 모순 없음.

## Critical 위배 (BLOCK 사유)

_없음_

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | cross_spec | `chat_channel_health=degraded` 트리거 경로가 CCH-SE-01(외부 API 호출 실패)에서 CCH-NF-03(rate-limit 초과)로 확장되나 CCH-SE-01 본문에 다중 경로 명시 없어 단독 읽기 시 오독 가능 | draft §결정 — `ChatChannelDispatcher.markDegraded` 동형 경로 + degraded 갱신 | `spec/5-system/15-chat-channel.md §3.4 CCH-SE-01`, `CCH-ERR-05` | R-CC-19 본문에 "CCH-SE-01(외부 API 실패)과 CCH-NF-03(rate-limit 초과) 두 경로 모두 동일 health 자원, 자동 비활성화 금지 동일"을 명시; 또는 §3.4 CCH-SE-01에 "degraded 설정 경로는 CCH-NF-03도 포함" 한 줄 추가 |
| W-2 | cross_spec | §5.5 표 하단 구현 메모("state?.executionId ?? 'ignored'")가 rate-limit 초과 케이스도 동일 sentinel임을 커버하는지 명시 없음 | draft §변경 surface §2 — 신규 202 행 | `spec/5-system/15-chat-channel.md §5.5 + R-CC-12` | §5.5 구현 메모를 "세 케이스 공통: group/bot skip, rate-limit 초과, unsupported update type"으로 확장 |
| W-3 | cross_spec | Redis INCR+EXPIRE latency가 WH-NF-01 200ms 예산에 포함된다는 명시 없음 — 구현자 오해 가능 | draft §결정 — enforcement 위치 `parseUpdate` 직후 | `spec/5-system/15-chat-channel.md §3.1 CCH-AD-04 / CCH-NF-01`, `WH-NF-01` | CCH-NF-03 본문 또는 §5.5 신규 행에 "Redis INCR+EXPIRE는 WH-NF-01 200ms 예산 안(fail-open으로 Redis 장애 시 latency 추가 없음)" 주석 추가 |
| W-4 | rationale_continuity | R9를 "rate-limit 큐 기각 근거로 적용"이라고 역방향 인용 — R9는 lifecycle 케이스와 rate-limit 케이스를 구분하며 rate-limit 큐의 정당성을 긍정했음 | draft §"큐 적재→재발사" 미채택 이유 절 첫 문장 | `spec/5-system/15-chat-channel.md Rationale R9` | "R9가 기각했으므로" 표현 삭제. "R9는 lifecycle 케이스와 트리거 조건을 분리했고, rate-limit 큐 역시 WH-NF-01 응답 시한 제약으로 동기 버퍼링 불가하므로 skip 채택"이라는 독립 근거로 재작성. R-CC-19에 이 독립 근거 명시 |
| W-5 | convention_compliance | plan frontmatter `worktree: chat-channel-rate-limit` — 실제 디렉토리명 `chat-channel-rate-limit-baa15a`에서 slug(`baa15a`) 누락 | `plan/in-progress/spec-draft-cch-nf-03-rate-limit.md` frontmatter | `.claude/docs/plan-lifecycle.md §4` — `<task>-<slug>` 형식 필수 | `worktree: chat-channel-rate-limit-baa15a`로 교정 |
| W-6 | plan_coherence | target 병합 후 `spec-update-gap-callout-plan-links.md`의 `spec/data-flow/14-chat-channel.md §1.1 rateLimitPerMinute` callout의 plan 링크가 `spec-sync-chat-channel-gaps.md`를 가리키고 있어 갱신 필요 | `plan/in-progress/spec-update-gap-callout-plan-links.md` 21행 | target plan 병합 후 해당 행의 추적 대상이 변경됨 | 병합 후 해당 행 plan 링크를 `spec-draft-cch-nf-03-rate-limit.md`(또는 구현 plan)으로 갱신하거나 행 제거 (병합 전 조치 불필요) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | cross_spec | `PublicWebhookQuotaService` "패턴 재사용" 표현이 동일 서비스 클래스 재사용으로 오독 가능 — 실제로는 per-chat 별도 카운터 | draft §결정 — "기존 PublicWebhookQuotaService.incrWithWindow 패턴 재사용" | CCH-NF-03 변경 문구에서 "PublicWebhookQuotaService와 동일 Redis INCR+EXPIRE pipeline 패턴을 별도 per-chat 카운터로 구현"으로 명확화 |
| I-2 | cross_spec | R9 본문에 R-CC-19 cross-link 없음 | `spec/5-system/15-chat-channel.md Rationale R9` 마지막 문장 | R9 마지막 문장에 "CCH-NF-03 rate-limit 큐 정책의 상세 rationale은 R-CC-19 참조" cross-link 추가 |
| I-3 | cross_spec | R-CC-19 신설 ID — 기존 체계(R-CC-10~R-CC-18)와 충돌 없음 확인됨 | draft §변경 surface §4 | 충돌 없음. 필요 시 R9 본문에 R-CC-19 cross-link만 추가 |
| I-4 | rationale_continuity | CCH-NF-03 신규 §3.6 문구에 "(구 큐 적재 정책 → skip 변경, 근거 R-CC-19)" 인라인 참조 없음 | draft §변경 surface §1 | 신규 §3.6 문구 끝에 `(구 큐 적재 정책 → skip 변경, 근거 R-CC-19)` 괄호 주석 추가 권고 |
| I-5 | rationale_continuity | R-CC-19에서 R9 인용 방식이 모호 — "R9 와의 직교성"이 아닌 "R9가 두 케이스를 분리했고, 본 R-CC-19는 rate-limit 케이스 내부의 독립 결정"으로 명시 필요 | draft §변경 surface §4 R-CC-19 신설 | R-CC-19 R9 인용을 "R9는 rate-limit 케이스를 lifecycle과 다른 트리거 조건으로 분리했다. 본 R-CC-19는 그 rate-limit 케이스 내에서 큐 vs skip을 추가로 결정하며 R9와 독립 사안이다"로 명시 |
| I-6 | convention_compliance | plan 문서의 Rationale 섹션이 두 곳으로 분산 (`## "큐 적재→재발사" 미채택 이유`와 `## Rationale`) — 3섹션 권장 패턴에서 이탈 | `plan/in-progress/spec-draft-cch-nf-03-rate-limit.md` 전체 구조 | `## "큐 적재→재발사" 미채택 이유`를 `## Rationale` 아래 서브섹션으로 통합하거나 `## 결정` 본문으로 흡수 |
| I-7 | convention_compliance | `{ executionId: 'ignored' }` 응답이 API 응답 봉투 형식 적용 여부 불명확 | draft §결정 "초과 시 동작" 및 §변경 surface §2 | §5.5 기존 행의 응답 body 형식과 동일 패턴임을 명시 또는 기존 spec 행 참조 추가 |
| I-8 | plan_coherence | `spec-sync-chat-channel-gaps.md` CCH-NF-03 항목과 target plan 정합 — 연동 확인됨, 충돌 없음 | `plan/in-progress/spec-sync-chat-channel-gaps.md` 15행 | target 병합 후 해당 항목 주석을 "spec 확정 완료, 구현 대기"로 갱신하면 추적성 향상 |
| I-9 | plan_coherence | `spec/data-flow/14-chat-channel.md` §1.1 구현 갭 주석(rateLimitPerMinute 미구현)이 spec-draft 변경 surface에 포함되지 않아 병합 후 불일치 가능 | `spec/data-flow/14-chat-channel.md §1.1` | spec-draft 적용 시 §1.1 갭 주석도 함께 갱신 |
| I-10 | naming_collision | R-CC-19 신설 — R-CC-14 결번 기존 존재하나 R-CC-19 할당에 영향 없음 | `spec/5-system/15-chat-channel.md Rationale` | 필요 시 Rationale ID 컨벤션 절에 R-CC-14 결번 주석 추가 |
| I-11 | naming_collision | `ChatChannelDispatcher.markDegraded` "동형 경로" 표현이 spec 레벨에서 모호 — 코드 레벨 이름이 spec에 노출됨 | draft §결정 "동형 경로" 언급 | spec 본문에서 "동형 경로" 대신 "동일 DB 갱신 동작(`chat_channel_health=degraded`, `chat_channel_last_error` 갱신)"으로 구체화 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | degraded 다중 경로 미명시(W-1), Redis latency 예산 미명시(W-3), sentinel 주석 확장 필요(W-2). INFO: PublicWebhookQuotaService 표현 모호(I-1) |
| rationale_continuity | LOW | R9 역방향 인용(W-4) — skip 선택 근거는 독립 근거로 충분히 정당화 가능, CRITICAL 아님 |
| convention_compliance | LOW | frontmatter `worktree` slug 누락(W-5). INFO: Rationale 섹션 분산(I-6) |
| plan_coherence | LOW | 병합 후 plan 링크 갱신 필요(W-6, 현재 비차단). active worktree 간 파일 경합 없음 |
| naming_collision | NONE | 신규 식별자 R-CC-19 충돌 없음. 기존 식별자 재활용 모두 정합 |

## 권장 조치사항

1. **[W-4 우선 해소]** draft §"큐 적재→재발사" 미채택 이유 절에서 "R9가 기각했으므로" 표현 삭제. WH-NF-01 응답 시한·동기 버퍼링 불가·구현 단순성의 독립 근거로 재작성. R-CC-19에 이 독립 근거 명시.
2. **[W-5 즉시 교정]** frontmatter `worktree: chat-channel-rate-limit` → `worktree: chat-channel-rate-limit-baa15a` 교정 (plan_coherence 매칭 오류 방지).
3. **[W-1 spec 반영 시]** R-CC-19 본문에 "CCH-SE-01(외부 API 실패)과 CCH-NF-03(rate-limit 초과) 두 경로 모두 동일 health 자원" 명시. §3.4 CCH-SE-01에 다중 경로 한 줄 추가.
4. **[W-3 spec 반영 시]** CCH-NF-03 또는 §5.5 신규 행에 "Redis INCR+EXPIRE는 WH-NF-01 200ms 예산 안(fail-open)" 주석 추가.
5. **[W-2 spec 반영 시]** §5.5 구현 메모를 "세 케이스 공통: group/bot skip, rate-limit 초과, unsupported update type"으로 확장.
6. **[W-6 병합 후]** `spec-update-gap-callout-plan-links.md` 해당 행 plan 링크를 구현 plan으로 갱신.
7. **[I-1 spec 반영 시]** "PublicWebhookQuotaService 패턴 재사용" → "별도 per-chat 카운터로 구현"으로 명확화.
8. **[I-5 R-CC-19 작성 시]** R9 인용 방식을 "R9는 두 케이스를 분리했고 본 R-CC-19는 rate-limit 케이스 내 독립 결정"으로 명시.