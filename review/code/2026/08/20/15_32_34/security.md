STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# 보안(Security) 코드 리뷰 — eia-inputdata-marker-guard

## 컨텍스트

이 changeset 은 `Execution.inputData` 의 egress 마스킹 **카브아웃을 폐지**하는 변경이다. 종전엔 이 컬럼이 Re-run/히스토리 로드가 그대로 재제출하는 값이라는 이유(데이터 무결성)로 자격증명 값-패턴 마스킹의 유일한 예외였는데, 이번에 그 카브아웃을 닫는 조건("프런트가 마스킹 마커를 감지해 재입력을 강제")을 세 소비처(폼 프리필 `#1181` · Re-run 모달 · 에디터 히스토리 로드)가 전부 갖추면서 `Execution.inputData` 도 `outputData`/`error`/노드 레벨과 같은 규칙으로 마스킹 대상에 편입됐다. 이 changeset 은 이미 동일 브랜치에서 3라운드(`14_08_45`→`14_44_08`→`15_10_25`) 코드 리뷰를 거쳐 CRITICAL 2건·WARNING 다수가 모두 조치되고 마지막 라운드는 CRITICAL 0·WARNING 2(둘 다 documentation)로 수렴한 상태다. 아래는 그 위에서 보안 관점 독립 재검토 결과다.

## 확인한 것 (실측)

- **마스킹 관문의 완전성**: `ExecutionsService.toResponseExecution`(`findById`/`getChain`/`stop` 공용 단일 관문)과 `toExecutionDto`(목록) 양쪽에서 `inputData`/`outputData`/`error` 세 컬럼이 모두 `redactStoredDataForResponse`/`redactStoredErrorForResponse` 를 통과하도록 코드가 실제로 고쳐져 있음을 `codebase/backend/src/modules/executions/executions.service.ts` 직접 열람으로 확인했다. `executions.service.spec.ts` 의 캐너리(①/②/⑤/⑥-b/⑧/⑧-b)가 네 표면(`findById`·`findByWorkflow`·`getChain`·`stop`) + 노드 레벨 전부에서 `admin:pw` 원문이 `not.toContain`, `***` 가 `toContain` 되도록 방향이 정확히 반전돼 있다 — 이전엔 `Execution.inputData` 만 원문 통과를 고정하던 캐너리였는데 지금은 마스킹을 고정한다. `background-runs.service.spec.ts` 도 동일 패턴.
- **`resolveTriggerParameters`/`useOriginalInput=true` 경로**: 서버가 `original.inputData` 를 엔티티에서 직접 읽어 재실행 input 으로 쓰는 자리(`executions.service.ts` rerun 핸들러, 이번 diff 밖)는 응답으로 나가는 게 아니라 서버 내부에서 소비되므로 마스킹 대상이 아니고, 이번 변경과 충돌하지 않는다.
- **프런트 마커 가드 로직**(`codebase/frontend/src/lib/utils/masked-markers.ts`, `rerun-modal.tsx`, `editor-toolbar.tsx`): `isMaskedMarker` 는 정확 일치만(`Set.has`), `hasMaskedMarkerLeaf` 는 object/array 내부 leaf 까지 재귀 탐색한다. Re-run 모달의 `blockedByMaskedInput` 은 "사용자가 그 키를 건드렸는가" **그리고** "현재 값에 마커가 없는가" 두 조건의 **합**으로 판정해, 리뷰가 짚었던 두 개별 우회 경로(스키마 지연 도착 시 `coerceInput` 타입강제로 값이 조용히 `false` 가 되는 경로 / 한 번 건드린 뒤 값을 다시 마커로 되돌려도 영구 해제되는 경로)를 각각 막는다. `masked-markers.test.ts` 가 non-string 입력·중첩 leaf·부분-포함 오탐 방지 경계를 양방향으로 고정한다.
- **하드코딩 시크릿**: diff·테스트에 등장하는 `sk-live-abc123`, `admin:pw`, `Bearer sk-live-abc123def456` 는 모두 `*.spec.ts`/`*.test.tsx` 안의 마스킹 검증용 가짜 fixture 문자열이다. 실제 API 키/토큰/인증서 등이 코드에 직접 포함된 사례는 없다.
- **암호화/전송**: 이 changeset 은 알고리즘이나 전송 방식을 바꾸지 않는다. 기존 `redactStoredDataForResponse`(공유, `MAX_REDACT_DEPTH = 10` 로 재귀 깊이가 이미 유계) 를 재사용할 뿐 새 정규식/새 마스킹 로직을 도입하지 않는다.
- **인젝션**: 이번 changeset 은 신규 SQL/커맨드/경로 처리 코드가 없다. `JSON.parse`(에디터 툴바) 는 기존 동작이고 파싱 실패 시 즉시 반환해 이후 마커 검사에 도달하지 않는다.
- **defense-in-depth 갭 (이미 트래커 등재·기존 라운드가 INFO 판정)**: `rerun-modal.tsx`/`editor-toolbar.tsx` 의 마커 차단은 **클라이언트 UI 가드**다 — `POST .../rerun` 을 UI 우회(curl 등)로 직접 호출하면 `inputOverride` 에 리터럴 `'***'` 를 그대로 실어 왕복 오염을 재현할 수 있다(`resolveTriggerParameters` 는 타입·필수값만 검증). **이건 기밀성 침해가 아니다** — 이미 마스킹된(자격증명이 제거된) 값이 그대로 리터럴 문자열로 다시 저장되는 데이터 무결성 문제이고, 이 PR 이 새로 만든 구멍이 아니라 카브아웃이 있던 시절부터 존재하던 특성이 그대로 이어진 것이다. `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 `inputOverride 서버측 마커 리터럴 거부` 로 이미 등재돼 있고 §R17 이 가드 범위를 "UI 정상 흐름 방어" 로 명시한다. 독립적으로 재검토했고 같은 판단을 유지한다 — 이번 PR 을 막을 사안이 아니다(INFO, 비차단).

## 발견사항

없음 — 이번 diff 자체가 도입하는 새로운 CRITICAL/WARNING 급 보안 결함을 찾지 못했다.

## 요약

이 changeset 은 egress 마스킹의 유일한 예외였던 `Execution.inputData` 카브아웃을 프런트 마커 가드 3중 배선과 함께 닫는, 순수하게 보안/데이터 무결성을 강화하는 방향의 변경이다. backend 마스킹 관문(`toResponseExecution`/`toExecutionDto`)이 네 읽기 표면 + 노드 레벨 전부에서 일관되게 세 컬럼을 가리도록 실제로 고쳐졌고, 테스트 캐너리가 각 표면에서 원문 미노출을 개별적으로 고정한다. 프런트 마커 가드는 판정을 "건드림 AND 현재값 무마커" 두 조건의 합으로 둬 앞선 두 라운드에서 발견된 개별 우회 경로를 모두 닫았다. 신규 하드코딩 시크릿·인젝션·인증/인가 우회·안전하지 않은 암호화는 발견되지 않았다. 유일한 잔여 항목(`inputOverride` 서버측 마커 리터럴 거부 부재)은 기밀성 침해가 아닌 UI-우회 데이터 무결성 갭으로, 이미 트래커에 등재돼 있고 이 PR 의 범위를 벗어난다.

## 위험도

NONE
