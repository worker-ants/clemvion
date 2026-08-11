# Rationale 연속성 검토 결과

대상 델타: 커밋 `d7c6cf668` (`codebase/backend/src/modules/audit-logs/audit-action.const.ts`, prettier 자동 줄바꿈 2줄뿐). spec 본문·`## Rationale` 섹션 자체는 이번 라운드에 변경되지 않았다.

## 검증 대상

지시받은 확인 항목: 이번 라운드 `review/code/2026/08/11/14_33_16/maintainability.md` 가 "80자에 맞추려 키 이름을 줄이자" 는 대안을 검토·기각하며 든 근거 — "이 파일의 장황함은 sub-channel 을 액션명에 담는 의도적 설계이고 `conventions/audit-actions.md §3` Rationale 에 문서화돼 있다" — 가 실제 Rationale 과 일치하는지.

## 발견사항

- **[INFO]** maintainability 리뷰의 `audit-actions.md §3` 인용 — 근거 일치, 지어낸 내용 아님
  - target 위치: `review/code/2026/08/11/14_33_16/maintainability.md` L12-15, L19 (커밋 `d7c6cf668` 리뷰, INFO 항목)
  - 과거 결정 출처: `spec/conventions/audit-actions.md` §3 "트리거 시크릿/토큰 회전을 셋으로 가른 이유 (2026-08-11)" 인라인 note (L72-80) + `codebase/backend/src/modules/audit-logs/audit-action.const.ts` L87-88 포인터 주석
  - 상세: 대조 결과 두 가지 모두 실제로 확인됨.
    1. `audit-actions.md` §3 L74 "셋을 가른 축은 **폭발 반경(blast radius)** 이다" · L76 "**액션명이 sub-channel 을 담는다** — `notification_*`·`chat_channel_*`·`interaction_*`" 문구가 실존하며, maintainability 리뷰가 인용한 "sub-channel 을 액션명에 담는 의도적 설계" · "폭발 반경이 다른 자격증명을 구분" 표현과 내용이 정확히 일치한다.
    2. `audit-action.const.ts` L87-88 의 포인터 주석("셋으로 가른 근거(폭발 반경이 서로 다르다)와 액션명이 sub-channel 을 담는 이유는 `spec/conventions/audit-actions.md §3` Rationale.")도 리뷰가 인용한 "주석 87-88행" 과 라인 번호까지 정확히 일치한다.
    지어낸 근거가 아니다. (참고: 이 저장소는 과거 지어낸 Rationale 인용이 checker 에 잡힌 이력이 있어 특히 대조했다.)
  - 참고(사소, 문제로 보지 않음): 인용된 문단은 문서의 공식 `## Rationale` H2 섹션(L84-96, 시제 3분류·`workspace.transfer_ownership` 기각 등을 다룸)이 아니라 §3 "도메인별 분류 레지스트리" 본문 내 인라인 note 블록이다. 다만 "§3 Rationale" 이라는 표기 자체가 이미 `audit-action.const.ts` L87-88 주석에서 쓰이는 기존 관용 표현이므로, maintainability 리뷰가 새로 지어낸 라벨이 아니다 — 실질적 불일치로 취급하지 않는다.
  - 제안: 수정 불요. 향후 유사 인용도 이번처럼 코드 주석의 라인 앵커(L87-88)를 통해 spec 문단과 대조 가능하다는 점을 유지할 것.

그 외, target(`spec/5-system`) 범위에서 이번 델타(prettier 포맷팅 2줄)로 인해 과거 Rationale 에서 기각된 대안의 재도입, 합의된 설계 원칙 위반, 근거 없는 결정 번복, 기록된 invariant 우회로 볼 만한 사항은 없다. 코드 변경 자체가 로직 변경이 아니라 lint 위반 해소이므로 Rationale 연속성에 영향을 줄 표면이 애초에 없다.

## 요약

이번 라운드의 유일한 델타는 커밋 `d7c6cf668`(prettier 자동 줄바꿈 2줄)이며 spec·Rationale 은 무변경이다. 명시적으로 검증을 요청받은 maintainability 리뷰의 "80자 맞춤 키 단축" 대안 기각 근거는 `spec/conventions/audit-actions.md §3` 의 실제 문구(폭발 반경·sub-channel 문단, L72-80)와 `audit-action.const.ts` L87-88 포인터 주석 라인 번호까지 정확히 일치해, 지어낸 근거가 아니라 실제 문서 상태를 정확히 반영한 인용이다. 그 외 Rationale 연속성 관점에서 이번 라운드가 새로 만든 위험은 없다.

## 위험도

NONE

STATUS: OK
