# 정식 규약 준수 검토 — `spec/5-system/**` (`--impl-prep`, scope=`spec/5-system/`)

## 검토 방법

번들 프롬프트의 `spec/conventions/**` 는 예산 초과로 대부분 title-only stub 이라, 이 target 과 직접
관련된 `spec/conventions/spec-impl-evidence.md`·`swagger.md`·`error-codes.md`·`secret-store.md` 는
저장소에서 직접 `Read`/`grep` 으로 열어 대조했다. target 본체는 `git diff origin/main...HEAD` 로
이번 브랜치(`eia-inputdata-marker-guard`)가 실제로 건드린 7개 spec 파일
(`spec/5-system/{6-websocket-protocol,12-webhook,13-replay-rerun,14-external-interaction-api}.md`,
`spec/1-data-model.md`, `spec/3-workflow-editor/3-execution.md`, `spec/4-nodes/1-logic/12-background.md`)
로 좁혀 diff 라인 단위로 검토했고, 각 파일이 "이미 됐다"고 서술하는 동작을 실제
`codebase/backend`·`codebase/frontend` 소스에서 `grep` 으로 대조했다. 또한 이 작업의 SoT 트래커
(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)와 진행 plan
(`plan/in-progress/eia-inputdata-marker-guard.md`)을 읽어 구현 착수 여부를 확인했다.

## 발견사항

### [CRITICAL] `status: implemented`/`partial` 문서 4~6곳이 아직 코드에 없는 표면을 "이미 됐다"로 단언 — `spec-impl-evidence.md` R-5 의 "빈 약속" 금지 위반

- target 위치:
  - `spec/5-system/12-webhook.md:326` — `> **2026-08-20 부터 그 갭을 덮는 후속 층이 생겼다** — inputData 도 … egress 값-마스킹 대상이다.`
  - `spec/5-system/13-replay-rerun.md:358` — `> **전환 (2026-08-20)**: 프리필 값이 마스킹 마커면 프리필하지 않고 … Re-run 제출을 막는다.`
  - `spec/4-nodes/1-logic/12-background.md:246` — `… 지금은 **두 레벨 모두** 마스킹한다(프런트 마커 가드가 서면서 카브아웃이 닫혔다)`
  - `spec/3-workflow-editor/3-execution.md:91` — `**적재된 JSON 에 마스킹 마커(***  등)가 남아 있으면 Run 이 비활성**된다`
  - `spec/5-system/6-websocket-protocol.md:205` — `> **Execution.inputData(REST)도 마스킹한다 (2026-08-20)**`
  - `spec/5-system/14-external-interaction-api.md:1564` — `**닫는 조건은 충족됐다 (2026-08-20)**` + 바로 아래 "소비처/가드/시점" 표(세 소비처 모두 "2026-08-20" 로 이미 갖춰졌다고 명시)
