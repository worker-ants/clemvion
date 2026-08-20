# Rationale 연속성 검토 — spec/5-system/ (eia-inputdata-marker-guard)

## 점검 대상
- diff-base `origin/main` → HEAD(`2c628f6ac`), scope `spec/5-system/` (impl-done)
- 핵심 변경: `Execution.inputData` egress 마스킹 **카브아웃 폐지**(2026-08-16 결정의 번복) — 프런트 마커 가드(폼 프리필 스킵·Re-run 모달 제출 차단·에디터 히스토리 로드 차단)가 서면서 "round-trip 되는 값은 마스킹 제외" 축을 닫음.
- 변경 파일: `spec/5-system/14-external-interaction-api.md`(§R17), `6-websocket-protocol.md`, `12-webhook.md`, `13-replay-rerun.md`, `1-data-model.md`, `3-workflow-editor/3-execution.md`, `4-nodes/1-logic/12-background.md`.
- 직전 라운드(`review/consistency/2026/08/20/18_03_37/rationale_continuity.md`) 이후 HEAD 에 1개 커밋(`2c628f6ac`)만 추가됐고, `spec/` 파일은 그 커밋에서 변경되지 않았다(프런트 코드 + CHANGELOG 만). 따라서 아래는 그 라운드의 재확인 + 그 라운드가 놓친 항목 1건(§R17 "닫힌 범위" 서술)의 추가 심사다.

## 발견사항

- **[WARNING]** §R17 "닫는 조건 충족" 서술이 실제 닫힌 범위보다 넓게 읽힌다 — API 직접 호출 경로의 잔여 위험이 spec 본문에 없다
  - target 위치: `spec/5-system/14-external-interaction-api.md:1565-1572` (§R17 잔여 ② "**닫는 조건은 충족됐다 (2026-08-20)**" 문단 + 3-소비처 표)
  - 과거 결정 출처: 같은 §R17 잔여 ② 항목 자체(카브아웃 도입 2026-08-16, 닫는 조건 정의 2026-08-17, 이번 폐지 2026-08-20) — 원 카브아웃의 근거는 "**클라이언트 프리필 왕복 경로**" 오염(§R17:1552-1561, "위험은 클라이언트 프리필 왕복 경로 하나다")
  - 상세: §R17 은 "닫는 조건은 충족됐다" 라고 단정하고 프런트 소비처 3곳(폼 프리필·Re-run 모달·에디터 히스토리 로드)의 가드 표만 제시한다. 그러나 실제로 서버(`resolveTriggerParameters` 등 재실행 처리 경로)는 `inputOverride` 필드값이 마스킹 마커 리터럴(`'***'` 등)이어도 타입·필수값만 검사하고 그대로 받아들인다 — `codebase/backend/src/modules/executions/` 안에 마커 리터럴을 거부하는 로직이 없음을 확인했다(`grep` 0건). 즉 UI 를 우회해 `POST /api/executions/:id/re-run` 을 직접 호출하면 §R17 이 막으려던 것과 **정확히 같은 형태의 데이터 오염**(마스킹 마커가 새 실행의 실제 입력이 되는 것)을 API 레벨에서 재현할 수 있는데, 이 잔여 경로가 §R17 본문 어디에도 명시돼 있지 않다.
    이 갭은 이미 같은 PR 의 `plan/in-progress/spec-sync-external-interaction-api-gaps.md:322-340`(`inputOverride 서버측 마커 리터럴 거부`, 2026-08-20 등재)에 등재돼 있고, 그 항목 자체가 자기수정 기록을 담고 있다 — 담당자가 세 라운드에 걸쳐 "§R17 이 가드 범위를 UI 정상 흐름으로 명시했다" 는 이유로 이 지적을 유예했으나, 2026-08-20 실측에서 "**§R17 을 열어 보면 그런 문장이 없다**" 고 스스로 정정했다(`17_38_33` api_contract W2 인용). 즉 이번 리뷰가 잡아낸 것과 동일한 결함을 프로젝트가 이미 인지했고, "spec 표면이라 developer 권한 밖" 이라는 이유로 이번 PR 에서 spec 을 고치지 않고 CHANGELOG 캐비엇(`CHANGELOG.md:10-16`, 커밋 `2c628f6ac`)으로만 임시 기록한 상태다. CHANGELOG 는 이 프로젝트의 결정 근거 SoT 위치가 아니다(`## 정보 저장 위치` 표 — "결정의 배경·근거" 는 spec 문서의 `## Rationale`).
    같은 PR 의 `12-webhook.md:83-90` 는 대조적으로 "그래도 이 층은 대체되지 않는다 — expression `$trigger.headers` 는 egress 를 타지 않으므로 이 표면은 여전히 이 ingestion 층뿐이다" 라고 잔여 위험을 스스로 명시했다 — 같은 PR 안에서 한쪽(webhook)은 잔여 위험 경계를 spec 에 적었고 다른 쪽(§R17 Re-run)은 CHANGELOG 로만 적어, target 문서(§R17)만 놓고 보면 "닫힌 범위 = UI 정상 흐름" 이라는 제약이 안 보인다.
  - 제안: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 해당 항목이 이미 계획한 대로 — **planner 턴**에서 §R17 잔여 ② 문단(1565번째 줄 부근)에 "이 닫는 조건은 프런트 렌더 경로(UI)에 한정된다. `POST .../re-run` 을 API 로 직접 호출하는 경로는 이 가드 밖이며 [잔여 항목 링크]" 같은 명시적 경계 문장을 추가할 것. 그 전까지는 §R17 을 "완전 폐쇄" 로 재인용하지 말 것 — 이미 한 번 그 오독으로 3라운드가 소모됐다(추가 재발 방지).

