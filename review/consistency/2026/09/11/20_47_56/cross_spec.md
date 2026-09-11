# Cross-Spec 일관성 검토 — `spec-draft-chat-channel-binder-drift.md`

## 검토 방법

target draft 가 편집 대상으로 지목한 7개 파일(a)~(g) + `code:` glob 변경 + §7 열거를,
실제 `spec/**` 현재 상태 및 `codebase/backend/src/modules/triggers/` 실제 코드와 직접 대조했다.
검증 수단: `grep` 전수 스캔(이동한 심볼 9개 전부 + `TriggersService` 전체 인용처), 코드 정의
위치 확인, `review_guard._glob_to_regex` 를 이 세션에서 직접 실행해 draft 가 주장하는 매칭 수치
(10 / 27 / 0) 재현.

## 발견사항

- **[WARNING]** `## Rationale` 초안 문구가 `spec-impl-evidence.md` R-1 절의 내용 위치를 부정확하게 인용한다
  - target 위치: draft `## Rationale (spec 본문에 실을 근거)` — *"[`spec-impl-evidence.md` R-1](...) 이 '글로브 허용을 채택' 하면서 **바로 그 절에서** '넓은 트리 글롭으로 가드만 통과시키는 것은 아무것도 가리키지 않는 것과 같다' 고 못박고 있다"*
  - 충돌 대상: `spec/conventions/spec-impl-evidence.md` — R-1 절(`### R-1. code: 글로브 허용 vs 명시 파일만`, 201~203행)과 그 인용 문구의 실제 위치(§3 frontmatter 속성 표의 `code` 행, 81행)
  - 상세: 실측(`grep -n`)으로 확인한 결과, `"넓은 트리 글롭으로 가드만 통과시키는 것은 아무것도 가리키지 않는 것과 같다"` 라는 문구는 **§3 속성 표 안**(81행)에 있고, R-1 Rationale 절(201~203행)에는 이 문장이 없다 — R-1 은 "글로브 허용 채택 + stale 글로브 단점 + `/spec-coverage` 가 보완" 만 서술한다. 두 위치는 문서 안에서 서로 다른 절이므로 *"바로 그 절에서"* 는 사실과 다르다. 이 절이 `## Rationale (spec 본문에 실을 근거)` 로 명시돼 있어 **이 표현이 그대로 `15-chat-channel.md` 의 R-CC-22 에 실릴 위험**이 있다 — 그렇게 되면 `spec/5-system/15-chat-channel.md` 가 `spec/conventions/spec-impl-evidence.md` 의 내용 위치에 대해 틀린 주장을 하게 되어 새로운 cross-spec 불일치를 만든다.
  - 제안: R-CC-22 본문 작성 시 "바로 그 절에서" 를 "같은 문서 §3 의 `code` 속성 설명에서" 또는 앵커를 `#3-frontmatter-...`(§3 해당 행)로 구체화해 인용 정밀도를 R-1 자체가 아니라 실제 위치로 맞출 것. (교훈: 이 저장소 메모리의 "리뷰어 위치 인용을 소스 라인에 고정" 케이스와 같은 종류의 결함.)

