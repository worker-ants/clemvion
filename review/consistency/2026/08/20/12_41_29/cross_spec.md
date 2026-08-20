# Cross-Spec 일관성 검토 — `spec-draft-inputdata-egress-masking.md`

## 방법

`_prompts/cross_spec.md` 에 번들된 spec 발췌는 `13-replay-rerun.md`·`14-external-interaction-api.md`
등 핵심 파일이 "본문 생략됨 — 컨텍스트 예산 초과"로 절단되어 있었다(EIA 문서 원문 120,740자).
번들만으로는 target 이 인용하는 정확한 문구·행 번호를 검증할 수 없어, 저장소의 실제
`spec/**` 파일을 직접 읽어(`spec/1-data-model.md`, `spec/5-system/12-webhook.md`,
`spec/5-system/6-websocket-protocol.md`, `spec/5-system/13-replay-rerun.md`,
`spec/5-system/14-external-interaction-api.md`, `spec/4-nodes/1-logic/12-background.md`,
`spec/3-workflow-editor/3-execution.md`) target 의 인용·라인 번호·현재 서술을 대조했고,
`grep` 으로 `spec/` 전체에서 "재제출"·"카브아웃"·"egress"·"inputData"·"유일한 방어"·
"가르는 축은" 등을 전수 탐색해 target 의 "미러 전수 7개 파일" 주장이 실제로 완전한지
독립 검증했다.

## 발견사항

### [WARNING] EIA §R17 "잔여 ②" 블록의 실제 개정 범위가 번호 목록(1527·1539·1542·1549·1569·1620·1642)보다 넓다

