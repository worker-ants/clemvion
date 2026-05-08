# Engine Raw Config Exposure — 완료 메모

**상태**: 모든 phase 완료 (2026-05-08)

**결정 요약**:
- Path A — 엔진이 핸들러에 raw config (expression 평가 전 원본) 를 `ExecutionContext.rawConfig` / `state.rawConfig` (multi-turn) 로 노출.
- 핸들러는 `NodeHandlerOutput.config` 에 raw echo, expression 평가 결과는 `output.*` 에 둠 (CONVENTIONS Principle 7 / 1.1.3).
- 마이그레이션 전략: 하드 스위치 — 25개 핸들러 일관 적용.
- PRD `ENG-RC-01`~`ENG-RC-04` 모두 ✅.
- Replay 정책: 옵션 C Hybrid — View (저장된 evaluated 단순 조회) + Re-run (future PRD, raw 재평가 + 새 실행) 분리. Multi-turn resume 은 replay 가 아님.

**산출물 위치**:
- PRD: `prd/3-node-system.md` §11 — `ENG-RC-01~04` + Replay 정책 한 줄 (Phase 6).
- Spec: `spec/5-system/4-execution-engine.md` §5.1 / §5.2 / §5.5 / §6.1 / **§6.3 신설 (Replay Policy)**, `spec/4-nodes/0-overview.md` §4.3, `spec/4-nodes/4-integration/0-common.md` / `1-http-request.md` / `3-send-email.md`.
- CONVENTIONS: `user_memo/node-specs-improvement/CONVENTIONS.md` Principle 7 / 1.1.3 / 8.2.
- Release note: `CHANGELOG.md` 항목 #14 (raw config echo policy) / #15 (Send Email 신규 output) / #16 (HTTP Request 신규 output) + "Replay / View Policy (new)" 절.
- Implementation tracker: `plan/complete/engine-raw-config-exposure.md`.
- Follow-ups: `plan/in-progress/engine-raw-config-followups.md` (AI Agent helper plumbing + Carousel/Table cap).

**Phase 별 PR 링크**:

| Phase | 핵심 sha | 비고 |
| --- | --- | --- |
| Phase 1 — 엔진 plumbing | `6953cafb` + `ce059405` (quality gate) | `ExecutionContext.rawConfig` + multi-turn `state.rawConfig` snapshot |
| Phase 2 — Send Email + HTTP Request | `e1ecbc1f` + `e516d3e1` + `2ffdf058` + `ef15242c` + `198bbefe` + `104d1bb9` | helpers (truncate-body / sanitize-response-headers) + 두 노드 마이그레이션 + spec |
| Phase 3 — 나머지 25개 핸들러 | `c29ee55b` (3a) + `75ec5eb6` (3b) + `05b69896` (3c) + `71e4fa7a` (3d) + `6eeeb095` (3e) + `7f7a9d3d` (3f) | 카테고리별 6 PR |
| Phase 4 — Frontend autocomplete | `5540f02a` | verification only — 코드 변경 0 |
| Phase 5 — Swagger DTO | `06c0a8c4` | DTO JSDoc 보강 |
| Phase 6 — Replay Policy spec + CHANGELOG | `0f91f8c6` | spec §6.3 신설 + PRD §11 한 줄 + CHANGELOG #14~16 + Replay/View 절 |
| Phase 7 — 정리 / 클로저 | (본 commit) | follow-up 분리 + memory 갱신 + plan/complete 이동 |

**미해결 항목 → follow-up 으로 이관**:
- AI Agent `buildMultiTurnFinalOutput` / `buildConditionOutput` 의 rawConfig plumbing (multi-turn cache lifecycle 영향 분석 필요).
- Information Extractor `multiTurnConfigEcho` 의 raw plumbing.
- Carousel / Table 의 256KB cap 적용 정책 결정.

상세는 `plan/in-progress/engine-raw-config-followups.md`.

**참고 메모**:
- 본 결정은 사용자가 "Send Email / HTTP Request output 에 본문 추가" 요청 시 발견된 아키텍처 misalignment 가 트리거였다. Path B (config + output 양쪽에 같은 evaluated 값) 는 Principle 1.1 직교성 위반으로 기각.
