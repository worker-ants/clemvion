# 정식 규약 준수 검토 — convention_compliance

**대상 문서**: `plan/in-progress/spec-telegram-chat-channel-ui-polish.md`
**검토 모드**: spec draft 검토 (--spec)
**검토일**: 2026-05-23

---

## 발견사항

### [WARNING] 영향 spec 파일 표에 `Rationale R10/R11/R12` 와 `R-CC-10/11/12` 혼용
- **target 위치**: `## 영향 spec 파일` 표의 `spec/5-system/15-chat-channel.md` 행 변경 요약 (`Rationale R10/R11/R12 추가`)
- **위반 규약**: CLAUDE.md §정보 저장 위치 — "결정의 배경·근거"는 해당 spec 문서 끝의 `## Rationale`에 위치하며, 문서 내 식별자 명명은 해당 문서의 기존 컨벤션을 따라야 함. 또한 동 plan 의 `## Rationale ID 컨벤션` 절은 `15-chat-channel.md` 내 신규 Rationale 을 `R-CC-10/R-CC-11/R-CC-12` prefix 로 명시함.
- **상세**: `## 영향 spec 파일` 표(line 139)에서는 "Rationale **R10/R11/R12** 추가" 라고 기술하는 반면, 바로 아래 `## Rationale ID 컨벤션` 절(line 157)에서는 `R-CC-10 / R-CC-11 / R-CC-12` 를 정식 prefix 로 확정했다. 두 절 사이에서 같은 plan 내 naming 이 불일치해 구현자가 혼동할 수 있다.
- **제안**: `## 영향 spec 파일` 표의 해당 셀을 `Rationale R-CC-10/R-CC-11/R-CC-12 추가` 로 일관성 있게 수정.

---

### [WARNING] 결정 4 제목과 정책 본문의 HTTP 응답 코드 불일치
- **target 위치**: `### 결정 4 — Inbound HTTP Contract (200 OK 고정 + auth 실패 정책)` 제목 (line 100)
- **위반 규약**: `spec/conventions/chat-channel-adapter.md` §3 매핑 표 및 `spec/5-system/2-api-convention.md` 응답 정책. 특히 spec 문서의 출력 포맷 규약으로서 응답 코드 값이 일관되어야 함.
- **상세**: 결정 4 의 소제목은 "**200 OK** 고정" 이라고 표기하고 있으나, 정책 본문(line 111)에서는 "모든 chat channel webhook inbound 정상 응답은 **`202 Accepted`**" 로 명시하고, Rationale(a) 에서도 `202` 를 기존 SoT 로 채택했음을 서술한다. 제목의 `200 OK` 는 실제 결정과 반대되는 오기이며, 이 제목이 그대로 spec PR 제목이나 커밋 메시지로 노출되면 혼동을 유발한다.
- **제안**: 결정 4 소제목을 `결정 4 — Inbound HTTP Contract (202 Accepted 고정 + auth 실패 정책)` 으로 수정.

---

### [WARNING] `chat-channel-adapter.md §7` 변경 관리 조항 해석과 plan 의 3-파일 원자성 간 조항 범위 논거 불완전
- **target 위치**: `### 결정 3` 의 "원자적 동시 갱신 의무" 단락 (line 63)
- **위반 규약**: `spec/conventions/chat-channel-adapter.md §7` — "본 인터페이스 변경은 `15-chat-channel.md` (시스템 정의) + `spec/4-nodes/7-trigger/providers/<name>.md` (모든 구체 어댑터 명세) 두 외부 spec 동시 갱신 의무 + `providers/_overview.md` catalog 도 함께 갱신"
- **상세**: plan 은 "`providers/_overview.md` catalog 는 provider 목록이 아니라 enum 한 필드 변경이라 본 결정에서는 갱신 불필요" 라고 선언하며 `Rationale 에 그 판단 명시` 라고 한다. 그러나 `chat-channel-adapter.md §7` 은 "catalog 도 함께 갱신" 을 명시적 의무로 적고 있으며, "enum 필드 변경이라 불필요" 라는 예외 근거가 컨벤션 파일 어디에도 없다. 이 예외를 인정하려면 컨벤션 파일 §7 에 예외 조건을 추가해야 한다.
- **제안**: 다음 두 방향 중 하나를 선택.
  - (권장) `spec/conventions/chat-channel-adapter.md §7` 에 "provider 목록 변경 아닌 공통 타입 변경 시 `_overview.md` 갱신 불필요" 예외 조항을 한 줄 추가하고, 해당 판단 근거를 컨벤션 Changelog 에 기록.
  - (대안) plan 의 해당 단락에서 `providers/_overview.md` 갱신을 의무 목록에 포함시키되 실제 변경 내용이 없음을 Changelog 행으로만 처리.

