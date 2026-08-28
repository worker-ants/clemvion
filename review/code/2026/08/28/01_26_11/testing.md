# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `extractNodeErrorPayload` 의 `direct` 분기(객체 형태 `rawError`)가 뮤테이션으로 실측 확인한 결과 **테스트 커버리지 0**이다.
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` 함수 `extractNodeErrorPayload` 내 `const direct = ...` 선언부(주석상 "`rawError` 가 객체인 경우만 잡는다" 바로 아래 블록).
  - 상세: 직접 뮤테이션 테스트로 검증함 — `const direct = rawError && ... ? (...) : null;` 을 `const direct = null;` 로 강제 치환한 뒤 `npx vitest run src/lib/websocket/__tests__/use-execution-events.test.ts` 를 재실행했더니 **87개 테스트 전부 GREEN** 을 유지했다(원복 후 재실행으로 87 GREEN 재확인, `git status` clean 확인). 즉 이 분기를 통째로 죽여도 어떤 테스트도 실패하지 않는다.
    현재 이 헬퍼의 실제 호출부는 2곳뿐이다 — `handleNodeCompleted`(`extractNodeErrorPayload(undefined, payload.output)`, `rawError` 는 항상 `undefined`)와 `handleNodeFailed`(`payload.error` 는 spec/실측상 emit 4곳 전수가 문자열). 즉 프로덕션에서는 `direct` 가 항상 `null` 이 되므로 현재 코드베이스 기준으로는 죽은 코드다. 하지만 코드 주석 자체가 "`node.completed` 등 다른 호출자가 객체를 넘길 수 있다"는 방어적 의도를 명시하고 있어, 이 헬퍼가 공유 유틸리티로서 유지하려는 계약의 일부다. CT-S9/CT-S10 은 이번 PR 에서 정확히 이 분기를 검증하던 유일한 테스트였는데, 이번 fixture 정정(객체 `error` → 문자열 `error`)으로 전부 `nested` 경로로 옮겨갔고, 그 결과 `direct` 분기를 양성(positive)으로 확인하는 테스트가 하나도 남지 않았다.
  - 제안: `handleNodeFailed` (또는 헬퍼를 직접 호출하는 별도 유닛 테스트)에 "AI 노드 + 기존 대화 컨텍스트 + **객체 형태** `error`(`{code, message, details}`)" 조합의 양성 테스트를 하나 추가해 `direct` 분기가 여전히 동작함을 고정한다. 혹은 이 분기가 정말 도달 불가능하다고 판단되면(YAGNI) 제거해 헬퍼를 단순화하는 편이 "테스트 없는 방어 코드"보다 낫다 — 다만 이는 설계 판단이라 developer 선택.

- **[INFO]** `asRecord` 신규 헬퍼는 직접 유닛 테스트가 없으나 `extractNodeErrorPayload` 를 통해 간접적으로 (object/null 두 갈래) 충분히 행사된다. 배열 입력(`asRecord([1,2])`) 케이스는 어느 테스트에서도 명시적으로 겨냥하지 않지만, 순수 함수이고 로직이 단순해 우선순위 낮음.

- **[INFO]** 회귀 캐너리 테스트(`[캐너리] 문자열 error + 래퍼 output 조합에서 배너가 뜬다`, `use-execution-events.test.ts` CT-S9/S10 인접 블록)는 결함 티켓(`12_24_55`)을 명시적으로 인용하고, 결함이 만드는 정확한 조건(top-level `error`=문자열 + `output.output.error`=구조화 객체)을 그대로 재현한 뒤 `code`/`retryable`/`retryAfterSec` 세 필드를 개별 단언한다. 백엔드 실측(`execution-engine.service.ts:8018` `error: errorMessage`, `:6360` 대역 `nodeExec.outputData = finalOutput`, `ai-turn-orchestrator.service.ts:1513-1537` `errOutput = nodeExec.outputData?.output` → `errFromOutput = errOutput?.error`)과 대조한 결과 fixture 의 wrapper 중첩(`output.output.error`)이 실제 backend emit 구조와 정확히 일치함을 직접 확인했다 — mock 이 허구가 아니라 프로덕션 shape 을 충실히 반영한다.

- **[INFO]** `output` 미동봉 경로 테스트("`output` 미동봉 경로(문자열 error 단독)는 system_error 를 APPEND 하지 않는다")는 기존 테스트("legacy string error...")를 이름·주석만 정정해 재사용했고 테스트 바디(assert 대상·payload)는 그대로다 — 라벨이 사유(`옛 backend 호환` → `구조화 에러 도달 경로 없음`)를 따라잡은 것으로, 의미 왜곡 없이 커버리지가 보존됐다.

## 요약

핵심 회귀(문자열 `error` + 한 겹 더 깊은 `output.output.error` 래퍼 조합에서 배너가 안 뜨던 결함)를 정확히 겨냥하는 캐너리 테스트가 추가됐고, 그 근거가 되는 fixture shape 은 백엔드 실제 emit 코드(`execution-engine.service.ts`, `ai-turn-orchestrator.service.ts`)와 대조해 정확함을 확인했다. `handleNodeCompleted` 의 자매 호출부(§9.7 port='error' 케이스)도 같은 헬퍼를 공유하므로 fixture 갱신으로 자동 회귀 방지에 편입됐다. 87개 테스트 전부 GREEN 을 직접 재현했다(원본 상태로 복원 후 재확인). 다만 헬퍼의 두 갈래(`direct`/`nested`) 중 `direct`(객체 형태 `rawError`) 분기는 이번 fixture 정정으로 양성 테스트가 사라졌음을 뮤테이션으로 직접 실증했다 — 프로덕션에서는 현재 도달 불가능한 방어 코드지만, 주석이 "다른 호출자를 위한 방어"라는 계약을 명시한 만큼 그 계약을 지키는 테스트 하나를 추가하는 것이 바람직하다. 전반적으로 이번 diff 는 결함 원인·수정·회귀 테스트·문서 정정이 일관되게 맞물려 있고 테스트 가독성·격리도 양호하다.

## 위험도

LOW
