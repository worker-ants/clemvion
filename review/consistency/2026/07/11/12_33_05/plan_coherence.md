# Plan 정합성 검토 — eia-context-schema-followups.md (--impl-done)

- diff-base: `1682777fe..HEAD` (4 commits: `964e887af`·`428134b64`·`dedc411fd`·`52e244034`)
- target: `spec/5-system/14-external-interaction-api.md` 관련 impl-done PR
- 검증 worktree: `/Volumes/project/private/clemvion/.claude/worktrees/eia-client-context-types-33e771`

## 발견사항

- **[WARNING]** plan 항목 2·4 체크박스가 실제 완료 상태를 반영하지 않음(과소 표기)
  - target 위치: 구현 diff 전체 — `codebase/channel-web-chat/src/lib/eia-types.ts`(`WaitingContext`/`ButtonsContext`/`NodeOutputContext` 신설 + `ExecutionStatus.context` 정밀화), `codebase/channel-web-chat/src/widget/use-widget.ts`(`as` 캐스트 제거), `codebase/packages/sdk/src/client.ts`+`index.ts`(동형 SDK export), `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.types.ts`(off-by-one 수정) + `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`(`collectCodebaseSources`/`findBrokenSpecLinksInSources` 신설) + `spec-link-integrity.test.ts`(신규 가드 2건)
  - 관련 plan: `plan/in-progress/eia-context-schema-followups.md` `## 항목` 리스트
    - 항목 2 `**EIA client 타입의 `context` 정밀화 (2곳)**` — `- [ ]` 로 남아 있음
    - 항목 4 `**`terminal-revoke-reconciler.types.ts:6` 의 spec 상대링크 off-by-one**` (+ "함께 검토" 가드 신설) — `- [ ]` 로 남아 있음
  - 상세: 두 항목 모두 diff 로 구현이 확인되고, `review/code/2026/07/11/11_44_59/`(1차 ai-review, Critical 2 전부 조치 또는 명시적 deferred)와 `review/code/2026/07/11/12_15_40/`(fresh review, 코멘트-only 잔여 수정 후 clean)를 거쳐 lint/unit/build **PASS**, e2e **250 passed**(11_44_59) 확인까지 완료됐다. plan 파일 상단 진행 배너(2026-07-11)도 "이번 PR에서 처리한다"고 명시하는데도 두 항목의 체크박스는 미완료(`[ ]`) 상태로 남아 merge 시점 plan 이 실제 진행 상황보다 뒤처진 스냅샷이 된다. (과대 표기가 아니라 과소 표기라 즉각적 오도 위험은 낮으나, 이후 세션이 이 plan 을 다시 읽고 "아직 미착수"로 오인해 중복 작업할 소지가 있다 — CLAUDE.md/memory 규약 "plan 체크박스 = 실제 상태, 수행 후 체크하고 PR 커밋에 포함")
  - 제안: 이번 PR 커밋에 `eia-context-schema-followups.md` 항목 2·4를 `- [x]` 로 갱신(간단히 "구현+테스트+리뷰 완료, PR 커밋 해시" 한 줄 부기 권장, item 5(§R17 잔여 등 인접 파일의 기존 관례와 동형). 항목 1(DTO 디렉토리)·3(swagger §1-4 본문)은 계속 열어두고 plan 은 `in-progress/`에 유지.

- **[WARNING]** RESOLUTION 의 `W-spec-edit`(acknowledged) 후속 확인 의무가 durable plan 항목으로 등재되지 않음
  - target 위치: `spec/conventions/spec-impl-evidence.md` §4.2 가드 표 1행(`spec-link-integrity.test.ts` 대상 범위 확장 서술) — diff 상 developer worktree 가 `spec/` 를 직접 편집
  - 관련 plan: `plan/in-progress/eia-context-schema-followups.md` `## 리뷰 후속` (4항목: C2·W-spec-link-ci·spec-links 중복·타 packages 배선)
  - 상세: `review/code/2026/07/11/11_44_59/RESOLUTION.md` 의 `W-spec-edit` 행은 "developer 가 `spec-impl-evidence.md §4.2` 를 self-justify 로 편집(CLAUDE.md 경계)"를 지적하고 상태를 `acknowledged`로 남기며 "planner/사용자 사후 확인 권고"라 적었다. 그러나 이 사후 확인 액션 아이템이 plan 의 `## 리뷰 후속` 목록(C2/W-spec-link-ci/spec-links 중복/타 packages 배선 4건)에는 없다 — RESOLUTION 이 스스로 "후속 4건은 `eia-context-schema-followups.md` §리뷰 후속 에 등재"라 적었지만 실제로는 3건(C2·W-spec-link-ci·spec-links 중복)+타 packages 만 등재되고 W-spec-edit 의 "사후 확인" 항목은 누락됐다(RESOLUTION 서술상 "후속 4건" 카운트에도 W-spec-edit 은 포함 안 된 것으로 보임 — 의도적 제외인지 누락인지 plan 문서만으로 판별 불가). 과거 유사 사례(memory: "RESOLUTION '후속 이관' 은 committed plan 등록해야 durable")에서 이 패턴이 반복적으로 plan_coherence WARNING 대상이었다.
  - 제안: `## 리뷰 후속`에 5번째 항목으로 "`spec/conventions/spec-impl-evidence.md` §4.2 편집(developer, CLAUDE.md 역할 경계) — planner/사용자 사후 확인" 을 명시적으로 추가하거나, 이미 커밋 근거 기록으로 충분하다고 판단되면(내용이 사실 정확·순수 서술 추가) 그 판단을 RESOLUTION 또는 plan 비고에 "확인 불필요 사유"로 명문화. 둘 중 하나 필요 — 현재는 "권고"만 있고 추적 흔적이 없다.

- **[INFO]** 항목 4 서술이 이번 PR에서 함께 갱신된 `spec-impl-evidence.md` §4.2 SoT 테이블 동기화를 언급하지 않음
  - target 위치: `spec/conventions/spec-impl-evidence.md` §4.2 가드 표 (`spec-link-integrity.test.ts` 행)
  - 관련 plan: `plan/in-progress/eia-context-schema-followups.md` 항목 4
  - 상세: 항목 4 는 "spec-link-integrity.test.ts 가드가 backend 소스를 스캔하지 않아 자동 검출되지 않는다... 함께 검토: 가드를 추가할지" 라고만 적혀 있고, 실제 구현은 가드 코드뿐 아니라 그 가드를 규정하는 SoT 문서(`spec-impl-evidence.md §4.2`)의 표 서술도 갱신했다(범위를 "(1) spec/**.md 본문, 및 (2) codebase .ts/.tsx 소스"로 확장 명시). 체크박스를 [x]로 갱신할 때 이 SoT 동기화도 완료 근거에 포함하면 plan 이 실제 변경 표면을 더 정확히 반영한다. 차단 사유는 아님.

## 정합 확인된 부분 (참고)

- 프런트매터 `worktree: eia-client-context-types-33e771` — 실제 worktree 디렉토리명과 일치. `started: 2026-07-10`·`owner: developer` 도 이상 없음.
- plan 상단 진행 배너(2026-07-11)가 본 PR 스코프(client context 정밀화 + spec-link 가드 확장)와 diff 를 정확히 요약하며, 항목 1(DTO 디렉토리 정규화)·3(swagger §1-4 본문)을 "범위 밖"으로 명시 — 이 둘이 여전히 미해결이라 plan 이 `in-progress/`에 남는 것은 정합.
- `## 리뷰 후속` 4항목(C2 typecheck 배선·W-spec-link-ci CI trigger·spec-links.ts 중복·타 packages harness 배선)은 `review/code/2026/07/11/11_44_59/RESOLUTION.md`의 "deferred" 4건과 1:1로 정확히 매핑됨. fresh review(12_15_40)의 R4 정정("pre-existing red 3건"→실측 ~10건)도 plan C2 서술에 정확히 반영됨(`~10건` 표기).
- 다른 `plan/in-progress/*.md` 문서 중 이 PR 이 건드린 파일(`eia-types.ts`, `use-widget.ts`, `client.ts`, `chat-channel/types.ts`, `chat-channel-config.dto.ts`, `spec-link-integrity.test.ts`, `spec-links.ts`, `widgets.tsx`, `multi-select-widget.test.tsx`, `terminal-revoke-reconciler.types.ts`)를 참조하거나 그 구현을 전제하는 항목은 없음 — 후속 항목 누락/선행 plan 미해소 충돌 없음.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(§5.3 `currentNode`/`context` 항목, 이미 `[x]`)의 "축 분리 주의" 각주가 본 PR 의 스코프(OpenAPI 스키마 표현·부재 표현 컨벤션)와 여전히 정합 — 본 PR 은 그 각주가 가리키는 `spec-draft-eia-context-schema-absence-convention.md` 계열의 클라이언트측 후속이라 재열림/충돌 없음.
- 체크박스 과대 표기(실제로 안 됐는데 [x])는 발견되지 않음 — 위 두 WARNING 은 모두 과소 표기/추적 누락 방향.

## 요약

구현 diff(4 commits)는 plan `eia-context-schema-followups.md` 의 항목 2(client `context` 타입 정밀화, 위젯+SDK)와 항목 4(spec 링크 off-by-one + 스캔 가드 확장)를 완결한 것으로 확인되며, 2회의 ai-review(11_44_59 → fresh 12_15_40, Critical 전량 조치·잔여 deferred)를 거쳐 lint/unit/build/e2e 전 단계 통과 상태다. plan 문서 자체는 프런트매터·범위 배너·리뷰 후속 목록이 모두 실제 리뷰 산출물과 정합하나, 완료된 항목 2·4의 체크박스가 여전히 `[ ]`로 남아 plan 이 실제 진행 상태보다 뒤처진 스냅샷을 보이는 점, 그리고 RESOLUTION 의 `W-spec-edit`(developer 의 spec/ 직접 편집에 대한 사후 확인 권고)이 durable plan 항목으로 등재되지 않은 점이 갱신 필요 사항이다. 미해결 결정과의 충돌이나 선행 plan 미해소는 발견되지 않았다.

## 위험도

LOW
