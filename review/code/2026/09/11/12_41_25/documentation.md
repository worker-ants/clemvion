# 문서화(Documentation) 코드 리뷰

이 diff(`origin/main` 대비)는 이미 여러 라운드(`11_05_27`→`11_33_35`→`12_00_40`)의 `/ai-review`
를 거친 누적 상태다. 아래는 그 위에서 파일을 직접 열어 재검증한 결과다. 이전 라운드가 이미
발견해 `plan/in-progress/` 에 등재·처분한 항목은 "이미 추적됨"으로 표시하고, 새로 관측한 것만
독립 항목으로 적는다.

## 발견사항

- **[WARNING]** `spec/5-system/15-chat-channel.md` §5.4.1.2 가 이 PR 로 인해 거짓이 되는 명시적
  시한 문장을 여전히 담고 있다 — **이미 추적됨, 조치 불필요(developer 단독 수정 불가)**
  - 위치: `spec/5-system/15-chat-channel.md` §5.4.1.2 절, "그 PR 이 머지되기 전까지 이 문단은
    *"아직 안 실린다"* 를 서술할 뿐 *"싣지 않기로 했다"* 가 아니다" 문장 (해당 spec 파일은 이번
    diff 대상 목록에 없다 — `git diff origin/main --stat -- spec/` 결과 0건)
  - 상세: 직접 `Read` 로 확인했다. 이 문장은 "`chatChannel` 이 없는 트리거에 PATCH 로 붙이려는
    시도"와 "`provider` 변경 시도"의 `details[].code` 가 **현재는 안 실린다**고 서술하며, "뒤따르는
    developer PR" 이 배선을 완료하면 문단을 고쳐야 한다는 전제로 쓰였다. 그런데 이번 diff 의
    `codebase/backend/src/modules/triggers/triggers.service.ts` 가 정확히 그 두 자리
    (`chatChannel`/`provider` 필드 거부)에 `code: ErrorCode.INVALID_FIELD` 를 배선했다 — "그 PR"
    이 바로 이 PR 이다. 병합되는 순간 "두 항목 모두 서비스 가드 갈래라 싣지 않는다" 는 문장이
    거짓이 된다. 같은 절 위 §5.4.1(375행)·§5.4.1.1(회전 행)의 동일 패턴 문장은 이미 "배선 전
    관측값" 이라는 시제-중립 표현으로 고쳐져 있어 병합 시점과 무관하게 참으로 남지만,
    §5.4.1.2 만 시한부 표현이 남아 있다.
  - **developer 가 직접 고칠 수 없다** — 자기-반증형 소정정 조건 1(그 문장을 developer 자신이
    썼는가)이 불성립한다(그 문장은 `#1316` planner 턴이 썼다). 실제로 `plan/in-progress/
    spec-draft-nullable-notation-followups.md` 에 이 항목이 *"planner, 2026-09-11 등재"* 로 이미
    상세히 등록돼 있고(§ 술어 분리 표까지 포함), `plan/in-progress/impl-details-code-wiring.md`
    의 "3라운드 리뷰 처분" 절도 같은 결론(§5.4.1.2 는 planner 필수, 나머지 2곳은 일관성)에
    도달해 있다.
  - 제안: 이번 PR 을 막을 사유 아님(3라운드 연속 동일 판단, 정상 절차). 다음 세션이 "이미
    해결됐다"고 오독하지 않도록 WARNING 을 남긴다 — 실제 조치는 planner 턴에서 §5.4.1.2 를
    §5.4.1/§5.4.1.1 과 같은 시제-중립 패턴으로 고치는 것.

- **[INFO]** e2e 파일 상단 주석의 "축(axis)" 서술이 스스로의 스코프 한정 문장과 미묘하게
  긴장한다
  - 위치: `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts` 파일 최상단 주석 블록
    (`import` 문 바로 앞, 8줄)
  - 상세: 주석은 "spec `15-chat-channel.md` §5.4.1 이 *"실제 HTTP round-trip 은 아직 e2e 로
    확인하지 않았다"* 고 적었던 축이 바로 이 자리다" 라고 쓰는데, spec 원문의 그 문장은 **PATCH
    엔드포인트의 두 갈래**(비어있지 않은 값 → 파이프/중첩·배열, `null`/`''` → 서비스 가드/flat·
    단일 object)가 실제 HTTP 응답에서 그대로 재현되는지를 가리킨다(`spec/5-system/
    15-chat-channel.md` §5.4.1 표, "토큰 변경 (rotation)" 행). 그런데 이 e2e 파일은 **POST 생성
    경로**의 `inboundSigningPlaintext` 검증 실패만 다루고, 같은 문단 바로 다음 줄에서 스스로
    "커버리지는 POST 생성 경로 전용이고 PATCH 경로의 wire 증거는 아직 없다(후속 항목)" 라고
    명시한다 — 즉 spec 이 콕 집어 말한 PATCH 두-갈래 축은 이 파일이 아직 닫지 못했다. 이 파일이
    실제로 제공하는 것은 "`details[].code` 가 실제 HTTP wire 에 나타난다"는 **더 일반적인**
    증거이지, spec 문장이 가리키는 PATCH 특정 축의 증거는 아니다. 같은 4줄 안에서 자기
    정정("PATCH 증거는 아직 없다")이 바로 이어지므로 실제로 다음 사람을 오도할 위험은 낮지만,
    "바로 이 자리다" 라는 단정은 스코프보다 넓게 읽힌다.
  - 제안: 급하지 않음(주석 자체가 4번째 줄에서 스코프를 좁힌다). 후속 정리 시 "이 자리가 그
    축이다" 대신 "이 자리는 §5.3 규약의 HTTP wire 증거를 처음 제공하지만, spec 이 지목한 PATCH
    두-갈래 축 자체는 아직 POST 전용이라 별도" 로 표현을 분리하면 더 정확하다.

