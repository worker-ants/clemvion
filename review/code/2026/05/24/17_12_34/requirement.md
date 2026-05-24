# 요구사항(Requirement) Review — form-resubmit-fix

리뷰 대상 커밋: `3d961b92` (handler.ts fix) + `2f44f538` (e2e fixture fix)  
관련 spec SoT: `spec/4-nodes/3-ai/1-ai-agent.md` §4.1 / §6.2 step 2.c / §12.6, `spec/4-nodes/6-presentation/0-common.md` §10.9 (4) layer

---

## 발견사항

### [WARNING] 진행 체크리스트 items 4–11 이 미완료 상태로 마킹됨
- 위치: `plan/in-progress/form-resubmit-fix.md` lines 96–103
- 상세: 체크리스트 4번(project-planner spec 갱신), 5번(consistency-check --impl-prep), 6번(테스트 선작성), 7번(코드 구현), 8번(테스트 보강), 9번(TEST WORKFLOW), 10번(REVIEW WORKFLOW), 11번(plan complete 이동) 모두 `[ ]` 미완료. 그러나 실제 git log 를 보면 `22652414`(spec 갱신), `673f5838`(spec stale cross-ref 정리), `3d961b92`(handler.ts fix), `2f44f538`(e2e fixture fix) 가 이미 커밋됨. 체크리스트와 실제 진행 상태가 불일치한다.
- 제안: plan 파일의 4–8번 항목을 `[x]` 로 갱신하고, TEST WORKFLOW / REVIEW WORKFLOW / plan complete 이동 완료 후 각각 체크. 특히 plan complete 이동(`git mv`)이 미처리 상태.

### [WARNING] 테스트 regex 와 PRESENTATION_TOOLS_GUIDANCE 문구 불일치 위험
- 위치: `ai-agent.handler.spec.ts` line 106 vs `ai-agent.handler.ts` line 202
- 상세: systemPrompt 테스트는 `/재호출하지|다시 호출하지|do not call/i` 를 기대한다. 현재 `PRESENTATION_TOOLS_GUIDANCE` line 202 는 "**같은 form 을 다시 호출하지 마세요.**" 를 포함하므로 "다시 호출하지" 가 매칭되어 통과한다. `FORM_SUBMITTED_GUIDANCE_MESSAGE` (line 215) 는 "같은 form 을 다시 호출하지 말고" 를 포함하므로 `parsed.message` 테스트의 `/재호출|다시 호출|do not call/i` 도 "다시 호출" 에서 매칭된다. 현재는 통과하지만, 두 위치의 문구가 향후 리팩토링 시 어긋날 경우 어떤 쪽이 변경됐는지 추적이 어렵다.
- 제안: 테스트 주석에 각 regex 가 어느 문구를 검증하는지 명시하거나, `FORM_SUBMITTED_GUIDANCE_MESSAGE` 상수를 테스트에서 직접 참조해 문자열 고정을 피할 것. 현재는 회귀 위험이 낮지만 주의 필요.

### [INFO] plan 체크리스트에 consistency-check --impl-prep 항목이 미완료로 표시됨
- 위치: `plan/in-progress/form-resubmit-fix.md` line 97
- 상세: 5번 항목(`consistency-check --impl-prep`) 이 `[ ]`. CLAUDE.md 규약에 따르면 developer 는 구현 착수 직전 `--impl-prep` 의무이다. 구현 커밋이 이미 완료됐으므로, 이 단계를 건너뛴 것인지 완료 후 미표기인지 불명확.
- 제안: impl-prep 세션 실행 결과를 확인하거나 완료 여부를 명시.

### [INFO] e2e fixture 변경이 review 대상 diff 에 포함됨 — form-resubmit-fix 범위 외
- 위치: `test/chat-channel-discord.e2e-spec.ts`, `test/chat-channel-slack.e2e-spec.ts`
- 상세: 두 파일의 변경은 `user.role` 컬럼 제거, `workflow.created_by` + `trigger.name` backfill 로 DB schema 정합 수정이다. form 재호출 회귀 차단과 직접 관련이 없으나 같은 PR 에 포함됐다. 기능 자체는 올바른 수정(실제 schema 에 맞춘 fixture 정합)이며 회귀 위험 없음.
- 제안: 분리된 fix commit 으로 처리됐으므로 범위 drift 주의 노트만 남김.

