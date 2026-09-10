# 신규 식별자 충돌 검토 — `spec/5-system` (impl-done, chat-channel PATCH 토큰 우회 수정 · 5라운드)

## 전제 확인

`git diff --stat origin/main...HEAD -- spec/5-system` 결과가 이번에도 **0개 파일** —
워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/impl-chat-channel-patch-token-a17c4e`)에서
직접 재확인했다. 이 브랜치는 spec 레벨에서 요구사항 ID·엔티티명·API endpoint·이벤트명·
ENV/설정키·spec 파일 경로를 새로 도입하지 않는다. 실질 검토 대상은 여전히 코드/문서
diff(`origin/main...HEAD`, 15 파일 / 1622줄)가 도입하는 심볼이다.

이 세션(`01_10_44`)의 target 은 직전 라운드(`review/consistency/2026/09/11/00_45_19`, NONE)
이후 추가된 커밋 `464f2ba1a`("리뷰 4라운드")다. 그 커밋의 diff 를 워킹트리에서 직접 열어
신규 식별자 유무를 확인했다.

## `464f2ba1a`(직전 라운드 이후 신규 커밋)가 추가한 것 — 신규 식별자 없음

- `chat-channel-config.dto.ts` — `ChatChannelUpdateConfigDto` 클래스 JSDoc 안에 있던 세 단락
  ("왜 `OmitType` 인가" · "왜 optional 인가" · "왜 `Patch` 가 아니라 `Update` 인가")을 JSDoc
  블록에서 클래스 선언 바로 위 `//` 라인 주석으로 옮겼을 뿐이다 — `introspectComments` 가
  JSDoc 을 공개 OpenAPI `description` 에 실어 내부 서사가 유출되는 것을 막는 조치
  (`spec/conventions/swagger.md:315` 규약). **새 클래스·필드·함수 선언 없음**, 순수 주석
  위치 이동. 같은 파일의 `botTokenRef` JSDoc 설명도 `chatChannel.botTokenRef`(중첩 경로)로
  갱신했지만 이는 기존 필드의 설명 문구 정정이지 신규 식별자가 아니다.
- `trigger-dto-validation.spec.ts` — 이미 존재하던 JSDoc 블록(`details.field` 실측 설명)을
  엉뚱한 테스트 위에서 원래 테스트(`it('[실측] 차단 5필드의 details.field 는...')`) 위로
  재배치했다. 테스트 케이스·단언·식별자 신규 추가 없음.
- `triggers.mdx`/`triggers.en.mdx` — "Chat Channel 은 트리거를 만들 때만 설정할 수 있다"
  단락을 ko/en 에 각 1개씩 추가했다. 여기서 인용되는 `details.field='chatChannel'` /
  `details.field='provider'` 값은 **이미 이전 라운드(`00_21_57`)가 검토·확인한 기존 값**
  (`assertChatChannelAlreadySetUp`/provider 변경 차단 분기, `triggers.service.ts:744` 등)의
  재인용이며, 새 값이 아니다.

즉 이번 라운드에서 신규로 등장한 코드 심볼·필드명·API·ENV·파일 경로는 없다. 아래는 지금까지
누적된 신규 식별자 집합을 이번 세션에서 독립 재검증한 결과다.

## 검토 대상 신규 식별자와 실측 결과 (독립 재검증)

