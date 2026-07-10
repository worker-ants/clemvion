# 보안(Security) 코드 리뷰 — widget-presentation-restore (23_26_31)

대상: `codebase/channel-web-chat/src/lib/{conversation,presentation}.test.ts`,
`codebase/channel-web-chat/src/lib/presentation.ts`,
`codebase/channel-web-chat/src/widget/components/presentations.test.tsx`,
plan 문서·`review/code/2026/07/10/23_04_23/**`(이전 리뷰 라운드 산출물)·spec 문서 다수(비실행 코드).

## 검토 범위 요약

실질 프로덕션 코드 변경은 `codebase/channel-web-chat/src/lib/presentation.ts` 의 `asEnvelope()` 한 함수뿐이다.
전체 파일을 직접 읽어 diff 와 대조 확인했다. `PresentationPayload.truncation`(payload 바깥 top-level 필드)을
`output` envelope 으로 흡수하는 로직이며, 이번 라운드에서는 이전 라운드(23_04_23)의 통째-spread
(`...asRecord(o.truncation)`) 대신 **명시적 4-키 화이트리스트**(`TRUNCATION_KEYS` + `truncationMeta()`)로
강화되어 있다 — `rowsTruncated`/`itemsTruncated`/`rowsTotalCount`/`itemsTotalCount` 외의 키는 흡수하지 않는다.
나머지 diff(파일 1·2·4)는 이 변경을 검증하는 vitest 테스트, plan·이전 리뷰 산출물·spec 문서(`.md`)는 실행되는
코드가 아니다.

## 발견사항

- **[INFO]** `truncation` 병합이 이전 라운드의 통째 spread에서 명시적 화이트리스트로 강화됨(개선 확인)
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts:108-125`(`TRUNCATION_KEYS`, `truncationMeta()`), `:152`(`asEnvelope` 반환문)
  - 상세: 이전 라운드 `side_effect`/`maintainability` 리뷰가 지적한 "임의 payload 필드가 truncation 예약어와 겹치면 조용히 유실될 수 있다"는 INFO 우려가 이번 diff 에서 `truncationMeta()` 화이트리스트 도입으로 실제로 해소됐다. `truncationMeta`는 `for (const k of TRUNCATION_KEYS) if (k in t) meta[k] = t[k]`로 알려진 4개 키만 복사하므로, `o.truncation`(AI 에이전트 tool 출력이라 신뢰 경계 밖 데이터)이 임의의 추가 키(예: `__proto__`, `constructor`, 렌더 로직이 읽는 다른 이름의 키)를 갖고 있어도 결과 `output` 에 전파되지 않는다. `k in t` 체크와 `meta[k] = t[k]`는 일반 property assignment(`[[Set]]`)이지만 `k`가 리터럴 상수 배열(`TRUNCATION_KEYS`)에서만 나오므로 공격자가 통제할 수 있는 키 이름이 애초에 순회 대상에 들어가지 않아, `Object.assign`류에서 우려되는 prototype pollution 벡터 자체가 성립하지 않는다.
  - 제안: 조치 불요 — 안전한 패턴으로 확인.

- **[INFO]** 소비 측(`toTable`/`toCarousel`/`toChart`/`toTemplate`)의 엄격한 타입 가드는 이번 diff 로 변경되지 않음
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts:209-227`(`toTable` — `truncated: output.rowsTruncated === true`), `:187-203`(`toCarousel`), `:236-258`(`toChart`), `:265-280`(`toTemplate`)
  - 상세: `truncationMeta()`가 흡수하는 `rowsTruncated`/`itemsTruncated`는 `=== true` strict 비교로만 소비되어 boolean 이외 값(문자열 `"true"` 등)이 배너를 오탐 노출시키지 않는다. `rowsTotalCount`/`itemsTotalCount`는 이번 diff 의 어떤 소비 경로에서도 DOM/URL/HTML 로 렌더되지 않는다(테스트 배너 텍스트는 고정 문자열 "일부 행만 표시됩니다."). `isSafeUrl()`(`javascript:`/`data:`/`vbscript:`/`blob:`/`file:` 차단, :72-84)과 template 렌더 시 DOMPurify sanitize 경로는 이번 diff 의 변경 범위 밖이며 그대로 유지된다.
  - 제안: 조치 불요.

- **[INFO]** 하드코딩된 시크릿·자격증명 없음
  - 위치: 전체 diff
  - 상세: 테스트 fixture 의 `renderedAt: "2026-07-10T00:00:00.000Z"`, `toolCallId: "call_${type}"` 등은 목데이터이며 API 키/토큰/비밀번호/인증서 패턴이 아니다. plan/이전 리뷰 산출물/spec 문서에도 시크릿 노출 없음.
  - 제안: 해당 없음.

- **[INFO]** spec/plan/review 문서 변경(파일 5~24, `review/code/2026/07/10/23_04_23/**` 포함)은 실행 코드가 아니므로 인젝션·인증/인가·암호화·에러 처리 관점에서 해당 없음
  - 상세: `review/code/2026/07/10/23_04_23/**`(SUMMARY/RESOLUTION/각 관점 리뷰 산출물)는 이전 라운드에서 발견된 항목의 조치 기록이며, `spec/7-channel-web-chat/1-widget-app.md`·`_product-overview.md`·`spec/conventions/conversation-thread.md`는 "standalone 노드 표시물은 durable thread 에 영속되지 않는다"는 기존 아키텍처 경계를 문서화하는 정정이다. 신규 API 표면·권한 모델·데이터 노출 범위 확대를 도입하지 않는다.
  - 제안: 해당 없음.

인젝션(SQL/XSS/커맨드/LDAP/경로탐색), 인증/인가 우회, prototype pollution, 안전하지 않은 해시/암호화, 평문 전송, 민감정보 노출 에러 처리, 알려진 취약 의존성 도입 등 CRITICAL/WARNING 급 이슈는 발견되지 않았다.

## 요약

이번 라운드는 이전 리뷰(23_04_23)에서 이미 NONE 등급으로 평가된 `asEnvelope`의 `truncation` 흡수 로직을 명시적 4-키 화이트리스트(`TRUNCATION_KEYS`/`truncationMeta()`)로 한층 강화한 fix commit(`da3d2672c`)을 포함한다. 신뢰 경계 밖(AI 에이전트 tool 출력) 데이터를 다루는 유일한 병합 지점이 이제 상수 키 목록으로만 순회하므로 이전에도 안전했던 spread 패턴보다 더 방어적이며, prototype pollution·임의 필드 유입 가능성이 구조적으로 차단된다. 흡수된 값은 이후에도 엄격한 타입 체크(`typeof`, `=== true`)를 거쳐 boolean/문자열 필드로만 소비되어 XSS·인젝션 경로가 없다. 나머지 diff는 이를 검증하는 테스트, 그리고 이전 리뷰 라운드의 조치 기록(`review/**`)·spec/plan 문서(비실행)뿐이라 별도 공격 표면을 추가하지 않는다. 하드코딩 시크릿, 인증/인가 변경, 암호화 방식 변경, 민감정보 노출 에러 처리, 취약 의존성 도입도 없다.

## 위험도

NONE
