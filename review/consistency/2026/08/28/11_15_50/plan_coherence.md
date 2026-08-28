# Plan 정합성 검토 — spec/5-system/ (--impl-prep)

## 발견사항

- **[WARNING]** `OAUTH_STATE_MISMATCH` 가 아직 중앙 에러 카탈로그(§1.2)에 등재되지 않았다
  - target 위치: `spec/5-system/3-error-handling.md` §1.2 "인증/인가 에러" (표, 401/403/423 코드들이 나열된 절)
  - 관련 plan: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` "추가 위임 (2026-08-14 #12)" 항목 (미체크, `- [ ]` 상태 아님 — 표 형태의 신규 카탈로그 항목으로 남아 있음)
  - 상세: 해당 plan 은 2026-08-14 실측으로 "`3-error-handling.md` 내 `OAUTH_STATE_MISMATCH` 출현 0건, 자매 코드 `KB_REEMBED_IN_PROGRESS`·`KB_REEXTRACT_IN_PROGRESS` 는 각 1건 등재"라고 확정하고, 삽입 위치를 §1.8(최초 오판)에서 §1.2 로 정정까지 마쳤다. 오늘(2026-08-28) 직접 `grep` 으로 재확인해도 `spec/5-system/3-error-handling.md`·`spec/5-system/2-api-convention.md` 어디에도 `OAUTH_STATE_MISMATCH` 가 없다 — 여전히 `spec/conventions/error-codes.md:35`(명명 예시)·`spec/2-navigation/4-integration.md:851`(연동 OAuth 쪽 서술)에만 흩어져 있고 §1.2 중앙 카탈로그 행이 비어 있다. plan 은 "한 코드가 로그인 OAuth·연동 OAuth 두 표면을 공유하므로 카탈로그 행이 어느 쪽을 덮는지 명시하라"는 세부 조건까지 적어 뒀다. `--impl-prep spec/5-system/` 검토가 이 카탈로그를 그라운드 트루스로 다루게 되므로, 착수 전에 이 gap 이 아직 열려 있음을 인지해야 한다.
  - 제안: 이 항목은 plan 쪽에 이미 정확하게 등재돼 있어 plan 갱신은 불필요하다 — target(spec) 쪽에 표 1행 추가가 필요한 planner 작업으로 다음 planner 턴에 반영할 것. impl-prep 통과 판정에 영향은 없으나(개발자가 이 코드를 새로 다루는 작업이 아니면), 만약 이번 구현이 OAuth 관련 표면을 건드린다면 이 gap 을 먼저 닫는 편이 안전하다.

- **[WARNING]** `update-returning-tuple-shape.md` 가 위임한 소급 caveat 5건 중 3건이 `spec/5-system/` 대상 파일에 아직 반영되지 않았다
  - target 위치: `spec/5-system/4-execution-engine.md` §1.1(admission gate·종결 이벤트), `spec/5-system/8-embedding-pipeline.md` §7.3(KB 재임베딩 CAS 락), `spec/5-system/10-graph-rag.md` 동시 호출 표(KB 재추출 CAS 락) — 이번 검토 스코프(`spec/5-system/`) 안의 파일들
  - 관련 plan: `plan/in-progress/update-returning-tuple-shape.md` `## 후속` 절의 두 `[planner 위임]` 항목("소급 각주 — 대상이 한 문서가 아니다", "raw SQL 결과 shape 을 규약으로 승격")
  - 상세: 2026-08-13 커밋(`8332d9a20`)이 `.query()` 튜플-vs-배열 오독 버그를 고치기 전까지, 위 세 spec 문서가 서술한 "admission gate 가 동시 실행을 defer 시킨다" / "CAS 락이 동시 재임베딩·재추출을 거절한다" 는 보장이 **실효되지 않았다**(코드 실측 완료, e2e 지연시간 4191ms→2242ms 로 검증됨). plan 은 이 사실을 5곳(위 3곳 + `spec/data-flow/2-auth.md` OAuth state 소비 + `spec/conventions/node-cancellation.md` §2.4)에 소급 caveat 으로 남겨야 한다고 스스로 결론 내렸고, `developer` 는 `spec/` 쓰기 권한이 없어 `[planner 위임]`으로 명시했다. `git grep` 재확인 결과 다섯 곳 모두 아직 caveat 미기재(`data-flow/2-auth.md` 는 원래 있던 정상 흐름 설명 1줄만 존재, caveat 문장은 없음). 부수로 `spec/conventions/node-cancellation.md` frontmatter `pending_plans:` 에도 이 plan 이 등재돼 있어야 하는데(plan 자신의 지시), 실제로는 `node-cancellation-residual-signal-propagation.md` 만 등재돼 있다. 오늘 날짜 최신 plan-audit 커밋(`6adf773e4`)도 이 항목들을 건드리지 않아 여전히 열려 있는 백로그다.
  - 제안: target(spec) 갱신이 필요한 planner 턴 항목이다. plan 문서 자체는 이미 정확하게 위임을 기록해 뒀으므로 plan 갱신은 불요하지만, 이번 `--impl-prep spec/5-system/` 세션이 execution-engine/embedding-pipeline/graph-rag 의 admission·CAS 락 관련 코드를 다룰 계획이라면, 위 caveat 없이는 "동시 요청을 락이 거절한다"는 현재 spec 서술을 과거 이력까지 포함해 사실로 오인할 위험이 있다.

## 요약

`spec/5-system/` 완전 번들 3개 문서(1-auth.md·2-api-convention.md·3-error-handling.md) 는 `spec-sync-auth-gaps.md`·`auth-guard-reflection-hardening.md` 등 관련 plan 과 결정 수준에서 충돌하지 않는다 — LDAP/SAML 미구현, `workflow.executed` 보존정책 유예, WebAuthn reflection 캐너리 등 plan 이 추적하는 미해결 결정은 target 문서에도 동일하게 "Planned/미정"으로 정합하게 반영돼 있다. 다만 이미 각 plan 이 스스로 확정해 둔 두 건의 **후속 spec 반영 작업**(OAuth 에러 코드 카탈로그 등재, `update-returning-tuple-shape.md` 소급 caveat 5건)이 아직 target 에 착지하지 않은 채 열려 있다 — 둘 다 코드 변경을 요구하지 않는 순수 문서 갭이고 developer 권한 밖(`spec/` 쓰기)이라 다음 planner 턴 대기 상태다. 새로운 미해결 결정 충돌이나 선행 plan 미해소는 발견되지 않았다.

## 위험도
LOW