| 신규 식별자 | 종류 | 정의 위치 | 전수 grep 재실측(이번 세션) |
|---|---|---|---|
| `ChatChannelUpdateConfigDto` | class (DTO) | `chat-channel-config.dto.ts` | 저장소 전체 `class`/`export class` 정의 1건. 인접 DTO(`NotificationConfigDto`·`InteractionConfigDto`·`UpdateModelConfigDto`·`UpdateAuthConfigDto` 등) 어느 것과도 이름이 겹치지 않음. `Patch` 접두 클래스는 저장소 전체 0건 — 개명 경위가 이번 커밋에서 클래스 위 주석으로 보존됨 |
| `ChatChannelInput` / `ChatChannelInputMode` | type alias | `triggers.service.ts` | 변경 없음(이번 커밋 미접촉). 이전 라운드 확인 유지 |
| `assertPatchCarriesNoSecrets` / `assertChatChannelAlreadySetUp` | private method | `triggers.service.ts` | 변경 없음(이번 커밋 미접촉). 이전 라운드 확인 유지 |
| `storeUserSuppliedSecrets` / `preservedInboundSigningRef` | 내부 옵션 플래그명 | `triggers.service.ts` | 변경 없음(이번 커밋 미접촉). 이전 라운드 확인 유지 |
| `details.field='provider'` | 에러 응답 값 | `triggers.service.ts:744` | 저장소 전체 정의 1건(`triggers.service.ts`) + 테스트 단언 1건 — 다른 모듈이 같은 문자열을 다른 의미로 쓰는 사례 없음 |
| `details.field='chatChannel'` | 에러 응답 값 | `triggers.service.ts`(`assertChatChannelAlreadySetUp`) | 이전 라운드(`00_21_57`)가 이미 확인, 이번 커밋은 사용자 문서에 재인용만 추가 |

- **API endpoint** — 이번 커밋은 controller/service 로직을 건드리지 않는다(주석·테스트
  위치·문서만). 새 method+path 조합 없음.
- **환경변수·설정키** — `git diff origin/main...HEAD -- codebase/backend | grep -n
  "process\.env\|@Column\|migrations/"` 결과 0건(전체 브랜치 기준 재확인). 신규 ENV·DB
  컬럼·마이그레이션 없음.
- **파일 경로** — `git diff --diff-filter=A --name-only origin/main -- codebase spec`
  결과 **0건**(신규 코드/spec 파일 없음). 브랜치 전체에서 유일한 신규 파일은
  `plan/in-progress/impl-chat-channel-patch-token.md` 이며, 이는 `spec-draft-*` ↔ `impl-*`
  접두어 페어링이라는 기존 관례를 따른다(이전 라운드에서 이미 확인).
- **이벤트/메시지명** — webhook·queue·sse 이벤트 신설 없음.

## 발견사항

없음. 신규 식별자(요구사항 ID / 엔티티·DTO명 / endpoint / 이벤트명 / 환경변수 / 파일 경로) 중
기존 사용처와 다른 의미로 충돌하는 사례를 찾지 못했다. 이 결론은 `21_37_56`(최초 발견 —
`ChatChannelPatchConfigDto` WARNING, 이후 `ChatChannelUpdateConfigDto` 로 개명) →
`22_04_23`/`22_14_27`/`22_24_30`(개명 확인) → `22_45_26`/`23_54_09`/`00_21_57`/`00_45_19`
(전수 재검증)에 이어 이번이 **8번째 독립 재검증**이며, 매 라운드 동일하게 NONE 으로 수렴했다.
이번 라운드(`464f2ba1a`)는 production 로직·테스트 로직을 건드리지 않고 JSDoc→`//` 주석
이동, orphan JSDoc 재배치, 사용자 문서 보강만 수행해 애초에 신규 식별자 표면이 생기지
않았다.

## 요약

target(`spec/5-system`)은 이번 라운드에서도 변경되지 않았고, 직전 라운드 이후 추가된 유일한
커밋(`464f2ba1a`)은 내부 설계 서사가 공개 OpenAPI 스키마로 새는 것을 막기 위해 JSDoc 세 단락을
클래스 선언 위 일반 주석으로 옮기고, orphan JSDoc 을 원 테스트 위로 재배치하고, 사용자 문서에
기존 값(`details.field='chatChannel'`/`'provider'`)을 재인용하는 문단을 추가한 것뿐이다. 새
클래스·함수·필드·엔드포인트·ENV·설정키·spec/코드 파일 경로 중 무엇도 신설되지 않았으므로,
이전 7라운드에 걸쳐 검증된 "충돌 없음" 결론에 변화가 없다.

## 위험도

NONE
