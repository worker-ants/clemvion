# 변경 범위(Scope) Review

## 발견사항

- **[INFO]** 스테일니스 가드 3종(`startGenRef`/`sessionRef` 동일성/`cancelled` 로컬 플래그) 통합이 최소 패치보다 넓은 리팩터링
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `worldGenRef` 관련 8개 diff hunk(선언부, `teardownSession`, `seedWaitingFromStatus`, `start`, `sendCommand`, `applyConfig`, 마운트 effect cleanup)
  - 상세: 발견된 구체 버그("유령 표면 부활" — `seedWaitingFromStatus` 의 `sessionRef.current !== session` 검사가 `teardownSession()` 이 `sessionRef` 를 null 하지 않아 SSE terminal 종료를 못 잡는 문제)만 고치려면 해당 함수 내부에 국소 가드(예: `endedRef` 참조)만 추가해도 충분했을 수 있다. 그러나 이번 diff 는 `start()` 전용이던 `startGenRef`, `seedWaitingFromStatus`/`sendCommand` 의 `sessionRef` 동일성 검사, `applyConfig` 의 지역 `cancelled` 플래그까지 전부 `worldGenRef` 하나로 교체해 파일 전역 5개 호출부를 건드렸다.
  - 근거(mitigating): `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 "구조 개선 — worldGen 단일화" 문단으로 결정 배경(4라운드 리뷰에서 같은 실패 유형 반복 확인 → `useEiaStream` 분리 검토 후 기각 → 가드 단일화가 근본 원인 해소라는 결론), 재현 확인, mutation 테스트 3종 검증 결과, 전체 테스트(lint·unit·build·e2e) PASS 근거가 상세히 기록되어 있다. 즉 "관련 없는 사전 정리"가 아니라 이번 라운드의 명시적 조사·수정 대상 그 자체다.
  - 제안: 현재 수준의 plan 문서화(결정 배경 + 검증 근거)면 충분. 향후 유사한 "국소 버그 fix → 구조적 원인 추적 → 통합 리팩터" 패턴에서도 이 문서화 관행(재현 확인·mutation 테스트·plan 기록)을 유지할 것을 권장.

- **[INFO]** 마운트 effect 언마운트 cleanup 의 `worldGenRef.current++` 추가는 단순 rename 이상의 신규 동작
  - 위치: `use-widget.ts` 마운트 `useEffect` cleanup(옛 `cancelled = true;` → `worldGenRef.current++;` + `eslint-disable-next-line react-hooks/exhaustive-deps`)
  - 상세: 종전 `cancelled` 지역 플래그는 `applyConfig` 의 첫 `await`(임베드 검증)만 방어했고 그 이후(`seedWaitingFromStatus`/`openStream`)는 무방비였다. 이번 변경은 언마운트도 `worldGenRef` 무효화 지점으로 승격시켜, 언마운트 후 in-flight 비동기가 뒤늦게 resolve 되어 `openStream` 으로 새 `EventSource` 를 여는 leak 을 추가로 차단한다 — 순수 리네이밍을 넘어선 동작 확장.
  - 근거(mitigating): 코드 주석과 plan 문서 모두 이를 "리뷰 W6(unmount-after-await SSE leak)" 로 이미 식별된 기존 발견 사항의 fix 로 명시한다. 즉 이번 라운드에 새로 발명한 범위가 아니라 문서화된 선행 리뷰 지적의 이행이다.
  - 제안: 없음(문서화 충분, 별도 조치 불요).

- **[INFO]** 임포트/설정/포맷팅 오염 없음 — 확인 결과 3개 파일 모두 diff 가 논리 변경에 1:1 대응하는 주석/문서 갱신만 동반하며, 사용하지 않는 import 추가·설정 파일 변경·의미 없는 공백/줄바꿈 변경은 발견되지 않았다.

## 요약

3개 파일(구현 `use-widget.ts`, 회귀 테스트 `use-widget-eager-start.test.ts`, plan 문서 `spec-sync-external-interaction-api-gaps.md`) 은 모두 하나의 비동기 staleness 버그("유령 표면 부활": 버퍼 만료 seed 가 in-flight 인 동안 SSE terminal 이 먼저 도착해도 종전 `sessionRef` 동일성 가드가 이를 못 잡아 종료된 위젯이 되살아나는 문제)를 중심으로 긴밀하게 결합돼 있다. 구현 fix + 그 fix 를 고정하는 회귀 테스트 + 결정 배경을 남기는 plan 문서 갱신이 하나의 일관된 트리오로 움직였고, 이 프로젝트 관례(진행 중 작업의 구조적 결정은 `plan/in-progress/*.md` 에 기록)와도 부합한다. 다만 실제 채택한 fix 는 원인이 된 특정 함수(`seedWaitingFromStatus`)만 고치는 최소 패치가 아니라 파일 전역 5개 호출부의 staleness 가드 3종을 `worldGenRef` 하나로 통합하는 더 넓은 리팩터링이다. 이는 무관한 코드 정리가 아니라 plan 문서에 상세히 기록된 근본 원인 분석(4라운드 반복된 동일 실패 유형 → 분리안 검토·기각 → 통합 채택)의 직접적 산물이며, mutation 테스트·재현 확인·전 스택 테스트 결과까지 함께 남아 있어 임의 확장으로 보기 어렵다. import/설정 변경, 무관 파일 수정, 의미 없는 포맷팅 변경은 발견되지 않았다.

## 위험도

LOW
