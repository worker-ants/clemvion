# 신규 식별자 충돌 검토 — `spec-draft-inputdata-egress-masking.md`

## 검토 방법

target(`plan/in-progress/spec-draft-inputdata-egress-masking.md`)이 실제로 **새 식별자를
도입하는지**부터 확인했다. 이 draft 는 §R17 이 이미 정의해 둔 "`Execution.inputData` 카브아웃"
결정을 **뒤집어(flip) 7개 기존 spec 파일에 반영**하는 안이며, 새 요구사항 ID·엔티티명·
endpoint·이벤트명·env var·spec 파일 경로를 하나도 신설하지 않는다. 따라서 검토는 (a) draft 가
인용하는 기존 식별자/라벨이 실제로 그 자리에 그 의미로 존재하는지 실측 대조, (b) draft 가
재사용하는 표현·라벨 스킴이 spec 다른 곳에서 다른 의미로 이미 쓰이고 있어 충돌 여지가 있는지
grep 전수 확인, 두 축으로 진행했다.

### 실측 대조 결과 (전부 일치)

| target 인용 | 실제 파일:행 | 대조 |
|---|---|---|
| `1-data-model.md:471` — Execution.input_data 행 | 확인 (471행, 문구 정확 일치) | 일치 |
| `1-data-model.md:550` — NodeExecution.input_data 대비 서술 | 확인 (550행) | 일치 |
| `12-webhook.md:329` — "유일한 방어" | 확인 | 일치 |
| `6-websocket-protocol.md:205-207` — "레벨이 가른다" 축 | 확인 | 일치 |
| `13-replay-rerun.md:358-359` — "이 모달이 그 이유다" + `MASKED_INPUT_DATA_REASON` 인용 | 확인 | 일치 |
| `14-external-interaction-api.md:1527,1536,1539,1581,1584` | 확인 | 일치 |
| `14-external-interaction-api.md:1618-1621` — 판단 기준 표 | 확인 (`Execution.inputData (REST) \| **안 함**`) | 일치 |
| `3-workflow-editor/3-execution.md:91` — 히스토리 로드 행 | 확인 | 일치, frontmatter `code:` 에 `editor-toolbar.tsx` 기등재 |
| `4-nodes/1-logic/12-background.md:246` | 확인 (현재형 서술) | 일치 |

인용된 라인·문구가 실제 파일 상태와 어긋나는 곳은 없었다 — "존재하지 않는 앵커를 근거로
든다" 류의 충돌은 없다.

## 발견사항

### [INFO] 잔여 라벨 스킴의 취소선(strikethrough) 컨벤션 미명시

- target 신규/변경 식별자: §R17 "**잔여 ② — … `Execution.inputData` 만 의도적
  비대상(2026-08-16, 범위 정정 2026-08-17)**" 표제를 "**"해소(2026-08-20)"**"로 바꾸는 안
  (draft ④)
- 기존 사용처: 같은 문서 `14-external-interaction-api.md:1536` 의 선례 —
  "**~~잔여 ①~~ 해소(2026-08-16)**: WS `execution.node.*` **emit** 경로의 `error`" 는 라벨
  자체에 취소선을 그어 "닫힘"을 한눈에 표시하는 컨벤션을 이미 세워 두었다.
- 상세: draft 는 표제 뒤쪽 문구("… 의도적 비대상")를 "해소(2026-08-20)"로 바꾸라고만
  적었고, 라벨 부분("잔여 ②")에 잔여①과 같은 `~~잔여 ②~~` 취소선을 적용할지는 명시하지
  않았다. 같은 절 안에서 잔여①은 취소선, 잔여②는 무취소선으로 남으면 "닫힌 항목은 취소선"
  이라는 방금 세운 스캔 규칙이 절 내에서 스스로 깨진다 — 새 식별자 충돌은 아니지만, 기존
  라벨링 컨벤션(사실상 이 절의 "닫힘 마커" 역할을 하는 준-식별자)과의 정합이 비어 있다.
- 제안: 표제를 `**~~잔여 ②~~ — outputData 해소(2026-08-16), Execution.inputData 도
  해소(2026-08-20)**` 식으로 잔여①과 동일한 취소선 패턴을 적용하도록 draft 지시를 한 줄
  보강.

## 검토 범위에서 확인했으나 충돌 없음으로 판정한 항목 (참고용)

- **"잔여 ①②③" 원형숫자 라벨**: `spec/` 전체 grep 결과 이 스킴은 오직
  `14-external-interaction-api.md` §R17 절과 그 미러(`1-data-model.md`, `12-webhook.md`,
  `6-websocket-protocol.md`, `13-replay-rerun.md`)에서만 쓰인다. 다른 절·다른 문서가 같은
  원형숫자를 다른 의미로 쓰는 경우는 없다 — 라벨 재사용 충돌 없음.
- **frontmatter `code:` 등재**: draft 가 `14-external-interaction-api.md`·
  `13-replay-rerun.md` 에 새로 등재하려는 `rerun-modal.tsx` 는 현재 `spec/` 어느 문서의
  `code:` 에도 없어 최초 등재이며 충돌 없음. `editor-toolbar.tsx` 는 이미
  `0-canvas.md`·`3-execution.md`·`node-cancellation.md`·`cross-node-warning-rules.md` 4곳의
  `code:` 에 등재돼 있으나, 이는 여러 spec 문서가 같은 공유 컴포넌트 파일을 가리키는 기존
  확립된 패턴(예: `editor-toolbar.tsx` 자체가 이미 다문서 공유)이라 충돌이 아니라 정상
  누적 등재다.
- **"이중 방어" 표현**: `2-navigation/6-config.md`·`3-workflow-editor/2-edge.md`·
  `data-flow/12-workspace.md`·`data-flow/2-auth.md` 등에서 이미 범용적으로 쓰이는 서술어이고
  draft(`12-webhook.md` §5.3 변경안)도 동일한 일반적 의미("독립된 두 방어 층")로 쓴다 — 고유
  명사가 아니라 서술 표현이라 충돌 판정 대상이 아니다.
- **`MASKED_INPUT_DATA_REASON` 삭제**: target draft 자체는 이 식별자를 새로 정의하지 않고
  §10.2 인용만 제거한다(삭제는 자매 plan `eia-inputdata-marker-guard.md` 담당). 삭제는
  신규 식별자 충돌 범주가 아니며, 삭제 후 대체 앵커를 두지 않는다는 결정도 새 이름을 만들지
  않으므로 충돌 여지가 없다.
- 신규 요구사항 ID·신규 엔티티/DTO·신규 API endpoint·신규 webhook/queue/SSE 이벤트명·신규
  env var·설정키·신규 spec 파일 경로는 draft 전체에서 하나도 발견되지 않았다.

## 요약

이 draft 는 새 식별자를 도입하는 문서가 아니라 §R17 이 이미 정의한 기존 결정("카브아웃")을
동일한 식별자 체계(§R17, `Execution.inputData`, `NodeExecution.input_data`, "잔여 ①②③"
라벨, `code:` frontmatter) 안에서 뒤집어 7개 기존 spec 파일에 재미러링하는 안이다. 인용된
모든 파일:행이 실측과 정확히 일치했고, 재사용하는 라벨·표현이 spec 다른 곳에서 다른 의미로
쓰이는 사례도 없었다. 유일한 지적은 "잔여 ②" 라벨에 잔여①과 같은 취소선 컨벤션을 적용할지
draft 가 명시하지 않은 점으로, 신규 식별자 충돌이라기보다 기존 라벨링 컨벤션과의 정합
공백이다.

## 위험도
LOW
