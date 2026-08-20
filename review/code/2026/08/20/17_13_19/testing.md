STATUS=success ISSUES=1

===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 코드 리뷰 — eia-inputdata-marker-guard (17_13_19)

## 컨텍스트

이 changeset(`origin/main...HEAD`)은 `Execution.inputData` egress 마스킹 카브아웃 폐지 +
재제출 소비처 3곳(폼 프리필·Re-run 모달·에디터 히스토리 로드) 마커 가드를 다룬다. 이미 8라운드
(`14_08_45`→`14_44_08`→`15_10_25`→`15_32_34`→`15_59_17`→`16_25_35`→`16_51_19`)의 code review
가 testing 관점에서 촘촘히 훑어 왔고, 직전 라운드(`16_51_19`)의 유일한 WARNING("ingestion
`[REDACTED]` 마커 보존 캐너리가 `background-runs.service.spec.ts` 에서는 `inputData` 표면을
안 본다")은 이번 diff 에서 실측상 해소돼 있다 —
`background-runs.service.spec.ts:283-289`(`makeBodyNodeExec` 의 `inputData.headers`)와
`:333-341`(`inHeaders.authorization`/`content-type` 단언)로 확인했다.

소스(`executions.service.ts`/`.spec.ts`, `background-runs.service.ts`/`.spec.ts`,
`rerun-modal.tsx`/`.test.tsx`, `editor-toolbar.tsx`/`editor-toolbar-run-input.test.tsx`,
`masked-markers.ts`/`.test.ts`)를 직접 열어 `git diff origin/main...HEAD` 전량과 대조했다.
이번 라운드에서 신규로 짚을 결함을 하나 찾았다 — 이번 diff 가 **한 표면에만** 추가한 보강이
자매 세 표면에는 번지지 않았다.

## 발견사항

- **[WARNING]** `①`(`findById`)에만 새로 추가한 "마스킹됐다" 양성 단언(`toContain('***')`)이 자매 `②`(`findByWorkflow`)·`⑧`(`getChain`)·`⑧-b`(`stop`)에는 번지지 않아, 세 표면은 여전히 "유출 문자열이 없다" 는 음성 단언만으로 마스킹을 검증한다
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts:1178`(② `findByWorkflow`), `:1415`(⑧ `getChain`), `:1443`(⑧-b `stop`) — 대조군: `:1160-1161`(① `findById`, 이번 diff 가 새로 추가한 `.not.toContain('admin:pw')` + `.toContain('***')` 쌍)
  - 상세: 이번 diff 는 ①(`findById`)의 `inputData` 캐너리를 `expect(result.inputData.note).toContain('admin:pw')`(원문 통과 단언) → `expect(...).not.toContain('admin:pw'); expect(...).toContain('***')`(마스킹 단언, 음성+양성 쌍)로 뒤집었다. 그런데 같은 diff 가 같은 방향으로 뒤집는 ②·⑧·⑧-b 는 각각 `expect(JSON.stringify(result.data[0].inputData)).not.toContain('admin:pw')`(:1178), `expect(JSON.stringify(rows[0].inputData)).not.toContain('admin:pw')`(:1415), `expect(JSON.stringify(result.inputData)).not.toContain('admin:pw')`(:1443) 로만 고쳐졌다 — `.toContain('***')` 짝이 없다. `LEAKY_IN = { note: 'connect via postgres://admin:pw@db.internal/prod' }` 를 실제로 통과하는 `redactStoredDataForResponse` 는 `postgres://***@db.internal/prod` 형태로 **부분 치환**하지 값을 지우지 않으므로 지금 당장 이 세 테스트가 거짓 통과를 내는 것은 아니다. 다만 이 저장소 관례(project memory `feedback_vacuous_test_three_shapes.md`: "부정 단언이 제3상태에서 참")대로, 세 테스트는 `redactStoredDataForResponse(row.inputData)` 호출이 통째로 다른 값(예: 배선 실수로 `null`/`{}`/필드 누락)을 내도 "leaked 문자열이 없다"는 이유만으로 계속 GREEN 이다 — 즉 "제대로 마스킹됐다"가 아니라 "그 문자열이 우연히 안 보인다"만 고정한다. ①이 이번 diff 에서 스스로 이 구분을 인지하고 양성 단언을 추가했다는 사실 자체가, 나머지 세 곳도 같은 보강이 필요하다는 신호다 — 이 저장소가 반복 겪어 온 "같은 작업 안에서 자매 표면 중 하나만" 패턴(RESOLUTION `16_51_19` W1 이 같은 파일 인접 표면에서 이미 한 번 지적)이 이번엔 축을 "표면 존재 여부"에서 "단언 강도"로 바꿔 재발한 형태다.
  - 제안: ②·⑧·⑧-b 세 자리에 ①과 동일하게 `expect(...).toContain('***')`(또는 `JSON.stringify` 결과 기준 동등한 양성 단언)를 나란히 추가한다. 비용이 각 1줄이라 이식이 저렴하다.

## 확인했으나 재지적하지 않은 것

- **프런트 3-조건 판정** (`touchedMaskedKeys` · `hasMaskedMarkerLeaf` · 구조 필드 coerce 실패)은 `rerun-modal.test.tsx` 에 각 조건을 겨눈 캐너리(무효 JSON 폴백, touch 영구해제, `some`→`every`, boolean+지연 스키마, 다중 마스킹 키, "원본 입력 그대로 사용" 우회 예외)로 정확히 고정돼 있다 — 이번 diff 에서 변화 없음, 재확인 결과 유효.
- **`masked-markers.ts` 깊이 상한**: 값 검사 우선순위(값 검사가 깊이 컷보다 먼저)와 상한 자체(10/11 경계) 두 단언이 분리 고정돼 있다. 다만 경계 테스트(`nest` 헬퍼)는 **object 중첩만** 만든다 — `scanForMarker` 의 array 분기(`value.some((v) => scanForMarker(v, depth + 1))`)가 `depth + 1` 을 빠뜨리는 뮤테이션은 이 경계 테스트로는 안 잡히고, 일반 중첩 배열 테스트("중첩 객체·배열의 leaf 를 찾는다")는 얕아서(깊이 3) 상한과 무관하게 통과한다. object 분기와 대칭이라 실제 위험은 낮아 INFO 수준으로만 남긴다(위치: `codebase/frontend/src/lib/utils/__tests__/masked-markers.test.ts:78-90`).
- **`rerun-modal.tsx` 의 `touchedMaskedKeys` 리셋** (모달이 `open` 전이 시 `setTouchedMaskedKeys(new Set())`, `:248`)은 재오픈 시나리오(필드를 건드린 뒤 모달을 닫았다 다시 여는 경우)를 직접 행사하는 테스트가 없다. 같은 effect 가 `useOriginalInput`/`dryRun`/`paramValues` 도 함께 리셋하는 기존 패턴에 새 상태를 얹은 것이라 회귀 위험은 낮지만(패턴 일관성), 신설 상태이므로 명시적 캐너리가 있으면 향후 이 effect 를 쪼개는 리팩터에서 유용할 것이다. INFO 수준.
- **backend 세 파일 전 표면**: `①`·`②`·`⑤`·`⑥`(양쪽 `outputData`/`inputData`)·`⑧`/`⑧-b` 모두 반전된 방향(과거 "원문 보존" → 현재 "마스킹")을 직접 단언하고, `describe` 소제목도 최신 결론과 일치한다(`14_44_08` W7/`15_10_25` W1 이 지적한 "주제문 방치" 패턴은 이 파일에서 이미 해소).
- **테스트 격리**: `rerun-modal.test.tsx` 신규 `describe("ReRunModal — 마스킹 마커 왕복 차단", ...)` 는 형제 레벨 독립 `beforeEach` 로 mock/store/router 를 리셋한다. `masked-markers.test.ts` 는 순수 함수만 다뤄 mock 없음. `.only`/`.skip` 잔존 없음(변경된 `.spec.ts`/`.test.tsx` 전체 grep 확인).
- **Mock 적절성**: `executions.service.spec.ts`/`background-runs.service.spec.ts` 는 `redactStoredDataForResponse`/`redactStoredErrorForResponse` 를 모킹하지 않고 실구현을 그대로 태워, 배선(어느 필드가 관문을 타는가)과 함수 자체(마커 보존)를 분리 검증하는 구조가 유지된다.
- **`dynamic-form-ui.test.tsx`**: import 경로만 이동(`../dynamic-form-ui` → `@/lib/utils/masked-markers`)이고, 승격된 유틸의 동작 자체는 신설 `masked-markers.test.ts` 가 직접 커버한다 — 재검증 불요.

## 요약

핵심 마스킹-차단 로직(프런트 3소비처·backend 3표면)의 테스트는 8라운드에 걸쳐 이미 매우
촘촘히 다져졌고, 직전 라운드가 지적한 유일한 갭(background-runs `inputData` ingestion 마커
캐너리 부재)도 이번 diff 에서 해소됐다. 이번 라운드에서 새로 발견한 것은 이번 diff 자신이
만든 비대칭이다 — `①`(`findById`)의 `inputData` 캐너리는 "유출 문자열 부재" 외에
"마스킹 마커 존재" 양성 단언까지 추가했는데, 같은 diff 가 같은 방향으로 뒤집는 자매 표면
`②`/`⑧`/`⑧-b` 는 음성 단언만 남았다. 현재 마스킹 함수의 실제 동작(부분 치환)상 지금 당장
거짓 통과를 내는 상태는 아니지만, 이 저장소가 반복 지적해 온 "자매 표면 중 하나만 보강"
패턴이 축을 바꿔 재발한 형태라 WARNING 으로 올린다. 그 외 나머지는 정보성 갭(배열 분기
깊이 경계 미검증, 모달 재오픈 시 신설 상태 리셋 미검증) 수준이다.

## 위험도

LOW
