# Rationale 연속성 검토 결과

## 검토 범위 확인

`prompt_file` 은 `spec/7-channel-web-chat` 전체(0-architecture / 1-widget-app / 2-sdk / 3-auth-session / 4-security / 5-admin-console)를 "Target 문서" 로 첨부했지만, 실제 diff-base(`origin/main`) 대비 HEAD 의 변경분은 다음 3개 파일 각 1줄로 매우 좁다(`git diff origin/main...HEAD --stat`, HEAD=`40a375972`):

```
codebase/channel-web-chat/src/app/demo/demo-config.ts | 2 +-
codebase/packages/web-chat-sdk/examples/snippet.html  | 2 +-
spec/7-channel-web-chat/2-sdk.md                      | 2 +-
```

`spec/7-channel-web-chat/2-sdk.md` 변경분(§1 스니펫 예시 `disclaimer` 값):

```diff
-    disclaimer: 'AI는 한정된 데이터로 동작하며 …',
+    disclaimer: 'AI는 한정된 데이터로 동작하며 답변이 부정확할 수 있어요.',
```

코드 측 동반 변경(`demo-config.ts`/`snippet.html`)도 동일 문구를 "합니다체"에서 "해요체" canonical 문구로 통일한 것이며, `## Rationale` 섹션 자체는 어느 파일에서도 변경되지 않았다(`git diff` 상 Rationale 절 라인 변경 없음).

## 발견사항

없음. 이 변경은 §1 "스니펫 로더" 예시 코드 블록 안의 `disclaimer` 데모 문구를 truncated placeholder(`…`)에서 완성 문장으로 채우고, 톤을 [`spec/conventions/i18n-userguide.md` Principle 6](../../../../spec/conventions/i18n-userguide.md)("위젯 인라인 한국어도 해요체 준수")에 맞춰 통일한 것이다. 검토 관점 4가지에 대해:

1. **기각된 대안의 재도입** — 해당 없음. `disclaimer` 문구는 어느 Rationale 에서도 "합니다체"나 truncated 표기를 의도적 설계로 채택한 이력이 없다(2-sdk.md `## Rationale` R1~R6 어디에도 `disclaimer` 문구 자체에 대한 결정 기록 없음). 단순 예시 텍스트 완성이다.
2. **합의된 원칙 위반** — 오히려 반대다. i18n-userguide §P6("여전히 적용" 절, 위젯 인라인 한국어도 해요체 준수)에 정합하도록 만드는 수정이며, 변경 전 상태(`demo-config.ts` "…습니다", `snippet.html` "…필요합니다")가 P6 을 위반하고 있었다. 커밋 메시지 자체도 "consistency-check 가 발견한 사전 결함... P6 위반" 이라고 명시한다.
3. **결정의 무근거 번복** — 해당 없음. 이 변경은 디자인 결정 번복이 아니라 예시 문구의 tone 정합화이며, `## Rationale` 신규 항목이 필요할 만큼의 의사결정이 아니다(기존 R6 "`locale` 은 reserved" 등 어떤 Rationale 항목과도 충돌하지 않음).
4. **암묵적 가정 충돌** — 해당 없음. `BootConfig.disclaimer`(§4 스키마)·EIA 표면·인증/세션·CORS 등 spec 이 기록한 어떤 invariant 도 이 변경으로 우회되지 않는다.

## 요약

이번 target diff 는 `spec/7-channel-web-chat/2-sdk.md` §1 스니펫 예시의 `disclaimer` 문구를 truncated placeholder 에서 완성 문장(해요체, `web-chat-sdk.mdx` canonical 문구와 동일)으로 바꾸고 코드(데모 기본값·SDK 예제)를 동일 문구로 맞춘 것뿐이다. `## Rationale` 섹션은 어느 파일에서도 수정되지 않았고, 변경 내용은 기존 Rationale(R1~R9, R1~R6 등)이 다룬 어떤 결정(iframe 격리, eager-start, per_execution 토큰, CORS 이원화, sanitize 정책 등)과도 접점이 없다. 오히려 i18n-userguide Principle 6(문체 일관성)이라는 이미 합의된 규약을 사후에 맞추는 정합화 커밋이며, 기각된 대안의 재도입·원칙 위반·무근거 번복·invariant 우회 어느 카테고리에도 해당하지 않는다.

## 위험도
NONE
