# 유지보수성(Maintainability) 리뷰 결과

## 리뷰 대상
- `codebase/channel-web-chat/src/app/demo/demo-config.ts` (defaultDemoForm.disclaimer 문자열 변경)
- `codebase/packages/web-chat-sdk/examples/snippet.html` (boot 예시 disclaimer 문자열 변경)
- `spec/7-channel-web-chat/2-sdk.md` (스니펫 예시 코드블록 disclaimer 문자열 변경)

세 파일 모두 위젯 `disclaimer` 필드의 예시/기본 문구를 다음 한 문장으로 통일하는 순수 카피 변경이다:
`"AI는 한정된 데이터로 동작하며 답변이 부정확할 수 있어요."`
로직·타입·함수 시그니처·제어 흐름 변경은 없다.

### 발견사항

- **[INFO]** 동일 disclaimer 문자열이 3개 파일(데모 기본값, SDK 예제 HTML, spec 예시 코드블록)에 각각 리터럴로 중복 기재됨
  - 위치: `codebase/channel-web-chat/src/app/demo/demo-config.ts:74`, `codebase/packages/web-chat-sdk/examples/snippet.html:163`, `spec/7-channel-web-chat/2-sdk.md:248`
  - 상세: 세 표면이 각기 다른 아티팩트(런타임 기본값 / npm 패키지 사용 예제 / spec 문서 예시)라 공유 상수로 묶기 어렵고, 변경 전에도 세 값이 서로 달랐던(정확하지 않을 수 있습니다 / 중요한 정보는 추가 확인이 필요합니다 / "…" 생략) drift 상태였다. 이번 diff는 오히려 세 값을 하나로 수렴시켜 **기존 불일치를 해소**하는 방향이라 이 변경 자체가 문제를 만들지는 않는다. 다만 SoT 부재로 향후 문구가 다시 바뀔 때 3곳을 수동 동기화해야 하는 부담은 여전하다.
  - 제안: 현시점 리팩터링 불필요(예제/문서/기본값의 성격상 자연스러운 중복). 문구가 향후 재변경될 가능성이 높다면 `spec/7-channel-web-chat/2-sdk.md`를 SoT로 명시하고 나머지 두 곳은 "동기화 대상"이라는 주석을 추가하는 정도로 충분하다(이미 유사한 패턴이 `disclaimer`가 아닌 다른 필드들에도 존재).

- **[INFO]** 문체가 해요체("…있어요")로 통일됨
  - 위치: 3개 파일 동일 라인
  - 상세: 이전 demo-config.ts 기본값은 "…습니다"(하십시오체), snippet.html은 다른 문구의 "…합니다"였다. 변경 후 세 곳 모두 "…있어요"로 통일되어, 위젯 UI 카피의 기존 해요체 관례(PR #921 계열)와 일관성이 맞다.
  - 제안: 없음 — 오히려 컨벤션 준수 방향의 개선.

### 요약
세 파일 모두 UI 카피 문자열 1줄만 교체하는 non-functional 변경으로, 함수 길이·중첩·복잡도·네이밍 등 다른 유지보수성 축에 영향이 없다. 변경 전 서로 어긋나 있던 데모 기본값/SDK 예제/spec 예시 문구를 하나의 표현으로 수렴시켰고 문체도 위젯 해요체 관례에 맞춰졌다는 점에서 오히려 일관성이 개선됐다. 3개 파일에 동일 문자열이 리터럴로 중복되는 점은 구조적으로 남아 있으나 이는 예제/문서/기본값이라는 서로 다른 표면의 성격상 불가피한 기존 패턴이며 이번 diff가 새로 만든 문제는 아니다.

### 위험도
NONE
