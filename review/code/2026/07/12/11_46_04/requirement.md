# 요구사항(Requirement) 리뷰 — disclaimer 기본 문구 해요체 통일

## 리뷰 대상
- `codebase/channel-web-chat/src/app/demo/demo-config.ts` (`defaultDemoForm.disclaimer`)
- `codebase/packages/web-chat-sdk/examples/snippet.html` (예제 스니펫 `disclaimer`)
- `spec/7-channel-web-chat/2-sdk.md` (§1 스니펫 예시 코드블록 `disclaimer`)

## 점검 내용

세 파일 모두 `disclaimer` 예시/기본값 문자열을 `"AI는 한정된 데이터로 동작하며 답변이 부정확할 수 있어요."` 로 통일하는
단순 카피 변경. byte-level 비교(python 스크립트로 codepoint 대조) 결과 세 파일의 문자열이 완전히 동일함을 확인 —
동일 문구가 데모 기본값·npm 예제·spec 예시 세 곳에 흩어져 있음에도 drift 없이 갱신됨.

- **기능 완전성**: `disclaimer` 는 자유 텍스트 필드(스키마 상 `string`, 고정 enum/포맷 아님)이므로 문구 교체 자체가 기능
  변경이 아니다. `buildBootConfig`(demo-config.ts) 의 trim/조건부 포함 로직(L112, L132)은 이번 diff 로 변경되지 않았고
  disclaimer 흐름은 정상 동작 유지.
- **의도와 구현 일치**: 기존 문구("...답변이 정확하지 않을 수 있습니다", snippet.html 은 "...추가 확인이 필요합니다")는
  `합니다체` 였고, `spec/conventions/i18n-userguide.md` Principle 6(§글로서리·문체, L165-169: "해요체로 통일
  (`~합니다`, `~한다` 금지)")·L50-51("위젯의 인라인 한국어도 Principle 6 를 따른다")을 위반하고 있었다. 새 문구는
  `~있어요` 로 Principle 6 준수 — 스타일 컨벤션 정합화이며 회귀 없음.
- **spec fidelity**: `spec/7-channel-web-chat/2-sdk.md` §1 은 예시 코드블록으로, `disclaimer` 필드 자체의 타입/검증
  규칙(§4 Boot config 스키마, L131: `disclaimer?: string;`)은 이번 diff 로 변경되지 않았다. 예시 텍스트만 실제
  npm 패키지 예제(`snippet.html`)·데모 기본값과 동기화됐으므로 spec 본문과 코드 간 문구 불일치(과거 `…` 로 축약돼
  있던 예시 텍스트) 가 오히려 해소됨. CRITICAL 없음.
- **다른 잔존 disclaimer 문구 스캔**: repo 전체(`grep -rln`)에서 구 문구("정확하지 않을 수 있습니다", "추가 확인이
  필요합니다") 잔존 여부 확인 — 소스 코드에는 없음(같은 리뷰 배치의 review/ 산출물 파일 2건만 매치, 소스 아님).
  `frontend` admin console 의 `DEFAULT_DRAFT.disclaimer` 는 빈 문자열(`""`, 운영자 미입력 시 폼 placeholder 만 존재)이라
  영향 없음. `demo-config.test.ts` 는 기본값 리터럴을 assert 하지 않고 자체 override 값을 사용하므로 테스트 회귀 없음.
- **엣지 케이스/에러 시나리오/반환값**: 문자열 리터럴 변경뿐이라 해당 없음(N/A).
- **TODO/FIXME**: 없음.

## 발견사항

없음 — 세 파일 모두 동일 문구로 일관 갱신됐고, i18n-userguide Principle 6(해요체) 준수 방향의 의도된 스타일 수정이며
기능·spec 스키마 변경이 수반되지 않음.

## 요약
`disclaimer` 기본/예시 문구를 해요체로 통일하는 순수 카피 변경으로, 데모 기본값·npm 예제 스니펫·spec 예시 코드블록
세 위치가 byte-identical 하게 동기화됐다. `disclaimer` 필드의 타입·검증·boot config 스키마(spec §4)는 변경 없고,
관련 컨벤션(`i18n-userguide.md` Principle 6 — 위젯 인라인 한국어도 해요체 적용)에 부합하는 방향의 수정이다. 기존
`합니다체` 잔존 문구가 이 컨벤션 위반이었으므로 이번 변경은 사실상 정합화(fix)이며 회귀·누락된 동기화 지점은
발견되지 않았다.

## 위험도
NONE
