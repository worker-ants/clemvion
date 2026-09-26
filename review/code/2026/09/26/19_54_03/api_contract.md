# API 계약(API Contract) 리뷰 — request-body-guard (2R, 19_54_03)

## 개요

이번 변경은 실제 REST 엔드포인트의 라우팅·요청/응답 스키마·에러 코드·인증을 하나도 수정하지 않는다. 핵심은 (1) 저장소 정적 가드
`request-body-advertised` 신설 — `@Body()` 자리의 설계 타입이 클래스가 아닌데 `@ApiBody` 로 스키마를 광고하지 않는 라우트를 잡는다,
(2) `spec/conventions/swagger.md` §5-4 체크리스트 + Rationale 로 그 규칙을 문서화, (3) `CustomValidationPipe.toValidate()` 의 지역
배열을 `export const UNVALIDATED_METATYPES`(현재 `Object.freeze` 로 동결됨)로 추출한 순수 리팩터다. 1R(`review/code/2026/09/26/19_32_47`)
에서 이미 API 계약 관점 LOW 판정을 받았고, 그 라운드의 Warning 2건(전역 가변 목록 미동결·`Number`/`Boolean`/`Array` 미검증)은
`8bc7e8f19` 로 조치되어 이번 diff 에 이미 반영돼 있다(`validation.pipe.ts` 의 `Object.freeze` 호출, `validation.pipe.spec.ts` 의
`isFrozen` 단언). 이 2R 리뷰는 그 조치 이후 상태를 API 계약 관점에서 다시 본다.

## 발견사항

- **[INFO]** 신설 가드는 "본문 스키마 광고의 존재"만 검사한다 — "요청 검증 충분성" 자체는 그대로 열려 있다 (기존 설계, 이번 PR 이 새로 만든 갭 아님)
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.ts:18` (`UNVALIDATED_METATYPES` 선언) / `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts` 함수 `advertisesBody`(게이트 60) · `isUnschematized`(게이트 42) / `spec/conventions/swagger.md:750-766` (Rationale "못 보는 것")
  - 상세: `@Body() body: unknown` + `@ApiBody({ schema: {} })` 로 광고된 라우트(외부 웹훅 수신 등)는 가드를 통과하지만, `CustomValidationPipe` 가 `Object`/`Array` 등 비클래스 설계 타입을 여전히 검증 없이 통과시킨다는 점은 변하지 않는다. Rationale 이 "이 가드는 광고의 존재만 센다"고 명시적으로 스코프를 그어 두었고, 다운스트림(트리거 파라미터 추출 등)이 별도로 검증한다고 1R RESOLUTION.md 에도 적혀 있어 이번 변경이 새로 연 구멍은 아니다.
  - 제안: 조치 불요(문서화된 트레이드오프). 다만 이 경계(어떤 라우트가 `schema:{}` 로 면제됐는지)를 저장소 가드로 목록화해 감사 가능하게 하는 후속 작업은 여전히 의미 있는 백로그로 남을 만하다.

- **[INFO]** 다중 키 지정 `@Body('a')`/`@Body('b')` 는 핸들러당 `@ApiBody` 하나만 있어도 전부 "광고됨"으로 처리된다 — 다만 이는 OpenAPI 의 `requestBody` 가 오퍼레이션당 하나뿐이라는 모델과 실제로 정합적이다
  - 위치: `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts` `advertisesBody`(게이트 60) · `scanRequestBodyAdvertised` 반복문(게이트 87-99) / 대조군 `request-body-advertised.spec.ts:119-121`(`keyedBody`, 단일 키 케이스만 존재)
  - 상세: `@Body('a')` · `@Body('b')` 는 같은 요청 본문 객체에서 서로 다른 키를 꺼내는 것이지 별도의 requestBody 가 아니므로, 핸들러 단위 `@ApiBody` 하나로 광고하는 현재 설계가 OpenAPI 계약 모델과 어긋나지 않는다. 1R SUMMARY 의 INFO2 가 같은 지점을 지적했고 저장소에 다중 키 라우트가 0곳이라 조치 불요로 처리됐다 — 이번 2R 에서도 실제 위반 사례가 없어 동일 결론이다.
  - 제안: 조치 불요. 다중 키 라우트가 실제로 생기면 그 라우트가 꺼내는 키들이 `@ApiBody` 스키마의 속성과 실제로 대응하는지는 이 가드가 아니라 라우트별 캐너리(`*-body.spec.ts`)의 몫이라는 점을 계속 명시하면 된다.

- **[INFO]** 하위 호환성 리스크를 의식적으로 회피한 설계 판단 — 확인용
  - 위치: `spec/conventions/swagger.md:755-759`(Rationale "클래스로 받게 강제하지 않는다")
  - 상세: 인라인 타입 파라미터를 DTO 클래스로 승격했다면 `CustomValidationPipe` 가 진입해 `whitelist`/`forbidNonWhitelisted` 가 켜지고, `rotate-bot-token` 처럼 spec 이 약속한 도메인 특화 에러 코드(`INVALID_BOT_TOKEN`)가 일반 `VALIDATION_ERROR` 로 바뀌며 여분 키를 보내던 기존 클라이언트 요청이 400 이 되는 실제 breaking change 시나리오를 문서가 스스로 짚고, 그 대안(문서 전용 DTO + `@ApiBody`)을 택했다. 가드 베이스라인이 0(실측 78개 `@Body()` 중 위반 0)이라 소급 적용 비용도 없다.
  - 제안: 조치 불요 — API 계약 관점에서 바람직한 판단.

- **[정보] 작업 트리 관측 (뮤테이션 아님, 조치 안 함)**: 리뷰 시작 시점에 `codebase/backend/src/common/pipes/validation.pipe.ts` 에 미커밋 로컬 diff(`UNVALIDATED_METATYPES` 배열에서 `Number` 제거)가 관측됐다. 동시 실행 고지에 따라 병렬 리뷰어의 뮤테이션 검증 작업으로 판단해 **손대지 않았다**. 이 리뷰의 판정은 커밋된 diff(`git log` HEAD 기준, 이 프롬프트에 실린 내용)에 근거했다. push/커밋 전에 `git status --short` 로 잔여 여부를 재확인할 것.

## 요약

점검 관점 8개 중 실질적으로 걸리는 것은 3(응답/요청 스키마 문서화)·5(요청 검증)뿐이며, 이번 변경은 라우트의 런타임 동작(검증 로직·에러 코드·상태 코드·인증)을 전혀 바꾸지 않고 OpenAPI 문서화 완전성을 강제하는 정적 가드 + 컨벤션 문서만 추가한다. 유일한 프로덕션 코드 diff(`validation.pipe.ts`)는 1R Warning 조치(`Object.freeze`)까지 포함해 순수 리팩터임이 확인됐고, "가드가 광고의 존재만 본다"는 잔여 갭은 새로 생긴 것이 아니라 spec Rationale 이 명시적으로 인정·경계 지은 기존 설계다. 버전 관리·응답 형식·에러 응답 형식·URL/경로 설계·페이지네이션·인증/인가는 이번 변경의 대상이 아니다(해당 없음). Critical/Warning 급 API 계약 위반은 발견되지 않았다.

## 위험도

LOW
