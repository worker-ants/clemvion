# 문서화(Documentation) 리뷰 — `details[].code` 배선 + 리뷰 WARNING 4건 반영 (fix-up 커밋 포함)

이 diff 는 origin/main 대비 커밋 2개(`0710021f0` 최초 구현, `0fb691248` 직전 `/ai-review`
`11_05_27` WARNING 4건 반영)를 함께 담고 있고, 그 리뷰 라운드(`11_05_27`)와 그 이전
consistency-check(`10_28_52`) 산출물도 diff 에 포함돼 있다. 아래는 그 review 산출물이
지적한 문서화 항목들이 실제로 얼마나 반영됐는지 직접 코드를 열어 재검증한 결과다.

## 발견사항

- **[WARNING]** `spec/5-system/15-chat-channel.md` 3곳이 여전히 "배선 전" 시제를 유지한다 —
  바로 이 PR 이 그 배선을 완료했는데도 spec 파일은 diff 에 없다 (carry-over, 미해소)
  - 위치: `spec/5-system/15-chat-channel.md` §5.4.1 "토큰 변경 (rotation)" 행, §5.4.1.1
    "회전 (rotation)" 행, §5.4.1.2 마지막 문단 — 함수/블록명 특정 불가한 산문이라 절 제목으로
    기재. (이 diff 에 해당 spec 파일이 포함돼 있지 않아 게이트 숫자 없음.)
  - 상세: 세 자리 모두 *"`details[].code` 는 **현재** … 서비스 가드 갈래라 싣지 않는다 …
    배선은 뒤따르는 developer PR 이 한다. 그 PR 이 머지되기 전까지 이 문단은 '아직 안 실린다'를
    서술할 뿐 '싣지 않기로 했다'가 아니다"* 라고 적혀 있다. 그런데 실제로 `triggers.service.ts`
    diff 는 `botTokenRef`·`inboundSigningRef`·`inboundSigning`·`botToken`·
    `inboundSigningPlaintext`(5곳 전부, `inboundSigningPlaintext` 는 5개 하위 분기 전부) 서비스
    가드 throw 자리에 `code: ErrorCode.INVALID_FIELD` 를 실측 확인했다(`grep -n
    "ErrorCode\.INVALID_FIELD" triggers.service.ts` → 13곳). "뒤따르는 developer PR" 이 바로 이
    PR 인데, spec 문단은 여전히 "아직 안 실린다"를 서술한다 — 머지 후 그 문장은 거짓이 된다.
    **이것은 이 PR 이 새로 만든 결함이 아니다** — 직전 `/ai-review` `11_05_27` 라운드에서
    requirement·documentation 두 reviewer 가 독립적으로 지적했고(`review/code/2026/09/11/
    11_05_27/requirement.md`, `documentation.md`), `0fb691248` 커밋 본문("## W1 (SPEC-DRIFT) 은
    이 PR 에서 못 닫는다 — planner 턴이다")과 `plan/in-progress/impl-details-code-wiring.md:184`
    (`W1` 행)에 **정확히 이 상태로 정직하게 남겨져** 있다 — 자기-반증형 소정정 조건 1(그 문장을
    developer 자신이 쓴 게 아니라 `#1316` planner 턴이 썼다)이 성립하지 않아 developer 가
    직접 고칠 권한이 없다는 근거도 정확하다.
  - 제안: 이번 PR 을 막을 사유는 아니다(이미 알려져 있고, 두 PR 분리 규약대로 처리 중). planner
    턴이 세 자리를 "배선 전 관측값 → 2026-09-11 배선 완료, 두 갈래 모두
    `code: 'INVALID_FIELD'`" 로 정정할 때까지 이 항목을 살아있는 트래커로 유지할 것. WARNING 으로
    남기는 이유는 spec 이 실제로 stale 한 채 push 될 것이기 때문 — 등급을 낮추면 다음 세션이
    "이미 해결됐다"고 오독할 위험이 있다.

- **[INFO]** `chat-channel-config.dto.ts` 의 공개 Swagger JSDoc(`botTokenRef` 등)이 이제 두 층
  모두에서 안정된 계약이 된 `details[].code` 를 여전히 언급하지 않는다 (carry-over, 미해소·
  의도적으로 낮은 우선순위)
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` — `botTokenRef`
    필드의 `/** */` JSDoc 블록(`외부 입력 금지 — [Spec Chat Channel §5.4.1 single-path]...`으로
    시작, `@ApiPropertyOptional` 바로 위)
  - 상세: 직접 `Read` 로 현재 파일을 열어 확인했다 — 이 JSDoc 은 "`details.field='chatChannel.
    botTokenRef'`(비어있지 않은 값) / `null`·`''` 는 flat `'botTokenRef'`" 처럼 두 갈래의 `field`
    shape 차이는 정확히 서술하지만 `code` 는 언급하지 않는다. 이 블록은 파일 하단 주석이 명시하는
    대로(`introspectComments` 로 공개 OpenAPI `description` 에 그대로 실리는 자리) 이므로, 외부에
    노출되는 문서에는 "안정적으로 존재하는데 문서화 안 된 필드"가 하나 남는다. `botToken`
    필드에는 `code` 를 설명하는 `//` 내부 서사 주석이 있지만 그건 공개 JSDoc 이 아니라 의도적으로
    분리된 "내부 서사"(같은 파일 368행 주석 규율 참조)다. 사실이 틀린 것은 아니라 CRITICAL/WARNING
    이 아니라 INFO — 이전 라운드(`11_05_27/documentation.md`)에서도 같은 항목이 INFO 로 났고,
    fix-up 커밋(`0fb691248`)이 반영한 4건(W2·W3·W4·W5)에 이 항목은 포함되지 않아 그대로 남았다.
  - 제안: 여유 있을 때 "두 갈래 모두 `details[].code='INVALID_FIELD'` 를 함께 싣는다" 한 문장
    추가. 차단 사유 아님.

## 확인했으나 문제 없음 (직전 라운드 WARNING 4건의 반영 여부 재검증)

직전 `/ai-review` `11_05_27` 라운드가 낸 WARNING 5건 중 코드/문서 4건이 `0fb691248` 커밋으로
반영됐다고 커밋 본문이 주장한다. 실제 파일을 열어 하나씩 재검증했다:

- **(구 WARNING #2, CHANGELOG 누락)** — **해소 확인.** `CHANGELOG.md` 상단에 `## Unreleased —
  거부 사유가 사람만 읽을 수 있었다 …` 섹션이 신설됐고, 이 저장소의 기존 관례(반복되는
  `## Unreleased — <한 줄 요약>` H2 패턴, `grep -n "^## Unreleased" CHANGELOG.md` 로 기존 9건과
  형식 일치 확인)와 정확히 같은 구조를 따른다. 두 동작 변경(payload `code` 추가, `botToken`
  빈 문자열 거부)과 뮤테이션에서 4자리가 생존했던 사실까지 담았다.
- **(구 WARNING #4, 상수 파일 헤더가 존재하지 않는 spec 파일 인용)** — **해소 확인.**
  `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` 헤더 주석을
  직접 열어 확인했다 — "전용 spec 파일은 없다"고 명시하고, 실제 두 단언 위치
  (`trigger-dto-validation.spec.ts` 파이프 층 / `triggers.service.spec.ts` 서비스 층)를
  정확히 지목한다. 존재하지 않는 파일 인용은 남아 있지 않다.
- **(구 WARNING 관련, `swagger.md:315` 매직넘버 인용)** — **해소 확인.**
  `chat-channel-config.dto.ts:370` 부근 주석이 줄 번호 대신 절 제목(「JSDoc 은 공개 OpenAPI 로
  나간다 — 내부 서사를 담지 않는다」)을 인용하도록 바뀌었고, `spec/conventions/swagger.md` 를
  직접 grep 해 그 절 제목이 정확히(333행) 존재함을 확인했다. 이 저장소가 이미 학습한 "정적
  줄-번호 인용은 다음 편집에 깨진다" 교훈이 실천됐다.
- **(구 WARNING #5, `it.each` fixture 완전 중복)** — **해소 확인, 문서화 품질도 개선.**
  `triggers.service.spec.ts` 를 열어 확인했다 — `BLOCKED_FIELD_CASES` 상수 하나로 통합됐고,
  그 바로 위 JSDoc 이 "왜 중복 제거만으로 안 닫히는가"(손으로 적은 목록이라 6번째 필드 추가 시
  조용히 누락될 수 있음)를 설명한 뒤, 실제로 `CHAT_CHANNEL_BLOCKED_FIELDS` 와의 집합 일치를
  단언하는 전용 테스트(`[A] fixture 가 차단 5필드 전체를 덮는다`)를 신설해 그 갈래까지 막았다 —
  "왜"를 설명하는 데서 그치지 않고 그 설명이 요구하는 후속 방어까지 실제로 존재한다.
- **(구 INFO, e2e 5곳 동일 주석 반복)** — **해소 확인.** `chat-channel-trigger-create.e2e-spec.ts`
  상단에 배경 설명이 한 번만 실리고, 각 `it()` 자리에는 "`details.code` 는 wire 증거다 — 파일
  상단 주석 참조" 짧은 앵커만 남도록 정리됐다.
- **(신규 검증) `password.util.ts` "왜 canonical `ErrorCode` 를 안 쓰는가" 주석의 수치 근거** —
  "실측"이라 표기된 수치를 grep 으로 직접 재현했다. 주석·plan(`W3` 행)이 "9개 모듈/9곳" 이라
  적은 근거는 `grep -rl "nodes/core/error-codes'" codebase/backend/src/modules/` 결과에서
  `.spec.ts` 를 제외한 파일 수(정확히 9개: `execution-engine` 4 · `executions` 2 ·
  `external-interaction` 1 · `triggers` 1 · `websocket` 1)와 정확히 일치했다. "`common/` → `nodes/`
  선례 0건" 도 같은 방식으로 재현해 0건임을 확인했다. 층을 갈라 적용한다는 아키텍처 결정의 근거
  수치가 부풀려지거나 축소되지 않았다.

## 요약

이번 diff(원 구현 `0710021f0` + 리뷰 반영 `0fb691248`)는 직전 `/ai-review` 라운드가 낸 문서화
관련 WARNING·INFO 대부분을 실제로 코드에 반영했고, 그 반영 내용을 파일을 직접 열어 재검증한
결과 커밋 메시지의 주장과 실제 코드 상태가 일치했다(CHANGELOG 신설, 존재하지 않는 spec 파일
인용 정정, 매직넘버 줄-번호 인용 → 절 제목 전환, fixture 중복 제거 + 집합-커버리지 단언 신설,
e2e 주석 중복 정리, "9개 모듈" 수치 근거 재현). 유일하게 남은 실질 항목은 이미 알려져 있고
정직하게 트래킹되는 SPEC-DRIFT 다 — `spec/5-system/15-chat-channel.md` 3곳의 "배선 전" 시제가
이 PR 로 stale 해지는데, developer 는 그 문장을 쓴 당사자가 아니라(자기-반증형 소정정 조건 1
불성립) planner 턴을 기다려야 한다. 코드를 되돌릴 사안이 아니라 spec 문서 정정이 필요한
것이므로 WARNING 으로 유지하되 이번 PR 의 병합을 막을 사유는 아니다. 그 외 DTO 공개 JSDoc 의
`details[].code` 미언급은 완전성 수준의 INFO 로 우선순위가 낮다. README·설정 문서·예제 코드
갱신은 이번 변경 범위(내부 에러 코드 배선·검증 강화·상수화)에 새 기능·환경변수·엔드포인트가
없어 해당 없음이다.

## 위험도

LOW
