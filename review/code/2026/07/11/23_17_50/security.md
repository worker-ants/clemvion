# 보안(Security) 리뷰 결과

리뷰 대상: 웹채팅 위젯 table 잘림 배너에 `totalCount`(잘리기 전 총 행 개수) 투영/노출 기능 추가
- `codebase/channel-web-chat/src/lib/presentation.ts` (`TableData.totalCount?`, `toTable`)
- `codebase/channel-web-chat/src/lib/presentation.test.ts`
- `codebase/channel-web-chat/src/widget/components/presentations.tsx` (`TableView` 배너 문구)
- `codebase/channel-web-chat/src/widget/components/presentations.test.tsx`
- `plan/in-progress/spec-draft-webchat-truncation-total-count.md`, `spec/7-channel-web-chat/1-widget-app.md` (spec/plan 문서, 코드 아님)

## 발견사항

- **[INFO]** 신뢰 경계를 넘어오는 값에 대해 엄격한 `typeof === "number"` 가드를 적용해 타입 혼동(문자열 주입 등)을 사전 차단
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` `toTable()` — `totalCount: typeof output.rowsTotalCount === "number" ? output.rowsTotalCount : undefined`
  - 상세: `output.rowsTotalCount` 는 백엔드/AI `render_*` 도구 응답(신뢰할 수 없는 wire 데이터)에서 오는 값인데, 문자열이나 객체가 오더라도(`presentation.test.ts` 의 `badCount` 케이스로 회귀 검증됨) `undefined` 로 폐기되고 렌더에 반영되지 않는다. 이후 `presentations.tsx` 의 `TableView` 는 이 값을 JSX 텍스트 노드로만 삽입(`{...}`, `dangerouslySetInnerHTML` 미사용)하므로 React 가 자동 이스케이프한다. 숫자 타입이 보장된 상태에서 문자열 템플릿(`` `총 ${totalCount}개 중 일부만 표시돼요.` ``)에 삽입되므로 XSS/인젝션 가능성은 없다.
  - 제안: 조치 불요(방어적으로 잘 작성됨). 참고용 기록.

- **[INFO]** `totalCount` 에 상한/유효값 검증이 없어 `Infinity`/`NaN`/음수 등 비정상 값이 그대로 배너 문구에 노출될 수 있음
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` `toTable()` — `typeof` 체크만 있고 `Number.isFinite`/범위 검사 없음
  - 상세: `typeof Infinity === "number"`, `typeof NaN === "number"` 가 모두 `true` 이므로 백엔드가 이런 값을 보내면 "총 Infinity개 중 일부만 표시돼요." 같은 어색한 문구가 노출될 수 있다. 이는 보안 취약점(인젝션/코드실행/정보노출)이 아니라 표시 데이터 위생(cosmetic/UX) 문제이며, 렌더 경로가 텍스트 노드라 스크립트 실행이나 DOM 조작 위험은 없다.
  - 제안: 필요시 `Number.isFinite(output.rowsTotalCount)` 로 한 단계 더 좁혀도 되나, 보안 관점에서는 blocking 사유가 아님.

- 인젝션(SQL/XSS/커맨드/경로탐색): 해당 없음 — 순수 프론트엔드 표시 로직이며 신규 사용자 입력 채널이나 `dangerouslySetInnerHTML` 사용이 추가되지 않았다. 기존 XSS 방어 로직(`isSafeUrl`, `DOMPurify` 기반 `renderTemplateHtml`)은 이번 diff 에서 변경되지 않았다.
- 하드코딩된 시크릿: 발견 없음.
- 인증/인가: 해당 변경 범위에 인증/인가 로직 없음.
- 입력 검증: `toTable` 의 `totalCount` 투영에 런타임 타입 가드가 있고, 테스트(`presentation.test.ts`)가 문자열/부재 케이스를 명시적으로 회귀 검증한다.
- OWASP Top 10: 해당 사항 없음(A03 Injection 관점에서도 안전 — 위 INFO 참고).
- 암호화: 해당 없음(암호화/해시 로직 미변경).
- 에러 처리: 신규 에러 처리 경로 없음, 민감정보 노출 없음.
- 의존성 보안: 신규 의존성 추가 없음.
- `plan/`·`review/`·`spec/` 문서 변경분은 코드가 아니며 시크릿·민감정보 노출 없음.

## 요약
이번 변경은 웹채팅 위젯의 table 잘림 배너에 "잘리기 전 총 개수"를 함께 표시하는 소규모 UI 기능으로, 신규 데이터(`output.rowsTotalCount`)는 엄격한 `typeof === "number"` 런타임 가드로 필터링된 뒤 React JSX 텍스트 노드(자동 이스케이프)로만 렌더된다. `dangerouslySetInnerHTML`, URL 렌더링, 인증/세션/암호화 로직 등 기존 보안 민감 경로는 이번 diff 에서 전혀 건드리지 않았고, 문자열 등 이형 데이터는 테스트로 회귀 검증되며 폐기된다. 인젝션·시크릿 노출·인가 우회·안전하지 않은 암호화 등 OWASP Top 10 관점의 실질적 위험은 발견되지 않았다. 유일한 참고사항은 `totalCount` 에 `Number.isFinite` 수준의 값 검증이 없다는 점이나, 이는 순수 표시 위생 문제로 보안 취약점은 아니다.

## 위험도
NONE
