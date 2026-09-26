# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 전문 확보, Critical 0건

## 전체 위험도
**LOW** — Critical/기능적 결함 없음. `CanvasSaveResultDto.nodes`/`.edges` 를 `NodeDto[]`/`EdgeDto[]` 로 좁힌 순수 OpenAPI 선언 정정이며, spec·convention·naming 관점에서 위반 없음. 유일한 WARNING 은 이 PR 자신이 "닫겠다" 고 선언한 트래커 체크박스가 실제로는 미체크로 남은 마무리 누락.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | 트래커 항목을 닫기로 한 계획이 실행되지 않음(부분 이행) — `canvas-save-typed.md` `## 방향` 항목 5 가 "트래커 항목을 닫는다" 고 명시했으나, 해당 트래커의 원본 항목은 여전히 미체크 | `plan/in-progress/spec-draft-nullable-notation-followups.md:1307` (`- [ ] CanvasSaveResultDto.nodes/.edges 가 타입 없는 객체 배열`) | `plan/in-progress/canvas-save-typed.md` `## 방향` 항목 5 및 자체 체크리스트 `[ ] 트래커 항목 닫기` | 1307행을 `[x]` 로 체크하고 "canvas-save-typed 로 해소(커밋 `04f603996`)" 등 처분 근거 한 줄 추가. 이어서 `canvas-save-typed.md` 잔여 체크리스트(`--impl-done`·`트래커 항목 닫기`) 완료 후 `plan/complete/` 로 이동 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/2-navigation/1-workflow-list.md` frontmatter `code:` 글롭(`workflows/dto/**`)이 실제로는 `spec/3-workflow-editor/0-canvas.md`·`5-version-history.md` 소관인 `CanvasSaveResultDto` 변경까지 워크플로우 목록 spec 으로 라우팅함 | `spec/2-navigation/1-workflow-list.md` frontmatter `code:` | (a) `0-canvas.md`/`5-version-history.md` 의 `code:` 에 `workflow-response.dto.ts`(`CanvasSaveResultDto` 한정 주석) 추가해 다중 소유 명시, 또는 (b) `1-workflow-list.md` glob 을 목록 화면 전용 DTO 로 좁히고 `2-trigger-list.md` 식 소유 근거 주석 추가. 급하지 않음 |
| 2 | Rationale Continuity | §5.4 "optional+nullable 동시 선언 금지" 조합(`NodeDto.description`/`.containerId`/`.toolOwnerId`, `EdgeDto.condition`)이 캔버스 저장·복원 두 엔드포인트에 처음 노출됐으나 기존 drift 이며 `--impl-prep` 단계에서 이미 triage 완료 | `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts` (`CanvasSaveResultDto.nodes`/`.edges`) | 조치 불요(트리아지 완료). 추후 `NodeDto`/`EdgeDto` 를 직접 손대는 PR 이 있을 때 §5.4 위반 정리 또는 grandfather 목록 편입 검토 |
| 3 | Rationale Continuity | 공칭 target(`spec/2-navigation/`)과 실질 관련 spec(`spec/3-workflow-editor/`)이 어긋남 — harness 의 `code:` 역-매핑 부작용, 내용 결함 아님 | 이 호출의 `## Target 문서` = `spec/2-navigation/` | target 문서 수정 불필요. orchestrator 코드→spec 역매핑을 파일 단위보다 세밀화하면 향후 유사 오배정 감소 가능(결과 영향 없음) |
| 4 | Convention Compliance | `type: () => [NodeDto]` 배열형 nested 참조 패턴이 저장소에 이미 6개 이상 파일에서 쓰이는 확립된 관행이나, `spec/conventions/swagger.md` §1-4 본문에는 단수형 예시만 있고 배열형 예시가 없음 | `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:80,84` / `spec/conventions/swagger.md` §1-4 | 여유 있을 때 swagger.md §1-4 에 `type: () => [NestedDto]` 배열형 예시 한 줄 추가 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | `NodeDto[]`/`EdgeDto[]` 광고는 `spec/1-data-model.md`·`5-version-history.md`·`data-flow/11-workflow.md`·`swagger.md` 모두와 정합. `code:` frontmatter 소유권 경계 INFO 1건 |
| Rationale Continuity | NONE | 과거 결정 재도입·원칙 위반·무근거 번복 없음. §5.4 조합 노출(기존 drift, 이미 triage)·scope 매핑 어긋남 INFO 2건 |
| Convention Compliance | NONE | swagger.md §1-4/§3/§5-1/§5-2/§6 전 항목 준수, plan frontmatter(Gate C 포함) 정상. 문서 예시 보강 INFO 1건 |
| Plan Coherence | LOW | spec 델타 0·숨은 소비자 없음 확인. 자신이 닫겠다고 선언한 트래커 항목 미체크(부분 이행) WARNING 1건 |
| Naming Collision | NONE | 신규 식별자 없음(`NodeDto`/`EdgeDto`/`CanvasSaveResultDto` 전부 기존 재사용). 신규 파일 1개는 확립된 명명 컨벤션 준수 |

## 권장 조치사항
1. `plan/in-progress/spec-draft-nullable-notation-followups.md:1307` 을 `[x]` 로 체크하고 "canvas-save-typed 로 해소(커밋 `04f603996`)" 근거 기록 (WARNING #1 해소, BLOCK 사유 아니지만 마무리 전 필수).
2. `plan/in-progress/canvas-save-typed.md` 잔여 체크리스트(`--impl-done`·`트래커 항목 닫기`) 완료 후 `plan/complete/` 로 이동.
3. (선택, 급하지 않음) `spec/3-workflow-editor/0-canvas.md` 또는 `5-version-history.md` 의 `code:` frontmatter 에 `workflow-response.dto.ts`(`CanvasSaveResultDto` 한정) 다중 소유 명시, 또는 `1-workflow-list.md` glob 축소.
4. (선택, 급하지 않음) `spec/conventions/swagger.md` §1-4 에 `type: () => [NestedDto]` 배열형 예시 추가.