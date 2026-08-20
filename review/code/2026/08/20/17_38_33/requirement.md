STATUS=success ISSUES=1

===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 코드 리뷰 — eia-inputdata-marker-guard

## 검토 방법

`origin/main...HEAD` 실제 diff(30 codebase/spec 파일, 1055+/215-)를 기준으로 판단했다. 프롬프트에
포함된 `review/code/**`·`review/consistency/**` 하위 130여개 파일은 이 브랜치가 이미 거쳐 온
8라운드 `/ai-review` + 7라운드 `--impl-done`/`--spec` 산출물(과거 리뷰 아티팩트)이라 이번 라운드의
"코드 변경" 판단 대상에서 제외하고, 실제 애플리케이션 코드(`codebase/`)·spec(`spec/`)·plan
변경만 Read 로 직접 열어 확인했다. 핵심 대상: `masked-markers.ts`(+test), `rerun-modal.tsx`(+test),
`editor-toolbar.tsx`, `dynamic-form-ui.tsx`, `executions.service.ts`(+spec), `background-runs.service.ts`
(+dto+spec), spec 7파일(`14-external-interaction-api.md` §R17, `13-replay-rerun.md` §10.2,
`6-websocket-protocol.md`, `3-execution.md`, `12-webhook.md`, `1-data-model.md`, `12-background.md`).

## 발견사항

