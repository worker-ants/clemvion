# 테스트(Testing) 리뷰 — disclaimer 문구 변경 (demo-config.ts / snippet.html / spec 2-sdk.md)

## 발견사항

- **[INFO]** 순수 문자열(microcopy) 변경 — 로직 변경 없음, 신규 테스트 불필요
  - 위치: `codebase/channel-web-chat/src/app/demo/demo-config.ts:74` (`defaultDemoForm.disclaimer`), `codebase/packages/web-chat-sdk/examples/snippet.html:44`, `spec/7-channel-web-chat/2-sdk.md:248`
  - 상세: 3개 파일 모두 disclaimer 문구를 `"...정확하지 않을 수 있습니다."` → `"...부정확할 수 있어요."`(해요체) 로 교체한 것뿐이며 `parseSuggestions`/`isBootReady`/`normalizeApiBase`/`buildBootConfig`/`isDemoEnabled` 등 테스트 대상 함수의 분기·로직은 전혀 변경되지 않았다. `snippet.html`·`2-sdk.md` 는 각각 예제 HTML·문서로 자동 테스트 실행 대상이 아니다.
  - 제안: 없음 — 현행대로 테스트 불필요.

- **[INFO]** 기존 `demo-config.test.ts` 는 변경된 리터럴에 결합돼 있지 않아 회귀 없음 (테스트 용이성 양호)
  - 위치: `codebase/channel-web-chat/src/app/demo/demo-config.test.ts:62-124` (`buildBootConfig` describe 블록)
  - 상세: 테스트는 `defaultDemoForm` 을 spread 한 뒤 자체 `disclaimer: " 주의 "` 값으로 override 해 trim 동작만 검증한다. `defaultDemoForm.disclaimer` 의 실제 문자열 내용을 assert 하는 테스트가 없어 이번 diff 로 깨지는 테스트가 없음을 확인했다(grep 으로 변경 전/후 문자열을 모두 검색해 하드코딩된 assertion 부재 확인). `widget-app.test.tsx`(`"AI는 한정된 데이터로 동작합니다."`) 와 frontend `snippet.test.ts`(`"AI 응답"`) 도 각각 독립된 임의 리터럴을 사용해 무관함을 확인했다.
  - 제안: 없음 — "테스트가 리터럴 콘텐츠에 결합되지 않고 동작(trim/omit-empty)만 검증"하는 현재 구조는 카피 변경에 강건해 바람직한 패턴이다.

- **[INFO]** 동일 disclaimer 카피가 4곳(코드 2 + 문서 2)에 중복 존재 — 교차 파일 drift 를 잡는 자동 검증 부재
  - 위치: `demo-config.ts`(default), `packages/web-chat-sdk/examples/snippet.html`(예제), `spec/7-channel-web-chat/2-sdk.md`(스펙 예제), `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat-sdk.mdx:50`(유저 가이드 — 확인 결과 이미 신규 문구로 일치)
  - 상세: 이번 diff 는 4곳 중 3곳을 수동으로 동기화했고 `web-chat-sdk.mdx` 는 이미 일치 상태였다(별도 확인 완료). 그러나 이 4곳을 하나로 묶어 "값이 달라지면 실패"하는 골든 텍스트 테스트나 공유 상수는 없다. spec R5 rationale 에 이미 이런 종류의 3-경로 drift(command-queue 스텁)가 실제로 한 번 발생·수정된 이력이 있어(`2026-06-25: 세 경로 모두 스텁 누락 drift 를 수정·복원`), 카피 성격의 값도 유사한 재발 가능성이 있다.
  - 제안: 우선순위 낮음(마케팅 카피 성격). 필요 시 `demo-config.ts` 의 `defaultDemoForm.disclaimer` 를 공유 상수로 export 하고 `snippet.html`/`.mdx`/`spec 2-sdk.md` 예제가 문자열 리터럴 대신 그 값을 참조(또는 최소한 doc-sync 성격의 단일 테스트가 4곳을 diff)하도록 리팩터를 고려할 수 있으나, 이번 PR 범위에서 강제할 사항은 아님.

## 요약
이번 변경은 disclaimer 안내문구를 해요체로 통일하는 순수 카피 수정으로, 함수 로직·분기·타입에는 아무 영향이 없다. grep 기반 교차 확인 결과 기존 단위테스트(`demo-config.test.ts`, `widget-app.test.tsx`, frontend `snippet.test.ts`) 어디에도 변경 전/후 리터럴을 하드코딩한 assertion 이 없어 회귀 위험이 없으며, `demo-config.test.ts` 가 `disclaimer` 값을 자체 override 해 trim/omit-empty 동작만 검증하는 구조는 카피 변경에 강건한 바람직한 테스트 설계다. 유일한 잠재 갭은 동일 문구가 코드 2곳·문서 2곳에 리터럴로 중복돼 향후 재차 drift 가능성이 있다는 점이나(spec R5 에 유사 전례 존재), 우선순위는 낮고 이번 PR 에서 신규 테스트나 코드 변경을 요구할 사안은 아니다.

## 위험도
NONE
