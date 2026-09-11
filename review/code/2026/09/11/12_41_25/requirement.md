# 요구사항(Requirement) 코드 리뷰

## 검증 방법

프롬프트 diff(파일 1~11, 이후는 review/plan 산출물이라 요구사항 관점 대상 아님)를 `git diff origin/main..HEAD`
로 실제 소스와 전수 대조했다. 이 브랜치는 `0710021f0`→`9fcce3f47` 5개 커밋 누적(3라운드 `/ai-review` +
1라운드 `consistency-check` 이미 완료)이며, `spec/5-system/2-api-convention.md §5.3`
(`details` 항목이 `field` 를 실으면 `code` 도 싣는다 — 형태 무관, `94e19be8d` 규약화, `origin/main` 에 이미 존재)
과 `spec/5-system/15-chat-channel.md`(R-CC-21·§5.4.1·§5.4.1.2)를 Read 로 열어 line-level 대조했다.
`common/` → `nodes/` import 선례 0건, `validation.pipe.ts` 의 `'INVALID_FIELD'` 리터럴 사용 등 소스 주석의
실측 주장도 grep 으로 직접 재확인했다. 저장소에는 아무것도 쓰지 않았다(`git status --short` 로 확인 —
세션 산출물 디렉터리 외 변경 없음).

## 발견사항

- **[SPEC-DRIFT]** `spec/5-system/15-chat-channel.md` §5.4.1.2 가 *"`details[].code` 는 **현재**
  두 항목(`chatChannel` 필드 존재성·`provider` 불변성) 모두 서비스 가드 갈래라 싣지 않는다"* 라고
  적고 있는데, 이번 PR 이 바로 그 배선을 했다 — 두 필드 모두 이제 `code: ErrorCode.INVALID_FIELD` 를 싣는다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `chatChannel` 필드 거부(`details: { field: 'chatChannel', code: ErrorCode.INVALID_FIELD }`)와 `provider` 불변 거부(`details: { field: 'provider', code: ErrorCode.INVALID_FIELD }`) 두 자리. Spec 쪽 위치: `spec/5-system/15-chat-channel.md` §5.4.1.2 닫는 문단("`details[].code` 는 현재 두 항목 모두...").
  - 상세: 이 spec 문단은 명시적으로 *"그 PR 이 머지되기 전까지 이 문단은 '아직 안 실린다'를 서술할 뿐 '싣지 않기로 했다'가 아니다"* 라고 적어, 뒤따르는 developer PR(=이 PR)이 배선하면 문단이 낡을 것을 스스로 예고하고 있었다. 실측(`triggers.service.spec.ts:3275`대의 `details: { field: 'chatChannel', code: 'INVALID_FIELD' }`, `:3413`대의 `details: { field: 'provider', code: 'INVALID_FIELD' }` 단언, 그리고 `codebase/frontend/src/content/docs/02-nodes/triggers.mdx:429`/`triggers.en.mdx:418` 가 이미 `details.code='INVALID_FIELD'` 로 갱신됨)로 코드와 사용자 문서는 새 상태를 정확히 반영하는데, `15-chat-channel.md` 본문만 "아직 안 싣는다"는 옛 관측값에 머물러 있다 — 코드가 옳고 spec 만 갱신이 안 된 전형적 케이스다. 이미 `plan/in-progress/impl-details-code-wiring.md:207`·`:253`·`:255-256` 이 이 정확한 갭을 "planner PR 대상, §5.4.1.2 를 필수로" 라고 durable 하게 등재해 두었으므로 **신규 미검출 항목은 아니다** — 다만 이번 리뷰 시점까지 spec 파일 자체는 손대지 않은 채로 남아 있어(`git diff origin/main..HEAD -- spec/` 결과 없음) 실제 정정은 아직 집행되지 않았다.
  - 제안: 코드는 유지 — planner 턴에서 `15-chat-channel.md` §5.4.1.2 의 "현재 …싣지 않는다" 문단(및 §5.4.1 표 375·411-416·426행의 "배선 전 관측값" 시제 서술 3곳, plan 문서가 이미 지목한 범위)을 "이제 싣는다"로 갱신한다. 이 developer PR 은 `spec/` 을 직접 고치지 않는 것이 맞다(자기-반증형 소정정 조건 2 — 요구사항/계약 문장이라 예외 대상 아님, planner 위임이 맞는 경로).

