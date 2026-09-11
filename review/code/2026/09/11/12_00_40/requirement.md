# 요구사항(Requirement) 리뷰 — impl-details-code-wiring (3커밋: `0710021f0`+`0fb691248`+`2d0270fbd`)

## 검증 방법

`git diff origin/main --stat` 로 diff 50개 파일(코드 9 + 문서 2 + plan 1 + 리뷰 산출물 38)을 확인하고,
프롬프트에서 잘린 `triggers.service.ts`/`triggers.service.spec.ts`/`plan/in-progress/impl-details-code-wiring.md`
는 `git diff origin/main -- <path>` 로 전문을 직접 열어 대조했다. `grep -n "field:"` 로
`triggers.service.ts` 전체(13곳 + `endpoint_path` 도메인 코드 1곳 제외 대상)와 `password.util.ts`(2곳)를
전수 확인해 15자리 배선이 diff·CHANGELOG·plan 서술과 정확히 일치함을 재현했다. `assertAuthConfigInWorkspace`
자리는 top-level 특화 코드(`AUTH_CONFIG_NOT_FOUND`)와 `details.code` 동시 존재가 §5.3 "둘을 겹쳐 쓰지
않는다" 원칙과 충돌하는지 `spec/5-system/2-api-convention.md §5.3`·`spec/5-system/3-error-handling.md`
(`TRIGGER_ENDPOINT_PATH_CONFLICT` 대조 사례)를 Read 로 직접 대조해 판정했다. `spec/5-system/15-chat-channel.md`
§5.4.1(375행)·§5.4.1.1(426행)·§5.4.1.2(391-416행) 세 자리를 전부 Read 로 열어 "배선 전 관측값" 문구의
현재 상태를 실측했다(단순 신뢰 아님). `MinLength` import 존재, `OmitType(['botToken', 'inboundSigningPlaintext'])`
가 실제로 부모 데코레이터를 제거하는지 소스로 직접 확인했다. 저장소에 뮤테이션을 가하지 않았다 —
`git status --short` 는 이 리뷰 세션 산출물(`review/code/2026/09/11/12_00_40/`) 외 변경 없음.

## 발견사항

