# 부작용(Side Effect) Review 결과

> 대상: 4차(fresh) 리뷰 세션(19_40_53). 이번 changeset(`origin/main` 대비 누적 diff, 14개 파일)을 확인한 결과
> **런타임 애플리케이션 코드(`.ts`/`.tsx`) 파일은 diff 에 전혀 포함되어 있지 않다**. 전량이 (1) 3차 리뷰 라운드
> (19_26_15)의 산출물 markdown 5종 + consistency-check(18_27_06) 산출물 3종(신규 커밋으로 추가) — `review/code/**`,
> `review/consistency/**`, (2) spec 문서 4종(`14-external-interaction-api.md`, `1-widget-app.md`, `2-sdk.md`,
> `3-auth-session.md`)의 텍스트 갱신뿐이다. `interaction.service.ts`/`use-widget.ts`/`panel.tsx`/`conversation.ts`
> 등 실제 로직 파일은 이전 커밋(들)에서 이미 반영되어 이번 diff 범위 밖이다.

## 발견사항

- **[INFO]** 이번 diff 범위에 부작용 점검 대상 코드가 없음(문서·리뷰 산출물 전용 변경)
  - 위치: 전체 diff(파일 1-14)
  - 상세: 부작용 점검 관점(상태 변경·전역 변수·파일시스템·시그니처·인터페이스·환경 변수·네트워크 호출·이벤트/콜백)은
    모두 실행되는 코드에 적용되는 항목인데, 이번 diff 는 (a) 과거 리뷰 세션이 생성한 리뷰 markdown/json 리포트를
    저장소에 커밋하는 것(본 저장소 컨벤션상 `review/` 는 gitignored 아니며 커밋 대상 — 메모리 "review/ 는
    gitignored 아님, SUMMARY/RESOLUTION 도 커밋"과 일치), (b) 이미 구현된 동작을 사후 서술하는 spec 문서 갱신
    뿐이다. 둘 다 애플리케이션 실행 시점에 아무 영향이 없는 정적 텍스트 파일이며, 빌드·런타임 부작용을 유발하지
    않는다.
  - 제안: 없음(정보 기록용). 코드 레벨 부작용은 이전 라운드(19_26_15)의 `side_effect.md` 산출물(파일 4, 이번
    diff 로 신규 커밋됨)에서 이미 `endConversation` 종료 순서·`startGenRef`·`getStatus` additive 확장·
    `PanelActions`/`TurnSource` 시그니처 확장·`conversationEnded.reason` 신규 값 등을 LOW 위험도로 상세 분석해
    두었고, 이번 라운드 재검토로도 해당 코드 자체의 변경이 없어 결론이 달라질 근거가 없다.

- **[INFO]** spec 문서 갱신(파일 11·12·14) 내용이 코드가 이미 구현한 additive/read-only 동작과 정합
  - 위치: `spec/5-system/14-external-interaction-api.md`(R17 재조정), `spec/7-channel-web-chat/1-widget-app.md`
    (§2 헤더·§3.1 표), `spec/7-channel-web-chat/3-auth-session.md`(§3.1 재로드 시퀀스)
  - 상세: 세 문서 모두 "`getStatus` 가 `waiting_for_input` 시 durable `conversation_thread` 를 `context.conversationThread`
    로 조건부(스프레드) 노출"·"REST 응답은 이미 로드된 컬럼을 재노출할 뿐 신규 DB I/O 없음"·"부재 시 키 생략, 위젯은
    graceful 처리" 라는, 앞선 라운드의 side_effect 분석(파일 4)이 이미 검증한 내용을 문서로 옮긴 것뿐이다. 문서
    갱신 자체가 새로운 부작용을 만들지 않으며, 서술과 코드 동작 사이의 괴리도 발견되지 않았다.
  - 제안: 없음.

- **[INFO]** `spec/7-channel-web-chat/2-sdk.md` 갱신 — `conversationEnded.reason` 을 열린 문자열 집합으로 명문화
  - 위치: `spec/7-channel-web-chat/2-sdk.md` (`wc:event` 표, `reason` 필드 설명 추가)
  - 상세: 이전 side_effect 라운드(19_26_15, 파일 4)가 "제안"으로 남겼던 항목("host 통합 문서에 `reason` 이 열린
    문자열 집합임을 명시")이 이번 diff 에서 정확히 그대로 반영됐다(`user_ended`/`gone`/SSE terminal 이벤트명 예시
    병기, "host 는 특정 값에 강결합하지 말 것" 명시). 문서만의 변경이라 host↔iframe `postMessage` 이벤트 자체의
    런타임 동작·페이로드 스키마는 변경되지 않았으며(이미 열린 문자열이었음을 사후 문서화), 기존 host 통합 코드에
    대한 breaking 영향이 없다.
  - 제안: 없음(이전 라운드 제안이 반영 완료됨을 확인).

## 요약

이번 4차(fresh) side_effect 리뷰 대상 diff 에는 실행 코드 변경이 전혀 포함되어 있지 않다 — 전량이 이전 리뷰
라운드(19_26_15)와 consistency-check(18_27_06)의 산출물 커밋 + spec 문서 4종의 사후 텍스트 정합화뿐이다. 따라서
"의도치 않은 상태 변경/전역 변수/파일시스템 부작용/시그니처·인터페이스 변경/환경 변수/네트워크 호출/이벤트·콜백"
어느 관점으로도 신규 CRITICAL/WARNING 급 부작용을 유발할 여지가 없다. 실질적인 코드 레벨 부작용 분석(`endConversation`
종료 순서, `startGenRef` 세대 토큰, `getStatus` additive 확장, `PanelActions`/`TurnSource` 시그니처 확장,
`conversationEnded.reason` 신규 값)은 이전 라운드(19_26_15)의 `side_effect.md` 에 이미 상세히 기록되어 있으며(위험도
LOW), 이번 diff 로 그 결론이 바뀔 근거는 없다. spec 문서 갱신은 이미 구현된 동작을 정확히 반영하고 있어 문서-코드
괴리도 발견되지 않았다.

## 위험도
NONE
