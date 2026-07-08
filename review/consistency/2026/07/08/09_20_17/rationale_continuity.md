# Rationale 연속성 검토 — spec/3-workflow-editor/0-canvas.md (§8 저장 모델 · ED-SP-05/ED-SV-02 정정)

## 검토 배경

target 변경은 워크플로우 캔버스의 저장 모델을 "2초 디바운스 타이머 자동 저장 + 오프라인 localStorage 임시 저장 + 동시 편집 충돌 감지 + 설정 즉시 반영"에서 "수동 저장(`Ctrl+S`/`Save`) + 실행 직전 저장 + 설정 패널 명시 클릭(`변경 저장`/`JSON 적용`)"으로 정정하고, 이를 `spec/3-workflow-editor/0-canvas.md` `## Rationale` **R-3**로 근거화한 spec-정정 draft다. 관련해 `_product-overview.md`(ED-SP-05/ED-SV-02/ED-AI-17), `spec/0-overview.md §3.3`, `spec/3-workflow-editor/2-edge.md §8`, `spec/3-workflow-editor/4-ai-assistant.md`(다수), `spec/4-nodes/0-overview.md §1.4`도 함께 정정됐다.

본 검토의 핵심 질문: **이 번복(reversal)이 과거 어느 spec 의 `## Rationale`이 명시적으로 옹호했던 자동 저장/즉시 반영 설계를 "무근거로" 뒤집는 것인가, 아니면 그런 선행 결정이 애초에 없었던 초기 draft 가정을 뒤늦게 정정하는 것인가**.

## 조사 방법

1. `git log -S` 로 §8 "디바운스 (2초)" 문구의 최초 도입 시점 추적.
2. `spec/**` 전체에서 "자동 저장"/"디바운스"/"오프라인 저장"/"충돌 감지"/"즉시 반영" 관련 과거 `## Rationale` 항목 존재 여부 grep.
3. R-3 가 인용하는 code evidence(`saveWorkflow` 호출처, `node-settings-panel.tsx` remount, 500ms 디바운스 용도)와 독립적으로 이미 존재하는 `spec/data-flow/11-workflow.md`, 유저 가이드 mdx 콘텐츠 대조.
4. `plan/in-progress/spec-sync-canvas-gaps.md`·동일 세션의 `cross_spec.md`/`plan_coherence.md` 산출물과 교차 확인.

## 발견사항

### [INFO] ED-SP-05/ED-SV-02/§8 자동 저장 조항은 애초에 Rationale 없는 최초 draft 가정 — "재도입"·"원칙 위반" 리스크 낮음