### [INFO] spec §12.6 SoT 참조 주석이 코드 내에만 존재 — 테스트 주석 충분성
- 위치: `ai-agent.handler.spec.ts` lines 44, 63, 73–75
- 상세: 테스트 주석이 "spec §12.6" 을 직접 명시한다. 현재 spec 에 §12.6 이 신설(line 1181)됐고 §4.1 표(line 242), §6.2 step 2.c(line 362), §10.9 (4) layer(presentation/0-common.md line 383) 도 갱신됐으므로 spec fidelity 는 충족된다.
- 제안: 해당 없음.

---

## Spec Fidelity 점검

| 항목 | 코드 구현 | Spec 본문 (SoT) | 일치 여부 |
|---|---|---|---|
| tool_result shape — `ok: true` | `handler.ts` line 1667 | `spec/…/1-ai-agent.md` §4.1 표 line 242, §6.2 step 2.c line 362, §12.6 | 일치 |
| tool_result shape — `type: 'form_submitted'` | `handler.ts` line 1668 | 동일 spec, 기존 SoT 유지 명시 | 일치 |
| tool_result shape — `data: formData` | `handler.ts` line 1669 | 동일 spec | 일치 |
| tool_result shape — `message: FORM_SUBMITTED_GUIDANCE_MESSAGE` | `handler.ts` line 1670 | spec §12.6 + §10.9 (4) layer (`presentation/0-common.md` line 383) | 일치 |
| PRESENTATION_TOOLS_GUIDANCE — form_submitted 안내 라인 | `handler.ts` line 202–203 | spec §12.6 (시스템 프롬프트 가드 안내 라인 추가 명시) | 일치 |
| 다른 4-layer (WS wire / internal bus / NodeOutput) 미변경 | 변경 없음 | spec §10.9 4-layer SSOT — (4) LLM tool_result 만 변경, (1)(2)(3) 무변경 명시 | 일치 |
| e2e fixture user.role 제거 | `user` INSERT 에서 `role` 컬럼 제거 | DB schema 정합 (review 대상 spec 외 영역) | 정합 |
| e2e fixture workflow.created_by | `workflow` INSERT 에 `created_by` 추가 | DB schema 정합 | 정합 |
| e2e fixture trigger.name | `trigger` INSERT 에 `name` 추가 | DB schema 정합 | 정합 |

---

## 요약

핵심 기능인 `render_form` submit 후 LLM 동일 form 재호출 회귀 차단 구현은 요구사항을 완전히 충족한다. `ai-agent.handler.ts` 의 `form_submitted` 분기가 `{ok: true, type: 'form_submitted', data, message}` shape 으로 보강됐고, `PRESENTATION_TOOLS_GUIDANCE` 에 `form_submitted` 케이스 안내 라인이 추가됐다. 두 위치의 메시지가 단일 상수 `FORM_SUBMITTED_GUIDANCE_MESSAGE` 로 동기화된 점은 spec §12.6 의 설계 의도에 부합한다. spec §4.1 표, §6.2 step 2.c, §12.6, presentation §10.9 (4) layer 모두 갱신됐으며 코드와 line-level 로 일치한다. 4-layer SSOT 의 다른 layer (WS wire / internal bus / NodeOutput) 에 영향이 없다는 spec 명시도 코드에서 확인된다. e2e fixture 수정은 DB schema 정합을 위한 올바른 변경이다. 주요 미결 사항은 plan 체크리스트 미갱신(커밋 완료 후 체크 미표기)과 plan complete 이동 미처리뿐이며, 이는 기능 동작에 영향을 주지 않는다.

## 위험도

LOW
