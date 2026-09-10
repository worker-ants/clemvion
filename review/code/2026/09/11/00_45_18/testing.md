# 테스트(Testing) 코드 리뷰 — `impl-chat-channel-patch-token` (4라운드)

## 검증 방법

이 라운드는 직전 라운드(`review/code/2026/09/11/00_21_55`)가 이미 전체 diff(23개 파일, 핵심
코드 6개)를 촘촘히 리뷰한 뒤의 4번째 라운드다. 동일 결함 재보고를 피하려고 **직전 라운드가
평가한 커밋(`83d5f3f94`) 이후의 델타만** 별도로 추적했다.

```
git diff 83d5f3f94..HEAD --stat -- 'codebase/**'
```

결과: `triggers.service.spec.ts` 8줄 변경(기존 테스트 1건의 단언 강화) + slack/discord
가이드 mdx 4파일 신설 + triggers.mdx 오타 수정 1자. **`codebase/backend/src/**` 프로덕션
코드는 이 델타에 없다** — 이번 라운드에서 테스트 관점으로 볼 신규 표면은 사실상 그 8줄뿐이다.

저장소는 뮤테이션하지 않았다. 검증은 두 가지로 했다:

1. 대상 두 spec 파일을 read-only 로 실행 — `npx jest src/modules/triggers/dto/trigger-dto-validation.spec.ts src/modules/triggers/triggers.service.spec.ts` → **181 passed, 1 skipped, 182 total** (GREEN, 직전 라운드와 동일 수치).
2. 이번 델타가 강화한 단언이 실제로 판별력을 갖는지 **스크래치 디렉터리 사본**(`mktemp` 대신 세션 scratchpad, 저장소 밖)에서 뮤테이션 검증 — `node_modules` 는 원본 저장소 경로를 심볼릭 링크해 재사용하고 `triggers.service.ts` 의 `assertChatChannelAlreadySetUp` 첫 분기(`if (!current?.provider) { throw … }`)를 제거한 뒤 해당 테스트만 재실행. 결과 **RED**(`TypeError: Cannot read properties of undefined (reading 'provider')` 로 실패) — 원복 불필요(사본이 스크래치에만 존재), `git status --short` 로 저장소 무변경 재확인.

## 발견사항 — 이번 델타

- **[INFO]** (조치 확인) `setup 안 된 트리거에 PATCH 로 chatChannel 을 처음 붙이면 400` 테스트가 `code` 만 보던 것에서 `details.field='chatChannel'` 까지 단언하도록 강화됐다 — 직전 라운드 `requirement` reviewer 의 WARNING("이 분기에 회귀 테스트가 없다")에 대한 응답이다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` — `describe('TriggersService — chatChannel PATCH 는 사용자 비밀을 쓰지 않는다 (R-CC-21)')` 안의 `'setup 안 된 트리거에 PATCH 로 chatChannel 을 처음 붙이면 400 (조용한 degraded 금지)'` 케이스.
  - 상세: 이 이름의 테스트 자체는 `cf4ba26e9`(최초 구현 커밋)부터 존재했지만 `response: { code: 'VALIDATION_ERROR' }` 만 검사해 — 인접한 다른 가드가 같은 트리거·바디를 **다른 이유로** 거부해도 GREEN 이 나오는 구조였다(이 저장소가 여러 차례 겪은 vacuous 형태). 이번 델타가 `details: { field: 'chatChannel' }` 를 추가해 "정확히 이 분기가 던졌다"를 판별하게 됐다. 위 뮤테이션 검증으로 이 판별력을 직접 확인했다 — 해당 분기를 제거하면 이 테스트가 (TypeError 로) RED 가 된다. 직전 라운드 WARNING 의 문면("어느 테스트 파일에도 등장하지 않는다")은 "테스트가 아예 없다"기보다 "있지만 vacuous 했다"에 더 가까웠는데, 결과적으로 이번 수정이 실질 갭(판별력 부재)을 정확히 메웠다. **새 지적이 아니라 조치 확인.**
- **[INFO]** slack/discord 신규 가이드 문서(4파일)의 서술이 테스트가 고정한 실제 동작과 정합한다.
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/{slack,discord}{,.en}.mdx` 신설 "Bot Token · Signing Secret/Public Key 변경" 절.
  - 상세: "PATCH 에 `botToken`/`inboundSigningPlaintext` 를 실으면 400, `details.field='chatChannel.botToken'`/`'chatChannel.inboundSigningPlaintext'`" 서술은 `trigger-dto-validation.spec.ts` 의 `'[실측] 차단 5필드의 details.field 는 비어있지 않은 값일 때 중첩 경로다'` 케이스가 고정한 값과 정확히 일치한다. "표시 옵션·rate limit 만 바꾸는 PATCH 는 영향받지 않는다"는 Callout 서술도 `triggers.service.spec.ts` 의 `cardBody()` 기반 "카드 편집 바디가 통과한다"/"slack/discord 의 plaintext 부재는 더 이상 400 이 아니다" 케이스로 뒷받침된다. 문서가 테스트되지 않은 동작을 주장하는 gap 은 없다.

## 확인한 것 — 직전 라운드 결론이 이번 델타로 무효화되지 않음

직전 라운드(`00_21_55`)가 남긴 INFO 3건(carry-over)은 이번 델타의 대상이 아니므로 재실측 없이
상태만 재확인했다 — 전부 여전히 유효하고 비차단이다:

1. `inboundSigningRef` 보존이 unit 레벨에서만 검증되고 실제 웹훅 서명 검증까지 잇는 e2e 가 없음(`triggers.service.spec.ts` 의 `persistedChannel()` 단언 vs `trigger-workflow-ref.e2e-spec.ts` case E — 관계 축만 봄).
2. `assertChatChannelAlreadySetUp` 의 `incoming.provider` falsy 분기가 미검증(HTTP 경로에서는 DTO 가 `provider` 를 필수로 두어 실질 도달 불가능하지만, 방어적 이중 검증이라는 주석의 주장 자체를 검증하는 테스트는 없음).
3. `cardBody` fixture 리터럴이 `trigger-dto-validation.spec.ts`/`triggers.service.spec.ts` 두 곳에 중복 — 프론트 카드 바디가 바뀌면 한쪽만 갱신되고 다른 쪽은 stale 바디로 계속 통과할 drift 위험.

## 요약

이번 라운드의 코드 델타는 `codebase/backend/src/**` 프로덕션 코드 변경 없이 (a) 기존 회귀
테스트 1건의 단언을 vacuous 에서 판별 가능한 형태로 강화하고 (b) slack/discord 사용자 문서
4파일을 신설한 것뿐이다. (a)는 뮤테이션 검증으로 실제 판별력을 직접 확인했고, (b)는 문서
서술이 기존 테스트가 고정한 값과 전부 일치해 문서-테스트 괴리가 없다. 전체 테스트(181/182,
1 skip 은 이 PR 과 무관한 기존 placeholder)는 재실행으로 GREEN 확인했다. 직전 라운드가 남긴
INFO 3건은 이번 델타로 해소되지도 악화되지도 않아 그대로 carry-over 다. 새로운 차단 사유는
없다.

## 위험도

NONE