- **[INFO]** §R17 헤딩에 2026-08-20 결정 미반영 (직전 라운드에서 이월, 재확인)
  - target 위치: `spec/5-system/14-external-interaction-api.md:1392` (`### R17. ... (결정 2026-06-25, conversationThread reload 노출 재조정 2026-07-09)`)
  - 과거 결정 출처: 같은 R17 항목 자체
  - 상세: R17 항목은 2026-08-16 카브아웃 도입 / 08-17 확장 / 08-20 폐지 세 번의 하위 결정이 본문에 인라인으로만 반영됐고 헤딩 괄호는 갱신되지 않았다. 08-16/08-17 때도 같은 관례였으므로 이번에 새로 생긴 결함은 아니다.
  - 제안: (선택) 헤딩에 "`Execution.inputData` 카브아웃 폐지 2026-08-20" 를 추가하면 탐색성 개선. 강제 아님.

## 정합성 확인 (문제 없음으로 판정한 항목 — 직전 라운드 재확인)

1. **번복에 새 Rationale 동반 (criterion 3)** — §R17 잔여 ② 를 직접 개정해 번복 사유(마커 가드 3곳 표, "강제"를 안내로 낮추지 않은 이유, 값-마스킹 부분치환의 감지 한계, 판단 기준의 축 재정의)를 인라인으로 명시했다 — 무근거 번복이 아니다. (단, 위 WARNING 은 그 새 Rationale 자체가 실제보다 넓게 읽힌다는 별개의 지적이다.)
2. **전파 정합성** — `1-data-model.md`·`3-workflow-editor/3-execution.md`·`4-nodes/1-logic/12-background.md`·`12-webhook.md`·`13-replay-rerun.md`·`6-websocket-protocol.md` 6개 파일 전부가 과거형("2026-08-20 이전에는 카브아웃")으로 통일 갱신됐다. `"마스킹 대상이 아니"`, `MASKED_INPUT_DATA_REASON`(옛 구현 정본 상수), `"가르는 축은 필드 이름이 아니라 레벨"` 잔존 서술 없음 확인. `spec/5-system/5-expression-language.md` 의 `Execution.inputData` 참조는 마스킹 카브아웃과 무관한(엔진 내부 `$trigger` 데이터 소스) 서술이라 갱신 대상 아님.
3. **타 spec 의 기각된 대안과의 충돌 없음 (criterion 1)** — `12-webhook.md` Rationale 의 "display 시점 마스킹" 기각(whack-a-mole 우려)과 이번 §R17 egress 값-패턴 마스킹은 헤더-key(구조화) vs 자유 텍스트 값-패턴(egress 만 가능) 축으로 명시적으로 구분돼 상충하지 않는다.
4. **구현-스펙 정합** — `codebase/frontend/src/lib/utils/masked-markers.ts` 의 `MASKED_MARKERS`/`MAX_MARKER_SCAN_DEPTH` 가 backend `sanitize-error-message.ts` 와 일치. Re-run 모달의 3-조건 차단도 spec §10.2 표 서술과 실제 커밋 이력(라운드4~10 처분)에서 반영됨을 확인.
5. **won't-do 항목 불가침** — `R-wontdo-rawws-rest`·R5(외부 WS 채널 보류) 등 기존 "비채택" Rationale 은 이번 diff 가 건드리지 않았다.

## 요약
이번 PR 은 `Execution.inputData` egress 마스킹 카브아웃(2026-08-16 결정)을 뒤집으면서 `spec/5-system/14-external-interaction-api.md` §R17 을 직접 개정해 번복 사유를 남겼고, 이를 참조하던 6개 인접 spec 파일도 일관되게 과거형으로 동기화했다 — Rationale 연속성 관점에서 기본적으로 모범적이다. 다만 §R17 의 "닫는 조건은 충족됐다" 서술은 실제로는 **프런트 렌더 경로(UI)** 에 한정된 폐쇄이고, `POST .../re-run` 을 API 로 직접 호출하는 경로에는 서버측 검증이 없어 동일한 오염이 재현 가능한데, 이 경계가 target 문서(§R17)에는 적혀 있지 않다. 프로젝트는 이 정확한 갭을 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 등재했고, "§R17 이 UI 범위를 명시했다" 는 과거 유예 근거가 사실이 아니었음을 스스로 정정한 기록까지 남겼다 — 즉 이번 리뷰의 지적과 프로젝트의 자체 진단이 일치한다. developer 권한 밖(spec 쓰기 불가)이라 이번 PR 에서 §R17 을 고치지 않은 판단 자체는 합리적이지만, 그 사이 §R17 을 "완전 폐쇄" 로 재인용하는 재발을 막기 위해 이번 라운드에서도 WARNING 으로 다시 표면화한다. 나머지 6개 파일의 서술 동기화, 헤딩 날짜 미반영(INFO), 기각된 대안 재도입 여부는 모두 문제 없다.

## 위험도
MEDIUM