- 위반 규약: `spec/conventions/spec-impl-evidence.md` §3 `status` 라이프사이클(`implemented` = "모든 약속 구현 완료", `partial` = `pending_plans:` **의무**) + §Rationale R-5(`status: partial` 의 `pending_plans:` 의무화 — "spec 이 자기를 책임지는 plan 을 가리킴", 텔레그램 chat-channel 사례의 "어떤 plan 도 책임지지 않는 빈 약속" 재발 방지가 신설 근거).
- 상세: 위 6곳은 전부 **오늘(2026-08-20) 날짜를 못박아 "이미 마스킹한다/이미 차단한다/닫혔다"** 고 현재완료·현재시제로 단언한다. 그런데 실제 코드를 대조하면 전부 미착수 상태다.
  - Backend: `codebase/backend/src/modules/executions/executions.service.ts:90-94` 는 지금도 `MASKED_INPUT_DATA_REASON` 을 선언하고 `Execution.inputData` 를 **의도적으로 마스킹하지 않는다** (`1044` 줄 주석 "**`inputData` 는 의도적으로 마스킹하지 않는다**" 그대로 살아있음). `dto/responses/execution-response.dto.ts:55,179` 와 `background-run-response.dto.ts:51` 도 같은 카브아웃을 여전히 문서화하고 있다.
  - Frontend: `codebase/frontend/src/components/executions/rerun-modal.tsx` 에는 `isMaskedMarker`/마커 감지 로직이 전혀 없다(`grep` 0건) — §10.2 가 말하는 "비어 있는 동안 제출 차단" 은 코드에 없다. `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` 도 마커 검사 로직이 없다(`grep` 0건) — §2.2 가 말하는 "Run 비활성" 은 코드에 없다.
  - `plan/in-progress/eia-inputdata-marker-guard.md` 자신의 체크리스트도 "Re-run 모달 마커 가드"·"에디터 히스토리 로드 마커 가드"·"backend — egress 마스킹으로 전환" 이 전부 `[ ]` 미완이고, `--impl-prep 재실행` 항목 자체가 이번 라운드용으로 아직 `[ ]` 다.
  - `plan/in-progress/spec-sync-external-interaction-api-gaps.md:281`(이 항목의 SoT 트래커)도 여전히 `[ ]` **미해결**로 남아 있어, spec 본문의 "닫혔다" 선언과 트래커 자신의 "열림" 표기가 **서로 모순**한다.
  - 이 중 `12-webhook.md`·`13-replay-rerun.md`·`4-nodes/1-logic/12-background.md`·`3-workflow-editor/3-execution.md` 4개 파일은 frontmatter `status: implemented` 이고 **`pending_plans:` 필드 자체가 없다** — R-5 가 막으려던 정확히 그 형태("책임지는 plan 이 없는 새 약속")다. `6-websocket-protocol.md` 는 `status: partial` 이지만 `pending_plans:` 가 `spec-sync-websocket-protocol-gaps.md`(WS 프로토콜의 다른 갭 트래커) 를 가리켜 이 항목과 무관하다(`grep` 0건). `14-external-interaction-api.md` 는 `pending_plans:` 가 `spec-sync-external-interaction-api-gaps.md` 를 가리켜 이 항목을 **간접적으로는** 추적하지만, 그 트래커 라인 자체가 아직 미체크라 본문의 "충족됐다" 단언과 어긋난다.
  - 이 저장소의 선례(`107c8038f` 코드 수정 → `b5e4dbb9c` spec 반영, 코드가 **먼저** 착지한 뒤 spec 이 사실을 뒤따라 적는 순서)와 반대로, 이번엔 spec 이 미착수 코드를 앞질러 "완료"로 적었다 — SDD 자체(spec-first)는 이 저장소의 정상 워크플로지만, 그 중간 상태를 표현하는 **정식 메커니즘**(`status: partial` + `pending_plans:`)을 이번엔 쓰지 않았다.
- 제안: developer 턴이 실제로 착수하기 전까지, 위 4개 `implemented` 문서를 임시로 `status: partial` + `pending_plans: [plan/in-progress/eia-inputdata-marker-guard.md]` 로 내리고(구현 완료 후 `implemented` 로 복귀), `6-websocket-protocol.md`/`14-external-interaction-api.md` 의 `pending_plans:` 에도 이 plan 경로를 추가해 "이 약속을 누가 책임지는가" 를 명시한다. 대안으로, 이 브랜치가 **같은 PR 안에서** 즉시 구현을 이어 붙여 push 전에 코드-스펙이 정합해진다면(현재 plan 의 다음 미체크 항목들이 그 경로) 이 CRITICAL 은 merge 시점엔 해소되지만, **그 사이 어느 시점에 이 스냅샷만 별도로 읽는 사람/에이전트**(예: 이 `--impl-prep` 게이트 자체, 또는 병렬 검토자)에게는 "자격증명이 이미 마스킹된다"는 거짓 안전 신호가 된다 — 자격증명 노출이라는 보안 민감 주제라 이 창이 짧더라도 정식 메커니즘으로 닫아 두는 편이 안전하다.

### [WARNING] R17 "적용 표면은 열거다" 원칙과 자기 모순 — 새 약속을 "열거"에 넣기 전에 실장부터 확인해야 했다

