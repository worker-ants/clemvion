# 정식 규약 준수 검토 — spec draft: `plan/in-progress/spec-draft-integration-personal-owner-assistant.md`

## 발견사항

- **[WARNING]** 변경 항목 (1) 의 대상 절 번호가 실제 절과 다르다 (§4.2 → 실제는 §4.1)
  - target 위치: target 문서 `## 변경안 — spec/3-workflow-editor/4-ai-assistant.md` `### (1) §4.2 탐색 도구 표 — list_integrations 행 설명`, 그리고 `## Rationale` `- **남은 이 문서의 drift 는 다루지 않는다**` 불릿 (같은 오기가 두 번 등장)
  - 위반 규약: 직접 대응하는 `spec/conventions/*` 조항은 없다. 다만 `spec/conventions/spec-impl-evidence.md` Overview 가 정의하는 핵심 invariant — "spec 가 약속한 surface 가 *지금* 구현됐는가" 를 문서가 정확히 짚어야 한다는 전제 — 가 절 번호 오기로 훼손될 수 있어 §4 family 관점에서 밝힌다.
  - 상세: target 문서는 `list_integrations` 행 설명 변경을 "§4.2 탐색 도구 표" 로 지칭하지만, 실제 `spec/3-workflow-editor/4-ai-assistant.md` 를 확인하면 `list_integrations` 행은 `### 4.1 탐색 도구 (Clarify, read-only)` 표(라인 196-208)에 있고, `### 4.2 계획 도구 (Plan, no-op on canvas)`(라인 300)는 `propose_plan`/`clear_plan` 전용으로 `list_integrations` 와 무관하다. 같은 오기가 `## Rationale` 의 "남은 이 문서의 drift 는 다루지 않는다" 불릿에도 "§4.2 list_integrations 의 출력 열…" 로 반복된다. 변경안 (2)(`§4.3.1`)와 (3)(`Rationale ED-AI-39` 1번)는 실제 위치와 정확히 일치함을 확인했다 — 이 항목만 어긋난다.
  - 제안: "§4.2" 를 "§4.1" 로 정정한다(두 자리 모두). 실행 위험은 완화 요인이 있다 — 변경안이 치환 대상 원문(«현재 워크스페이스에 등록된 Integration 목록»)을 그대로 인용하므로, 절 번호만 보고 기계적으로 §4.2 표를 편집하지 않는 한 리터럴 매칭으로 올바른 위치를 찾을 수 있다. 그럼에도 절 번호가 틀린 채로 남으면 향후 이 draft 를 다시 참조하는 사람·에이전트를 오도할 수 있으므로 이번 커밋에서 정정을 권장한다.

## 요약

target 문서는 `plan/in-progress/spec-draft-*.md` 계열의 기존 선례(같은 PR 의 `spec-draft-integration-personal-owner.md`, `spec-draft-eia-62-waiting-payload.md` 등)와 frontmatter 스키마(`worktree`/`started`/`owner`/`spec_impact`) · 본문 구성(맥락 문단 → `## 변경안` → `## Rationale`) · 절 라벨링 방식((1)(2)(3) 숫자형, 기존 `spec-draft-eia-*` 문서들과 동일) 모두 일치해 정식 규약 위반은 없다. 실제로 제안하는 두 곳의 markdown 링크(`../2-navigation/4-integration.md#8-권한-규칙`)도 대상 spec 의 `## 8. 권한 규칙` 헤딩과 정확히 일치해 링크 무결성 문제가 없고, 변경 (2)·(3)이 인용한 원문도 대상 spec 의 실제 텍스트와 정확히 일치한다. 유일한 흠은 변경 (1)의 절 번호가 §4.2 로 잘못 표기된 것(실제는 §4.1)으로, 리터럴 텍스트 인용 덕에 실행 리스크는 낮지만 정정이 바람직하다.

## 위험도
LOW
