# 변경 범위(Scope) 리뷰 — M-4 park-entry dispatch registry 추출

## 발견사항

### INFO: `review/` 산출물 파일 2건 커밋 포함
- **[INFO]** consistency check 산출물(`review/consistency/2026/06/24/15_38_48/SUMMARY.md`, `_retry_state.json`)이 동일 커밋에 포함됨
  - 위치: `review/consistency/2026/06/24/15_38_48/SUMMARY.md`, `review/consistency/2026/06/24/15_38_48/_retry_state.json`
  - 상세: impl-prep consistency check 산출물을 구현 커밋과 같은 커밋에 묶었다. 이는 impl-prep → impl 의 자연스러운 흐름이며 `review/` 는 `developer` 쓰기 허용 영역(`review/**/RESOLUTION.md` + 산출물 자체). 기능 구현과 별개 커밋으로 분리하는 것이 더 깔끔하나, 동작 변경 없는 산출물이고 스코프를 벗어난 코드 수정은 없다.
  - 제안: 필요하다면 다음 커밋부터 impl-prep 산출물은 별도 커밋으로 선행 분리. 단, 현재로선 차단 사유 없음.

### INFO: `dispatchParkEntry` 리턴 타입 암묵적 `undefined` 허용
- **[INFO]** `dispatchParkEntry`의 반환 타입이 `Promise<ProcessTurnResult>`로 선언되어 있으나, `handler`가 없으면 `undefined`를 반환한다. `ProcessTurnResult`가 `undefined`를 포함하는지 여부에 따라 타입 안전성 확인 필요.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `dispatchParkEntry` 메서드
  - 상세: 커밋 메시지에서 "매칭 없으면 `undefined`(추출 전 else-fallthrough 동일)"로 명시. `ProcessTurnResult`가 `undefined`를 허용하는 union이면 무결. 행동 보존 측면의 관찰이며 범위 이탈은 아님.
  - 제안: `ProcessTurnResult` 정의 확인 후 이미 포함되어 있으면 무시. 포함되지 않는다면 타입 선언 보정.

## 요약

이번 M-4 커밋은 `execution-engine.service.ts` 3개 사이트에 하드코딩돼 있던 form/buttons/ai park-entry if/else 삼중복을 `parkEntryRegistry` + `dispatchParkEntry` 단일 진입점으로 추출하는 behavior-preserving 리팩터링이다. 변경 범위는 계획된 M-4 작업(park-entry dispatch registry 추출)에 정확히 부합하며, 의도 외 코드 정리·기능 추가·무관한 파일 수정이 없다. 신규 `park-entry-dispatch.ts`(인터페이스 + factory)와 `park-entry-dispatch.spec.ts`(7 unit 테스트)는 작업 범위의 직접 산출물이다. impl-prep consistency check 산출물 2건이 동일 커밋에 포함된 점은 프로젝트 워크플로 규약상 정상 범주다. 범위 이탈에 해당하는 불필요한 리팩토링, 포맷팅 변경, 임포트 정리, 설정 변경은 발견되지 않았다.

## 위험도

NONE
