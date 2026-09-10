# 정식 규약 준수 검토 — Chat Channel PATCH Token (impl-done, scope=spec/5-system, 5라운드)

## 범위와 방법

- `spec/5-system` 델타는 이번에도 0개 파일 — 순수 코드 PR (누적 6커밋, 최신 `5976587c7`
  "docs(guide): slack/discord 도 PATCH 로 비밀을 못 바꾼다는 걸 사용자에게 알린다 — 리뷰
  3라운드"). 직전 4회 라운드(`21_37_56`·`22_45_26`·`23_54_09`·`00_21_57`)의
  `convention_compliance.md` 가 모두 CRITICAL/WARNING 0, 위험도 LOW 로 수렴한 이력을 확인했고,
  이번 라운드는 `00_21_57` 이후 신규 커밋(`5976587c7` — `triggers.service.spec.ts` 단언
  강화 8줄 + slack/discord/telegram/triggers 사용자 문서 4파일)의 **증분**을 대조했다.
- 프롬프트가 예산 절단한 `spec/conventions/*.md` 는 워킹트리 절대경로로 직접 열어 전문
  대조했다: `swagger.md`(전문, 특히 §1-5 writeOnly 의무·§3 JSDoc/`//` 분리)·
  `secret-store.md`(§1.1 응답 비노출·§2.1 rotate 호출 규약)·`review-citations.md`(전문)·
  `i18n-userguide.md`(전문, Principle 6/6-B)·`chat-channel-adapter.md`(헤더 스캔)·
  `error-codes.md`/`3-error-handling.md §1.3·§2.1·§5.3`(VALIDATION_ERROR·details 형태).
  `git show 5976587c7`로 마지막 커밋의 실제 diff 를, `git diff origin/main`으로 PR 전체
  diff(15파일/1603줄, 코드 기준)를 직접 읽었다.
- `dto-jsdoc-citation.spec.ts` 를 직접 실행해 리뷰-인용 래칫이 통과 상태임을 확인했다(5/5
  PASS) — 이 가드는 아래 WARNING 이 지적하는 문제(citation 이 아니라 **설계 서사**)를
  탐지 범위 밖에 두므로, 통과 자체가 아래 발견을 반증하지 않는다.

## 발견사항

- **[WARNING]** `ChatChannelUpdateConfigDto` 클래스 JSDoc 에 "내부 서사"(경위 설명)가 실려
  공개 OpenAPI `description` 으로 나간다
  - target 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:347-371`
    (`export class ChatChannelUpdateConfigDto extends OmitType(...)` 바로 위 `/** ... */`
    블록, 특히 357행 "**왜 `OmitType` 인가**", 365행 "**왜 `Patch` 가 아니라 `Update` 인가**")
  - 위반 규약: `spec/conventions/swagger.md` §3 "JSDoc 은 공개 OpenAPI 로 나간다 — 내부
    서사를 담지 않는다" — "정정 경위·리뷰 참조·'왜 이렇게 바꿨는지' 같은 내부 서사는
    JSDoc 이 아니라 그 위의 `//` 주석에 적는다" + 표 "왜 이 값이 이 타입인지의 경위, 리뷰·PR
    참조 → 바로 위 `//` 주석"
  - 상세: `nest-cli.json` 이 `introspectComments: true` 로 전체 `*.dto.ts` 를 대상으로
    삼으므로(파일 경로 무관 — `dto/responses/**` 한정 아님), 이 클래스 JSDoc 은 소비자가
    보는 OpenAPI 스키마 `description` 이 된다(저장소 자체 문서:
    `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation.spec.ts` JSDoc 이
    "DTO 의 JSDoc 은 introspectComments 로 공개 OpenAPI description 이 된다" 고 명시하며
    **클래스·프로퍼티 JSDoc 양쪽**을 대상으로 삼는다). 그런데 이 JSDoc 의 "왜 `OmitType`
    인가"(TypeScript 상속 메타데이터 충돌을 피하는 구현 사정) · "왜 `Patch` 가 아니라
    `Update` 인가"(저장소 내부 명명 관례 히스토리) 두 단락은 API 소비자가 이 필드를 쓰는 데
    필요한 정보가 아니라 **구현·명명 결정의 경위**다 — swagger.md §3 표가 명시적으로
    예시로 든 "왜 이 값이 이 타입인지의 경위" 범주에 정확히 해당한다. `schedule-response.dto.ts`
    (53행)·`workspace-response.dto.ts`(89행)는 같은 종류의 서사를 JSDoc 바깥 `//` 로 정확히
    분리한 기존 준수 사례이나, 이번 신설 클래스는 그 패턴을 따르지 않았다. 자동 가드
    (`dto-jsdoc-citation-guard.ts`)는 "리뷰 인용"(날짜·세션 경로) 패턴만 스캔하므로 이
    위반(일반 설계 서사, 리뷰 인용 아님)은 탐지 범위 밖이다 — `spec/conventions/review-citations.md`
    §3 이 다루는 좁은 부분집합과 `swagger.md` §3 이 정의하는 넓은 원칙 사이의 간극이
    자동화 없이 남아 있다.
  - 제안: "왜 `OmitType` 인가"·"왜 `Patch` 가 아니라 `Update` 인가" 두 단락을 클래스
    JSDoc 에서 빼서 클래스 선언 바로 위 `//` 블록으로 옮긴다. JSDoc 에는 소비자가 알아야
    할 것(생성과 다른 두 필드가 다르다는 표, PATCH 시 400 이 난다는 사실, rotate 엔드포인트
    안내, `@see` spec 링크)만 남긴다. "왜 optional 로 두고 무시하지 않는가" 단락은
    소비자가 "왜 필드가 조용히 버려지지 않고 거부되는지" 를 아는 것이 실질적으로 유용하므로
    JSDoc 존치가 타당하다(경계선이지만 위반으로 보지 않음).

- **[INFO]** `spec/5-system/15-chat-channel.md` frontmatter `code:` 가 5라운드째 이번 PR 의
  신규 배선 파일을 반영하지 않음 (직전 라운드 INFO 미해소, 재확인만)
  - target 위치: `spec/5-system/15-chat-channel.md` frontmatter `code:` 목록 — 직접 열어
    재확인. `chat-channel-config.dto.ts`·`triggers.service.ts`·`triggers.controller.ts`
    는 있으나 이번 PR 이 바꾼 `update-trigger.dto.ts`·`trigger-dto-validation.spec.ts`·
    `triggers.service.spec.ts`·`trigger-workflow-ref.e2e-spec.ts` 는 여전히 없음
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 `code:` 필드 정의 — 강제
    사항은 아니다(글로브 매치 ≥1 이면 `spec-code-paths.test.ts` 가드는 통과, 이미 3개
    파일이 매치되므로 가드는 그린).
  - 상세: `23_54_09`→`00_21_57`→(이번) 3개 라운드 연속 지적됐고 이번 라운드까지 커밋
    1개(`5976587c7`)가 더 쌓였지만 frontmatter 는 그대로다. developer 는 `spec/` 쓰기
    권한이 없어 직접 고칠 수 없고(자기-반증형 소정정 대상도 아님 — 예고 문장 정정이 아니라
    `code:` 목록 완결성 문제), planner 트래커(`spec-draft-nullable-notation-followups.md`)
    에도 별도 항목으로는 없다(가까운 항목은 있으나 `code:` 배선 자체를 지목하지 않음).
    가드 통과에는 영향이 없는 선택적 완결성 항목이라 CRITICAL/WARNING 격상 사유는 아니다.
  - 제안: 다음 planner 턴에서 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    에 한 줄 등재(예: "15-chat-channel.md code: 배선에 update-trigger.dto.ts 등 4파일
    추가") — 5라운드째 자연 소멸하지 않으므로 명시 등재가 필요하다.

## 준수 확인 (근거 요약 — 신규 diff 증분 대상)

- **`triggers.service.spec.ts` 단언 강화(`details.field: 'chatChannel'` 추가)**: 판별력
  보강일 뿐 새 코드·새 출력 포맷 없음 — 규약 대상 아님.
- **사용자 문서 신설 4파일(`slack.mdx`/`.en.mdx`, `discord.mdx`/`.en.mdx`)**:
  - **Principle 6-B(`i18n-userguide.md`) 내부 SoT 노출 금지**: 신설 절 어디에도
    `spec/**` 경로·`plan/**` 경로·`R-CC-NN`/`CCH-XX-NN` 내부 anchor id·"별 plan"/"v1
    미정의(로드맵성 문구로 오독될 수 있는 표현)가 노출되지 않는다 — "지금은 바꿀 수
    없어요"(현재 동작 서술)로만 적혀 있어 로드맵 서술 금지 조항도 준수. `no-internal-refs.test.ts`
    가 검증하는 결정론적 패턴에 걸리는 항목 없음(직접 대조).
  - **Principle 6 문체·글로서리**: 해요체 통일("~바꿔요"·"~이에요") 확인, 금지어
    ("엣지"·"작업 흐름"·"아웃풋") 미사용.
  - **`details.field='chatChannel.botToken'` 서술**: 실측 표(트래커
    `spec-draft-nullable-notation-followups.md`, `trigger-dto-validation.spec.ts` `[실측]`)에
    따르면 이 표기는 "비어있지 않은 값을 보낸" 케이스(전역 파이프 거부, 중첩 경로 + 배열
    `details`)에 정확히 해당한다 — 실사용자가 봇 토큰을 PATCH 로 보내려는 시나리오는
    거의 항상 이 갈래이므로 사용자 문서의 단순화가 §5.3 규약과 어긋나지 않는다(반대
    갈래 — `null`/`''` 전송 시 flat `botToken` — 는 실사용 시나리오가 아니라 문서
    누락으로 보지 않음).
- **에러 코드**: 이번 커밋에 신규 발행 코드 없음(문서·테스트만) — `error-codes.md`
  대상 아님.
- **DTO 명명 축(`Update*Dto`)·`OmitType` 사용**: 변동 없음, 직전 라운드 판정 유지 —
  `swagger.md §5-1` "중복 필드는 PickType/OmitType/PartialType 로 재사용" 과 일치.
- **`writeOnly: true` 의무(swagger.md §1-5)**: `ChatChannelUpdateConfigDto.botToken`·
  `.inboundSigningPlaintext` 둘 다 `@ApiPropertyOptional({ ..., writeOnly: true })` 로
  선언됨 — 준수(변동 없음, 재확인).
- **secret store 사용 패턴**: 이번 커밋은 `secrets.rotate()`/`secrets.store()` 호출
  변경 없음(테스트·문서만) — `secret-store.md` 대상 아님.
- **review-citations**: 신규 커밋의 코드 변경분(`triggers.service.spec.ts` 8줄)에 리뷰
  인용 없음. `dto-jsdoc-citation.spec.ts` 실행 결과 5/5 PASS(베이스라인 2건 그대로,
  신규 위반 0건) — 단 위 WARNING 은 이 가드의 탐지 범위(리뷰 인용) 밖의 별개 문제(설계
  서사 일반)임을 다시 확인한다.

## 요약

이번(5번째) 라운드는 문서 전용 커밋(`5976587c7`)의 증분을 중심으로 재검토했고,
`spec/conventions/**` 의 명명·출력 포맷·문서 구조·API 문서·금지 항목 다섯 관점에서
새 커밋 자체는 위반을 만들지 않았다(신설 사용자 문서 4파일은 i18n-userguide.md
Principle 6/6-B 를 준수, `details.field` 단순화도 실측 갈래와 정합). 다만 이번
라운드에서 **PR 전체 diff 를 다시 훑는 과정에서 이전 4라운드가 짚지 않은 새 지점**을
찾았다 — `ChatChannelUpdateConfigDto` 클래스 JSDoc(2라운드 전 커밋에서 신설)이
`swagger.md §3` 의 "내부 서사는 `//` 로" 원칙을 어기고 구현·명명 경위를 공개 OpenAPI
`description` 에 그대로 노출한다. 자동 가드(`dto-jsdoc-citation-guard.ts`)는 리뷰
인용만 스캔해 이 형태(설계 서사, 인용 아님)를 탐지하지 못하므로 사람이 확인하지 않으면
남는다. 시스템 invariant 를 깨는 CRITICAL 은 아니고(wire 계약·보안·데이터 정합성에
영향 없음), 규약이 명시한 위치 규칙을 어긴 명확한 WARNING 이다. 그 외에는 5라운드째
지속되는 비차단 INFO(`15-chat-channel.md` frontmatter `code:` 미갱신) 1건뿐이다.

## 위험도

LOW