---

### [INFO] frontmatter `owner` 값 표기 방식이 다른 plan 과 미미한 불일치
- **target 위치**: frontmatter (line 4): `owner: project-planner`
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — frontmatter 스키마 예시에서 `owner` 는 `<역할/이름>` 으로 자유 기술 (enum 강제 없음). 위반이 아니나 완전한 일치를 위한 정보 공유.
- **상세**: 기존 plan 파일들이 `planner`, `developer`, 또는 사용자 이름 등을 혼용하는 경향이 있으나, `project-planner` 는 CLAUDE.md 의 역할명과 정확히 일치하므로 엄밀히는 더 명확하다. 현행 유지 가능.
- **제안**: 현행 유지. INFO 등급으로 기록만 남김.

---

### [INFO] 후속 plan 이름 형식이 명명 컨벤션과 미미하게 다름
- **target 위치**: `## 후속 plan` 항목 1 (line 165): `developer-trigger-list-chat-channel-card-ui`
- **위반 규약**: CLAUDE.md §정보 저장 위치 — `plan/in-progress/<name>.md` 의 `<name>` 은 파일명이지만, 기존 in-progress plan 의 파일명 패턴을 보면 `spec-<domain>`, `fix-<domain>`, `chat-channel-<domain>` 등 역할 prefix 를 앞에 붙이지 않거나 `spec-` / `fix-` 처럼 작업 유형 prefix 를 붙이는 패턴이 주류.
- **상세**: `developer-` prefix 를 파일명 앞에 붙이는 형식이 다른 기존 파일명과 일치하지 않는다. 반면 이는 plan 내 비공식 참조명이고 실제 파일이 아직 없어 현재 단계에서 강제 위반은 아님.
- **제안**: 실제 파일 생성 시 기존 패턴에 맞추어 `trigger-list-chat-channel-card-ui.md` 또는 `spec-telegram-chat-channel-card-ui.md` 형식을 권장.

---

### [INFO] 라이프사이클 섹션의 spec 파일 수 카운트 불일치 (4 vs 5)
- **target 위치**: `## 라이프사이클` (line 181): "본 plan 의 spec **4 파일** 변경이 한 PR 로 머지되면"
- **위반 규약**: CLAUDE.md §정보 저장 위치 — plan 은 단일 진실을 유지해야 함.
- **상세**: `## 영향 spec 파일` 표 (line 136~143)에는 5개 파일이 열거되어 있다 (`2-trigger-list.md`, `15-chat-channel.md`, `12-webhook.md`, `chat-channel-adapter.md`, `telegram.md`). 그러나 라이프사이클 절에서는 "4 파일" 이라 기술하고 있어 숫자가 맞지 않는다.
- **제안**: `## 라이프사이클` 의 "spec 4 파일" 을 "spec 5 파일" 로 수정.

---

## 요약

`plan/in-progress/spec-telegram-chat-channel-ui-polish.md` 는 전반적으로 CLAUDE.md 의 plan frontmatter 스키마 (`worktree`, `started`, `owner`) 를 완전히 준수하며, 단일 진실 원칙에 따라 결정의 canonical 위치를 spec 파일별로 명시하고 각 Rationale 을 해당 spec 문서 끝에 배치하도록 안내한다. `spec/conventions/chat-channel-adapter.md` 의 변경 관리 조항 인용도 정확히 이루어졌다. 다만 결정 4 소제목의 HTTP 응답 코드 오기(200 vs 202)가 실질적 혼동을 유발할 수 있고, 영향 파일 표와 Rationale ID 컨벤션 절 사이의 Rationale prefix 불일치가 구현자에게 오신호를 줄 가능성이 있다. `chat-channel-adapter.md §7` 의 `_overview.md` 갱신 의무 면제 근거가 컨벤션 파일 자체에 없다는 점도 규약 정합성 관점에서 보완이 필요하다. INFO 항목 두 건(후속 plan 명명 스타일, 라이프사이클 파일 수 오기)은 차단하지 않으나 실제 spec PR 작성 전 수정 권장.

---

## 위험도

**MEDIUM**