- **[WARNING]** `authConfigId` 거부 자리를 두고 소스 주석과 테스트 주석의 판정 확신도가 서로 다르다 — 같은 PR 안에서 "미해결"과 "해결됨(위반 아님)"이 공존한다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `assertAuthConfigInWorkspace` 내부 `AUTH_CONFIG_NOT_FOUND` throw 직전 주석 블록("**이 자리만 top-level 이 도메인 특화 코드다 — §5.3 판정 미해결.**" ~ "이 자리가 그 금지에 걸리는지 자체가 판정 사안이고 그것은 §5.3 을 고치는 planner 결정이다") vs `codebase/backend/src/modules/triggers/triggers.service.spec.ts:710` 부근("§5.3 의 「둘을 겹쳐 쓰지 않는다」를 어기지 않는다(서로 다른 층의 서로 다른 정보다)")
  - 상세: 소스 쪽은 "판정 사안"(미확정, planner 대기)이라고 명시적으로 unresolved 로 적은 반면, 같은 PR 이 함께 넣은 테스트 주석은 확신에 찬 어조로 "어기지 않는다"고 이미 결론이 난 것처럼 적는다. 기능적 버그는 아니고(이 항목 자체는 `plan/in-progress/spec-draft-nullable-notation-followups.md:2336-2354` 에 이미 planner 판정 대기 항목으로 durable 하게 등재돼 있어 유실 위험은 없다), 다만 두 주석의 확신도가 어긋나 있어 `triggers.service.ts` 만 읽는 사람과 `triggers.service.spec.ts` 만 읽는 사람이 이 자리의 상태(확정 vs 미확정)에 대해 서로 다른 결론을 갖게 된다.
  - 제안: 급하지 않음 — 테스트 주석에 "이 판정 자체는 아직 planner 결정 대기(`spec-draft-nullable-notation-followups.md` 참조)"라는 한 문구를 덧붙이거나, 소스 쪽 주석을 인용하는 정도로 다음 라운드에 정리하면 충분하다. 코드 동작 변경 불필요.