- **[WARNING]** Manual Trigger 스키마가 실행 이후 바뀌어 마스킹된 파라미터 키가 현재 스키마에서
  사라지면, Re-run 모달의 편집 모드가 **영구적으로 차단**되고 사용자가 그 키를 재입력할 UI 슬롯
  자체가 없다
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx` — `fields` useMemo
    (`297`~`311`행), `blockedByMaskedInput` (`373`~`380`행)
  - 상세: `maskedKeys` 는 `original.inputData` (과거 실행 시점의 원본 파라미터)에서 도출되고,
    `fields` 는 **현재** 워크플로의 `manual_trigger` 스키마(`workflowNodes` 를 실시간 fetch)에서
    도출된다. 스키마에 값(`Array.isArray(schema) && schema.length > 0`)이 있으면 그 스키마가
    선언한 필드만 렌더한다 — 과거엔 있었지만 지금 스키마에서 제거된 키는 렌더되지 않는다.
    `blockedByMaskedInput` 의 첫 조건 `!touchedKeys.has(k)` 은 그 키를 사용자가 "건드렸는가" 를
    보는데, 렌더되지 않는 필드는 `setParam` 을 통해 절대 `touchedKeys` 에 들어갈 수 없다 —
    즉 이 키가 `maskedKeys` 에 남아 있는 한 `blockedByMaskedInput` 은 영구히 `true` 다. 사용자가
    이 상태를 벗어나는 유일한 경로는 "원본 입력 그대로 사용"(`useOriginalInput`) 토글인데, 이걸
    켜면 서버가 `original.inputData` 를 **그대로**(다른 정상 필드에 대한 사용자의 편집까지 포함해)
    무시하고 엔티티를 직접 읽는다 — 즉 "이 키만 마스킹돼 있고 나머지는 편집하고 싶다" 는 사용자의
    의도를 만족시킬 방법이 모달 안에 없다. §R17 "닫는 조건"과 plan 설계 절이 명시한 목표(*"사용자가
    직접 입력하게 만들어 마커가 제출되는 경로를 막는다"*)는 필드가 렌더될 때만 성립하고, 이 경로는
    스키마 partial-drift 를 다루지 않는다. `fields` fallback 은 스키마가 **통째로 없을 때만**
    (`schema.length > 0` 이 false 인 경우) 원본 키 전체로 fallback 하고, 스키마가 있지만 **일부
    키만** 빠진 경우는 다루지 않는다.
  - 참고: fail-closed 방향(차단이 풀리지 않음)이라 데이터 오염·보안 노출로는 이어지지 않고,
    "원본 그대로 사용" 토글이라는 탈출구가 여전히 존재하므로 CRITICAL 로는 판단하지 않았다.
    다만 이 시나리오에서 "재입력해서 정상 재실행" 이라는 §R17 이 규정한 사용자 경험 자체가
    깨지므로 요구사항 완전성 관점에서 WARNING 이다.
  - 제안: `fields` 계산 시 스키마에 없는 `maskedKeys` 를 스키마 필드 뒤에 fallback 필드(untyped
    text)로 병합하거나, 최소한 `blockedByMaskedInput` 이 이 상태를 구분해 "이 값은 재입력할 수
    없으니 원본 그대로 사용을 켜라" 같은 명시적 안내로 갈리게 한다. 발생 빈도가 낮으므로 즉시
    수정이 아니라 tracker(`spec-sync-external-interaction-api-gaps.md`) 등재도 대안이다 — 이미
    같은 파일에 유사한 "Re-run 차단 판정을 순수 함수로 추출" 항목이 있어 그 리팩터와 함께 다룰 수
    있다.

- **[INFO]** spec fidelity — 나머지 코드·spec 정합은 line-level 로 일치했다
  - `codebase/backend/src/modules/executions/executions.service.ts` 의 `toResponseExecution`/
    `toExecutionDto`/`findByWorkflow` 세 관문 모두 `redactStoredDataForResponse(rest.inputData)` 로
    갱신됐고, `ResponseExecution`/`ResponseNodeExecution` 타입이 `inputData` 를 `Record<string,
    unknown> | null` 로 넓혀 build 타입체크가 실제로 이 경로를 검증한다 — spec §R17 "적용 범위는
    총칭이 아니라 열거다" 표(파일 230, 1525~1530행)의 6표면 서술과 정확히 일치.
    `MASKED_INPUT_DATA_REASON` 앵커는 backend·spec 전수(`grep` 0건)로 삭제됐다.
  - `codebase/frontend/src/lib/utils/masked-markers.ts` 의 `MAX_MARKER_SCAN_DEPTH = 10` 이 backend
    `sanitize-error-message.ts` 의 `MAX_REDACT_DEPTH = 10` 과 값이 일치하고, 값 검사가 깊이 검사보다
    먼저 수행돼(off-by-one=fail-open 회피) JSDoc 이 서술한 불변식과 실제 구현이 맞는다.
  - `rerun-modal.tsx` 의 `blockedByMaskedInput` 세 조건(터치 여부·`hasMaskedMarkerLeaf`·구조
    필드의 coerce 실패)이 spec §R17 표(1571행) 의 *"세 조건이 모두 참일 때까지 제출 차단"* 서술과
    정확히 대응하고, `useOriginalInput` 토글 시 조건 평가 자체를 건너뛰는 것도 *"토글 ON 이면
    서버가 원문을 직접 읽으므로 차단도 풀린다"* 서술과 일치한다.
  - `editor-toolbar.tsx` 의 `jsonError` useMemo 는 파싱 성공 시에만 `hasMaskedMarkerLeaf` 를
    호출하고 파싱 실패 시엔 마커 검사를 건너뛰는데, 이는 plan 이 명시한 "파싱 실패 시 마커 검사
    미수행(같은 사유 중복 방지)" 설계와 일치한다.
    i18n 키 `t("editor.runWithInputMasked")`/`t("history.rerun.maskedInputBlocked")` 모두
    ko/en dict 양쪽에 존재하고 실제 호출 경로(`editor-toolbar.tsx:117`, `rerun-modal.tsx:543`)와
    키 경로가 일치한다.
  - CHANGELOG 의 기존 `#1180` 블록(*"`Execution.inputData` 만 마스킹하지 않는다 (의도)"*)과 새
    최상단 항목 간의 표면적 모순은 108행에 후방 참조 caveat(*"이 카브아웃은 2026-08-20 에
    닫혔다"*)으로 해소돼 있다.
  - TODO/FIXME/HACK/XXX 류 미완성 마커는 diff 전체에서 grep 0건.

## 요약

이번 changeset 은 `Execution.inputData` egress 마스킹 카브아웃을 닫으면서 재제출 소비처 3곳
(폼 프리필·Re-run 모달·에디터 히스토리 로드)에 마커 감지 가드를 일관되게 추가했다. 이미 8라운드
`/ai-review` + 7라운드 consistency check 를 거쳐 CRITICAL 0·최근 라운드 WARNING 0(NONE risk)으로
수렴한 상태이며, 본 라운드에서 backend 마스킹 관문(6표면)·프런트 마커 유틸(깊이 상한·값 우선
검사)·i18n parity·spec 7문서(§R17 표·WS §4.1·13-replay-rerun §10.2 등)를 직접 대조한 결과 이전
라운드들의 수정이 실제로 반영돼 있고 spec 본문과 line-level 로 일치함을 확인했다. 새로 발견한 것은
Re-run 모달에서 Manual Trigger 스키마가 실행 이후 바뀌어 마스킹된 파라미터가 현재 스키마에
없어지는 저빈도 edge case 하나뿐이다 — fail-closed 방향이고 "원본 그대로 사용" 토글이라는
탈출구가 있어 CRITICAL 은 아니지만, §R17 이 규정한 "재입력해 언블록" 이라는 사용자 경험 자체가
이 경로에서는 성립하지 않아 WARNING 으로 표기한다.

## 위험도

LOW
