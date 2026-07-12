# 문서화(Documentation) 리뷰 — disclaimer 문구 해요체 통일

## 컨텍스트

세 파일(`codebase/channel-web-chat/src/app/demo/demo-config.ts`,
`codebase/packages/web-chat-sdk/examples/snippet.html`, `spec/7-channel-web-chat/2-sdk.md`)의 변경은
동일한 disclaimer 기본값 문자열을 "AI는 한정된 데이터로 동작하며 답변이 부정확할 수 있어요."로
통일하는 순수 카피 정정이다. 이는 `review/consistency/2026/07/12/01_41_42/convention_compliance.md`
가 보고한 WARNING("위젯 disclaimer 기본 문구가 i18n-userguide.md Principle 6(해요체) 위반")에 대한
직접적인 후속 조치로 확인된다.

## 발견사항

- **[INFO]** consistency-checker WARNING 을 정확히 해소함 — 4개 canonical 소스 전수 일치 확인
  - 위치: `codebase/channel-web-chat/src/app/demo/demo-config.ts:30`,
    `codebase/packages/web-chat-sdk/examples/snippet.html:44`, `spec/7-channel-web-chat/2-sdk.md:46`
  - 상세: 변경 전 세 곳(및 이미 해요체였던 `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat-sdk.mdx:50`)
    이 서로 다른 문구·톤(`~습니다` 합니다체 vs `~어요` 해요체, 쉼표 유무, 문장 구조)을 쓰고 있었다.
    이번 변경으로 `demo-config.ts` / `snippet.html` / `2-sdk.md` 세 곳이 모두 `web-chat-sdk.mdx` 와
    바이트 단위로 동일한 문자열("AI는 한정된 데이터로 동작하며 답변이 부정확할 수 있어요.")로
    수렴했다(grep 으로 재확인, 잔존 구문구는 review 산출물·stale `.next`/`out` 빌드 아티팩트에만
    남아 있고 소스 트리에는 없음). `2-sdk.md` §1 예시가 기존 `…` truncate 대신 완전한 예문으로
    채워진 것도 해당 리뷰가 제안한 "향후 copy-paste 시 tone 오염 예방"을 정확히 반영한다.
  - 결론: 조치 불요. 문서화 관점에서 개선(consistency 부채 해소)으로 판단.

- **[INFO]** 인접 파일(diff 범위 밖) `widget-app.test.tsx` 의 테스트 픽스처가 여전히 합니다체
  - 위치: `codebase/channel-web-chat/src/widget/widget-app.test.tsx:44,53`
    (`disclaimer: "AI는 한정된 데이터로 동작합니다."`)
  - 상세: 이번 diff 의 대상이 아니며, 위젯이 임의 disclaimer 문자열을 그대로 렌더하는지 검증하는
    독립적 테스트 픽스처(canonical 기본값과 동기화 의무 없음)라 기능적 문제는 아니다. 다만
    i18n-userguide.md Principle 6(위젯 인라인 한국어는 해요체)의 문면상 인라인 한국어 문자열이며,
    `channel-web-chat` 은 frontend hardcoded-korean 가드 스코프 밖이라 자동 검출되지 않는다.
  - 제안: 강제 아님(scope 밖) — 후속 기회에 `~해요` 톤으로 통일하면 grep 기반 재발 방지에 도움.
    이번 PR 에서 굳이 손댈 필요는 없다.

- **[INFO]** 독스트링/README/API문서/CHANGELOG 해당 없음
  - 상세: 세 파일 모두 데이터 리터럴(문자열 상수) 1줄 교체로, 함수 시그니처·공개 API·엔드포인트·
    환경변수·설정 스키마 변경이 전혀 없다. `demo-config.ts` 의 기존 JSDoc 주석들(`buildBootConfig`,
    `normalizeApiBase`, `isDemoEnabled` 등)은 이 변경과 무관하며 여전히 코드와 일치한다(오래된 주석
    없음). 저장소에 CHANGELOG 파일이 존재하지 않아(검색 결과 0건) CHANGELOG 갱신 요구도 없다.

## 요약

세 파일의 변경은 disclaimer 기본 문구를 해요체로 통일하는 순수 카피 수정이며, 직전
consistency-check 가 명시적으로 지적한 톤 불일치 WARNING 을 정확히 해소한다. `demo-config.ts` /
`snippet.html` / `2-sdk.md` 세 곳 모두 이미 해요체였던 `web-chat-sdk.mdx` 와 문자 단위로 일치하게
되었고, `2-sdk.md` 의 truncate 된 예시도 완전한 예문으로 보강되어 향후 copy-paste 시 tone 오염
가능성도 줄었다. 코드 동작·공개 API·설정·독스트링에는 영향이 없어 추가 문서 갱신 의무가 없다.
diff 범위 밖의 `widget-app.test.tsx` 픽스처 문구가 여전히 합니다체이나 기능적으로 무해하고 scope
밖이라 INFO 로만 남긴다.

## 위험도
NONE