- **[INFO]** `botToken` 공백 전용 문자열(`'   '`)은 여전히 통과한다 — 이미 코드·CHANGELOG·테스트 주석 3곳 모두 명시적으로 스코프 아웃했음을 확인.
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`(`@MinLength(1)` 데코레이터, `botToken` 필드) — `chat-channel-config.dto.ts` 해당 자리 위 주석 및 `trigger-dto-validation.spec.ts` `[C]` 테스트 JSDoc, `CHANGELOG.md` 의 "공백 전용 문자열은 아직 안 막힌다" 단락.
  - 상세: `@MinLength(1)` 은 길이만 검사하므로 `'   '.length === 3` 이 통과해 `SecretResolver.rotate` 로 공백 시크릿이 저장될 수 있다 — CHANGELOG 에서 고쳤다고 주장하는 결함(빈 문자열이 시크릿을 먼저 저장)의 변형이 부분적으로 남는다. 다만 CHANGELOG·DTO 주석·테스트 JSDoc 세 곳이 모두 이 경계를 "trim 정책은 별개 결정" 이라고 일관되게 밝혀 두었고 과장된 해결 주장("빈 문자열 문제가 전부 닫혔다")도 스스로 부정하고 있어, 의도와 구현 간 괴리(관점 4)는 없다 — 정직하게 스코프를 좁힌 케이스다.
  - 제안: 조치 불필요, 후속 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 5 "공백 전용 trim")에 이미 등재됨을 재확인.

## 검증한 항목(발견 없음 — spec fidelity 핵심 축)

- `2-api-convention.md §5.3` "field 를 실으면 code 도 싣는다" — 15자리(`triggers.service.ts` 13곳 객체·`password.util.ts` 2곳 배열) 전부 배선 확인, `grep -c` 로 개수 일치 확인(13+2=15, CHANGELOG 서술과 일치).
- "field 없는 진단 payload 는 대상이 아니다" 카브아웃 — `triggers.service.ts:1626/1632` 의 `details: { reason }` 두 자리는 실제로 손대지 않은 채 남아 있음을 grep 으로 확인. §5.3 의 "둘을 겹쳐 쓰지 않는다"를 스스로 위반하지 않음.
- `common/` 이 `nodes/` 를 import 하는 선례 0건, `validation.pipe.ts` 가 `'INVALID_FIELD'` 리터럴을 쓴다는 `password.util.ts` 주석의 실측 주장 — 둘 다 grep 으로 재확인, 참.
- `ErrorCode.INVALID_FIELD === 'INVALID_FIELD'` (`nodes/core/error-codes.ts:116`) — `triggers.service.ts` 의 상수 사용이 §5.3 이 요구하는 문자열 값과 정확히 일치.
- `ChatChannelUpdateConfigDto` 의 `OmitType(['botToken', 'inboundSigningPlaintext'])` 이 부모의 `@MinLength(1)`/`@IsString()` 을 실제로 제거하고 `@IsEmpty()` 로 재선언함을 확인 — PATCH 경로에서 `''`/`null` 이 여전히 통과해야 한다는 스펙 요구(§5.4.1 표 2번째 갈래)와 일치, `[C]` 테스트가 반대 방향(생성 경로 거부) 캐너리 역할을 정확히 수행.
- TODO/FIXME/HACK/XXX 마커: `git diff origin/main..HEAD -- codebase/` 전수 grep 0건.
- 반환값/에러 흐름: 모든 신규·수정 throw 경로가 `BadRequestException` 을 명시적으로 던지고, 정상 경로는 기존 흐름 그대로 유지 — 관측된 경로 누락 없음.
- 이전 라운드(`11_05_27`)가 지적했던 `it.each` fixture 5-tuple 중복(maintainability WARNING)은 이번 diff 시점 `triggers.service.spec.ts` 에서 `BLOCKED_FIELD_CASES` 단일 상수로 이미 통합되어 있음을 실제 소스에서 확인 — stale 지적이며 재발 아님.

## 요약

이 PR 은 이미 `origin/main` 에 규약화된 `2-api-convention.md §5.3`("`field` 를 실으면 `code` 도 싣는다")을
15개 발행 지점에 line-level 로 정확히 배선하고, `botToken` 의 선언(`minLength: 1`)과 구현(검증 체인) 간극을
`@MinLength(1)` 로 닫았으며, 5쌍의 거부 메시지를 상수화해 두 층(DTO 파이프·서비스 가드) 등가성을 컴파일 타임으로
고정했다 — 뮤테이션 테스트로 15자리 전부 개별 회귀 캐너리를 확인한 흔적이 plan 문서에 남아 있고 실제 코드에서도
`toEqual`/`toMatchObject` 강도 차이를 의식한 정밀한 단언이 확인된다. 유일하게 실질적인 spec 불일치는
`15-chat-channel.md §5.4.1.2` 가 이번 PR 로 배선된 `chatChannel`/`provider` 두 자리를 여전히 "아직 안 싣는다"로
서술하는 SPEC-DRIFT 인데, 이는 그 문단 스스로가 예고했던 "뒤따르는 developer PR" 이 바로 이 PR 임을 뜻하며
`plan/in-progress/impl-details-code-wiring.md` 에 planner 후속 작업으로 이미 durable 하게 등재돼 있어 유실
위험은 낮다. `authConfigId` 자리의 top-level 특화 코드 + generic `details.code` 병기는 이미 3라운드에 걸쳐
검토·등재·소스 주석 보강이 끝난 기지(旣知) 항목이며, 이번 라운드에서 새로 발견한 것은 그 자리를 설명하는 테스트
주석의 확신도가 소스 주석보다 앞서 있다는 사소한 문서 불일치뿐이다. 공백 전용 `botToken` 미차단은 코드·문서·테스트
세 곳이 일관되게 스코프 아웃을 명시해 의도-구현 괴리가 아니다. 전반적으로 기능 완전성·에러 시나리오·spec 정합성
모두 높은 수준이며, 남은 항목은 모두 planner/후속 트래커로 적절히 위임돼 있다.

## 위험도

LOW
