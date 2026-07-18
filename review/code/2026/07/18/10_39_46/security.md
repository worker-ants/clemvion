# 보안(Security) 코드 리뷰

## 대상
- `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`
- `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts`
- `codebase/backend/src/nodes/core/assert-end-reason-domain.type-fixture.ts` (신규)
- `codebase/backend/src/nodes/core/node-handler.interface.ts`
- `codebase/packages/ai-end-reason/README.md`
- `codebase/packages/ai-end-reason/src/index.ts`
- `plan/in-progress/resumable-handler-generic-typing.md`
- `review/code/2026/07/17/22_58_45/*` (직전 리뷰 세션 산출물 — RESOLUTION.md, SUMMARY.md, 각 리뷰어 리포트, 상태 JSON)

## 변경 성격

전신 PR(#968 후속, `0aa8b83f6` 커밋)에 대한 `/ai-review` WARNING 4건 fix 반영본이다.
`ResumableNodeHandler<TEndReason>` 제네릭화 + `AssertEndReasonDomain` / `UniversalEndReason`
컴파일 타임 단언이라는 골격은 직전 세션(`review/code/2026/07/17/22_58_45/security.md`)에서
이미 위험도 NONE 으로 판정된 것과 동일하며, 금번 diff 의 실질 추가분은:

1. `assert-end-reason-domain.type-fixture.ts` 신규 — `AssertEndReasonDomain` 의 좁히기/넓히기
   위반을 거부하는지 확인하는 **컴파일 타임 전용** 회귀 fixture. `describe`/`it` 없음, 어떤
   프로덕션 모듈도 import 하지 않음, `tsc` 가 타입만 검사하고 소거(erase)한다 — 런타임 코드
   경로가 전혀 없다.
2. `node-handler.interface.ts` / 두 핸들러 파일의 JSDoc 축약(SoT 를 `AssertEndReasonDomain`
   docblock 한 곳으로 통합) — 주석 텍스트만 변경, 타입·런타임 로직 무변경.
3. `ai-end-reason/README.md` 에 `UniversalEndReason` export 항목 추가 — 문서 텍스트만 변경.
4. `plan/in-progress/*.md`, `review/code/2026/07/17/22_58_45/*` — 작업 추적/리뷰 산출물 문서·
   JSON 상태 파일. 코드 실행 경로와 무관.

`execute` / `processMultiTurnMessage` / `endMultiTurnConversation` / `buildMultiTurnFinalOutput`
등 런타임 로직 본문은 이번 diff 에서도 단 한 줄도 변경되지 않았다. `_endReasonDomainLock` /
`_universalNonEmpty` 와 신규 fixture 의 `_narrowingViolationIsRejected` /
`_wideningViolationIsRejected` / `_exactMatchIsAccepted` 상수는 모두 리터럴 대입 +
`void` 로 즉시 폐기되는 no-op 이며, 조건부 타입이 `never` 로 붕괴하면 컴파일 자체가
실패하는 구조라 런타임 분기·값에 영향을 주지 않는다.

## 발견사항

리뷰 관점 8개 항목(인젝션, 하드코딩 시크릿, 인증/인가, 입력 검증, OWASP Top 10, 암호화,
에러 처리, 의존성 보안) 전체에 대해 점검했으며, 이번 변경 범위 내에서 보안 관련 발견사항 없음.

- **인젝션**: 신규 사용자 입력 처리 경로 없음. `endReason` 파라미터의 타입 도메인만
  노드별로 좁아지고, 실제 런타임 값 생산·소비 로직(`portForEndReason`, `default: 'error'`
  런타임 방어, LLM 응답 `JSON.parse` 등)은 그대로다. 신규 fixture 의 더미 클래스
  (`NarrowingViolationHandler` 등)는 `Record<string, unknown>`/리터럴 유니온만 다루는
  순수 타입 예시로, 어떤 문자열도 실행·평가·직렬화되지 않는다.
- **하드코딩된 시크릿**: 신규 시크릿·자격증명·API 키·토큰 없음(코드·문서·JSON 상태 파일
  전수 확인, 커밋 SHA·테스트 로그 경로만 등장).
- **인증/인가**: 인증/인가 검사 로직 변경 없음 — `ExecutionContext`, `NodeHandler` 등
  기존 인터페이스 필드는 무변경이며 신규 필드도 추가되지 않았다.
- **입력 검증**: 새 사용자 입력 검증/새니타이징 대상 없음. `AssertEndReasonDomain` 이
  잠그는 것은 "구현체가 선언한 타입 도메인 == 실제 파라미터 타입"이라는 **컴파일 타임**
  계약이며, 런타임 exhaustiveness(각 핸들러의 `default` 분기, IE 는 `default: 'error'`)는
  이번 변경으로 달라지지 않았다.
- **OWASP Top 10**: 해당 없음 — HTTP/네트워크 표면, 인증, 세션, 직렬화, 접근 제어 등
  런타임 표면이 전혀 바뀌지 않았다.
- **암호화**: 해시/암호화 알고리즘 관련 코드 없음.
- **에러 처리**: 에러 메시지 노출 경로 변경 없음 — `errorPayload`/`retryabilityDetails`
  등 기존 에러 처리 경로는 그대로다.
- **의존성 보안**: 신규 의존성 추가 없음 — `@workflow/ai-end-reason` 패키지 내부 타입만
  확장(`UniversalEndReason` 파생 타입 + non-empty 컴파일 타임 단언).

부차 관찰(비-보안, 참고용): 신규 fixture 는 "검증 장치 자체의 무력화"를 잡기 위한
회귀 테스트로, 직전 세션 security 리뷰가 이미 확인한 "이 작업의 방향성은 안전 강화"라는
결론을 그대로 유지·보강한다(좁히기·넓히기 양방향 위반을 모두 거부하도록 고정). 이 fixture
가 `src/**` 아래 non-spec `.ts` 파일로 존재해 `nest build` 가 매번 타입 체크하는 설계는
보안과 무관한 테스트 인프라 판단(testing/architecture 리뷰어 영역)이라 이 리뷰의 판정에는
영향을 주지 않는다.

## 요약

이번 변경은 직전 세션에서 위험도 NONE 으로 판정된 `ResumableNodeHandler` 제네릭화 PR 에
대한 WARNING 4건 후속 fix(컴파일 타임 회귀 fixture 신설, JSDoc SoT 통합, README export
목록 갱신, plan/review 문서 갱신)로, 런타임 동작·데이터 흐름·인증/인가·입력 검증·에러
노출·암호화·의존성 어느 축에도 실질적 변경이 없다. 조사한 8개 관점 전체에서 보안 결함이
발견되지 않았으며, 신규 추가된 `assert-end-reason-domain.type-fixture.ts` 는 프로덕션에
포함되지 않는 컴파일 타임 전용 회귀 테스트로 그 자체로도 보안 표면을 늘리지 않는다.

## 위험도
NONE
