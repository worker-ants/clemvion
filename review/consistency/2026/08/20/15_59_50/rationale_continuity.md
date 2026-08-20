# Rationale 연속성 검토 — spec/5-system/ (eia-inputdata-marker-guard)

## 검토 대상

`origin/main...HEAD` 범위에서 `spec/5-system/{6-websocket-protocol,12-webhook,13-replay-rerun,14-external-interaction-api}.md` +
연관 미러 문서(`spec/1-data-model.md`, `spec/3-workflow-editor/3-execution.md`, `spec/4-nodes/1-logic/12-background.md`)를 대상으로,
`Execution.inputData` egress 마스킹 카브아웃을 폐지하고 프런트 "마커 가드"로 대체한 결정 번복을 Rationale 연속성 관점에서 검토했다.

## 발견사항

- **[INFO]** "닫는 조건 충족" 선언이 마커 감지의 알려진 경계(정확 일치 전용)를 명시하지 않음
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 "잔여 ②" — "**닫는 조건은 충족됐다 (2026-08-20)**" 표
  - 과거 결정 출처: 없음(신규 서술 자체에 대한 자기 정합성 문제). 대조 근거는 구현
    `codebase/frontend/src/lib/utils/masked-markers.ts`의 `isMaskedMarker`/`hasMaskedMarkerLeaf` 문서화 주석
    ("보장의 경계 — 정확 일치만 잡는다(의도)... `scheme://***@host` 처럼 부분 치환된 값은 여기서 감지되지 않아 그대로 통과한다").
  - 상세: spec 은 "닫는 조건" 을 "프런트가 마스킹 마커를 감지해 해당 필드 재입력을 강제하는 가드" 로 정의했고, 세 소비처(폼·Re-run 모달·에디터 히스토리)가 이를 문자 그대로 충족했다는 점은 코드로 확인된다(rerun-modal.tsx 의 `touchedMaskedKeys`+`isMaskedMarker` 이중조건, editor-toolbar.tsx 의 `hasMaskedMarkerLeaf` 실행 차단). 다만 이 가드는 값 전체가 마스킹 마커 문자열과 **정확히 일치**하는 경우만 잡고, `scheme://user:pass@host` → `scheme://***@host` 같은 **부분 치환** 값은 감지되지 않아 그대로 재제출된다 — 코드 주석은 이를 "같은 왕복(round-trip) 성질은 남는다" 고 스스로 인정한다. spec 의 "닫는 조건은 충족됐다" 라는 무조건적 종결 서술에는 이 잔존 경계가 어디에도 캐비엇으로 남아있지 않아, 향후 이 절을 읽는 사람이 "부분 마스킹 값의 왕복 오염"까지 닫혔다고 오해할 여지가 있다.
  - 제안: §R17 잔여 ② 종결 문단 또는 "프리필 왕복" 불릿 말미에 "정확 일치 마커만 감지 — 부분 치환(`scheme://***@host` 류)은 이 가드의 범위 밖이며, 해당 값은 이미 자격증명이 제거된 상태라 노출 위험은 없지만 동일한 round-trip 성질은 남는다" 정도의 1문장 캐비엇을 추가해 코드 주석과 spec Rationale 을 정합시킬 것을 제안. (CRITICAL/WARNING 은 아님 — 보안 노출이 아니라 문서 정합의 미세한 갭이다.)

그 외에는 Rationale 연속성 위반을 발견하지 못했다. 아래는 검토 과정에서 확인한 근거(발견사항 아님, 참고용):

- **결정 번복이지만 정당하게 처리됨**: `Execution.inputData` 를 egress 마스킹 대상에서 제외했던 기존 결정("잔여 ②", 2026-08-16/17 판정)을 이번 diff 가 뒤집는다. 그러나 4개 spec 파일(`14-external-interaction-api.md`, `13-replay-rerun.md`, `6-websocket-protocol.md`, `12-webhook.md`) + 3개 미러 문서(`1-data-model.md`, `3-workflow-editor/3-execution.md`, `4-nodes/1-logic/12-background.md`) 전부가 "2026-08-20" 날짜로 동기화된 새 Rationale(왜 종전 축이 폐기됐는지, 무엇이 전제였고 무엇이 무너졌는지, 무엇이 새 결정인지)을 동반한다 — CLAUDE.md 규약 "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" 을 모범적으로 준수한다.
  - `git -C <worktree> diff origin/main...HEAD -- spec/5-system/14-external-interaction-api.md` 확인: "**전환 (2026-08-20)**" 절이 종전 카브아웃의 근거("리터럴 `'***'` 가 실제 입력값이 됨")를 인용한 뒤, 그 전제가 왜 무너졌는지("프런트 마커 가드가 서면서 카브아웃 유지비가 가드 비용을 넘었다")를 명시하고 판단축을 1축→2축으로 재정의했다.
  - `MASKED_INPUT_DATA_REASON` 등 구 결정이 인용하던 식별자는 spec·codebase 전역에서 grep 0건 — 죽은 참조 없음.
