# 정식 규약 준수 검토 — convention_compliance

## 검토 범위 메모

본 라운드는 `--impl-done`(scope=`spec/5-system/`, diff-base=`origin/main`)이며 **spec 델타는
0개 파일**이다. 실제 변경은 `git diff origin/main...HEAD -- codebase/` 의 10파일/813줄
(`common/utils/password.util.ts`(+spec) · `modules/triggers/chat-channel-rejection-messages.const.ts`(신규)
· `modules/triggers/dto/chat-channel-config.dto.ts` · `modules/triggers/dto/trigger-dto-validation.spec.ts`
· `modules/triggers/triggers.service.ts`(+spec) · `test/chat-channel-trigger-create.e2e-spec.ts`
· `frontend/.../triggers.mdx`/`triggers.en.mdx`)이며, 이를 워킹트리 절대경로에서 직접 읽어
`spec/5-system/2-api-convention.md §5.3`(2026-09-11 `field`→`code` 배선 규약화)·
`spec/conventions/error-codes.md`·`spec/conventions/swagger.md`·`spec/conventions/review-citations.md`·
`spec/conventions/i18n-userguide.md`·`spec/5-system/15-chat-channel.md`(R-CC-21·§5.4.1) 대비로
대조했다.

## 발견사항

- **[WARNING] 새로 추가된 코드 주석이 리뷰 세션을 bare `hh_mm_ss` 로 인용한다**
  - target 위치: `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts:923`
    (`// ... 통과한다(\`/ai-review\` \`11_05_27\` testing INFO 3).`),
    `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3094`
    (`* ... 난다(\`/ai-review\` \`11_05_27\` maintainability WARNING).`) — 둘 다 이번 diff 의
    신규 추가분(`+` 라인, `git diff origin/main...HEAD` 확인).
  - 위반 규약: `spec/conventions/review-citations.md` §2 (「날짜를 포함한다 — **bare `hh_mm_ss`
    는 쓰지 않는다**」) · §3 적용범위 표(「`codebase/**` 의 코드·테스트 주석 | **적용**」).
  - 상세: 두 인용 모두 세션 시각 `11_05_27`만 적고 날짜(`2026-09-11`)나 전체 경로
    (`review/code/2026/09/11/11_05_27`)를 싣지 않았다. 해당 세션 디렉터리는 실재
    (`review/code/2026/09/11/11_05_27/`)하지만, 규약 문서가 명시하는 근거는 "지금 안 겹친다"가
    아니라 "**날짜가 빠지면 다른 날짜의 동일 시각과 영구히 구분 불가**"라는 것이다(문서 실측:
    `codebase/**` 인용 197개 중 46개가 이미 날짜-교차 충돌). 같은 PR 의 `plan/in-progress/impl-details-code-wiring.md`
    는 같은 세션을 `review/code/2026/09/11/11_05_27`(전체 경로)로 정확히 인용하고 있어(179번째 줄
    부근) — `plan/**` 는 이 규약의 적용 대상이 아니므로(§3 표) 정당하지만, **같은 세션을 가리키는
    두 인용이 `codebase/**` 쪽만 규약을 어겼다**는 뜻이기도 하다. 이 저장소는 이미 같은 클래스의
    위반(bare 시각·JSDoc 오분류)을 3회 이상 사람이 잡아 규약화한 이력이 있다
    (`review-citations.md` Rationale — `review/code/2026/09/05/00_06_38` W2, `2026/09/06/12_28_02` W2 등,
    모두 이 저장소 관행상 **Warning 등급**으로 처리됐다).
  - 제안: 두 주석을 `` `/ai-review` `review/code/2026/09/11/11_05_27` testing INFO 3 `` /
    `` maintainability WARNING `` 형태(전체 경로, §2 표의 "권장")로 정정한다. §2 "허용" 형태인
    `2026-09-11 11_05_27` 도 가능하나 이 규약 §1 이 전체-경로 인용을 이력 보존(git log) 관점에서
    더 권장한다.

## 준수 확인 (위반 아님 — 근거와 함께 기록)

검토 중 위반으로 오인하기 쉬우나 실측 결과 규약을 그대로 따르고 있음을 확인한 항목들:

- **`details[].code` 배선 15자리** — `spec/5-system/2-api-convention.md §5.3` 의
  「`field` 를 실으면 `code` 도 싣는다 — 형태 무관 (2026-09-11 규약화)」를 정확히 따른다.
  배열 형태(`password.util.ts`)·객체 형태(`triggers.service.ts`) 양쪽 다 `{ field, code }`
  또는 `{ field, message, code }` shape 을 지킨다. `spec/5-system/15-chat-channel.md`
  §5.4.1/§5.4.1.2 가 이미 "그 PR 이 머지되기 전까지 아직 안 실린다"고 예고해 둔 배선을
  정확히 그 예고대로 이행했다 — 코드 값은 신규 등재 없이 기존 generic `INVALID_FIELD` 재사용
  (§5.3 기본값 규정과 일치).
