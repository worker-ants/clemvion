# Plan 정합성 검토 — spec/5-system/14-external-interaction-api.md (--impl-prep, eia-inputdata-marker-guard)

## 발견사항

- **[WARNING]** target `code:` frontmatter 가 이 plan 이 편집할 두 소비처 파일을 아직 등재하지 않음
  - target 위치: `spec/5-system/14-external-interaction-api.md` frontmatter `code:` 목록 (파일 상단)
  - 관련 plan: `plan/in-progress/eia-inputdata-marker-guard.md` §범위 — "Re-run 모달 마커 가드", "에디터 히스토리 로드 마커 가드" 체크박스
  - 상세: 현재 `code:` 는 `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx`(#1181 폼 프리필 가드) 만 프런트 소비처로 등재하고 있다. 이 plan 이 실제로 편집할 두 파일 — `codebase/frontend/src/components/executions/rerun-modal.tsx`, `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` (둘 다 저장소에 실존 확인) — 는 목록에 없다. `spec-code-paths.test.ts` 가드는 glob 이 ≥1 매치만 요구하므로 빌드는 막히지 않지만, `spec-impl-evidence` 컨벤션의 "spec 약속 ↔ 구현 코드" 단일 진실 취지상 이 두 파일이 §R17 "닫는 조건"의 실제 구현 증거다. plan 의 범위 체크리스트에 이 frontmatter 갱신 항목이 없다.
  - 제안: plan 체크리스트에 "`14-external-interaction-api.md` `code:` 에 `rerun-modal.tsx`·`editor-toolbar.tsx` 추가" 를 명시적으로 넣거나, §R17 갱신 스텝(아래 항목)에 묶어 함께 처리한다.

- **[INFO]** "spec §R17 갱신" 체크박스가 owner=developer 인 plan 안에 있어, 이 저장소의 확립된 spec-write 위임 관행과 어긋나 보일 수 있음
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 (잔여 ② "닫는 조건" 단락, `1586`행 부근)
  - 관련 plan: `plan/in-progress/eia-inputdata-marker-guard.md` frontmatter `owner: developer` + 범위 체크리스트 마지막 부분 "spec §R17 — '닫는 조건' 충족 반영, `inputData` 를 마스킹 카탈로그로 이동"
  - 상세: CLAUDE.md §Skill 체계는 `spec/` 쓰기를 `project-planner` 전속으로 못박고("developer 는 `spec/` read-only", "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임"). 같은 target 문서를 다룬 자매 plan `eia-terminal-payload.md` 는 이 규칙을 정확히 지켜 `--impl-prep` 이 `BLOCK: YES` 를 내고 별도 planner 턴(`spec-draft-eia-62-waiting-payload.md`)으로 spec 을 갱신한 뒤에야 구현을 재개했다. 이번 plan 은 §R17 이 이미 "닫는 조건" 을 문서화해 두어 내용상 새로운 결정을 발명하는 것은 아니지만(순수 상태 반영에 가까움), 체크리스트 표현이 developer 가 직접 spec 을 쓰는 것처럼 읽혀 혼동을 남긴다. 실제로는 write 권한 hook 이 이를 막을 것이므로 CRITICAL 은 아니다.
  - 제안: 해당 체크박스를 "planner 위임: spec §R17 갱신" 형태로 명시하거나, 구현 완료 후 `project-planner` 턴을 별도로 예정해 두면 이후 라운드에서 같은 자매 plan 이 겪은 BLOCK 재발을 예방한다.

- **[INFO]** 같은 target 문서를 동시에 건드리는 자매 plan(`eia-terminal-payload.md`)이 있으나 섹션이 분리돼 있어 충돌 없음
  - target 위치: `spec/5-system/14-external-interaction-api.md` — §R17(잔여 ②, inputData) vs §6.4(Rationale, error 객체화·durationMs)
  - 관련 plan: `plan/in-progress/eia-terminal-payload.md` (spec_impact 동일 파일, 체크리스트 사실상 전부 `[x]`, 유일한 미결 항목은 `result.outputs` 정의를 별도 planner 턴으로 이연한 것으로 본 plan 과 무관)
  - 상세: 두 plan 이 같은 파일의 서로 다른 Rationale 서브섹션을 갱신하므로 내용 충돌은 없다. `eia-terminal-payload.md` 가 거의 완료 상태라 실질적 경합 위험도 낮다.
  - 제안: 조치 불요. 참고용으로만 기록.

## 사전 조건 검증 (선행 plan 미해소 여부)

plan 이 명시한 선행 조건 — "#1181 폼 프리필 가드"(`c9cc2a923`, 머지됨), "`token` 계열 마스킹 확장 #1186"(`45ba37792`, 머지됨) — 두 커밋 모두 현재 브랜치 히스토리에 반영되어 있어 **선행 plan 미해소 항목은 없다**. target §R17 이 이미 "닫는 조건"을 정확히 이 plan 의 범위(Re-run 모달 + 에디터 히스토리 로드 마커 가드)로 문서화해 두었고, 트래커(`spec-sync-external-interaction-api-gaps.md`)의 해당 항목도 동일 문구·동일 캐너리 표(⑧/⑧-b/①/②)로 이 plan 의 프로브 결과와 일치한다. 관련해 다른 in-progress plan(`spec-sync-stop-editor-and-forbidden-routes.md`, `retry-turn-terminal-guard.md`)이 같은 파일명(`editor-toolbar.tsx`)·같은 필드명(`inputData`)을 언급하지만 각각 역할 게이팅과 retry spawn row 라는 무관한 주제라 결정 충돌은 없다.

## 요약

`eia-inputdata-marker-guard` plan 은 target spec(§R17)이 이미 명문화한 "닫는 조건"을 그대로 집행하는 구조이며, 참조하는 선행 작업(#1180/#1181/#1186)도 전부 머지되어 있어 미해결 결정을 우회하거나 선행 plan 을 건너뛰는 정황은 없다. 다만 (1) target 의 `code:` evidence 목록이 이번에 편집될 두 프런트 소비처 파일을 아직 반영하지 않고 있고, (2) plan 체크리스트의 "spec §R17 갱신" 항목이 이 저장소의 spec-write 위임 관행(project-planner 턴)을 명시하지 않아 자매 plan 이 겪었던 BLOCK 재발 소지가 있다. 둘 다 차단 사유는 아니며 plan 갱신으로 정리하면 충분하다.

## 위험도
LOW
