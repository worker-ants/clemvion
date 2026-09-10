# 유지보수성(Maintainability) 코드 리뷰 — `impl-chat-channel-patch-token`

## 검토 방법

`origin/main...HEAD` 전체 diff(`codebase/**` 11개 파일)를 대상으로, 프롬프트가 크기 제한으로
생략한 파일(`triggers.service.ts`, `triggers.service.spec.ts`, `trigger-dto-validation.spec.ts`)은
저장소에서 `git diff`/`Read` 로 직접 전문을 확인했다. 이 PR 은 이미 4개 이전 라운드
(`review/code/2026/09/10/23_21_57`, `23_55_23`, `2026/09/11/00_21_55`, `00_45_18`)에서
maintainability 를 포함해 반복 검토됐고, 그중 `23_55_23/maintainability.md` 가 LOW 위험도로
수렴시킨 뒤의 코드 변화는 (a) 오버로드 2개 추가(`assertChatChannelInputSafe`), (b) 테스트
재구성/분리, (c) JSDoc 재배치(내부 서사를 `//` 로), (d) 컨트롤러 Swagger 설명 확장, (e) 문서
`.mdx` 정정뿐이다. 저장소 트리는 뮤테이션하지 않았다(`git status --short` 확인, 잔여물 없음).

## 발견사항

- **[WARNING]** `setupChatChannel` 이 여전히 186줄에 6~8개의 서로 다른 관심사(adapter 등록 확인 ·
  endpoint 검증 · bot-token rotate 게이팅 · provider-issued signing rotate 게이팅 ·
  `inboundSigningRefSurvives` 판정 · config 조립 · 성공 경로 영속화/listener 등록 · 실패 경로
  degraded 반영)를 순차 처리한다 — 새로운 지적이 아니라 이전 라운드(`23_55_23/maintainability.md`
  W6)의 재확인이다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1075`~`:1260`
    (`private async setupChatChannel`)
  - 상세: 이번 라운드의 델타(오버로드 추가·JSDoc 이동·테스트 재구성)는 이 함수 본문을 전혀
    건드리지 않았다 — 함수는 이전 라운드가 측정한 그대로다. 이미
    `plan/in-progress/spec-draft-nullable-notation-followups.md:2161`~`:2165` 에 "developer,
    2026-09-11 등재" 로 미체크 항목으로 올라 있고, 처방(앞쪽 절반을
    `resolveChatChannelSecretWrites(...)` 로 분리)도 명시돼 있다. 두꺼운 근거 주석과 대칭 회귀
    테스트(`triggers.service.spec.ts` 신설 `describe` — `existing()`/`setup()`/`cardBody()`/
    `persistedChannel()` 헬퍼)가 위험을 상쇄하고 있어 이번 PR 을 막을 사유는 아니다.
  - 제안: 트래커 항목대로 다음에 이 함수를 건드릴 때 분리. 이번 PR 범위에서 추가 조치 불요.

- **[INFO]** `update()` 가 여전히 123줄, 8개 관심사(schedule 타입 필드 제한 · 알림 URL 검증 ·
  chatChannel 입력 안전성 · 최초-setup 거부 · authConfig 검증 · config 병합 · 저장 · audit/
  schedule 동기화/secret 정규화/chatChannel setup 후처리)를 순차 처리 — 이전 라운드 INFO 의 연장,
  이번 델타로 추가된 줄은 없다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:485`~`:607` (`async update`)
  - 제안: 이전 라운드 제안(단계 함수 분리) 유지, 이번 PR 착수 불요.

- **[INFO]** `PATCH /api/triggers/:id` 의 `@ApiBadRequestResponse` 설명이 번호 매긴 3개 사유 +
  `details.field` 형태 분기(전역 파이프 vs 서비스 가드)까지 한 문자열 리터럴 안에 콤마로 이어
  붙어 있어, Swagger UI 렌더링 결과물은 몰라도 소스 상에서는 한 눈에 구조가 들어오지 않는다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:120`~`:131`
    (`@ApiBadRequestResponse({ description: ... })`)
  - 상세: 다만 같은 파일의 다른 `@Api*Response` 설명들(예: `:99`~`:101` 의 conflict 설명)도
    동일하게 조밀한 단일 단락 스타일이라 이 PR 이 새로 만든 불일치는 아니다 — 기존 컨벤션을
    그대로 따른 확장이다.
  - 제안: 조치 불요(기존 스타일과 일관). 이후 이 description 을 또 확장할 일이 생기면 그때
    템플릿 리터럴 + 줄바꿈으로 가독성을 높이는 것을 고려.

## 확인한 것 — 문제 없음(긍정적 관찰)

- `ChatChannelUpdateConfigDto` (`OmitType(ChatChannelConfigDto, ['botToken',
  'inboundSigningPlaintext'])`) 는 생성용 DTO 와의 차이(딱 두 필드)를 표로 명시하고, "왜
  `OmitType`" · "왜 optional 로 두고 무시하지 않는가" · "왜 `Patch` 가 아니라 `Update`" 세 가지
  설계 결정의 근거를 남긴다. 이번 라운드에서 그 세 단락을 JSDoc(→공개 OpenAPI 로 유출)에서
  `//` 내부 주석으로 옮겨 소비자용 문서와 구현 서사를 분리한 것(`chat-channel-config.dto.ts:363`
  ~`:377`)은 이전 라운드에 없던 개선이다.