- **역사적 서술의 시제 처리가 정확함**: "카브아웃은 `Execution.inputData` **한 컬럼**이었고" · "`Execution.inputData` 를 **한동안** 마스킹하지 않은 이유는" 등 과거 결정을 설명하는 문장이 전부 과거형/한정 표현으로 처리되어, 현재 유효한 규칙과 혼동되지 않는다.
- **연쇄 폐기 축과 명시적 재확인**: `6-websocket-protocol.md`의 "가르는 축은 필드 이름이 아니라 레벨이다" 축이 폐기되고 "**그 축은 폐기됐다**"로 명시. `14-external-interaction-api.md`의 "레벨이 가른다" 축도 동일하게 "**2026-08-20 — '레벨이 가른다' 축 폐기**"로 표제에 못박아, 과거 결정이 살아있는 것처럼 오인될 여지를 차단했다.
- **잔여 ③(workflow-assistant LLM 도구, `maskSensitiveFields` 키-이름 기반)은 이번 결정과 의도적으로 분리 유지** — `spec/3-workflow-editor/4-ai-assistant.md` 는 무변경이며 EIA §R17 의 "잔여 ③ (범위 밖 유지)" 서술과 일치. 값-패턴 마스킹을 그쪽에 단순 합성하면 안 된다는 기존 판단("접미 힌트 소실 회귀")도 이번 diff 로 훼손되지 않았다.
- **ingestion-time(webhook §5.3) vs egress-time(§R17) 이원 방어 원칙과 충돌하지 않음**: `12-webhook.md` 는 "그리고 `inputData` 에는 그 갭을 덮는 후속 층이 없다"를 "**2026-08-20 부터 그 갭을 덮는 후속 층이 생겼다**"로 갱신하면서도, "이 층은 대체되지 않는다 — `$trigger.headers` 는 egress 를 타지 않는다" 캐비엇을 새로 추가해 두 층의 역할 분담(구조화 필드=ingestion, 자유 텍스트=egress) 원칙을 훼손하지 않았다. 2026-07-07 Rationale의 "display 시점 마스킹 기각" 결정은 **webhook 헤더**(구조화·기지 key) 범위에 한정된 것으로, 이번 `inputData` egress 마스킹(자유 텍스트 대상)과 스코프가 달라 재도입에 해당하지 않는다 — 이 구분은 이미 `14-external-interaction-api.md` 의 "언제 가리는가 — ingestion-time 과 egress-time 이 공존한다" 절이 명시적으로 선언하고 있다.
- **`config` raw-echo 원칙(node-output Principle 7)과의 관계**: 기존 "backstop 이지 새 예외가 아니다" 서술은 이번 diff 로 변경되지 않았고, 새 마스킹 확대와 모순되지 않는다.
- **부수 정정도 근거를 남김**: `3-workflow-editor/3-execution.md` 의 "WebSocket 이벤트에는 inputData 가 포함되지 않음" (2026-04 이후 stale) 정정에 "실측 확인" 근거와 정정 사유를 명시 — 무근거 번복이 아니다.
- **구현 대조**: `codebase/backend/.../executions.service.ts` (`redactStoredDataForResponse` 를 `inputData`/`outputData` 양쪽에 적용, 2026-08-20 주석), `codebase/frontend/.../rerun-modal.tsx`(터치+마커 이중조건 차단, 토글 ON 시 우회), `codebase/frontend/.../editor-toolbar.tsx`(`hasMaskedMarkerLeaf` 로 실행 차단) 를 절대경로로 직접 확인 — spec 서술과 구현이 일치한다.

## 요약

이번 작업(`Execution.inputData` egress 마스킹 카브아웃 폐지 + 프런트 마커 가드 도입)은 기존에 명시적으로 채택했던 결정("재제출 경로라 마스킹하지 않는다")을 뒤집는 변경이지만, 번복의 이유·전제 붕괴·새 판단축을 4개 원본 spec 파일과 3개 미러 문서에 날짜(2026-08-20)와 함께 정합되게 기록했고, 관련된 다른 Rationale(ingestion vs egress 이원 방어, `config` raw-echo 원칙, 잔여 ③ 스코프 분리)과도 충돌 없이 재확인·상호참조했다. 구현(backend `redactStoredDataForResponse` 확대, frontend `masked-markers.ts`/`rerun-modal.tsx`/`editor-toolbar.tsx`)도 spec 서술과 일치한다. 유일한 잔여 관찰은 spec 의 "닫는 조건 충족" 선언이 코드 자신이 인정하는 부분-치환 값의 잔존 round-trip 경계를 캐비엇으로 옮기지 않은 점으로, 보안 노출이 아닌 문서 정합성 수준의 INFO 다.

## 위험도

LOW