- **[WARNING]** `[SPEC-DRIFT]` `spec/5-system/15-chat-channel.md` §5.4.1.2 가 여전히 *"`details[].code`
  는 **현재** 두 항목(`chatChannel`/`provider`) 모두 서비스 가드 갈래라 싣지 않는다 … 배선은
  **뒤따르는 developer PR** 이 한다. 그 PR 이 머지되기 전까지 이 문단은 '아직 안 실린다'를 서술할 뿐
  '싣지 않기로 했다' 가 아니다"* 라고 서술하는데, 바로 이 diff(`triggers.service.ts:734,745` —
  `chatChannel`·`provider` 거부에 `code: ErrorCode.INVALID_FIELD` 배선)가 정확히 그 두 필드를
  배선한다. 코드는 spec 이 스스로 선언한 계약값(`INVALID_FIELD`)을 정확히 구현했으므로 **코드는
  옳다** — 문제는 spec 문단의 시제뿐이다. 같은 절 §5.4.1(375행)·§5.4.1.1(426행)은 이미 "위 「`code`
  없음」은 **배선 전 관측값**이다" 로 시제-중립 정정이 돼 있는데(직접 grep 재확인, 2건), §5.4.1.2 만
  옛 문구("뒤따르는 developer PR")가 남아 있다.
  - 위치: `spec/5-system/15-chat-channel.md:411-416` (§5.4.1.2)
  - 상세: `plan/in-progress/impl-details-code-wiring.md` 의 1라운드(`11_05_27`)·2라운드(`11_33_35`)
    처분 표(W1) 둘 다 이 항목을 발견하고 "planner 턴으로 분리 — 자기-반증형 소정정 조건 1 불성립
    (그 문장은 `#1316` planner 턴이 썼다, 역할은 blame 이 아니라 diff 스코프·게이트·plan owner)"
    으로 정확히 처분했다 — developer 가 spec 을 직접 고치지 않은 것은 규약 준수다. 2라운드에서
    "세 자리 전부인가 §5.4.1.2 하나만인가"를 reviewer 간에 다르게 보고해 plan 이 직접 실측해
    "전부 미정정(→documentation 판단이 맞음)" 이라 결론 냈는데, 이번 3라운드 시점에 직접 재확인한
    결과 **§5.4.1·§5.4.1.1(375·426행) 두 곳은 이미 정정 완료, §5.4.1.2(411-416행) 한 곳만 잔존**
    — 두 번째 커밋(`2d0270fbd`, "docs(user-guide)")은 `triggers.mdx`/`triggers.en.mdx` 만 갱신했고
    `spec/5-system/15-chat-channel.md` 는 이번 diff 3커밋 어디에도 포함되지 않았다(`git diff
    origin/main --stat` 로 확인). planner PR 이 아직 착지하지 않았다는 뜻이다.
  - 제안: 코드는 유지. `spec/5-system/15-chat-channel.md` §5.4.1.2(411-416행)를 §5.4.1/§5.4.1.1 과
    동일한 패턴("배선 전 관측값 → 2026-09-11 이 PR 로 배선 완료, 두 필드 모두 `code:
    'INVALID_FIELD'`")으로 정정하는 project-planner 턴이 여전히 필요하다. plan 체크리스트의
    "`/ai-review` + `--impl-done`" 항목(미체크)이 이 gap 을 놓치지 않도록, `--impl-done` 실행 전에
    planner PR 착지 여부를 재확인할 것을 권장.

- **[INFO]** `assertAuthConfigInWorkspace`(`triggers.service.ts:1000-1014`)의 `authConfigId` 거부가
  top-level 특화 코드(`AUTH_CONFIG_NOT_FOUND`, 400 기본값 `VALIDATION_ERROR` 를 교체)와
  `details: { field: 'authConfigId', code: 'INVALID_FIELD' }` 를 **동시에** 낸다 — §5.3 택일
  기준표의 "top-level 코드 교체" 갈래(사유가 엔드포인트 결과 자체, 소비자가 code 하나로 분기)에
  해당하는데 `details[].code` 도 함께 실렸다. 실제 선례(`TRIGGER_ENDPOINT_PATH_CONFLICT`,
  `spec/5-system/3-error-handling.md:234`)는 반대 패턴이다 — **top-level 은 상태 기본값
  (`RESOURCE_CONFLICT`) 을 유지**하고 세부 사유만 `details.code` 에 싣는다. `authConfigId` 는
  top-level 자체가 이미 특화됐다는 점에서 그 선례와 모양이 다르다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1008-1012`
  - 상세: 다만 §5.3 의 "둘을 겹쳐 쓰지 않는다" 문구는 "**같은 사유**를 details[].code 에도 넣으면"
    이라 적는다 — 여기 실린 `INVALID_FIELD` 는 top-level `AUTH_CONFIG_NOT_FOUND` 와 **다른 값**
    (generic 마커 vs 특화 사유)이라 문자 그대로는 "같은 사유 중복"이 아니다. 이 PR 이 새로 추가한
    `triggers.service.spec.ts:715-716` 테스트 주석이 정확히 이 판단("top-level 은 도메인 코드를
    쓰고 details 는 어느 필드가 문제인지 + generic 사유를 싣는다 — §5.3 을 어기지 않는다, 서로
    다른 층의 서로 다른 정보다")을 명시적으로 남겨, 우발적 누락이 아니라 뮤테이션 검증
    (plan L86-101: 이 자리가 1차에서 `details` 미단언으로 생존했다가 보강된 이력)까지 거친 의도된
    선택임을 확인했다. 스펙 문면이 "top-level 교체" 갈래와 "field 있으면 code 필수" 규칙 사이의
    이 조합 케이스를 명시적으로 다루지 않아 해석의 여지가 남는 것이지, 코드 결함으로 보기는
    어렵다.
  - 제안: 처분 불요 — 다만 `2-api-convention.md §5.3` 이 향후 개정될 때 "top-level 이 이미
    특화 코드인 경우에도 details[].code 를 별도(generic) 값으로 병기할 수 있다"는 이 케이스를
    예시로 명문화하면 다음 발행 지점(top-level 특화 + field 존재)의 판단 비용을 줄일 수 있다는
    참고용 기록.

- **[INFO]** `AUTH_CONFIG_NOT_FOUND` 코드 자체가 `spec/5-system/3-error-handling.md` §1 카탈로그·
  `spec/conventions/error-codes.md` 어디에도 등재돼 있지 않다(grep 0건) — §5.3 이 "어느 쪽을
  택하든 §1 카탈로그에 등재한다" 라고 명시한 요구와 어긋난다. 다만 이 top-level 코드 자체는
  이번 PR 이 만든 것이 아니라 기존 코드(diff 는 `details.code` 필드만 추가)이므로 이번 PR 의
  범위 밖 pre-existing 갭이다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1009`
  - 제안: 이번 PR 을 막을 사안 아님. 후속 트래커 항목으로 등재를 검토할 만하다.

## 관점별 확인 결과

1. **기능 완전성** — `details[].code` 배선 15자리(`triggers.service.ts` 13 + `password.util.ts` 2)를
   `grep -n "field:"` 전수 재현으로 확인, diff·CHANGELOG·plan "15자리" 서술과 정확히 일치. `field`
   없는 6곳(`{ reason }` 2곳 직접 확인)과 도메인 코드 보유 자리(`rethrowEndpointPathConflict`,
   `:1852` `endpoint_path`)는 의도대로 미변경. 완전하다.
2. **엣지 케이스** — `botToken: ''`(생성 경로, `[C]` 테스트)·`null`/`''`(PATCH, 서비스 가드 flat
   경로, 기존 `[실측]` 케이스) 양쪽 커버. `inboundSigningPlaintext` 소스 자리 5곳(707/799/817/832/844)
   각각 개별 `code` 배선을 직접 확인. `OmitType(['botToken', 'inboundSigningPlaintext'])` 가 부모의
   `@MinLength(1)`/`@IsString()`/`@MaxLength(256)` 를 실제로 제거하고 `@IsEmpty()` 로 재선언함을
   소스에서 직접 확인 — PATCH 의 `''` 허용과 POST 의 `''` 거부가 충돌하지 않는다.
3. **TODO/FIXME** — 신규 diff(`codebase/`)에 TODO/FIXME/HACK/XXX 없음.
4. **의도와 구현 간 괴리** — 없음. `chat-channel-rejection-messages.const.ts` 의 "왜 상수인가"
   설명(등가성, DRY 아님)과 실제 사용처(DTO 3곳 + PATCH DTO 2곳 + 서비스 5곳)가 일치. 헤더 주석의
   테스트 위치 인용도 실제 `[등가성]` 테스트 소재지와 일치.
5. **에러 시나리오** — 각 신규 자리가 `BadRequestException({code, message, details})` 형태 유지,
   top-level 상태 기본값(`VALIDATION_ERROR`)과 `details[].code`(`INVALID_FIELD`) 를 겹쳐 쓰지
   않는 §5.3 원칙을 대다수 준수. 유일하게 `authConfigId`(top-level 특화 코드 + details.code 병기)가
   해석의 여지가 있는 조합이나(위 INFO), 코드에 명시적 근거·테스트가 있어 결함으로 보지 않았다.
6. **데이터 유효성** — `botToken` 의 `@ApiProperty({ minLength: 1 })` 선언과 검증 체인
   (`@MinLength(1)`) 불일치가 이 PR 로 해소됐다 — "선언이 구현보다 넓던" 결함의 정당한 정정.
7. **비즈니스 로직** — R-CC-21 5필드 거부 로직·PATCH vs POST 분기·Schedule 타입 트리거의
   `disallowed` 필드 목록에 동작 변경 없음(D 는 메시지 리터럴 상수 이동만, 등가성 테스트로 바이트
   동일성 고정). `2-trigger-list.md:178` 의 `details.field='type'` 서술과도 일치.
8. **반환값** — `validatePasswordStrength` 는 void 로 모든 실패 경로에서 예외를 던지고 통과 시
   무반환 — 기존 계약 유지. 서비스 가드 메서드들도 전부 예외 또는 무반환으로 회귀 없음.
9. **spec fidelity** — `2-api-convention.md §5.3`(2026-09-11 규약, `94e19be8d`)의 "field 있으면
   code 필수, 형태 무관" 규칙과 15자리 전부 line-level 로 일치. `15-chat-channel.md` R-CC-21·
   §5.4.1(375)·§5.4.1.1(426) 은 이미 시제 중립으로 정정돼 코드와 일치하나, **§5.4.1.2(411-416)
   만 "배선 대기" 옛 문구가 남아 SPEC-DRIFT(WARNING, 위 참조)** — 이 PR 자체의 diff 에
   `spec/5-system/15-chat-channel.md` 가 포함되지 않아 미해소 상태로 유지된다. `2-trigger-list.md`
   의 관련 서술과도 상충 없음.

## 요약

`details[].code` 배선 15자리 전수, `botToken` `@MinLength(1)`, 거부 메시지 5쌍의 상수화가 diff·grep
재현·spec(`2-api-convention.md §5.3`, `15-chat-channel.md` R-CC-21/§5.4.1/§5.4.1.1)과 line-level 로
일치했다. TODO/FIXME 없음, 반환값·에러 시나리오·엣지 케이스 처리 모두 정상이며 뮤테이션 검증
(1차 4자리 생존 → 단언 보강 → 15/15 개별 RED, plan 기록)까지 거쳐 판별력 있는 테스트가 각 변경
지점을 개별적으로 고정한다. 유일한 실질 미해소 발견은 `15-chat-channel.md §5.4.1.2` 가 "이 PR
이 머지되기 전까지" 라는 시제로 `chatChannel`/`provider` 의 `code` 미배선을 서술하는데, 정작 이
PR 이 그 배선을 포함해 세 커밋 모두 머지되도록 준비된 상태인데도 해당 문단만 정정되지 않은
SPEC-DRIFT(WARNING) — 두 차례 이전 리뷰 라운드가 이미 지적했고 plan 이 "planner PR 대상"으로
정확히 분리·추적하고 있으나, 그 planner PR 이 아직 착지하지 않았다. 코드는 spec 이 선언한 계약값을
정확히 구현했으므로 되돌릴 사안이 아니라 spec 문단의 시제 정정이 필요하다. 부수적으로
`authConfigId` 거부의 top-level 특화 코드 + `details.code` 병기 조합은 §5.3 "둘을 겹쳐 쓰지
않는다" 원칙의 해석 여지가 있는 경계 사례이나, 코드에 근거 주석과 뮤테이션 검증된 테스트가 있어
결함이 아니라 INFO 로 기록한다.

## 위험도

LOW
