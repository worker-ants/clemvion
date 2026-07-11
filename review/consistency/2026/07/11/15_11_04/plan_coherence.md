# Plan 정합성 검토 — `spec/5-system/14-external-interaction-api.md` (EIA 응답 DTO 정규화)

> 참고: 동일 대상의 직전 consistency-check(`review/consistency/2026/07/11/14_53_21/`)에서 본 checker(`plan_coherence`)는 `status=success` 보고에도 output 파일이 디스크에 없어(workflow disk-write gap) 미확인 상태였다. 본 실행이 실질적으로 첫 plan_coherence 검토다.

## 발견사항

없음 — CRITICAL/WARNING 없음.

- **[INFO]** `plan/in-progress/eia-context-schema-followups.md` frontmatter `worktree` 필드가 stale
  - target 위치: (target 문서 자체 아님 — 연관 plan 문서) `plan/in-progress/eia-context-schema-followups.md:2`
  - 관련 plan: 같은 문서 frontmatter `worktree: eia-client-context-types-33e771` (현재 작업 worktree는 `eia-response-dto-normalize-205f7d`)
  - 상세: 본 PR의 diff 자체가 이 plan 문서의 "`external-interaction` 모듈 응답 DTO 위치 정규화" 항목(line 16)을 완료 처리했음에도 frontmatter의 `worktree` 는 그 이전 세션(EIA client context 타입 정밀화, PR #912)의 worktree 이름을 그대로 가리킨다. 이미 `/ai-review`(`review/code/2026/07/11/14_52_32/`) INFO #4 로 지적됐고 비차단으로 처리된 사항 — 신규 발견 아님, 추적 메모로만 재기재.
  - 제안: 다중 worktree에 걸쳐 진행되는 후속 plan 문서의 `worktree` frontmatter 갱신 규칙(마지막 활성 worktree로 갱신할지, 최초 worktree를 유지할지)을 planner 트랙에서 한 번 정리해두면 향후 유사 혼란을 줄일 수 있다. 차단 사유 아님.

## 점검 관점별 확인 내역

1. **미해결 결정과의 충돌** — 위반 없음. `eia-context-schema-followups.md` 의 잔여 open 항목("EIA 응답 DTO `status` 리터럴 유니온 SoT 통합")은 본 diff 범위 밖으로 명시적으로 분리돼 있고, 본 diff는 그 항목이 경고한 대안(엔티티 enum 파생)을 채택하지 않았을 뿐 아니라 애초에 그 통합 자체를 시도하지 않아 결정 우회가 없다. `eia-command-waiting-surface-guard.md` 의 F-1/F-2/F-3 후속 항목(nodeId 검사·표면 불일치 안내·breaking-change 공지)도 DTO 파일 구조와 무관해 충돌 없음.
2. **선행 plan 미해소** — 위반 없음. 본 diff가 전제하는 유일한 선행 조건은 swagger.md §5-1 `dto/responses/*-response.dto.ts` 관례인데 이는 이미 확정된 규약(25개 기존 모듈이 준수)이라 미해소 전제가 아니다. `eia-context-schema-followups.md` 의 "EIA client 타입의 `context` 정밀화" 항목(선행 PR #912)도 이미 완료 상태.
3. **후속 항목 누락** — 위반 없음. `git diff origin/main...HEAD` 확인 결과 본 PR은 (a) `spec/5-system/14-external-interaction-api.md` §10 파일구조 다이어그램, (b) `spec/conventions/interaction-type-registry.md` SoT 각주 경로, (c) `plan/in-progress/eia-context-schema-followups.md` 체크박스를 모두 동반 갱신했다 — 이는 직전 consistency-check(`14_53_21`)와 ai-review(`14_52_32`)가 지적한 WARNING들이 이후 커밋(`31bbbac31` → `aa9a25300` → `5047750de`)에서 정확히 해소된 결과다. 새로 발생한 유지보수성 이슈(`status` 리터럴 유니온 중복)는 `eia-context-schema-followups.md` 에 신규 항목으로 이미 등재됐다. `plan/in-progress/` 전체를 대상으로 `responses.dto.ts`·`InteractAckDto`·`RefreshTokenResponseDto`·`ExecutionStatusDto`·`WaitingContextBaseDto` 식별자를 grep한 결과, 이 diff와 무관한 plan(`ai-agent-tool-connection-rewrite.md`·`self-hosting-deployment.md`·`spec-sync-external-interaction-api-gaps.md`·`merge-p2-async-fanin.md`·`node-output-redesign/README.md`)은 모두 상위 spec 섹션(§R7/§6.3/§8.1)만 참조하며 이번 파일 구조 변경과 겹치는 후속 항목이 없다.

## 요약

Plan 정합성 관점에서 이번 diff(`responses.dto.ts` → `dto/responses/{execution-status-response,interact-ack-response,refresh-token-response}.dto.ts` 3파일 분리)는 `plan/in-progress/eia-context-schema-followups.md` 가 이미 추적하던 항목("`external-interaction` 모듈 응답 DTO 위치 정규화")의 실제 구현이며, 커밋 이력(`31bbbac31`→`aa9a25300`→`5047750de`)을 통해 spec §10 다이어그램·`interaction-type-registry.md` SoT 각주·plan 체크박스가 모두 동반 갱신됐음을 확인했다. 미해결 결정을 우회하거나 선행 plan을 무시한 정황은 없고, 이 diff가 유발한 유일한 신규 후속 이슈(`status` 리터럴 유니온 중복)도 같은 plan 문서에 이미 등재돼 있다. plan/in-progress 전역에서 이 DTO 파일 구조를 전제하는 다른 미해소 항목도 발견되지 않았다.

## 위험도
NONE
