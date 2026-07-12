# 문서화(Documentation) 리뷰 — disclaimer 문구 해요체 통일

대상: `codebase/channel-web-chat/src/app/demo/demo-config.ts`,
`codebase/packages/web-chat-sdk/examples/snippet.html`,
`spec/7-channel-web-chat/2-sdk.md` (커밋 `40a375972`)

## 컨텍스트 확인

이 diff 는 `review/consistency/2026/07/12/01_41_42/convention_compliance.md` 가 발견한 WARNING
("위젯 disclaimer 기본 문구가 i18n-userguide.md Principle 6(해요체) 위반")의 fix 커밋이다. 세 파일
모두 문자열 리터럴 하나(`disclaimer`)만 합니다체 → 해요체로 교체하는 순수 콘텐츠 변경이며, 함수
시그니처·타입·로직·API 계약은 무변경이다.

## 발견사항

- **[INFO]** 수정이 정확하고 완결적 — 잔존 drift 없음
  - 위치: 전체 diff
  - 상세: 변경 후 문구("AI는 한정된 데이터로 동작하며 답변이 부정확할 수 있어요.")가 기존에
    이미 해요체를 준수하던 canonical 소스 `codebase/frontend/src/content/docs/06-integrations-and-config/
    web-chat-sdk.mdx:50` 와 바이트 단위로 정확히 일치한다. 저장소 전체를 재검색한 결과
    (`grep -rn "정확하지 않을 수 있습니다\|추가 확인이 필요합니다"`) 옛 합니다체 문구의 잔존 인스턴스는
    0건 — `demo-config.ts`/`snippet.html`/`2-sdk.md` 세 곳 모두 동시에 교정돼 tone drift 가 재발할
    소스가 남지 않았다. `2-sdk.md` 는 기존에 `…` 로 truncate 돼 있던 예시를 완전한 문장으로 채워
    향후 copy-paste 시 tone 오염 가능성도 함께 차단했다(consistency 리포트의 제안을 그대로 반영).
  - 제안: 없음 — 조치 완료로 판단.

- **[INFO]** CHANGELOG 미기재는 프로젝트 관례와 일치(결함 아님)
  - 위치: `CHANGELOG.md` (본 diff 에는 미포함)
  - 상세: `CHANGELOG.md` 의 "Unreleased" 섹션은 기능·동작 변경 위주로 항목이 촘촘하지만(예:
    `fb8d13f64`/`8436188c8` 등 대부분 PR 단위 1항목), 순수 카피/톤 통일 커밋에는 선례상 항목을 두지
    않는다 — `f718c6431`("한국어 가이드·UI i18n 어색 표현 일제 정리 — 의문 헤딩·해요체·글로서리 표준
    통일")·`1902b4621`("stale 문구 3종 정정") 모두 CHANGELOG 를 건드리지 않았다. 이번 커밋도 동일
    카테고리(예시/데모 기본값 tone 통일, 런타임 동작·API 계약 무변경)라 관례상 CHANGELOG 항목 생략이
    맞다.
  - 제안: 없음 — false positive 방지 차원에서 명시. 추가 조치 불요.

- **[INFO]** 주석·독스트링 정확성 — 영향 없음 확인
  - 위치: `demo-config.ts` 상단 모듈 주석, `defaultDemoForm` 위 블록 주석
  - 상세: 두 주석 모두 `apiBase`/`triggerEndpointPath` 규약을 설명할 뿐 `disclaimer` 필드 콘텐츠를
    언급하지 않아 이번 텍스트 교체로 stale 해질 여지가 없다. `2-sdk.md` R5/R6 Rationale 도 각각
    command-queue 스텁·`locale` reserved 를 다루며 disclaimer 와 무관 — 갱신 불필요.

## 요약
세 파일에 걸친 disclaimer 예시/기본값 문구를 해요체로 통일한 순수 카피 수정으로, 직전 consistency
검토에서 지적된 i18n-userguide Principle 6 위반을 정확하고 완결적으로 해소했다(잔존 drift 0건,
canonical 소스와 바이트 일치). 로직·API·타입 변경이 없어 독스트링·README·API 문서 갱신 필요성도
없으며, CHANGELOG 미기재도 순수 톤 수정에 대한 기존 프로젝트 관례와 부합한다. 문서화 관점에서 지적할
결함이 없다.

## 위험도
NONE
