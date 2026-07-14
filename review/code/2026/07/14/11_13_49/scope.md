# 변경 범위(Scope) Review

## 검토 대상
- `spec/5-system/15-chat-channel.md` — F-5 (`control-plane raw-send 키의 등록 시점 검증`) 단락 신설
- `spec/5-system/4-execution-engine.md` — F-6 (WS continuation nodeId 대조) 커버리지 표 1행 + Rationale 문단 정정
- `spec/5-system/6-websocket-protocol.md` — F-6 `execution.click_button` payload에 `nodeId?` 추가, ack 노트·§4.2 정정 이력 문단 갱신

## 배경 확인
`plan/in-progress/eia-command-waiting-surface-guard.md`의 "후속 항목" 체크리스트에 F-5, F-6가 별도 항목으로 명시돼 있고 각각 "완료 (2026-07-14)"로 마킹되어 있다. `git log`에서도 `ee13e3bf9 feat(chat-channel): ... F-5`, `2eda0da55 feat(websocket): ... F-6`, `3ed47bcc6 style(chat-channel): F-5 DTO validator prettier 포맷 정리` 3개 커밋으로 분리되어 존재한다. 즉 이번 diff는 사전에 계획·추적된 backlog 항목(F-5/F-6)의 spec 반영이며, 임의로 끼워넣은 범위 외 작업이 아니다.

## 발견사항

- **[INFO]** 서로 독립적인 두 기능(F-5, F-6)이 같은 리뷰 배치에 포함됨
  - 위치: 파일 1(F-5) vs 파일 2·3(F-6)
  - 상세: F-5(텔레그램 control-plane raw-send 키의 MarkdownV2 등록시점 검증)와 F-6(WS continuation `nodeId` 대조 확장)은 기능적으로 무관하다. 다만 두 항목 모두 동일 상위 plan(`eia-command-waiting-surface-guard.md`)의 "후속 항목" 체크리스트에 별도 서브섹션으로 명시돼 있고, git 커밋도 항목별로 분리되어 있어 "무관한 작업의 은닉 끼워넣기"는 아니다. 커밋 단위 분리가 이미 되어 있으므로 실무적 문제는 없음.
  - 제안: 조치 불필요. 향후 리뷰 배치 시 가능하면 plan 항목 단위로 나눠 리뷰하면 추적성이 더 좋아진다는 정도의 참고사항.

- **[INFO]** 파일 3의 `§4.2` "정정 내용" 이력 문단 수정은 과거 작성된 서술을 갱신하는 것으로, 신규 F-6 동작(`click_button`의 `nodeId?` optional 수용)과 직접 연동된 필연적 수정이다
  - 위치: `spec/5-system/6-websocket-protocol.md` 라인 1174-1175 (`- **정정 내용**...` 문단)
  - 상세: 이전 spec-sync 감사 기록(2026-06-10)에 "F-6 후속 정정" 주석을 추가하는 방식으로, 기존 서술을 삭제하지 않고 확장 서술을 덧붙였다. 범위 이탈이 아니라 정합성 유지를 위한 필수 동반 수정.
  - 제안: 조치 불필요.

세 파일의 diff 모두 실질 내용 변경만 포함하고 있으며, 포맷팅 전용 변경·주석 잡음·불필요한 임포트·설정 변경·요청 외 리팩토링은 발견되지 않았다(`.md` 파일이라 임포트/설정 항목은 해당 없음). "전체 파일 컨텍스트" 섹션은 참고용 전체본이며 diff 자체와 별개로 추가 변경 흔적은 없다.

## 요약
diff에 포함된 3개 spec 파일 변경은 모두 `plan/in-progress/eia-command-waiting-surface-guard.md`에 사전 등록된 F-5(telegram control-plane raw-send 키 MarkdownV2 검증)와 F-6(WS continuation nodeId 대조 확장) 두 backlog 항목의 문서 반영이며, git 커밋도 항목별로 분리되어 있어 계획 범위를 벗어난 임의 수정이나 불필요한 리팩토링·포맷팅 잡음은 발견되지 않았다. 두 기능이 하나의 리뷰 배치에 함께 제출된 점은 있으나 각 항목이 독립적으로 추적·커밋되어 있어 실질적 범위 위반으로 보기는 어렵다.

## 위험도
NONE
