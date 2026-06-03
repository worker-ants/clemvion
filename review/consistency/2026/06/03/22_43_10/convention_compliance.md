# Convention Compliance Review

검토 모드: impl-done | 대상: `spec/` (diff-base=origin/main)

---

## 발견사항

### [INFO] node-output.md — `## Rationale` 섹션 부재

- **target 위치**: `spec/conventions/node-output.md` 전체
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "결정의 배경·근거 | 해당 spec 문서 끝의 `## Rationale`"; `spec/0-overview.md §8 문서 컨벤션` — "N-name.md — 본문 끝에 `## Rationale` 섹션으로 결정 근거 inline"
- **상세**: `node-output.md` 는 `spec/conventions/` 소속 정식 규약 문서로 `spec-impl-evidence.md §1` 적용 대상이다. 다른 convention 파일(cafe24-api-metadata, error-codes, execution-context, node-cancellation 등)이 모두 `## Rationale` 섹션을 보유하는 반면, `node-output.md` 는 해당 섹션이 전혀 없다. Principle 0~11 의 설계 결정(특히 `config`·`output` 직교성, `meta` 분리, `_resumeCheckpoint` 예외 허용 등)의 근거가 본문에 산재하나 정식 Rationale 섹션으로 집약되지 않았다.
- **제안**: `spec/conventions/node-output.md` 말미에 `## Rationale` 섹션 추가. Principle 1.1 config·output 직교성 채택 근거, `_resumeState`·`_resumeCheckpoint`·`_retryState` internal 필드 예외 허용 결정, `output.result` 래핑을 LLM 계열 3종 한정으로 제한한 이유 등을 최소 3개 항으로 기재.

---

### [INFO] swagger.md — `## Rationale` 섹션 부재

- **target 위치**: `spec/conventions/swagger.md` 전체
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "결정의 배경·근거 | 해당 spec 문서 끝의 `## Rationale`"; 같은 `spec/conventions/` 파일들의 관행
- **상세**: `swagger.md` 는 DTO 패턴·공용 래퍼 헬퍼·응답 wrapping 등 설계 결정이 많음에도 `## Rationale` 섹션이 없다. `ApiOkPaginatedResponse` 도입 배경, `readOnly`/`writeOnly` 의무화 근거, 레거시 패턴 제거 이유 등이 문서화되지 않았다.
- **제안**: `spec/conventions/swagger.md` 말미에 `## Rationale` 섹션 추가. `ApiOkWrappedResponse` 패턴 채택, `writeOnly/readOnly` 의무화, 빈 껍데기 스키마 금지 결정의 근거를 기재.

---

### [INFO] conversation-thread.md — Rationale 섹션이 번호 붙은 `## 8. Rationale` 형식

- **target 위치**: `spec/conventions/conversation-thread.md` §8
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "결정의 배경·근거 | 해당 spec 문서 끝의 `## Rationale`" (bare heading 명시)
- **상세**: `## 8. Rationale` 처럼 번호가 앞에 붙은 형식을 사용한다. 같은 `spec/conventions/` 내 다른 파일(cafe24-api-metadata, error-codes, node-cancellation 등 대부분)은 `## Rationale` (번호 없음)을 일관 사용한다. `data-hydration-surfaces.md` 와 `interaction-type-registry.md` 도 같은 패턴 위반에 해당한다.
- **제안**: `## 8. Rationale` → `## Rationale` 로 교체 (섹션 번호 제거). 동일 패턴을 보이는 `data-hydration-surfaces.md` 와 `interaction-type-registry.md` 도 함께 교체.

---

### [INFO] migrations.md — Rationale 역할의 섹션명이 `## 7. 폐기 대안 (Rationale)` 형식

- **target 위치**: `spec/conventions/migrations.md` §7
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "결정의 배경·근거 | 해당 spec 문서 끝의 `## Rationale`"
- **상세**: 폐기 대안 서술이 `## 7. 폐기 대안 (Rationale)` 섹션 안에 담겨 있어 내용적으로는 Rationale 역할을 하지만, 표준 `## Rationale` heading 이 없다. 다른 convention 파일들과 heading 형식이 불일치한다.
- **제안**: `## 7. 폐기 대안 (Rationale)` → `## Rationale` 로 교체하거나, `## Rationale` 섹션을 별도로 추가하고 현 내용을 흡수.

---

### [INFO] data-flow/ 파일들 — spec-impl-evidence.md §1 적용 대상 외이나 frontmatter 미보유

- **target 위치**: `spec/data-flow/1-audit.md` 외 전체 `spec/data-flow/*.md`
- **위반 규약**: 해당 없음 (INFO 레벨)
- **상세**: `spec/data-flow/` 는 `spec-impl-evidence.md §1` 의 적용 대상 목록(`spec/2-navigation/`, `spec/3-workflow-editor/`, `spec/4-nodes/`, `spec/5-system/`, `spec/7-channel-web-chat/`, `spec/conventions/`)에 포함되지 않아 frontmatter `id`/`status` 의무가 없다. 현재 frontmatter 미보유 상태는 정합하다. 단, 이 디렉토리가 향후 성장할 경우 적용 대상 포함 여부를 재검토할 필요가 있다.
- **제안**: 현 상태 유지 가능. 단 `spec-impl-evidence.md §1` 예외 목록에 `spec/data-flow/**` 명시적 언급이 없으므로, 범위 문서가 확장될 때 명시적으로 제외 사유를 기재하는 것을 권장.

---

## 요약

검토 대상인 `spec/` 전체 범위에서 **CRITICAL 또는 WARNING 등급의 정식 규약 위반은 발견되지 않았다**. 모든 발견사항은 INFO 등급으로, 주로 `spec/conventions/` 하위 파일들에서 `## Rationale` 섹션의 부재 또는 번호 포함 형식(`## N. Rationale`)으로 인한 heading 불일치 패턴이다. 핵심 구조 규약(frontmatter `id`/`status`/`code:`, `pending_plans:` 실존, API endpoint kebab-case, 응답 래퍼 `{ data: ... }`, 에러 코드 `UPPER_SNAKE_CASE`, DB `status_reason` `snake_case` 의도적 분리)은 모두 준수되고 있다. `spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/0-dashboard.md`, `spec/2-navigation/1-workflow-list.md` 는 각각의 규약(문서 유형별 frontmatter 면제·의무, 3섹션 권장 구조)을 올바르게 따른다.

---

## 위험도

LOW