- target 위치: `spec/3-workflow-editor/0-canvas.md` §8/§8.1, `_product-overview.md` ED-SP-05/ED-SV-02
- 과거 결정 출처: 없음 — `git log -S "디바운스 (2초)"`(`spec/3-workflow-editor/0-canvas.md`)와 `git show 05089d5a6:prd/2-workflow-editor.md` 대조 결과, "2초 디바운스 자동 저장"/"오프라인 로컬 스토리지"/"동시 편집 충돌 감지"/"설정 변경 즉시 반영(ED-SP-05)"/"자동 저장(ED-SV-02)" 문구는 **본 저장소 최초 커밋(`05089d5a6`, "PRD·Spec 초안 일괄 작성")** 부터 존재했고, 그 이후 단 한 번도 수정된 적이 없다. `spec/3-workflow-editor/_product-overview.md`(당시 `prd/2-workflow-editor.md`)에는 애초에 `## Rationale` 섹션 자체가 없다(현재도 없음 — grep 확인). 즉 이 조항들은 사용자와 합의해 채택한 "결정"이 아니라, Rationale 관행이 이 프로젝트에 도입되기 이전의 미검증 초기 요구사항 나열이었다.
- 상세: "기각된 대안의 재도입"·"합의된 원칙 위반" 등급은 target 이 **과거에 명시적으로 논의·채택된 결정**을 우회할 때 성립한다. 여기서는 그 반대 방향 — 애초에 논의된 적 없는 초기 가정을 실제 구현·이미 배포된 유저 가이드(PR #855, `saving-and-sharing.mdx`/`settings-panel.mdx` 내용이 새 spec 문구와 정확히 일치함을 직접 대조 확인)에 맞춰 뒤늦게 정정하는 것이다. 따라서 CRITICAL 요건(명시적으로 기각된 대안 재채택, 또는 합의된 invariant 위반)에 해당하지 않는다.
- 부가 근거: PRD ED-EN-03("에디터에서 나갈 때 저장되지 않은 변경사항이 있으면 확인 다이얼로그 표시")은 원래부터 "unsaved changes(dirty)" 상태 존재를 전제하는 요구사항으로, 오히려 2초 자동 저장(거의 항상 저장됨 상태)보다 지금의 수동 저장(`isDirty`) 모델과 더 정합적이다 — 이번 정정이 PRD 내부의 잠재적 긴장까지 부수적으로 해소한다는 점에서 방향성이 합리적임을 뒷받침한다.

### [INFO] R-3 의 grounding 은 code evidence + 독립 사전 문서 + 배포된 유저 가이드 3중 교차검증됨

- target 위치: `spec/3-workflow-editor/0-canvas.md` `## Rationale` R-3 (line 785-789)
- 상세: R-3 가 인용하는 근거를 개별 검증한 결과 모두 사실과 일치했다.
  - `spec/data-flow/11-workflow.md` §1.4(line 128-129) — 이번 diff 에 포함되지 않은, **이미 존재하던** 문서로 "수동 Save(`POST /:id/save`)로만 일어난다 — auto-save 는 없으며, 에디터의 500ms debounce 는 저장이 아니라 graph-warning 사전 평가용" 이라고 독립적으로 서술한다. R-3 의 code evidence 와 대상·문구까지 정확히 일치 — 이번 spec 정정이 만들어낸 주장이 아니라 이미 기록돼 있던 사실을 canvas 스펙이 뒤늦게 반영하는 것임을 뒷받침한다.
  - `codebase/frontend/src/content/docs/03-workflow-editor/saving-and-sharing.mdx`(PR #855, target 대비 선행 커밋) — "수동 저장"/"실행 시 자동 저장"/"저장 중.../저장되지 않은 변경 사항/저장됨" 상태 텍스트를 그대로 서술.
  - `codebase/frontend/src/content/docs/03-workflow-editor/settings-panel.mdx` — "Settings 탭은 **변경 저장**, Code 탭은 **JSON 적용** 버튼을 눌러야 반영" 을 그대로 서술.
  - 세 소스 모두 R-3 의 결론과 정확히 부합해, "결정의 무근거 번복"에 해당하지 않는다.
- 제안(경미): R-3 본문은 "의도된 설계로 판단해" 라는 검토자(에이전트) 추론 어투로 끝나지만, 실제 provenance 는 `plan/in-progress/spec-sync-canvas-gaps.md`(§8 항목)에 "사용자 결정 2026-07-08" 로 명시돼 있다. spec Rationale 만 단독으로 읽는 독자를 위해 R-3 본문에도 "(사용자 확인, 2026-07-08)" 같은 provenance 한 구절을 추가하면 plan 파일을 교차 참조하지 않아도 결정의 소유자(추론 vs 명시적 제품 결정)가 명확해진다. 차단 사유는 아님.

### [INFO] 관련 spec 전파 완결성 — 잔존 모순 없음 (참고, 별도 checker cross_spec 과 중복 확인)

- target 위치: `spec/0-overview.md §3.3`, `spec/4-nodes/0-overview.md §1.4`, `spec/3-workflow-editor/2-edge.md §8`, `spec/3-workflow-editor/4-ai-assistant.md` 다수 위치
- 상세: 이번 세션의 `cross_spec.md` 가 이미 Critical 2건(§3.3, §1.4)을 발견→같은 워킹트리에서 fix 확인했음을 재확인했다. 본 rationale-continuity 관점에서 추가로, `4-ai-assistant.md` `## Rationale`의 "기획 결정 메모" 표("변경 적용 방식 | 즉시 반영 + Undo … 기존 저장 흐름과 일관")는 **Assistant 편집이 `editor-store`(in-memory) 에 즉시 반영된다**는, canvas §8 정정과 무관한 별개의 결정(§4.3/§9.2 명시: "DB 영구 기록은 사용자의 Save 를 통해서만")이라 이번 정정과 충돌하지 않는다 — "AI Assistant 편집 즉시 반영" 원칙과 "설정 패널 값 즉시 반영(ED-SP-05, 폐기)" 원칙은 레이어가 다르다(전자는 store 반영, 후자는 그 store 반영조차 폐기된 즉시-저장이 아니라 명시 클릭 필요). 두 "즉시 반영"을 혼동하지 않도록 R-3 나 §5.3.1 에서 이미 "설정 패널 `변경 저장`·`JSON 적용`, 어시스턴트 편집 등" 으로 구분해 서술하고 있어 문제 없음.
- 시스템 invariant 우회 여부: `spec/3-workflow-editor/5-version-history.md`("캔버스 저장과 버전 생성은 원자적") 과 §8.1 정정 내용이 일치하며, 멀티유저 동시 편집/충돌 감지를 전제하는 다른 spec(workspace/collaboration 관련 문서)은 grep 전수 결과 존재하지 않아 "동시 편집 충돌 감지" 폐기가 다른 문서의 암묵적 가정을 깨지 않는다.

## 요약

target 의 §8 저장 모델·ED-SP-05/ED-SV-02 정정은 Rationale 연속성 관점에서 위험이 낮다. 폐기되는 "2초 디바운스 자동 저장 / 오프라인 localStorage / 동시 편집 충돌 감지 / 설정 즉시 반영" 조항은 프로젝트 최초 커밋(Rationale 관행 도입 이전)의 미검증 draft 요구사항이었을 뿐, 그 어떤 spec 의 `## Rationale` 에서도 명시적으로 채택·옹호된 적이 없다 — 따라서 "기각된 대안의 재도입"이나 "합의된 원칙 위반"에 해당하는 CRITICAL 사유가 성립하지 않는다. 신설된 R-3 는 코드 근거(호출처 3곳, remount 폐기 동작, 500ms 디바운스의 실제 용도)와 더불어 이번 diff 이전부터 독립적으로 존재하던 `spec/data-flow/11-workflow.md` 서술, 이미 배포된 유저 가이드 mdx 두 문서 내용과 모두 정확히 일치해 "무근거 번복"도 아니다. 유일한 개선 여지는 R-3 본문에 "사용자 결정(2026-07-08)" provenance 를 명시적으로 한 줄 추가해 plan 파일을 보지 않고도 결정 주체를 알 수 있게 하는 것이며, 이는 INFO 수준의 보완 제안이다.

## 위험도

LOW

STATUS=success CRITICAL=0 WARNING=0
