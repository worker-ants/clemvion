# Rationale 연속성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/4-nodes/)
검토 대상: `spec/4-nodes/` 전체 (특히 `6-presentation/0-common.md`, `3-ai/1-ai-agent.md`)
주요 변경: `ButtonDef.userMessage` 옵션 필드 신설 + `§10.8 render_* 클릭 user-message 합성` SoT 신설

---

## 발견사항

### [INFO] `render_*` 버튼 클릭의 워크플로 분기 흉내 금지 원칙과 `userMessage` 필드의 관계 명문화 필요
- target 위치: `spec/4-nodes/6-presentation/0-common.md` §10.8, §1 ButtonDef 표
- 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md` §12.4 Rationale, 안 (D) "Render 결과의 워크플로 분기 흉내" 기각 항목
- 상세: §12.4 안 (D) 의 기각 근거는 "버튼 클릭 → 다른 출력 포트" 라는 **그래프 포트 라우팅 모방** 이다. 신설된 `ButtonDef.userMessage` 는 버튼 클릭 시 발화되는 chat user message 텍스트를 제어하는 것으로, 그래프 포트 분기가 아니라 LLM 다음 turn 의 user 메시지 내용을 결정하는 것이다. 이 두 가지는 의미상 구분되지만, 표면상으로는 "버튼 클릭이 LLM 대화 분기에 영향을 준다" 는 관점에서 (D) 와 혼동될 여지가 있다. §10.8 의 "라우팅 안 함" 단락이 이를 명시하고 있어 충돌은 없으나, §12.4 Rationale 과의 관계가 §12.4 본문에서 역참조되지 않아 독자가 (D) 기각 결정이 `userMessage` 에도 적용되는지 혼동할 수 있다.
- 제안: `spec/4-nodes/3-ai/1-ai-agent.md` §12.4 Rationale 에 "`ButtonDef.userMessage` (presentation 공통 §10.8) 는 user message **텍스트 내용** 을 제어하는 것으로 안 (D) 의 '그래프 포트 라우팅 모방' 에 해당하지 않는다. 다음 LLM turn 의 `ai_user` 메시지 경로는 변경하지 않는다" 는 clarification 한 줄 추가를 권장. 또는 §10.8 의 "라우팅 안 함" 단락에 `§12.4 (D) 기각 원칙과 직교` cross-ref 추가.

### [INFO] `userMessage` 옵션 필드의 `backfillButtonUuids` 처리 대상 제외 근거가 Rationale 내 명시됨 — 잠재 혼동 주의
- target 위치: `spec/4-nodes/6-presentation/0-common.md` §Rationale "`render_*` 클릭 user-message 하이브리드 합성 (2026-05-23)" 마지막 항 "왜 옵션 필드 — §10.5 backfill 대상 아님"
- 과거 결정 출처: 같은 문서 §Rationale "`button.id` backfill 도입 (2026-05-23)" — `backfillButtonUuids` 는 `button.id` 누락 시에만 적용
- 상세: `button.id` backfill 도입 Rationale 의 결론은 "id 가 없는 것에만 UUID v4 를 채운다" 였다. `userMessage` 가 backfill 대상이 아닌 이유는 "미설정이 정상 케이스이고, 임의 값 채움이 LLM 의 의도를 흐린다" 는 것으로, 이는 `button.id` 의 "워크플로 에디터 UI 가 항상 발급하고 LLM 은 id 를 모른다" 는 전제와 다르다. 두 결정이 같은 §Rationale 절 내에 함께 배치되어 있어 backfill 처리 범위를 오해할 여지가 있다. 그러나 현재 §10.5 step 3 의 "id 가 없는 것에만" 표현과 §Rationale 의 "backfill 대상 아님" 주석이 일치하므로, 구현자가 주의 깊게 읽으면 혼동을 피할 수 있다.
- 제안: `spec/4-nodes/6-presentation/0-common.md` §10.5 step 3 의 `backfillButtonUuids` 설명에 "`userMessage` 는 backfill 대상 아님 (§Rationale 참조)" 한 줄 추가하면 구현자가 두 필드를 혼동하는 위험을 더 낮출 수 있다. 현재 구조도 spec 정합은 완료된 상태.

### [INFO] `link` 타입 버튼의 `userMessage` 무시 처리 — 기존 `link` 버튼 시맨틱 원칙과 정합 확인
- target 위치: `spec/4-nodes/6-presentation/0-common.md` §1 ButtonDef 표 `userMessage` 행, §1.1 유효성 "`userMessage` 는 `type: "port"` 한정" 행
- 과거 결정 출처: `spec/4-nodes/6-presentation/0-common.md` §2 포트 토폴로지, §3 Blocking Mode 실행 흐름 §6.1 "link 버튼 클릭 시 새 탭에서 URL 열기 (실행 상태 변경 없음)"
- 상세: 기존 spec 에서 `type: "link"` 버튼은 "외부 URL 이동" 이 우선 시맨틱으로, 그래프 포트 라우팅이나 실행 재개 없음이 확립된 원칙이다. `userMessage` 가 `type: "link"` 에서 무시(warning 아님)되는 결정은 이 기존 원칙과 완전히 일치한다. Rationale 에 이 연결 고리가 명시적으로 언급되지 않았으나 내용적으로 충돌 없음.
- 제안: 현상 유지. 정합 문제 없음.

### [INFO] `button.id` backfill 순서 불변성 — `validate → overlay → cap → backfill` 순서가 Rationale 에 명시됨
- target 위치: `spec/4-nodes/6-presentation/0-common.md` §Rationale "`button.id` backfill 도입" "normalize 적용 시점이 cap 이후인 이유"
- 과거 결정 출처: 같은 §Rationale §10.5 schema 위반 처리 흐름 (기존 step 1~2 → 3·4 로 재번호됨), §10.3 Defaults Overlay 규칙
- 상세: `button.id` backfill 이 도입되면서 step 3 이 신설되고 기존 step 3·4 가 4·5 로 재번호되었다. 이 순서 변경은 §Rationale 에 근거가 명시되어 있고, Defaults Overlay 규칙 (§10.3) 과 1MB cap (§10.4) 이 기존 Rationale 에서 확립된 원칙을 유지한다. 재번호 처리가 clean 하다.
- 제안: 현상 유지. 기존 §10.3, §10.4 의 Rationale 와 정합.

---

## 요약

`spec/4-nodes/6-presentation/0-common.md` 에 신설된 `ButtonDef.userMessage` 필드 및 `§10.8 render_* 클릭 user-message 합성` 절은, 과거 Rationale 에서 확립된 결정들(§12.4 안 D "그래프 포트 분기 흉내 금지", `button.id` backfill 원칙, `link` 버튼의 URL 이동 우선 시맨틱, `validate → overlay → cap → backfill` 순서 불변성)을 실질적으로 위반하거나 번복하지 않는다. 신설 변경은 모두 자체 Rationale 를 동반하고 있으며 기각된 대안(안 A/B, (B) zod required 강제 등)에 대한 비교 근거도 명시되어 있다. CRITICAL 또는 WARNING 수준의 문제는 발견되지 않았다. INFO 로 지적한 세 항목은 §12.4 Rationale 의 역참조 누락, `userMessage` 와 `button.id` backfill 처리 범위의 잠재 혼동, `link` 버튼 무시 처리의 기존 원칙 연결 명시 여부에 대한 가독성 개선 제안으로, 구현 착수를 차단할 사유는 없다.

---

## 위험도

LOW