- **target 위치**: target 문서 `## 문서별 변경안 ④` 및 `## 미러 전수` 표 6행
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md:1539-1567`
- **상세**: target 이 인용하는 7개 행 번호는 EIA 문서에서 실측한 "잔여 ② — `outputData`
  해소, `Execution.inputData` 만 의도적 비대상" 블록의 **앵커**일 뿐, 그 블록 전체
  (1539~1567행)는 다음과 같은 **현재형 단정문**을 여러 줄에 걸쳐 담고 있다 —
  `카브아웃은 Execution.inputData 한 컬럼이고... 마스킹하지 않는 이유는 그것이
  재제출되는 값이기 때문이다`(1542·1549행), `Re-run 모달이 inputData 를 프리필해...`
  (1550행), `기본 Re-run 은 영향 없다`(1556행), `남는 노출: 트리거 파라미터 자유
  텍스트의 자격증명`(1558행), `닫는 조건: ... 선행되어야 한다`(1561행) 등. target 의
  Rationale 은 "다만 현재형을 과거형으로 돌린다"는 **일반 지침**으로 이를 포괄하려
  하지만, 정작 표에 나열된 숫자 목록은 7개뿐이라 실제 구현자가 그 숫자만 문자 그대로
  좇으면 사이사이의 present-tense 단정문(1542-1558)이 "해소(2026-08-20)" 표제 바로
  아래 그대로 남아 **같은 절 안에서 표제는 과거형, 본문은 현재형인 자기모순**이
  생긴다. 이 저장소가 이미 두 차례(`23_49_05`·`01_17_49`) 같은 "부분 미러"류 결함을
  낸 이력이 있는 문서라는 점도 이 리스크를 가중한다.
- **제안**: item ④ 에 "1539~1567행 전체(잔여 ② 서술)를 과거형으로 재작성"이라고
  명시적 범위를 못박거나, 표의 7개 행 번호를 "대표 앵커"로 명확히 표기해 구현자가
  전체 블록을 훑도록 유도할 것. (표 아래 "가르는 축은 레벨" 프레임 문장(약
  1608~1621행)과 "닫는 조건" 문단은 이미 별도 불릿으로 커버되어 있어 이 항목에서는
  제외.)

### [INFO] "잔여 ②" 표제의 취소선(strike-through) 포맷이 인접 "잔여 ①" 관례와 다를 수 있음

- **target 위치**: target 문서 `## 문서별 변경안 ④` 첫 항목
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md:1537` — `~~잔여 ①~~
  해소(2026-08-16)` 표기
- **상세**: 같은 목록의 형제 항목 "잔여 ①"은 해소되며 `~~잔여 ①~~ 해소(...)` 취소선
  포맷을 썼다. target 의 item ④ 는 "잔여 ②" 표제를 "해소(2026-08-20)"로 바꾼다고만
  적고 취소선 여부는 명시하지 않는다. 인접 항목과 표기가 어긋나면 다음 독자가
  "잔여 ①만 닫힌 항목, 잔여 ②는 열린 항목"으로 오독할 수 있다.
- **제안**: `~~잔여 ②~~ 해소(2026-08-20)` 형태로 통일.

### [INFO] Rationale 의 "6개 spec 파일 · 14개 지점" 수치가 표에 나열된 지점 수와 어긋난다

- **target 위치**: target 문서 `## Rationale > 왜 카브아웃을 유지하지 않나` 첫 문단
- **충돌 대상**: target 자신의 `## 미러 전수` 표 #1~#7
- **상세**: 표의 #1~#7 을 단순 합산하면 1(#1)+1(#2)+1(#3)+1(#4)+1(#5)+7(#6, EIA 행
  번호 7개)+1(#7) = **13개 지점**이며, "6개 spec 파일"(1-data-model·12-webhook·
  6-websocket-protocol·13-replay-rerun·14-eia·12-background)은 정확하다. "14개
  지점"의 근거가 되는 14번째 지점이 표에 명시돼 있지 않다(§R17 잔여② 재작성 범위가
  위 WARNING 처럼 7행보다 넓다는 점을 감안하면 실제 지점 수는 14보다 클 수도 있다).
  이 수치 자체를 "실측했다"고 강조하는 문서이므로(§Rationale "이 수치 자체가 근거의
  일부라 실측으로 적는다") 정합성 이슈가 상대적으로 더 눈에 띈다.
- **제안**: 커밋 직전 지점 수를 다시 세어 "13" 또는 갱신된 실측치로 정정하거나, 14의
  근거가 된 항목(예: `13-replay-rerun.md` frontmatter `code:` 추가를 별도 "지점"으로
  카운트한 것인지)을 한 줄로 명시.

## 검증되어 문제 없음을 확인한 사항 (참고)

- target 이 인용한 7개 파일·8개 위치(데이터 모델 §2.13/§2.14, webhook §5.3,
  websocket-protocol §4.1, replay-rerun §10.2, EIA §R17, background §8.2,
  execution.md §2.2)는 실제 저장소 파일과 행 번호·인용 문구가 **정확히 일치**했다.
- `spec/` 전체를 `재제출`·`카브아웃`·`egress`·`inputData` 로 재탐색한 결과, target 의
  7파일 스코프 밖에서 `Execution.inputData` 카브아웃을 전제로 한 추가 미러는
  발견되지 않았다(`spec/3-workflow-editor/_product-overview.md` ED-AI-37,
  `spec/3-workflow-editor/4-ai-assistant.md` 의 `inputData` 마스킹 언급은 별개의
  key-기반 마스킹 메커니즘(=EIA §R17 "잔여 ③", 범위 밖 유지)이라 무관함을 확인).
  `chat-channel`·`channel-web-chat`·`system-status`·`observability` 계열 문서는
  `inputData` 를 전혀 참조하지 않아 영향권 밖이다.
- `spec/5-system/13-replay-rerun.md`·`spec/5-system/14-external-interaction-api.md`
  의 frontmatter `code:` 목록에는 현재 `rerun-modal.tsx` 가 실제로 없음을 확인 —
  item ④ 의 등재 계획이 정확하다. 코드 경로
  `codebase/frontend/src/components/executions/rerun-modal.tsx` 도 실존한다.
  `editor-toolbar.tsx` 는 이미 `3-execution.md` frontmatter 에 등재돼 있다.
  `MASKED_INPUT_DATA_REASON` 은 `spec/` 전체에서 `13-replay-rerun.md` 한 곳에만
  인용되어 있어 item ② 의 "인용을 지운다" 처리로 충분하다.
  "이-모달이-그-이유다" 앵커 문구를 링크하는 다른 spec 문서도 없어 anchor breakage
  위험이 없다.
- 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 여섯 관점 중 실제
  충돌이 발견된 것은 없다 — 이 draft 는 값-마스킹 **정책 전환**(마스킹 여부만
  바뀜)이고 필드 타입·엔드포인트 shape·상태 머신·권한 게이트를 변경하지 않는다.

## 요약

target 은 `Execution.inputData` egress 카브아웃 폐지를 7개 spec 파일에 걸쳐 정합되게
반영하는 draft다. 번들 컨텍스트가 핵심 원본(EIA·Re-run 문서)을 예산 초과로 잘라낸
탓에 실제 저장소 파일을 직접 열어 대조했고, 인용된 모든 행 번호·문구는 정확했으며
`spec/` 전체 재탐색으로도 target 이 놓친 8번째 미러 지점은 발견되지 않았다(전수
스캔이 실제로 전수였다). 유일한 실질적 리스크는 EIA §R17 "잔여 ②" 블록 재작성
범위가 target 이 나열한 7개 행 번호보다 넓다는 점 — 문자 그대로 그 숫자만 따르면
"해소" 표제 바로 아래 카브아웃 근거를 현재형으로 재진술하는 문장들이 남아 같은
절 안에서 자기모순이 생길 수 있다. 이는 CRITICAL 급 파괴는 아니지만(전체 취지의
지침이 이미 존재해 실제 구현 시 누락될 확률은 낮음), 이 문서군이 반복해 겪은
"부분 미러" 실패 패턴과 겹치므로 WARNING 으로 표기했다. 그 외 지점 수 산정("14개")과
취소선 포맷 정합은 INFO 수준의 사소한 정정 항목이다.

## 위험도

LOW
