# 유지보수성(Maintainability) 리뷰 결과

## 리뷰 대상
- `codebase/channel-web-chat/src/app/demo/demo-config.ts` (기본 disclaimer 문구 변경)
- `codebase/packages/web-chat-sdk/examples/snippet.html` (예제 disclaimer 문구 변경)
- `spec/7-channel-web-chat/2-sdk.md` (spec 예제 disclaimer 문구 변경)

세 파일 모두 동일한 1줄 변경: disclaimer 텍스트를 `"AI는 한정된 데이터로 동작하며 답변이 부정확할 수 있어요."` 로 통일. 로직·구조 변경은 없다.

## 발견사항

- **[INFO]** 3개 파일에 걸쳐 서로 달랐던 disclaimer 문구가 하나로 수렴됨(긍정적 변경)
  - 위치: `demo-config.ts:30`(변경 전 `"...답변이 정확하지 않을 수 있습니다."` 습니다체), `snippet.html:44`(변경 전 `"...중요한 정보는 추가 확인이 필요합니다."` — 의미까지 다른 문구), `2-sdk.md:246`(변경 전 `"AI는 한정된 데이터로 동작하며 …"` — 말줄임 placeholder)
  - 상세: 데모 기본값·SDK 예제·spec 문서 예제 3곳이 서로 다른 문구(심지어 의미가 다른 문구, 미완성 placeholder)로 drift 되어 있었다. 이번 변경으로 3곳이 동일 문구·동일 문체(해요체)로 수렴해 "위젯 UI=해요체" 관례와도 합치한다. 유지보수성 관점에서 명확한 개선.
  - 제안: 없음(변경 자체는 적절).

- **[WARNING]** 동일 문구가 3개 파일에 리터럴 중복(single source of truth 부재) — 이 토폴로지(demo-config / snippet.html / spec.md)는 이 코드베이스에서 실제로 drift 가 재발한 전례가 있음
  - 위치: `demo-config.ts:30`, `snippet.html:44`, `2-sdk.md:246` (및 `2-sdk.md` R5 rationale)
  - 상세: 이번 커밋이 정확히 "3곳에 흩어진 동일 문자열이 서로 달라져 있던 것을 수동으로 재동기화"한 사례다. `2-sdk.md` §R5 는 동일한 3-파일 토폴로지(스니펫 로더의 command-queue 스텁)가 과거(2026-06-25) 에 정확히 이렇게 drift 되어 "세 경로 모두 스텁 누락"을 수동 복원했다고 기록하고 있다. 코드 검색 결과 이 3개 파일의 disclaimer/스텁 문자열 일치를 자동으로 검증하는 테스트는 없다(`snippet.test.ts` 는 프런트엔드 설치-스니펫 **생성기**의 별도 테스트 값을 쓰고, `2-sdk.md`/`examples/snippet.html`/`demo-config.ts` 는 서로 비교되지 않음). 즉 동일 클래스의 drift 가 다시 발생해도 CI/테스트가 잡아내지 못한다.
  - 제안: (a) `demo-config.ts` 의 기본 disclaimer 값을 export 하고 두 문서(snippet.html 주석, 2-sdk.md 본문)가 "demo-config.ts 의 기본값과 동일해야 함"을 주석으로 명시하거나, (b) 세 리터럴을 비교하는 경량 테스트(또는 spec-link-integrity 확장)를 추가해 향후 drift 를 기계적으로 차단. 단 이번 diff 자체의 스코프는 아니므로 별도 후속 항목으로 제안.

## 요약
변경 자체는 3개 파일에서 동일한 disclaimer 카피 문자열 1줄을 통일하는 순수 콘텐츠 수정으로, 함수 구조·네이밍·중첩·복잡도에 영향이 없고 기존의 서로 다른(심지어 의미까지 다른) 3개 문구를 하나의 일관된 해요체 문구로 수렴시켜 오히려 일관성을 개선한다. 다만 동일 문자열이 여전히 3개 파일에 리터럴로 중복돼 있고, 이 코드베이스에는 정확히 같은 3-파일 토폴로지(데모/스니펫 예제/spec)에서 문자열이 drift 됐던 전례(§R5, command-queue 스텁)가 있음에도 이를 자동 검증하는 테스트가 없어 동일 클래스의 재발 위험이 남는다. 이는 이번 diff 가 새로 만든 문제가 아니라 기존 구조적 특성이므로 이번 변경을 막을 사유는 아니다.

## 위험도
LOW
