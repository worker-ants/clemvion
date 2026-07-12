# 부작용(Side Effect) 리뷰 결과

## 대상
- `codebase/channel-web-chat/src/app/demo/demo-config.ts` (defaultDemoForm.disclaimer 문자열 리터럴)
- `codebase/packages/web-chat-sdk/examples/snippet.html` (예제 disclaimer 문자열 리터럴)
- `spec/7-channel-web-chat/2-sdk.md` (스니펫 예시 disclaimer 문자열)

세 파일 모두 disclaimer 안내문구를 "AI는 한정된 데이터로 동작하며 답변이 부정확할 수 있어요." 로 통일한 순수 텍스트 리터럴 변경. 함수/타입/로직 변경 없음.

### 발견사항
없음. (부작용 관점에서 지적할 항목 없음)

- 상태/전역 변경: 없음 — `DemoFormState`/`BootMessage` 상수 초기값의 문자열만 교체, 함수 로직·구조 무변경.
- 시그니처/인터페이스 변경: 없음 — `buildBootConfig`, `parseSuggestions`, `isBootReady`, `normalizeApiBase`, `isDemoEnabled` 모두 무변경.
- 파일시스템/환경변수/네트워크/이벤트: 관련 코드 경로 자체가 손대지지 않음(순수 문자열 상수).
- 호출자 영향: `demo-config.test.ts` 확인 결과 `disclaimer` 기본값의 정확한 문자열에 의존하는 단언(assertion) 없음(테스트는 자체 override 값 `" 주의 "` 사용). `widget-app.test.tsx` 도 자체 disclaimer 리터럴("AI는 한정된 데이터로 동작합니다.")을 별도로 사용하므로 영향 없음.
- 문서 정합성: `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.mdx`, `web-chat-sdk.mdx`, `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts` 는 이번 diff 대상은 아니지만 이미 동일 계열 문구("AI 답변은 부정확할 수 있어요." 등)를 사용 중이어서 drift 없음(부작용 아님, 참고용 확인).

### 요약
세 파일 모두 UI/예제/문서 문자열 리터럴 교체에 그치는 콘텐츠 변경으로, 함수 시그니처·공개 인터페이스·전역 상태·파일시스템·환경변수·네트워크 호출·이벤트 콜백 어느 것도 건드리지 않는다. 기존 테스트가 해당 기본값 문자열에 의존하지 않음을 확인했으며 다른 소비처와의 불일치도 발견되지 않았다. 부작용 관점에서 위험 요소 없음.

### 위험도
NONE
