# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 CRITICAL 0건, 전문 전원 확보)

## 전체 위험도
**LOW** — SMTP SSRF 가드를 HTTP/DB 공용 `http-safety.ts` 로 통합한 코드 전용(spec 델타 0) 변경. Critical/구조적 위반 없음. WARNING 1건(신설 파일의 spec `code:` 증거 목록 누락)만 존재하며 build 게이트를 막지 않는 문서 완결성 갭.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | 신설 `smtp-host-guard.ts`(`nodes/integration/send-email/` 로 이전)가 자신이 속한 노드 spec 의 `code:` 증거 목록에 없음 | `spec/4-nodes/4-integration/3-send-email.md` frontmatter `code:` | `spec/conventions/spec-impl-evidence.md` §2.1 (`code:` 필드는 spec 이 약속한 surface 의 구현 경로를 등재) | `code:` 에 `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts` 추가. `1-http-request.md` 가 자신의 `http-safety.ts` 를 등재해 둔 것과 대칭 맞춤. build 게이트는 안 막지만 다음 planner/consistency 턴에서 반영 권장 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `execution-engine.md §10.1` `IntegrationsService.logUsage` 시그니처가 INT-US-05 `api` 필드 누락(stale) — 이번 diff 무관, 기존 drift | `spec/5-system/execution-engine.md §10.1` | 조치 불요(이미 트래커 등재, `21_02_09` 라운드 WARNING) |
| 2 | cross_spec | `chat-channel-adapter.md §3.1` 분류표가 `EMAIL_HOST_BLOCKED` 등 신규 에러 코드 미커버 — 기존 drift | `spec/.../chat-channel-adapter.md §3.1` | 조치 불요(기등재) |
| 3 | rationale_continuity | IPv4-mapped IPv6 판정 근거·NAT64/SIIT/6to4 비대상 경계가 spec `## Rationale` 이 아니라 코드 JSDoc/plan 에만 기록 | `http-safety.ts mappedIPv4()` JSDoc, `1-http-request.md §8` | 병합 차단 아님. plan 종료 시 `1-http-request.md §8`(또는 공통 Rationale)에 한 줄 추가 권장 |
| 4 | rationale_continuity | `SsrfBlockedError` 타입 discriminate 가 4개 기존 소비자(HTTP/DB handler·redirect·connection-tester)에 아직 미적용 — 코드 리뷰 2라운드에서 "수렴 예외"로 이미 처분 | `http-request.handler.ts` 등 | 조치 불요(트래커 등재·재확인됨) |
| 5 | convention_compliance | 공유 `http-safety.ts` 가 Database Query·Send Email 두 spec `code:` 에 여전히 미등재 — 기존 부채(이번 PR 이 만든 것 아님) | `2-database-query.md`, `3-send-email.md` frontmatter `code:` | 별도 조치 불필요, 트래커 실행 시 함께 갱신 |
| 6 | convention_compliance | 에러 코드·클래스명·클라이언트 메시지 마스킹은 기존 규약과 전부 정합(양성 확인) | `http-safety.ts`, `smtp-host-guard.ts` | 조치 불요 |
| 7 | plan_coherence | `spec-draft-nullable-notation-followups.md` 트래커가 두 항목을 `[x]` 로 이미 표시하며 `plan/complete/ssrf-guard-integration-unify.md` 를 인용하지만, 실제로는 해당 plan 이 아직 `in-progress/` 에 있고 체크리스트 마지막 3항목 미완료 — 두 파일 모두 미커밋 상태 | `plan/in-progress/spec-draft-nullable-notation-followups.md`, `plan/in-progress/ssrf-guard-integration-unify.md` | 이번 `--impl-done`/`/ai-review` 를 이 라운드에서 통과시키지 못하면 트래커의 선반영 서술을 되돌릴 것. 통과 시 마무리 커밋에서 두 문서를 함께 정리(체크박스 확정 + `complete/` 이동) |
| 8 | naming_collision | `smtp-host-guard.ts` 가 `common/utils/` → `nodes/integration/send-email/` 로 이동, 이전 경로 잔존 파일 없음(확인 완료) | 해당 파일 경로 | 조치 불요, 정상 리팩터 |
| 9 | naming_collision | 코드베이스에 SSRF 판정 구현이 3벌 병존(`http-safety.ts`/`ssrf.util.ts`/`ssrf-safe-url.util.ts`) — 함수명 비충돌, 이번 PR 스코프 밖 | `common/utils/ssrf*.ts` | 이번 PR 스코프 아님, 별도 중복 로직 통합 검토 대상일 수 있음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | SMTP 가드를 `http-safety.ts` 로 통합 — target spec 이 이미 선언한 "3노드 동일 메커니즘" 을 사실로 만드는 버그 수정. `5-system/7-llm-client.md` 와의 CGNAT 목록 차이는 기존 상태이며 트래커 등재됨 |
| rationale_continuity | NONE | 기각된 대안(`SMTP_BLOCK_PRIVATE_HOSTS`) 재도입 없음, 오히려 잔재 주석 제거. 메시지 일반화·플래그 통일 원칙 유지 |
| convention_compliance | LOW | 명명·출력 포맷·마스킹 전부 정합. WARNING 1건(신설 파일 `code:` 미등재) |
| plan_coherence | NONE | spec 델타 0 은 plan(`spec_impact: none`)의 의도된 결과. 트래커 선반영 서술은 미커밋 상태라 조치 불요, 마무리 커밋 시 정리 필요 |
| naming_collision | NONE | 신규 식별자(`SsrfBlockedError`, `canonicalIPv6`, `mappedIPv4` 등) 전수 `git grep` 대조 결과 충돌 없음. 파일 이동 깨끗이 완료 |

## 권장 조치사항
1. (BLOCK 아님, 권장) `spec/4-nodes/4-integration/3-send-email.md` frontmatter `code:` 에 `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts` 추가.
2. `--impl-done`/`/ai-review` 가 이 라운드에서 최종 수렴하면, `plan/in-progress/ssrf-guard-integration-unify.md` 체크리스트 나머지 항목을 체크하고 `plan/complete/` 로 이동 + `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 두 항목 서술이 실제 상태(완료)와 일치하는지 최종 확인 후 함께 커밋.
3. (선택) `1-http-request.md §8`(또는 공통 Rationale)에 IPv4-mapped IPv6 판정 근거·NAT64/SIIT/6to4 비대상 경계 한 줄 명시 — spec 만 읽는 다음 검토자를 위한 문서화.
