# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `background-runs.service.spec.ts` 의 노드 레벨 `inputData` 마스킹 단언이 **outputData 의 양성 단언에 얹혀** vacuous 하다 — 같은 PR 이 다른 곳(`executions.service.spec.ts` ①②⑥⑧⑧-b)에서 이미 잡아 고친 것과 **같은 클래스**의 결함이 이 형제 파일엔 남아 있다.
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts:262-266` (`it('body nodeExecutions[] 의 inputData·outputData 를 모두 마스킹한다', ...)`)
  - 상세: `row = JSON.stringify(result.nodeExecutions.data[0])` 로 `inputData`·`outputData` 를 **한 문자열로 합친 뒤** `expect(row).toContain('***')` (양성) 하나만 두고 `expect(row).not.toContain('admin:pw')` (음성) 를 붙였다. `outputData` 쪽(`sk-live-abc123` → `***`)이 이미 `***` 를 만들어 내므로, `inputData` 마스킹이 값을 **치환하는 대신 필드를 비우거나 `null` 로 떨어뜨리는** 회귀가 나도 `toContain('***')` 는 `outputData` 만으로 통과하고 `not.toContain('admin:pw')` 도 원본 문자열이 사라졌으니 통과한다 — `inputData` 경로 자체가 무엇을 검증하는지 이 조합 문자열로는 판별 불가능하다.
    이 저장소가 **바로 이 PR 안에서** `executions.service.spec.ts` ①②⑧⑧-b 에 대해 정확히 이 뮤테이션(마스킹 제거가 아니라 "필드 비우기": `inputData: null`)으로 5건 RED 를 확인하고 양성 단언을 추가했는데(`plan/in-progress/eia-inputdata-marker-guard.md` 의 뮤턴트 표, `17_38_23` 커밋), 같은 필드 비우기 뮤테이션이 `background-runs.service.ts:305`(`inputData: redactStoredDataForResponse(row.inputData)`)에 대해서는 이 스펙에서 시도된 흔적이 없다(plan 의 뮤턴트 표에도 이 표면은 없다 — 표에 있는 `background-runs` 항목은 마커 **보존** 캐너리 `:339` 뿐, 마스킹 **적용** 테스트는 대상이 아니었다).
  - 제안: `inputData` 전용 문자열(`JSON.stringify(result.nodeExecutions.data[0].inputData)`)에 대해 별도로 `not.toContain('admin:pw')` + `toContain('***')` 양쪽을 단언해 `outputData` 의 통과 여부와 독립적으로 검증한다. (참고로 같은 파일의 마커 **보존** 테스트, `280-341` 인근 `inHeaders`/`headers` 는 이미 필드별로 분리돼 있어 이 패턴을 그대로 재사용하면 된다.)

- **[INFO]** `executions.service.spec.ts` 의 ③④⑤⑥-b 가 여전히 음성 단독 단언이다 — 라운드8(`17_38_23`)이 고친 것과 같은 취약점 형태이지만, 이번 diff 가 방향을 뒤집지 않은 (pre-existing) 테스트라 의도적으로 범위 밖에 뒀다(주석 "종전엔 방향이 갈렸다" 참조).
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts:1198`(③ `getChain`, outputData) · `:1228`(④ `stop`, outputData) · `:1250-1253`(⑤ `findById` nodeExecutions, input+output 결합) · `:1362`·`:1369`(⑥-b copy-on-change, inputLeaky/outputLeaky 각각)
  - 상세: 특히 ⑤(`:1231-1254`)는 `ne = JSON.stringify(result.nodeExecutions[0])` 로 두 필드를 합쳐 놓고 `not.toContain` 두 개만 있어, 양성 단언이 전혀 없다 — 위 WARNING 과 동일한 결합-문자열 문제가 이쪽엔 음성조차 짝이 없는 형태로 존재한다. 다만 ⑤·⑥-b 는 노드 레벨 `inputData` 마스킹(이 PR 이전부터 있던 동작)을 고정하는 캐너리라 이번 diff 의 "방향 반전" 대상이 아니었고, 라운드8 커밋 메시지도 "노드 레벨 캐너리는 그대로 둔다" 고 명시했다 — 그래서 CRITICAL 이 아니라 INFO 로 낮춘다.
  - 제안: 여유가 있다면 같은 양성-단언 패턴(`toContain('***')`)을 필드별로 분리해 ③④⑤⑥-b 에도 번지게 하면, 이 파일 안의 "자매 표면 단언 강도" 를 완전히 통일할 수 있다. 급하지 않으면 트래커에 등재.

- **[INFO]** e2e(Playwright) 레벨에서 이 마스킹-가드 왕복(마스킹된 값 → 프리필 스킵/제출 차단 → 재입력 → 해제)을 검증하는 테스트가 없다.
  - 위치: `codebase/frontend/e2e/` (grep 결과 `rerun`/`Re-run`/`masked`/`MASKED` 매치 없음)
  - 상세: unit/component 레벨(RTL, `rerun-modal.test.tsx` 12건 + `editor-toolbar-run-input.test.tsx` 3건 + `masked-markers.test.ts`)이 이미 매우 촘촘해 실질 위험은 낮지만, "backend 가 실제로 마스킹한 값이 실제 API 응답을 타고 프런트에 와서 실제로 차단되는지" 의 end-to-end 회귀는 아직 목/스텁이 대신하고 있다.
  - 제안: 필수는 아님. 다음 e2e 정비 라운드에서 짧은 스모크(예: webhook·manual trigger 로 시크릿 패턴 입력 실행 → Re-run 모달에서 Run 버튼 disabled 확인) 하나만 추가해도 충분.

## 요약

이 PR 은 이미 8라운드 리뷰·플랜 히스토리가 보여주듯 뮤테이션 기반 테스트 강화가 매우 공격적으로 진행됐다 — `masked-markers.ts` 의 깊이 상한 off-by-one(값 검사 vs 깊이 검사 순서, 배열/객체 보폭 동일성, 스택 오버플로 회귀), `rerun-modal.tsx` 의 세 조건 차단 판정(터치/마커 잔존/JSON 파싱 실패) 전부에 대해 캐너리가 있고, 방금 직전 라운드(`17_38_23`)는 "음성 단독 단언은 필드 소실에도 통과한다" 는 정확한 통찰로 `executions.service.spec.ts` ①②⑧⑧-b 를 고쳤다. 다만 그 하드닝이 **형제 파일**(`background-runs.service.spec.ts`)의 동일 구조(결합 JSON 문자열 + 공유 양성 마커) 테스트에는 번지지 않아, 정확히 같은 취약 패턴이 `inputData` 표면 하나에 남아 있다(WARNING 1건). 같은 파일 안의 방향-불변 자매(③④⑤⑥-b)에도 동일 결이 남아 있으나 이번 diff 범위 밖이라 INFO 로 낮췄다. e2e 왕복 커버리지 부재도 INFO 로 남긴다. 전반적으로 테스트 설계·가독성·격리(각 `beforeEach` 의 mock/store 리셋, `vi.clearAllMocks`)는 모범적인 수준이다.

## 위험도

LOW
