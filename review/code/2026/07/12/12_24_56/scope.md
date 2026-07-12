# 변경 범위(Scope) 리뷰 결과

## 검토 대상
- `codebase/channel-web-chat/src/app/demo/demo-config.ts`
- `codebase/packages/web-chat-sdk/examples/snippet.html`
- `spec/7-channel-web-chat/2-sdk.md`

## 발견사항

없음.

세 파일 모두 정확히 한 줄씩만 변경되었고, 변경 내용은 **동일한 `disclaimer` 문구를 세 위치에서 일관된 텍스트로 동기화**하는 것이 전부다.

- `demo-config.ts`: `"AI는 한정된 데이터로 동작하며 답변이 정확하지 않을 수 있습니다."` → `"AI는 한정된 데이터로 동작하며 답변이 부정확할 수 있어요."`
- `snippet.html`: `"AI는 한정된 데이터로 동작하며, 중요한 정보는 추가 확인이 필요합니다."` → 위와 동일 문구로 통일
- `2-sdk.md`: 생략 표기(`'AI는 한정된 데이터로 동작하며 …'`) → 위와 동일 문구로 완전 기술(spec 예시가 실제 문구를 온전히 노출)

- 변경 전 세 곳의 문구가 서로 다른 표현(`합니다`체·`습니다`체·생략)이었고, 변경 후 정확히 동일한 문자열로 통일됨 — 텍스트만 비교해 확인.
- `git diff origin/main -- <세 파일>` 로 재확인한 결과 payload 에 제시된 diff 와 100% 일치, 숨은 추가 변경 없음.
- 코드 로직·타입·함수 시그니처·import·포맷팅·주석·설정 파일 변경 전혀 없음. `demo-config.ts` 의 다른 필드(welcomeText, launcherSuggestions 등)·헬퍼 함수(`parseSuggestions`, `normalizeApiBase`, `buildBootConfig`, `isDemoEnabled`)는 미변경.
- 참고: 같은 changeset(`origin/main` 대비)에는 `hooks.controller.ts` 의 import 경로 변경과 `embed-config-response.dto.ts` → `embed-config.dto.ts` 리네임, `4-security.md` 의 `code:` 프론트매터 경로 갱신도 포함돼 있으나, 이는 본 스코프 리뷰 payload 에 포함되지 않은 별개 관심사(DTO 파일명 정리)로 판단되며 이 3개 파일의 disclaimer 동기화와는 무관한 독립 변경이다. 이 3개 파일에 한해서는 범위 이탈 없음.

## 요약
세 파일 변경은 위젯 disclaimer 문구를 데모 기본값·SDK 예제 스니펫·spec 문서 예시 세 곳에서 동일한 최종 텍스트로 맞추는 순수 텍스트 동기화이며, 그 외 로직·포맷팅·주석·임포트·설정 변경이 전혀 섞여 있지 않다. 의도(문구 통일)와 실제 diff 범위가 정확히 일치하는 이상적으로 스코프가 좁은 변경이다.

## 위험도
NONE