## 확인했으나 문제 없음 (주요 항목 재검증)

- `CHANGELOG.md` 신설 섹션의 정량 주장(`triggers.service.ts` 13곳 + `password.util.ts` 배열
  2곳 = 15자리)을 `grep -c` 로 재확인 — 정확히 일치(13/2).
- `chat-channel-rejection-messages.const.ts` 헤더 주석의 "`Record<>` 로 선언한 이유(양방향 검사,
  종전 `satisfies` 는 편도)" 설명이 실제 타입 선언(`Record<ChatChannelBlockedField, string>`,
  `satisfies` 미사용)과 정확히 일치.
- `password.util.ts` 의 "`common/` 이 `nodes/` 를 import 하는 선례가 0건" 주장을 직접 grep 으로
  재확인 — 0건 맞음. 반대로 `modules/**` 다수(websocket·execution-engine·triggers·
  external-interaction)가 이미 `nodes/core/error-codes` 를 import 하는 선례도 확인 — "층 경계"
  근거가 실측에 부합.
- `chat-channel-config.dto.ts` 의 `swagger.md:315` 매직넘버 인용 → 절 제목 인용 전환: 해당 절
  제목("JSDoc 은 공개 OpenAPI 로 나간다 — 내부 서사를 담지 않는다")이 `spec/conventions/
  swagger.md` 에 실재함을 확인했고, `codebase/` 전체에서 `swagger.md:[0-9]` 형태의 stale
  줄-번호 인용이 0건임을 grep 으로 확인.
- `trigger-dto-validation.spec.ts`/`triggers.service.spec.ts` 신규 `[A]`/`[등가성]`/`[C]` 테스트의
  JSDoc — fixture 판별 근거(길이 분기 vs 종류 분기), 뮤테이션에서 생존한 4자리, "리터럴 복사
  금지" 이유가 모두 실제 코드(공유 상수 참조, `toEqual` 전체 일치)와 일치.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이번 PR 이 새로 추가한 5개
  백로그 항목 — `triggers.mdx`/provider 문서 3곳의 `details.code` 누락, `authConfigId` 의
  top-level+details.code 병기 판정, 서비스 스펙의 pre-existing bare 시각 인용 3건 등 — 을 직접
  대조한 결과 실제 코드/spec 상태와 부합하며, 각 항목에 owner(planner/developer)와 근거
  reviewer 세션 경로가 정확히 달려 있다.
- README·환경변수·API 엔드포인트 신설 없음 — 이번 변경은 기존 에러 응답 payload 에 `code` 키를
  additive 로 배선하고 검증 체인 하나를 강화한 것으로, README/설정 문서 갱신 대상 없음. 사용자
  대상 문서(`triggers.mdx`/`.en.mdx`)는 실제로 영향받는 두 문장(`chatChannel`/`provider` PATCH
  거부)에 대해 한국어·영어 양쪽 동일하게 갱신됐다.

## 요약

핵심 코드 파일(9개)의 JSDoc·인라인 주석·CHANGELOG·spec 인용은 실제 코드 상태와 정확히
일치하며, 정량적 주장(15자리, `common/`→`nodes/` import 선례 0건, `swagger.md` 인용 정정)은
모두 grep/Read 로 직접 재검증됐다. 유일한 실질 항목은 3라운드 연속 carry-over 인
`15-chat-channel.md` §5.4.1.2 의 시한부 문장으로, 이 PR 이 병합되면 거짓이 되지만 developer 가
쓴 문장이 아니라 직접 고칠 권한이 없고 이미 `plan/in-progress/` 두 파일에 상세히 등재·처분돼
있다 — 병합을 막을 사유는 아니며 WARNING 으로 재확인만 한다. 새로 관측한 것은 e2e 상단 주석의
"축" 서술이 자신의 스코프 한정 문장과 미묘하게 긴장한다는 INFO 하나로, 같은 문단 안에서 자기
정정되므로 낮은 우선순위다.

## 위험도

LOW
