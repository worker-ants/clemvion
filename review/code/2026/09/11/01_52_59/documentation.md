# 문서화(Documentation) 코드 리뷰 — `impl-chat-channel-patch-token` (7라운드)

## 검토 방법

`origin/main...HEAD` 전체 diff(`codebase/**` 16개 파일, `4a8b5f456`~`84a6aeaa8` 8개 커밋)를
대상으로 했다. 이 PR 은 이전 6라운드(`23_21_57`·`23_55_23`·`00_21_55`·`00_45_18`·`01_10_43`·
`01_27_26`)에서 이미 `documentation` reviewer 가 CHANGELOG 미기재·JSDoc OpenAPI 유출·orphan
JSDoc·`store()`/`rotate()` 용어 drift 를 순차로 지적해 전부 수정 완료(commit
`464f2ba1a`·`c817a44c4`·`84a6aeaa8`)된 상태다. 이번 라운드는 (a) 그 수정들이 최신 소스에
실제로 반영돼 있는지 직접 대조하고 (b) 직전 라운드(`01_27_26`) **이후** 델타인 `84a6aeaa8`(내부
3필드 테스트 보강 + `store→rotate` JSDoc 3곳 정정 + 트래커 재정정)에 새 문서화 결함이 있는지에
집중했다. `Read`/`grep`/`git show` 로 저장소를 직접 열었고 트리는 뮤테이션하지 않았다
(`git status --short` 확인, 세션 리뷰 산출물 디렉터리 외 잔여물 없음).

## 발견사항

없음 — 이번 라운드의 신규 델타(`84a6aeaa8`)를 포함해 문서화 관점의 CRITICAL/WARNING 급 결함을
찾지 못했다. 세부 확인 내역은 아래 참조.

## 확인한 것 — 이전 라운드 수정이 최신 소스에 실제로 반영됨

- **`store()` → `rotate()` 용어 drift 3곳(직전 라운드 WARNING)이 실제로 고쳐졌다.**
  `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.ts` 의
  `setupChannel` JSDoc, `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
  의 `inboundSigningPlaintext` JSDoc(`chat-channel-config.dto.ts:252`), `triggers.service.ts` 의
  `stripChatChannelPlaintext` JSDoc — 세 곳 모두 `SecretResolver.store` → `SecretResolver.rotate
  (UPSERT)` 로 정정돼 있고, 각 자리에 "`setupChannel` 은 생성·활성화·PATCH 세 갈래에서 재호출되는
  멱등 함수라 중복 시 throw 하는 `store` 로는 두 번째 호출부터 깨진다" 는 근거가 함께 남아 있다.
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 도 "남은 것은 `spec/` 9곳뿐"으로
  갱신돼 codebase 축의 잔여 항목이 없음을 표시한다.
- **JSDoc → OpenAPI 유출 수정(4라운드)이 유지됨.** `chat-channel-config.dto.ts` 의
  `ChatChannelUpdateConfigDto` 클래스 위에는 소비자용 정보(딱 두 필드 차이 표 + `@see` spec
  참조)만 JSDoc 으로 남아 있고, "왜 `OmitType` 인가"·"왜 optional 로 두고 무시하지 않는가"·
  "왜 `Patch` 가 아니라 `Update` 인가" 세 단락은 클래스 선언 바로 위 `//` 블록으로 분리돼 있다
  (`spec/conventions/swagger.md:315` 규약 인용까지 포함). `introspectComments` 가 JSDoc 만
  `description` 에 싣는 플러그인 동작을 고려하면 올바른 분리다.
- **orphan JSDoc(4라운드) 해소 확인.** `trigger-dto-validation.spec.ts` 의 5필드 설명 JSDoc 이
  대상 테스트(`it('[실측] 차단 5필드의 details.field 는 **비어있지 않은 값일 때** 중첩 경로다', ...)`
  ) 바로 위에 붙어 있고, 분리된 나머지 케이스에는 별도 설명이 있다 — 엉뚱한 테스트 위에 남는
  형태의 재발 없음.