- target 위치: `spec/5-system/14-external-interaction-api.md:1518-1525` (같은 R17 안, "적용 범위는 총칭이 아니라 열거다" 불릿, `**inputData 도 이 목록의 대상이다** (2026-08-20, 아래 잔여 ② 종결)`)
- 위반 규약: 문서 자신이 세운 국소 규율 — 바로 그 불릿이 *"종전 이 자리는 '4곳' 이라 적었는데 이후 여섯으로 늘며 낡았다"* 고, 열거는 **실측 갱신**이어야 한다는 교훈을 스스로 남겨 두고 있다(`spec-impl-evidence.md` 의 상위 원칙과 같은 정신).
- 상세: 위 CRITICAL 과 같은 원인이지만 초점이 다르다 — R17 의 "적용 표면 열거" 목록은 이 문서가 **실제로 코드가 하고 있는 일**의 인벤토리로 기능해 왔다(예: `(1) findById (2) getChain … (6) toNodeExecutionDto`). 이번 diff 는 그 열거에 `inputData` 를 추가하며 "종결됐다"고 적었는데, 열거의 다른 5항목과 달리 이 항목만 **코드가 아직 하지 않는 일**이다. 같은 표 안에 "실제로 일어나는 일"과 "아직 안 일어나는 일"이 구분 없이 섞이면, 이 열거를 근거로 삼는 다음 리뷰(예: 보안 감사, 다른 spec 문서의 인용)가 오판할 수 있다.
- 제안: 위 CRITICAL 의 수정과 함께, 이 불릿에도 "(구현 대기 — `eia-inputdata-marker-guard` plan)" 같은 상태 마커를 붙이거나, 구현 완료 후 병합하는 편이 이 문서 자신의 "열거는 실측" 원칙과 정합한다.

## 검증한 정합 항목 (참고 — 이번 diff 범위)

- **글리프 규율 유지**: R17 "표면 1~6"(아라비아) vs "잔여 ①②③"(원형) 구분이 이번 diff 에서도 깨지지 않았다(`잔여 ②` 표기 유지).
- **교차참조 링크**: 이전 라운드(12_29_59)가 지적한 "일부 문단이 마크다운 링크 대신 평문 괄호를 쓴다"는 INFO 는 실제 spec 반영 시 전부 `[EIA §R17](...)` / `[Re-run §10.2](...)` 형태로 정상화되어 있다 — 회귀 없음.
- **`code:` frontmatter 대칭성**: 이전 라운드가 제안한 `rerun-modal.tsx` → `13-replay-rerun.md` `code:` 등재가 실제로 반영되어 있다(파일 상단 frontmatter 확인).
- **문서 구조(Overview/본문/Rationale)**: 이번 diff 는 기존 절 내부 문구만 고치고 섹션 배치를 바꾸지 않아 3섹션 구조에 영향 없음.
- **명명 규약**: 새 API/endpoint/에러 코드 신설 없음 — 이번 diff 는 서술 변경뿐이라 URL·에러 코드·Redis 키 등 명명 규약 대상 자체가 없음(N/A).
- **Swagger/DTO 규약**: 이번 diff 는 `spec/` 만 건드리고 DTO(`*.dto.ts`)는 아직 건드리지 않았다. 다만 `execution-response.dto.ts`/`background-run-response.dto.ts` 의 `inputData` JSDoc 은 여전히 "마스킹 대상이 아니다" 라고 적혀 있어(위 CRITICAL 과 같은 근거), developer 턴이 코드를 고칠 때 `swagger.md §3` 예외 조항(요약 1~2문장 + SoT 링크 형태)에 맞춰 이 JSDoc 도 함께 재작성해야 한다 — 이는 이전 라운드(12_41_29)가 이미 남긴 인수인계 메모이고 이번 target(spec 파일) 자체의 위반은 아니라 재차 INFO 로만 남긴다.

## 요약

이번 diff 가 spec 문서 6곳에 반영한 "`Execution.inputData` egress 마스킹 카브아웃 폐지" 결론은 서술 형식(링크·글리프·표 구조·`code:` 대칭)만 놓고 보면 정식 규약을 잘 따른다. 그러나 그 서술 **내용**이 문제다 — 4개 문서(`12-webhook.md`·`13-replay-rerun.md`·`4-nodes/1-logic/12-background.md`·`3-workflow-editor/3-execution.md`)가 `status: implemented`(`pending_plans:` 없음) 상태로 "오늘부터 마스킹/차단된다"고 단언하지만, 백엔드(`MASKED_INPUT_DATA_REASON` 카브아웃 그대로)·프런트(Re-run 모달·에디터 히스토리 로드 모두 마커 가드 로직 0건)를 실측하면 전혀 구현되지 않았다. 이는 `spec/conventions/spec-impl-evidence.md` R-5 가 명시적으로 막으려 한 "책임지는 plan 이 없는 새 약속" 패턴이며, 이 프로젝트가 반복 지적해 온 "문서한 보장이 구현보다 넓으면 안 된다" 실패 형태와 동형이다. `--impl-prep` 게이트가 developer 착수 직전 시점이라는 점을 감안하면, 이 상태로 통과시키기보다 `status: partial` + `pending_plans:` 로 임시 다운그레이드하거나 구현을 즉시 이어 붙여 push 전에 정합을 맞추는 조치가 필요하다.

## 위험도

CRITICAL
