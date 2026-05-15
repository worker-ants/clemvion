`spec/conventions/` 내 5개 파일을 교차 검토합니다.

---

## 발견사항

- **[WARNING]** `conversation-thread.md` — §2.5가 §3 뒤에 배치됨 (섹션 순서 오류)
  - target 위치: `spec/conventions/conversation-thread.md`, `### 2.5 nextSeq 원자성` 블록
  - 위반 규약: CLAUDE.md §프로젝트 스펙 문서 — "latest에 대한 기술, 정합성이 흐려질 경우 정리·재구성"
  - 상세: 문서 구조가 §1 → §2(2.1~2.4) → §3(3.1~3.3) → **§2.5** → §4 순으로 되어 있어, §2.5가 §3 이후에 삽입되어 있음. 독자가 §3까지 읽고 나서 `### 2.5`를 마주치면 섹션 트리가 깨진 것으로 혼동.
  - 제안: `### 2.5 nextSeq 원자성`을 `### 2.4 opt-out` 바로 다음(§3 이전)으로 이동.

- **[WARNING]** `conversation-thread.md` §5.1 — `system` source의 `role: 'system'` Anthropic 비호환이 "v1 실질 문제 없음"으로만 처리되고 우회 정책 미확정
  - target 위치: §5.1 messages 모드 매핑 표, `system` row
  - 위반 규약: `node-output.md` Principle 3.1 — Pre-flight 에러(config 오류)는 명확히 throw / port:'error' 중 하나로 처리해야 함; Principle 0 — 5-필드 invariant는 어떤 노드에서든 동일해야 함
  - 상세: `system` source turn을 messages 모드로 주입할 때 `role: 'system'`이 Anthropic provider에서 깨지는데, "수동 push 도입 시 provider 분기 검증 필수"라는 주석만 있고 v1 내 우회 정책(예: `system_text` 모드 자동 강제 또는 throw)이 정의되지 않음. 향후 구현자가 모호하게 해석할 수 있음.
  - 제안: `system` source 사용 시 provider가 anthropic이면 messages 모드를 허용하지 않고 `system_text` 모드로 자동 강제하거나, 또는 사용자가 `contextInjectionMode='messages'`로 설정한 경우 `system` turn을 silent drop한다는 v1 정책을 §5.1에 한 줄 명시.

- **[INFO]** `cafe24-api-metadata.md`, `node-output.md`, `swagger.md` — `## Rationale` 섹션 부재
  - target 위치: 각 파일 말미
  - 위반 규약: CLAUDE.md §프로젝트 스펙 문서 — "각 spec 문서는 권장 3섹션 구성(Overview·본문·Rationale)을 따른다"
  - 상세: `conversation-thread.md`는 `## 8. Rationale`을 갖추고 있고 `migrations.md`는 §7에서 폐기 대안을 다루지만, 나머지 3개 파일에는 설계 결정 배경이 없어 향후 규약 개정 시 근거를 추적하기 어려움.
  - 제안: 각 파일에 `## Rationale` 섹션 추가 (최소 2~3줄). 또는 규약 특성상 Rationale 생략을 공식 면제로 정하려면 CLAUDE.md에 "conventions 파일은 Rationale 선택"이라고 명시.

- **[INFO]** `migrations.md` §7 — Rationale 섹션명이 비표준
  - target 위치: `spec/conventions/migrations.md`, `## 7. 폐기 대안 (Rationale)`
  - 위반 규약: CLAUDE.md §정보 저장 위치 — `## Rationale` 섹션으로 표준화
  - 상세: `conversation-thread.md`는 `## 8. Rationale`로 단일 표준명을 사용하는 반면, `migrations.md`는 `## 7. 폐기 대안 (Rationale)`을 사용해 표기가 불일치.
  - 제안: `## 7. 폐기 대안 (Rationale)` → `## Rationale` (또는 `## 7. Rationale`) 로 변경.

- **[INFO]** `node-output.md`, `swagger.md` — CHANGELOG 섹션 없음
  - target 위치: 각 파일 말미
  - 위반 규약: 명시적 규약은 없으나 `cafe24-api-metadata.md`·`conversation-thread.md`·`migrations.md` 3개 파일 모두 CHANGELOG 표를 가지고 있어 관행상 불일치.
  - 제안: 일관성을 위해 `## CHANGELOG` 섹션 추가, 또는 conventions 파일 전체에서 CHANGELOG를 공식 필수/선택으로 통일.

---

## 요약

5개 컨벤션 파일 간 **CRITICAL 위반은 없다.** 핵심 규약(node-output Principle, conversation-thread 자료구조, Cafe24 메타데이터 형식, migrations 버전 정책, Swagger 패턴)의 **내부 정합성과 상호 cross-reference(§meta.contextInjection, §interaction.data 형식 등)는 일치**한다. 다만 `conversation-thread.md`에서 §2.5가 §3 뒤에 삽입된 구조 오류(WARNING)와 `system` source messages 모드 미확정 정책(WARNING), 그리고 Rationale/CHANGELOG 섹션 부재 등 일관성 결함(INFO)이 발견된다. 구현 착수 차단 사유는 없으나 §2.5 위치 이동은 착수 전 수정을 권장한다.

---

## 위험도

**LOW**