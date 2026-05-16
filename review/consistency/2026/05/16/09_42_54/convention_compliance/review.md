# 정식 규약 준수 검토 — plan/in-progress/spec-draft-ai-thread-source-mark.md

검토 일시: 2026-05-16
검토 모드: spec draft (--spec)

---

### 발견사항

- **[INFO]** plan 문서가 spec draft 내용을 직접 포함하는 구조
  - target 위치: 문서 전체 (## 변경 대상 1, ## 변경 대상 2)
  - 위반 규약: `CLAUDE.md` §정보 저장 위치 (단일 진실 원칙)
  - 상세: plan 문서 안에 diff·JSON 예시·신규 절(§4.4.6) 전문이 포함되어 있다. plan 문서는 "처리할 항목이 남아있는 추적 문서"로 정의되어 있으며, 기술 명세 본문은 `spec/<영역>/*.md` 에 두는 것이 단일 진실 원칙에 부합한다. 본 문서는 spec 반영 전 검토 단계임을 명시(`/consistency-check --spec` 호출 대상)하고 있으므로 이는 작업 임시 상태이며 spec 반영 후 plan 에서 세부 내용이 제거될 것임을 전제하고 있다. 구조 자체가 반칙은 아니나, plan 에 spec 전문이 남은 채 `complete/` 이동 시 중복 진실 공급원이 생길 위험이 있다.
  - 제안: spec 반영 완료 후 plan 의 변경 내용 상세를 삭제하거나 "완료, spec 반영됨" 요약으로 대체할 것. 현재 draft 단계에서는 허용 가능.

- **[INFO]** `## 변경하지 않는 부분` 섹션 — plan 규약상 비표준 섹션명
  - target 위치: `## 변경하지 않는 부분 (의도적 보존)` 섹션
  - 위반 규약: `CLAUDE.md` 명명 컨벤션 — plan 문서 구조 규약 (frontmatter + 체크리스트 중심)
  - 상세: plan/in-progress 문서는 frontmatter + 체크리스트 항목이 주된 구조이나 규약이 섹션 구성을 명시적으로 제한하지는 않는다. "변경하지 않는 부분" 섹션은 명세 추적 목적에 부합하므로 심각한 위반은 아님.
  - 제안: 형식상 문제 없음. 필요시 체크리스트 항목(`- [ ]`)으로 전환해 완료 추적을 명시해도 좋다.

- **[INFO]** `spec/conventions/conversation-thread.md` §4.4.6 cross-reference 앵커 형식 확인 필요
  - target 위치: 1-E 절 및 2-A 절의 앵커 링크 `#446-messagessource-마커`, `#51-messages-모드-매핑`
  - 위반 규약: 정식 규약 문서 내 cross-reference 패턴 (spec/conventions/conversation-thread.md §5.1 링크 사용 방식)
  - 상세: 현행 `conversation-thread.md` 의 §5.1 heading 이 "messages 모드 매핑"이므로 GitHub Markdown 앵커 `#51-messages-모드-매핑`은 올바르게 생성된다. `#446-messagessource-마커`는 제안하는 신규 절 `#### 4.4.6 \`messages[].source\` 마커`로부터 파생되는 앵커이므로 실제 spec 에 절이 추가된 후에야 유효해진다. draft 단계에서는 미래 앵커를 선점하는 형태로 허용 가능하나, 반영 전 broken link 상태임을 인지해야 한다.
  - 제안: spec 반영 완료 후 양쪽 링크를 검증할 것.

---

### 요약

target 문서(`plan/in-progress/spec-draft-ai-thread-source-mark.md`)는 정식 규약을 전반적으로 준수하고 있다. frontmatter(`worktree`, `started`, `owner`)가 규약대로 작성되어 있고, 변경 대상이 `spec/5-system/6-websocket-protocol.md`와 `spec/conventions/conversation-thread.md`로 올바른 spec 경로를 지정하며, 금지된 옛 경로(`prd/`, `memory/` 등)를 참조하지 않는다. 신규 절(§4.4.6)에 `## Rationale` 에 해당하는 근거가 충실히 포함되어 있고, `spec/conventions/conversation-thread.md`의 CHANGELOG 갱신도 명시되어 있다. CRITICAL·WARNING 수준의 위반은 발견되지 않았으며, 발견된 3건은 모두 draft 단계의 구조적 특성에서 비롯된 INFO 수준의 형식 제안이다.

### 위험도

NONE