- **CHANGELOG 미기재(5·6라운드 WARNING)가 해소됨.** `CHANGELOG.md` 최상단에 `## Unreleased —
  카드 저장이 항상 400 이던 게 봇 토큰을 지키고 있었다 (chatChannel PATCH)` 절이 신설돼 두
  CRITICAL(R-CC-10 우회 · `inboundSigningRef` fail-open)의 발견 경위, wire 계약 변경 3축(비밀
  필드 실음·최초 `chatChannel` 부착·provider 전환)과 각각의 `details.field`, 유일한 소비자
  `ChatChannelCard` 영향 없음을 서술한다. 이 서술을 `triggers.controller.ts` 의
  `@ApiBadRequestResponse` 설명(`update()` 데코레이터)·`trigger-dto-validation.spec.ts` 의 두
  갈래 단언과 대조한 결과 필드명·`details.field` 형식·배열/단일-object 구분까지 정확히
  일치한다.
- **`ChatChannelInputMode`/`ChatChannelInput` 오버로드(2라운드 WARNING "타입 결속 없음")가 실제
  타입 레벨로 결속돼 있음.** `assertChatChannelInputSafe` 가 `mode: 'create'`/`'update'` 각각에
  대응하는 DTO 타입 오버로드 2개를 갖고, 그 이유("문자열 판별자만 두면 짝 깨짐을 컴파일러가 못
  잡는다")를 오버로드 바로 위 주석에 남겼다.

## 확인한 것 — 사용자 문서(mdx)

- `triggers.mdx`/`.en.mdx` 의 "Bot Token 회전(single-path)" 절이 이 PR 이 새로 연 두 400 사유
  (최초 `chatChannel` 부착 금지·`provider` 전환 금지)를 포함하도록 확장됐고, `discord`/`slack`
  각 ko/en mdx 에 신설된 "6.5/5.5 Bot Token · Signing Secret 변경" 절은 telegram 문서의 기존
  패턴과 구조·톤이 대칭이다(Bot token = rotate API 전용, signing 값은 v1 변경 불가 → 삭제·재생성
  안내, 카드 표시 옵션 저장은 무관이라는 Callout).
- 6라운드 `scope` reviewer 가 지적한 이중 공백 오타(`triggers.mdx:429` "항상  rotate")는 다음
  커밋(`5976587c7`)에서 실제로 단일 공백으로 정정된 상태를 `grep` 으로 재확인했다.

## 확인한 것 — 이번 델타(`84a6aeaa8`)의 문서화 표면

- `triggers.service.spec.ts` 에 추가된 6개 `it.each` 항목 위 주석은 "왜 이 케이스가 필요한가"
  (기존 4조합이 신규 2필드만 덮고 대상 3필드를 안 걸었다는 것, 실측 근거 링크)를 명시해 향후
  이 자리를 다시 지우려는 시도가 같은 실수를 반복하지 않도록 돕는다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 재정정 각주가 "첫 판본이
  거짓이었다" 를 명시하고 원문을 지우지 않은 채 정정문을 이어 붙인 형식 — 이 저장소의
  자기-정정 관례(취소선/원문 보존)와 부합한다.

## 남아있는 항목 (이미 등재·비차단, 재-flag 아님)

- `TriggersService` God Object 경향, 동시 PATCH lost update, `botToken` `@MinLength(1)` 부재,
  mdx 의 flat(`null`/`''`) 갈래 미서술 — 4가지 모두 `plan/in-progress/
  spec-draft-nullable-notation-followups.md` 에 근거와 함께 등재돼 있고 여러 라운드에서 반복
  확인됐다. 이번 라운드에서 새로 검토했으나 성격이 바뀌지 않아 재-flag 하지 않는다(특히 mdx
  flat 갈래 미서술은 백엔드 Swagger·CHANGELOG 에는 정확히 반영돼 있고 사용자 가이드에만
  간략화돼 남아 있는 상태 — 기존 6라운드 INFO 그대로 유지).

## 요약

이 PR 은 7라운드에 걸쳐 CHANGELOG 미기재, JSDoc→OpenAPI 서사 유출, orphan JSDoc, `store()`/
`rotate()` 용어 drift, 테스트 커버리지 갭에 대한 자기-정정 서술 등 문서화 관점의 결함을 순차로
찾아 모두 고쳤고, 이번 라운드에서 최신 소스를 직접 대조한 결과 그 수정들이 전부 실제로
반영돼 있음을 확인했다. 마지막 델타(`84a6aeaa8`)도 세 곳의 JSDoc 정정과 테스트 주석 추가뿐이라
새로운 문서화 결함을 만들지 않았다. 남은 항목은 전부 이전 라운드에서 이미 등재·수렴 처리된
비차단 사안이다.

## 위험도

NONE