- **`common/utils/password.util.ts` 의 `'INVALID_FIELD'` 리터럴** — `nodes/core/error-codes.ts`
  의 canonical `ErrorCode.INVALID_FIELD` 값과 문자열 일치. `common/` → `nodes/` import 가
  저장소에 0건이라는 주석의 주장을 `grep`으로 재확인했고(사실), 자매 생산자
  `common/pipes/validation.pipe.ts` 도 이미 리터럴을 쓰는 선례를 확인했다 — layering 근거가
  실측과 맞다. `modules/triggers/triggers.service.ts` 가 `ErrorCode` enum 을 import 하는 것도
  `modules/**` → `nodes/core/error-codes` 선례가 최소 9개 파일에 실재해 정당하다.
  `spec/conventions/error-codes.md` 는 이름·값의 의미 규율만 다루고 "리터럴 금지"는 규정하지
  않으므로 위반 아님.
- **`@MinLength(1)` 데코레이터 순서** — `@IsString()` → `@MinLength(1)` → `@MaxLength(256)` 은
  `spec/conventions/swagger.md` §1-1/§1-2 예시(`@IsString → @MinLength → @MaxLength`)와 정확히
  일치. `botToken` 의 `writeOnly: true` 도 §1-5 "secret store 입력 plaintext 필드는 항상
  writeOnly 동반" 의무를 충족(기존부터 있었음, 이번 diff 는 검증 체인만 보강).
- **`ChatChannelUpdateConfigDto` 명명** — `swagger.md` §1-7 표가 이 클래스명 자체를
  "nested 필드의 갱신용 변형은 `Update` 접두 확장 대상이 아니다"의 **본보기 예시**로 이미
  등재해 뒀다. 이번 diff 는 이 클래스를 새로 만들지 않고 기존 구조를 그대로 쓴다 — 위반 아님.
  (litreral 인용 주석도 `swagger.md:315` 줄-번호 인용을 절 제목 인용으로 정정했다 — 앵커
  문구 사용 권장과 정합.)
- **`chat-channel-rejection-messages.const.ts` 파일명** — 저장소의 기존 `.const.ts` kebab-case
  명명 선례(`audit-action.const.ts`, `embedding-dimensions.const.ts`)와 일치.
  `CHAT_CHANNEL_BLOCKED_FIELDS`/`CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` UPPER_SNAKE_CASE 상수도
  일관적.
- **`error-response.dto.ts` 의 `details?: unknown` 오픈 스키마** — 이번 diff 가 건드리지
  않았고, `2-api-convention.md §5.3` 의 "`GlobalExceptionFilter` 는 `details` 를 그대로
  통과시키며 OpenAPI 도 열려 있다"는 서술과 일치 — 별도 스키마 강제가 필요하지 않다.
  손대지 않은 것이 맞다.
  `spec/conventions/secret-store.md` SS-SE-01 인용, `spec/5-system/15-chat-channel.md`
  R-CC-21/§5.4.1 인용 모두 대상 앵커가 실재함을 확인했다.
- **`.mdx`/`.en.mdx` 사이블링 동시 수정** — `spec/conventions/i18n-userguide.md` Principle 5
  (sibling 동시 유지)를 지킨다. 본문에 실은 `details.code='INVALID_FIELD'` 는 wire 계약 값이지
  `spec/`·`plan/`·`CCH-XX-NN`류 내부 anchor 가 아니므로 Principle 6-B(내부 SoT 노출 금지)
  위반이 아니다. 해요체 문체(`~예요`)도 §Principle 6 과 일치.
- **`plan/in-progress/impl-details-code-wiring.md` frontmatter** — `spec_impact: none` 이
  bare `none`(리스트 아님) 형태로 올바르며, 이 PR 이 spec 본문을 건드리지 않는 것(선행 PR
  `94e19be8d` 에서 이미 규약화 완료, `origin/main` 조상 확인)과 정합.
- **파일 배치** — `review/code/2026/09/11/{11_05_27,11_33_35,12_00_40}/`,
  `review/consistency/2026/09/11/10_28_52/` 모두 CLAUDE.md 가 정한 nested-ISO
  (`<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`) 구조를 따른다.

## 요약

이번 diff 의 핵심 작업 — `2-api-convention.md §5.3`(2026-09-11 신규 규약화)의 `details[].code`
배선, `botToken` `@MinLength(1)` 보강, 거부 메시지 상수 추출 — 은 명명·출력 포맷·API 문서(Swagger)
규약을 정확하게 따르고 있으며, 검토 과정에서 위반으로 의심됐던 항목들(리터럴 에러코드, DTO
명명, mdx 내부 노출 등)은 전부 실측으로 규약 준수가 확인됐다. 유일한 위반은 `review-citations.md`
§2 를 어긴 신규 bare `hh_mm_ss` 인용 2건으로, 이 저장소가 같은 클래스의 과거 위반을 이미
Warning 등급으로 처분해 온 선례와 정합하게 WARNING 으로 분류한다. 시스템 동작이나 다른 계약을
깨뜨리지 않는 문서 추적성 결함이라 병합을 막을 정도는 아니나, 다음 편집 시 정정을 권한다.

## 위험도

LOW
