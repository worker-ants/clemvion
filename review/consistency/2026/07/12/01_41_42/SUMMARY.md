# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — `spec/7-channel-web-chat` 는 이번 diff 로 전혀 변경되지 않은 test-only PR(위젯 multi-turn 복원 characterization test + `mergeMessages` JSDoc 정정)이며, 5개 checker 전원이 Critical 0건을 보고. 다만 convention-compliance 에서 해요체(Principle 6) 위반 2건과 DTO 파일명 컨벤션 미준수 1건, plan-coherence 에서 완료된 plan 잔류 1건의 low-cost WARNING 이 확인됨.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | 위젯 demo/example disclaimer 기본값이 i18n-userguide.md Principle 6(해요체) 위반 — 금지된 합니다체 사용 | `codebase/channel-web-chat/src/app/demo/demo-config.ts:30`, `codebase/packages/web-chat-sdk/examples/snippet.html:44` (각각 `spec/7-channel-web-chat/0-architecture.md`·`2-sdk.md` `code:` glob 인용처) | `spec/conventions/i18n-userguide.md` §적용범위/Principle 6 | 두 파일의 disclaimer 문구를 `web-chat-sdk.mdx`/`webChat.ts` 와 동일한 해요체(예: "...답변이 정확하지 않을 수 있어요.")로 정정. `2-sdk.md` 의 truncate 된 예시도 완전한 해요체 문구로 채워 향후 copy-paste tone 오염 예방 |
| 2 | Convention Compliance | 신규 응답 DTO `embed-config.dto.ts` 가 swagger.md §5-1 `*-response.dto.ts` 파일명 컨벤션 미준수 (`dto/responses/` 36개 중 33개는 패턴 준수) | `codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts` (spec 인용: `spec/7-channel-web-chat/4-security.md` §3-①) | `spec/conventions/swagger.md` §5-1 응답 DTO 위치 컨벤션 | `embed-config.dto.ts` → `embed-config-response.dto.ts` rename + import 경로 갱신 + spec frontmatter `code:` 경로 동반 갱신 |
| 3 | Plan Coherence | `spec-draft-pr874-deferred-docs.md` 의 변경안(R7 신설·conversation-thread §9 예외·frontmatter/§4 표 미러) 3건 모두 PR #899(commit `52f46f95f`)로 이미 완료됐으나 잔여 체크박스 2개(`doc-guard 통과`, `commit+PR`)가 미체크 상태로 `plan/in-progress/` 잔류 | `plan/in-progress/spec-draft-pr874-deferred-docs.md` (target 반영 확인처: `1-widget-app.md` §R7, `conversation-thread.md` §9/§8.2/frontmatter `code:`/§4 표) | plan 라이프사이클 규약 (in-progress ↔ complete) | `project-planner` 가 잔여 체크박스를 실제 상태로 마감(둘 다 이미 충족)하고 `plan/complete/` 로 이동 — 향후 에이전트의 오인 중복작업/오판 방지 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Convention Compliance | Rationale 항목 번호(R-numbering)가 파일별로 불연속(`1-widget-app.md` R4부터, `2-sdk.md` R2부터, `3-auth-session.md` R3부터) — 명문화된 규약 위반은 아님, 애초 영역 전역 공유 번호 체계 흔적 | `1-widget-app.md`/`2-sdk.md`/`3-auth-session.md` Rationale | 강제 아님. 가독성 개선 원하면 파일 내 R1부터 재번호(진행 전 다른 문서가 구 번호를 anchor 참조하지 않는지 재확인 — 현재는 없음) |
| 2 | Convention Compliance | `id: web-chat-security` 충돌 방지 주석의 근거가 현재 spec tree 실제 충돌과 불일치(오늘 시점 실제 충돌 없음, 나머지 4문서도 동일 접두어를 쓰나 사유 주석 없음) | `4-security.md` frontmatter | 주석을 "영역 전체 id 네임스페이스 정책(`web-chat-*`)" 으로 정정하거나 실제 충돌 사례를 인용해 명확화. 기능 영향 없음 |
| 3 | Plan Coherence | carousel 잘림 배너·총 개수 노출 — target 의 "table 한정, carousel 은 별도 후속" carve-out 이 plan 의 미해결(`[ ]`) 상태와 정확히 일치 (조치 불요) | `1-widget-app.md` §2 각주/§R8, `plan/in-progress/webchat-widget-presentation-followups.md` | 향후 carousel 배너 신설 시 해당 plan 항목이 유효한 진입점 |
| 4 | Plan Coherence | EIA-RL-07 idle-wait reaper·single-flight coalesce·`replay_unavailable` 클라이언트 미배선 — target "구현 상태" 서술이 plan 체크 상태와 완전 일치 (과장·은폐 없음, 조치 불요) | `1-widget-app.md` §3.1/§R9, `3-auth-session.md` §R6, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | `spec/7-channel-web-chat` diff 없음(test-only PR). 타 영역(EIA/conversation-thread/data-model/webhook/navigation) 참조 전수 대조 결과 모순 없음 |
| Rationale Continuity | NONE | `mergeMessages` 로직 무변경, JSDoc 만 실제 동작에 맞게 정정(최초 정직화). 기각 대안 재도입·합의 원칙 위반·무근거 번복 없음 |
| Convention Compliance | LOW | 해요체(Principle 6) 위반 2건(demo/example 한정, 위젯 본체는 준수), DTO 파일명 컨벤션 미준수 1건 — 모두 low-cost fix. 그 외 모범적으로 spec-code drift 를 자체 노출한 점 확인 |
| Plan Coherence | LOW | 완료된 `spec-draft-pr874-deferred-docs.md` 가 in-progress 잔류(하우스키핑). 실질 관련 plan(EIA 대기표면 가드/context 후속/gaps 트래커/presentation followups) 은 target carve-out 과 전부 정합 |
| Naming Collision | NONE | spec 무변경, 신규 export 타입/엔드포인트/이벤트명/ENV 없음. 테스트 파일 신설 2건만 존재하며 명명 충돌 없음 |

## 권장 조치사항
1. (WARNING #2, 권장) `embed-config.dto.ts` → `embed-config-response.dto.ts` rename + import 경로 + spec frontmatter `code:` 동반 갱신 — swagger.md §5-1 정합화
2. (WARNING #1, 권장) `demo-config.ts`·`snippet.html` disclaimer 문구를 해요체로 정정, `2-sdk.md` truncate 예시 완전한 해요체 문구로 보강
3. (WARNING #3, 하우스키핑) `project-planner` 가 `spec-draft-pr874-deferred-docs.md` 잔여 체크박스 마감 후 `plan/complete/` 이동
4. (INFO, 선택) Rationale 번호 재정렬, `id: web-chat-security` 주석 근거 명확화 — 낮은 우선순위, 강제 아님

---
검토 대상: `spec/7-channel-web-chat/**` (--impl-done, diff-base=origin/main). 실제 코드 diff 는 `codebase/channel-web-chat/src/lib/widget-state.{ts,test.ts}`, `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`, `plan/in-progress/webchat-multiturn-restore-test.md` 로 한정된 test-only PR — spec 본문은 무변경이며 `1-widget-app.md` `code:` glob 매칭으로 절차상 가드가 트리거됨.