- **[INFO]** draft `## 안 하는 것` 항목이 `TriggersService:` 로그 리터럴의 실제 위치를 오귀속
  - target 위치: draft `## 안 하는 것` — *"`triggers.service.ts` 의 `TriggersService:` 로그 리터럴 — 코드 사안(developer)."*
  - 충돌 대상: 실제 코드 `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (83, 250, 253, 288행 — 전부 `TriggersService:` 접두 로그 리터럴)
  - 상세: `grep -n "TriggersService:" triggers.service.ts chat-channel-binder.service.ts` 로 확인한 결과 이 접두 로그 문자열은 **`triggers.service.ts` 에는 한 곳도 없고 전부 `chat-channel-binder.service.ts` 에만 있다**(binder 자신의 클래스 docblock 이 "로그 메시지의 `TriggersService:` 접두는 의도적으로 남겼다" 고 이미 명시). 이 draft 는 정확히 "심볼이 어느 파일에 사는가" 를 바로잡는 작업인데, out-of-scope 로 남기는 항목 자체가 파일을 잘못 짚었다 — 트래커에 그대로 옮겨지면 다음 사람이 `triggers.service.ts` 에서 찾다가 못 찾는다.
  - 제안: 해당 불릿의 파일명을 `chat-channel-binder.service.ts` 로 정정. spec 편집 대상은 아니므로 CRITICAL/WARNING 은 아니나, 트래커 텍스트 정확도 차원에서 반영 권장.

- **[INFO]** §1.3 표 헤더 제거 후 각주가 3행 중 2행만 귀속을 밝힌다
  - target 위치: draft 편집 (d) — `spec/data-flow/14-chat-channel.md` §1.3, 제안된 각주 *"최초 setup/teardown 은 `chat-channel-binder.service.ts`, 회전·cleanup 은 `triggers.service.ts`"*
  - 충돌 대상: 같은 표의 3번째 행 `PATCH 가 거부하는 세 경우`(비밀 필드 차단 / 사후 부착 차단 / provider 변경 차단) — 이 검증 로직의 정본은 `chat-channel-input-rules.ts`(`assertPatchCarriesNoSecrets` 등, T1 에서 이동)다
  - 상세: 헤더의 `(triggers.service.ts)` 단일 파일 한정을 떼는 것 자체는 옳다(모든 행이 같은 파일이 아니므로). 다만 제안된 각주는 1·2번째 행(setup/teardown, rotate/cleanup)의 소유자만 밝히고 3번째 행(PATCH 검증)의 소유자는 언급하지 않는다 — 검증 로직이 실제로는 **세 번째 파일**(`chat-channel-input-rules.ts`)에 있으므로, 이 draft 의 "정확한 귀속" 취지를 §1.3 전체에 완결하려면 세 번째 파일도 각주에 넣는 것이 일관적이다. 틀린 서술은 아니고(각주가 거짓을 말하지 않음) 완결성 갭이다.
  - 제안: 각주를 "최초 setup/teardown 은 `chat-channel-binder.service.ts`, PATCH 검증(비밀 차단·사후 부착·provider 불변)은 `chat-channel-input-rules.ts`, 회전·cleanup 은 `triggers.service.ts`" 세 갈래로 확장 검토.

## 검증되어 충돌 없음으로 확인된 항목 (참고)

- `code:` glob 3종을 `review_guard._glob_to_regex` 로 이 세션에서 직접 컴파일해 재측정 — 매칭 10개(의도한 집합과 차집합 0), `triggers/**` 는 27개(무관 파일 포함) 확인. draft 의 수치 주장과 완전히 일치.
- 이동 심볼 9개(T1 6개: `assertChatChannelInputSafe`/`assertPatchCarriesNoSecrets`/`assertChatChannelAlreadySetUp`/`stripChatChannelPlaintext`/`assertInboundSigningPlaintextByProvider`/`translateSetupChannelError`, T2 3개: `setupChatChannel`/`teardownChatChannel`/`buildCallbackUrl`→`buildTriggerCallbackUrl`)를 `spec/` 전체에서 grep — draft 가 지목한 7곳 외 추가 잔존 attribution 없음을 확인(비대상으로 분류된 `update()`/`remove()`/`rotateBotToken`/`cleanupRotatedChatChannelTokens`/`findByEndpointPath`/`assertAuthConfigInWorkspace`/`revokePerTriggerToken`/`assertNotificationUrlSafe`/`rotateNotificationSecret`/`promoteRotatedNotificationSecrets` 등은 실제로 여전히 `triggers.service.ts` 안에 정의돼 있음을 코드로 재확인).
- `R-CC-22` ID 충돌 없음 — `spec/` 전체에 `R-CC-22` 미사용, `R-CC-14` 는 실측대로 결번(13→15 로 skip). 새 ID 부여는 안전.
- 원문 인용 ⓐ~ⓘ 전부 실제 파일 verbatim 과 대조해 일치 확인(`secret-store.md` §2.1, `chat-channel-adapter.md` §2.4, `data-flow/14-chat-channel.md` §0/§1.3, `15-chat-channel.md` frontmatter/§7, `slack.md`/`discord.md`/`telegram.md` 해당 행).
- 편집 대상 문자열은 각 provider 파일에서 정확히 1회씩만 등장 — 부분 교체 시 다른 자리 누락 위험 없음.
- `triggers.service.ts` → `chatChannelBinder.setupChatChannel()` 호출이 생성(448행)·수정(565행) 경로 양쪽에 실재 — 편집 (b) 의 "TriggersService(생성/수정 경로 진입)" 서술과 일치.
- `rotateBotToken`/`cleanupRotatedChatChannelTokens` 는 여전히 `triggers.service.ts` 자체 메서드(각각 984·1200행)이고 `chat-channel-binder.service.ts` 의 클래스 docblock 도 이 둘을 명시적으로 "없다" 쪽에 나열 — §7 새 주석과 정합.
- `trigger-callback-url.ts` 는 `chat-channel-binder.service.ts` 와 `triggers.service.ts`(rotateBotToken) 양쪽에서 import — "binder·rotateBotToken 공용" 서술과 일치.
- `chat-channel-rejection-messages.const.ts` 는 `chat-channel-input-rules.ts` 와 `dto/chat-channel-config.dto.ts` 양쪽에서 import — "두 층의 단일 SoT" 서술과 일치.

## 요약

draft 는 이례적으로 높은 정확도로 검증돼 있다 — glob 매칭 수치, 이동 심볼 9개의 spec 전역 잔존 스캔, 원문 verbatim 대조, R-CC ID 결번까지 전부 실측이 draft 의 주장과 정확히 일치했다. Cross-spec 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 축에서는 충돌을 찾지 못했다. 유일하게 남는 리스크는 draft 자신의 서술 정확도 층위다 — `spec-impl-evidence.md` 인용 위치가 부정확해 그대로 `R-CC-22` 에 옮겨지면 새로운 (작지만 실재하는) cross-spec 불일치를 만들 수 있고, "안 하는 것" 목록의 로그 리터럴 귀속도 틀렸다. 둘 다 target 이 실제로 spec 에 쓰기 전에 고치면 되는 손쉬운 정정이며, 이 draft 가 이번 턴에 고치려는 문제(부정확한 귀속)의 축소판이 draft 자신 안에 하나 들어 있었다는 점만 지적해 둔다.

## 위험도

LOW
