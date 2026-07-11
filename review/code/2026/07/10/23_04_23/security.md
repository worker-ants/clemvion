# 보안(Security) 코드 리뷰 — widget-presentation-restore

대상: `codebase/channel-web-chat/src/lib/{conversation,presentation}.test.ts`,
`codebase/channel-web-chat/src/lib/presentation.ts`,
`codebase/channel-web-chat/src/widget/components/presentations.test.tsx`,
plan/spec 문서 다수(코드 변경 없음).

## 검토 범위 요약

실질 프로덕션 코드 변경은 `codebase/channel-web-chat/src/lib/presentation.ts` 의 `asEnvelope()` 한 함수뿐이다 —
AI `render_*` `PresentationPayload` shape 의 top-level `truncation` 필드를 `output` envelope 으로 흡수(spread)하도록
1줄 확장했다. 나머지 diff(파일 1·2·4)는 이 변경을 검증하는 vitest 테스트이고, 파일 5~24 는 plan/consistency-review
산출물과 spec 문서(`.md`)로 실행되는 코드가 아니다.

## 발견사항

- **[INFO]** `asEnvelope` 의 top-level `truncation` 병합은 object-literal spread(`{ ...payload, ...asRecord(o.truncation) }`)를 사용
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts:129`
  - 상세: 입력 `p`(AI 에이전트 `render_*` 도구가 반환하는 `PresentationPayload`)는 궁극적으로 워크플로우 제작자가 구성한 AI 에이전트의 tool 출력이라 신뢰 경계 밖의 데이터로 취급해야 한다. 병합에 `Object.assign`이 아니라 object-literal spread 문법을 쓴 것은 안전한 선택이다 — spread 는 `CopyDataProperties`(→ `[[DefineOwnProperty]]`) 의미론을 쓰므로, 소스에 `"__proto__"`라는 own-property 키가 있어도 결과 객체의 실제 프로토타입 체인을 오염시키지 않고 단순히 그 이름의 일반 데이터 프로퍼티가 생길 뿐이다(`Object.assign`이었다면 `[[Set]]` 의미론 때문에 대상 객체 프로토타입이 실제로 바뀔 수 있어 위험했을 것). 소비 측(`toTable`/`toCarousel`/`toChart`/`toTemplate`)도 병합된 `output` 에서 `rowsTruncated`/`itemsTruncated`/`rows`/`items`/`rendered` 등 특정 키만 `typeof`/`=== true` 로 엄격히 검증해 읽으므로, `truncation` 이 실어 나를 수 있는 임의 키가 있어도 렌더 로직에 영향을 주지 못한다.
  - 제안: 조치 불요 — 현재 구현이 안전한 패턴. 향후 이 병합 로직을 `Object.assign`/재귀 deep-merge 유틸로 바꾸는 리팩터링 시에는 prototype pollution 회귀에 유의할 것(참고용 기록).

- **[INFO]** 새 필드(`truncation.rowsTotalCount`/`itemsTotalCount`)는 렌더 대상 문자열/URL 로 소비되지 않음
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts:186-204`(`toTable`), 관련 컴포넌트 `presentations.tsx`
  - 상세: `toTable` 은 `truncated: output.rowsTruncated === true` 로만 boolean 을 도출하고, `rowsTotalCount` 는 이번 diff 의 어떤 소비 경로에서도 DOM/URL/HTML 로 직접 렌더되지 않는다(테스트에서도 배너 텍스트는 고정 문자열 "일부 행만 표시됩니다." — 사용자 제어 문자열 삽입 없음). 기존 `isSafeUrl`(`javascript:`/`data:`/`vbscript:`/`blob:`/`file:` 차단)·`dangerouslySetInnerHTML` 경로(template, DOMPurify sanitize)는 이번 diff 의 변경 범위 밖이며 그대로 유지된다.
  - 제안: 조치 불요.

- **[INFO]** 하드코딩된 시크릿·자격증명 없음
  - 위치: 전체 diff
  - 상세: 테스트 fixture 의 `renderedAt: "2026-07-10T00:00:00.000Z"`, `toolCallId: "call_${type}"` 등은 목데이터이며 API 키/토큰/비밀번호/인증서 패턴이 아니다. plan/consistency 문서(`review/**`, `plan/**`)에도 시크릿 노출 없음.
  - 제안: 해당 없음.

- **[INFO]** spec/plan 문서 변경(파일 5~24)은 실행 코드가 아니므로 인젝션·인증/인가·암호화·에러 처리 관점에서 해당 없음
  - 상세: `spec/7-channel-web-chat/1-widget-app.md`·`_product-overview.md`·`spec/conventions/conversation-thread.md` 변경은 "standalone presentation 노드 표시물은 durable thread 에 영속되지 않는다"는 기존 아키텍처 경계를 문서화하는 정정이며, 신규 API 표면·권한 모델·데이터 노출 범위 확대를 도입하지 않는다(오히려 노출 범위를 명확화·축소 방향으로 문서화).
  - 제안: 해당 없음.

인젝션(SQL/XSS/커맨드/LDAP/경로탐색), 인증/인가 우회, 안전하지 않은 해시/암호화, 평문 전송, 민감정보 노출 에러 처리, 알려진 취약 의존성 도입 등 CRITICAL/WARNING 급 이슈는 발견되지 않았다.

## 요약

이번 변경의 실질 공격 표면은 위젯이 AI 에이전트 tool 출력의 `truncation` 메타 필드를 렌더 envelope 으로 흡수하는 로직 한 줄뿐이며, object-literal spread 특유의 안전한 의미론(`__proto__` own-key 가 있어도 프로토타입 오염 없음) 덕분에 prototype pollution 위험이 없고, 흡수된 값은 이후 엄격한 타입 체크(`typeof`, `=== true`)를 거쳐 boolean/문자열 필드로만 소비되어 XSS·인젝션 경로도 없다. 나머지 diff 는 이를 검증하는 테스트와 spec/plan 문서(비실행)뿐이라 별도 공격 표면을 추가하지 않는다. 하드코딩 시크릿, 인증/인가 변경, 암호화 방식 변경, 민감정보 노출 에러 처리, 취약 의존성 도입도 없다.

## 위험도

NONE
