# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] http-exception.filter.ts — 주석 추가 (A-2 범위 내)
- 위치: `http-exception.filter.ts` lines 278-289 (두 상수 JSDoc)
- 상세: named 상수화(A-2) 과정에서 두 상수에 설명 JSDoc 주석이 추가됨. 범위 선언("명명만")에는 주석 추가가 명시되지 않았으나, 두 상수가 의도적으로 다름을 명확히 설명하는 주석은 향후 혼동 방지를 위해 합리적이다. 동작 변경 없음.
- 제안: 허용 범위 내로 판단. 단, 주석 길이가 상수 자체보다 길어 "명명만" 범위에서 살짝 확대되었음을 인지할 것.

### [INFO] hooks.service.ts — 주석 변경 (A-1 범위 내)
- 위치: `hooks.service.ts` diff lines +679~+682 (handleWebhook 호출부 주석), diff lines -691 (handleChatChannelWebhook 기존 주석 제거)
- 상세: A-1에서 로컬 래퍼를 제거하면서, 기존 함수 레벨 JSDoc(`extractClientIp` 함수 주석 13줄)이 삭제되고 그 내용이 각 호출부 인라인 주석으로 축약·이동되었다. 내용 보존 관점에서 적절하다. 그러나 두 번째 호출부(`handleChatChannelWebhook` 내 line -692 기존 주석 제거)에서 기존 "extractClientIp 를 재사용 없이 인라인 재호출하면 향후 부수효과 추가 시 회귀 위험" 설명이 사라졌다. 두 번째 호출부에 추가된 인라인 주석이 없어 정보 손실이 있으나, 단일 구현 통합이 완료되었으므로 해당 경고 문구의 의미도 소멸됨. 허용 범위 내.
- 제안: 이슈 없음.

### [INFO] public-webhook-throttle.guard.spec.ts — 삭제된 export interface (A-3 범위 내)
- 위치: `public-webhook-throttle.guard.spec.ts` diff lines -1769~-1775
- 상세: 기존 spec 파일에서 `export interface ReqShape`가 삭제되고 `type ReqShape = PublicWebhookReqShape` 로 교체되었다. 이 interface가 `export` 되어 있었으므로 외부에서 import 하는 코드가 있다면 breaking change가 될 수 있다. 그러나 spec 파일에서 export된 타입을 다른 곳에서 import하는 것은 일반적이지 않으며, test 파일 간 타입 공유가 실질적으로 없다고 보이면 문제 없음. diff 상 이 타입을 소비하는 다른 파일 변경이 없어 실제 소비자가 없는 것으로 추정.
- 제안: 실제 import 소비자가 없는지 확인 권장(저위험).

### [INFO] plan 파일 두 개 신설 — 범위 밖 항목 명시
- 위치: `plan/in-progress/webhook-hardening-cleanup.md`, `plan/in-progress/webhook-public-ip-failopen-hardening.md`
- 상세: 두 plan 파일이 새로 추가되었다. `webhook-hardening-cleanup.md`는 이번 작업(A+B)을 추적하는 정상적인 plan 파일이다. `webhook-public-ip-failopen-hardening.md`는 이번 작업에서 처리하지 않는 "범위 밖" 항목(D-12)을 별도 plan으로 분리한 파일이다. 이는 코드 변경 없이 미래 작업을 기록하는 것으로, CLAUDE.md의 plan 생성 규약에 부합하며 현재 변경 범위를 벗어나지 않는다.
- 제안: 이슈 없음.

## 요약

변경 범위(A-1~A-3, B-4~B-7)와 실제 변경 내용이 전반적으로 일치한다. plan 파일에 선언된 각 항목이 대응하는 파일 변경으로 정확히 구현되었으며, 동작 변경 없이 코드 정리·테스트 격리라는 의도가 유지된다. `http-exception.filter.ts`에 JSDoc 주석이 추가된 것과 `hooks.service.ts`에서 기존 함수 레벨 주석이 호출부 인라인 주석으로 재배치된 것은 선언된 범위("명명만", "동작 보존")에서 소폭 확대되었으나, 내용이 적절하고 범위를 실질적으로 위반하지 않는다. 무관한 파일 수정, 기능 확장, 불필요한 리팩토링은 없다.

## 위험도

NONE