- `assertChatChannelInputSafe` 를 오버로드 2개로 선언해 `mode`(`'create'|'update'`)와 DTO 타입을
  컴파일 타임에 결속한 것(`triggers.service.ts:636`~`:687`)은 문자열 판별자만 쓸 때 생기는
  "모드-타입 짝 어긋남을 컴파일러가 못 잡는" 위험을 제거한다 — 이 PR 이 닫은 보안 결함 클래스가
  검출 없이 재발하지 않도록 타입 레벨에서 강제한 좋은 선택이다.
  `assertPatchCarriesNoSecrets`/`assertChatChannelAlreadySetUp` 도 각각 단일 책임의 짧은 private
  메서드이고, 기존 `assertChatChannelInputSafe`/`assertInboundSigningPlaintextByProvider` 와
  `assert*` 접두 네이밍 축이 일관된다.
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "검증 함수 분리" 항목도 이
  오버로드 도입 근거로 이번 라운드에 체크 완료됐다(정합).
  `plan/in-progress/spec-draft-nullable-notation-followups.md:2167` 에는 별개의 미해결 항목
  (`@MinLength(1)` 부재, 생성 경로 한정, 이번 PR 스코프 밖)이 이미 등재돼 있어 중복 지적하지
  않는다.
- `trigger-dto-validation.spec.ts` 신설 `describe('ChatChannelUpdateConfigDto — PATCH 는 비밀을
  받지 않는다')` 는 `run()`/`cardBody()` 헬퍼로 8개 케이스의 공통 파이프 호출·바디 조립을
  추출해, 각 `it` 이 "무엇이 다른가"(필드 실림 여부·값 형태)에만 집중하게 한다.
  `triggers.service.spec.ts` 신설 `describe('chatChannel PATCH 는 사용자 비밀을 쓰지 않는다')`
  도 `existing()`/`setup()`/`cardBody()`/`persistedChannel()` 헬퍼 + `// ── D-1/D-2/D-3 ──`
  섹션 배너로 "쓰기 3개 중 2개만 막는다"는 비대칭을 코드 구조로도 드러낸다. 기존 8개 케이스를
  `service.update()` 에서 `service.create()`(`createWithChannel` 헬퍼)로 옮긴 리팩터링도 PATCH/
  POST 계약 분리 후의 실제 경로에 맞춰 정확하다.
- 매직 넘버 없음 — 새로 추가된 리터럴은 전부 에러 메시지·필드명·spec 참조 문자열이고, 값
  자체가 의미를 가진 상수(hex 길이 등)는 이번 diff 이전부터 있던 provider 별 정규식 상수를
  그대로 재사용한다.
- 중첩 깊이 — 신설 함수(`assertPatchCarriesNoSecrets`, `assertChatChannelAlreadySetUp`)는 모두
  최대 2단계(함수 본문 → `if`)를 넘지 않는다.

## 요약

이 PR 은 이미 4라운드에 걸쳐 코드 리뷰·수정을 거친 상태이고, 이번 라운드의 실제 `codebase/`
델타는 타입 결속 강화(오버로드)·테스트 재구성·주석 재배치·문서 정정뿐이라 새로운 유지보수성
결함을 만들지 않았다. 유일하게 이어지는 항목은 `setupChatChannel` 의 길이/복잡도(WARNING)로,
이번 diff 가 만든 것이 아니라 이전 라운드가 이미 측정·등재하고 developer 가 트래커에
"다음에 손댈 때" 로 명시적으로 미룬 항목이며 두꺼운 근거 주석과 대칭 회귀 테스트가 그 위험을
상쇄한다. `update()` 길이(INFO)도 마찬가지로 기존에 이미 인지된 채무다. 반대로 JSDoc→`//`
이동을 통한 공개 API 문서 오염 제거, `mode`/DTO 타입 컴파일 타임 결속, 테스트 헬퍼 추출을 통한
중복 제거는 모두 유지보수성을 개선하는 방향의 변경이다. 이번 PR 을 이 관점에서 막을 사유는
없다.

## 위험도

LOW
