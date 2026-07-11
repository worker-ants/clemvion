# Plan 정합성 검토 결과

검토 대상: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md` (--impl-prep)
비교 기준: `plan/in-progress/**` 전체 (파일시스템 직접 조회 — 프롬프트에 임베딩된 "진행 중 plan 문서 모음" 은 5개 파일로 절단되어 있어 보조 자료로만 사용하고, 실제 판정은 `plan/in-progress/` 40개 파일 전수 grep 결과를 근거로 함)

## 발견사항

- **[WARNING]** `rag-dynamic-cut.md` 의 "비차단 후속" 항목이 target(`10-graph-rag.md` KB-GR-SR-05)에 이미 반영된 변경을 미반영 상태로 계속 추적 중
  - target 위치: `spec/5-system/10-graph-rag.md` §3.5 KB-GR-SR-05 — "최종 생성 주입 청크 수는 [RAG 검색 §3.4] 동적 점수 컷(token-budget + inject-cap)이 결정한다(고정 `topK` 아님)" (이미 동적 컷 표현으로 개정 완료, ✅)
  - 관련 plan: `plan/in-progress/rag-dynamic-cut.md` L45-47 "비차단 후속 (advisory...) 게이트 안정성·e2e cascade·loop 방지를 위해 본 PR 에서 미적용, 후속 정리: ... `10-graph-rag KB-GR-SR-05(topK→동적 컷 표현)`"
  - 상세: `git log` 확인 결과 커밋 `8c21455a3` (`#503`, 2026-06-06, "feat(rag-search): P1 후속 — pgvector HNSW ef_search recall 보전 + 주변 spec 정합")가 바로 이 항목("10-graph-rag KB-GR-SR-05")을 포함해 §7-llm-client §3.6·§4-integration KB-AG-04·§9-rag-search 정합까지 같은 날 완결시켰다. 로드맵 SoT 인 `plan/in-progress/rag-quality-improvement.md` L99 도 "spec 갱신 (2026-06-06, `rag-dynamic-cut` PR): ... `17-agent-memory.md`·`10-graph-rag.md`·`1-data-model.md` 정합. consistency `--spec 14_53_44` BLOCK:NO" 로 완료를 기록한다. 그런데 `rag-dynamic-cut.md` 자체의 "비차단 후속" 목록은 5주 넘게(2026-06-06 → 2026-07-11) 이 항목을 미해결 TODO 로 남겨두고 있다 — target 은 이미 그 변경을 반영했는데 plan 문서만 stale 하다. 이대로면 향후 이 plan 을 재개하는 세션이 이미 끝난 작업을 다시 하거나, "무엇이 실제로 남았는지" 판단에 혼선을 줄 수 있다.
  - 제안: `rag-dynamic-cut.md` 의 "비차단 후속" 절에서 "10-graph-rag KB-GR-SR-05(topK→동적 컷 표현)" 항목을 제거하거나 완료 표시(취소선 + 해소 커밋 `#503` 링크)로 갱신. 같은 절의 나머지 3항목(`7-llm-client §3.6`, `4-integration KB-AG-04`, 테스트 fixture 2건)도 `#503` 범위와 겹치는지 재확인 권장(단 target 범위 밖이라 본 검토에서는 미확인).

## 참고 (발견사항 아님 — 검토 과정 메모)

- `spec-sync-auth-gaps.md` (target `1-auth.md` frontmatter 의 `pending_plans` 가 직접 가리키는 plan)는 target §1.3 "LDAP/SAML 미구현·Planned" 서술과 완전히 정합한다 — 충돌·누락 없음.
- `error-codes-catalog-sot.md` 는 워크플로 항목 전부 `[x]` 완료 상태이며, target 이 참조하는 SoT 위치(`1-auth.md §1.4/§2.3` 의 WebAuthn/재인증 코드, `10-graph-rag.md §5.1/§7` 의 `KB_REEXTRACT_IN_PROGRESS`)가 실제 `spec/5-system/3-error-handling.md`·`10-graph-rag.md` 본문과 모두 일치함을 확인(디스크 직접 대조). 다만 이 plan 은 완료 상태인데도 `plan/complete/` 로 이동되지 않았다(자체 노트에 "`#882` 구조 정리 몫" 으로 명시 위임) — target 과의 충돌은 아니므로 CRITICAL/WARNING 으로 올리지 않음.
- **선례 주의**: `plan/in-progress/trigger-params-autocomplete.md` L45 는 과거 동일한 target 조합(`1-auth.md` + `10-graph-rag.md`)이 별개 작업(trigger-params-autocomplete)에서 "orchestrator payload 가 무관 target 1-auth/10-graph-rag 전달" 로 인한 오탐 BLOCK 사례였음을 기록하고 있다. 이번 실행의 target 선정이 실제 `llm-usage-doc-alignment` 작업 범위와 진짜 연관된 것인지(예: `production-guards.ts` 의 `LLM_STUB_MODE`, `LlmService.chat`↔`LlmUsageLog` 기록 경로 공유), 아니면 동일한 번들링 아티팩트의 재발인지 호출자가 한 번 더 확인할 가치가 있다. 이 자체는 plan-target 결정 충돌이 아니라 orchestrator 입력 구성 이슈이므로 INFO 로만 남긴다.
- 이번 세션 worktree(`git status`)는 origin/main 대비 diff 가 없고(spec/코드 미변경, `review/` 폴더만 untracked) — 실제 spec 변경은 아직 시작되지 않은 순수 --impl-prep 사전 점검 단계다.

## 요약

target(`1-auth.md`, `10-graph-rag.md`)이 명시적으로 가리키는 미해결 plan(`spec-sync-auth-gaps.md`)과는 충돌이 없고, 두 target 이 다루는 결정(§1.3 LDAP/SAML, WebAuthn/2FA/재인증 코드 카탈로그, KB 재추출 에러코드)은 관련 plan 들과 정합하다. 유일한 실질 이슈는 `rag-dynamic-cut.md` 의 "비차단 후속" 목록이 이미 5주 전에 완료된 `10-graph-rag.md` KB-GR-SR-05 변경을 여전히 미해결로 추적하는 stale 항목이며, 이는 target 을 오해하게 하거나 중복 작업을 유발할 수 있는 WARNING 급 plan 갱신 필요 사항이다. 그 외에는 CRITICAL 급 "미해결 결정 우회" 사례를 발견하지 못했다.

## 위험도

LOW
