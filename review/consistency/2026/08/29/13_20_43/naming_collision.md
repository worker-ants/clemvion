# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 확인

`--impl-done` scope=`spec/5-system/`, diff-base=`origin/main` 로 지정되어 있으나, 실측
(`git diff origin/main...HEAD --stat`)상 이번 PR 은 **`spec/**` 파일을 전혀 변경하지 않았다**.
번들에 포함된 `spec/5-system/1-auth.md`·`3-error-handling.md`·`2-api-convention.md` 등은
`code:` 매핑을 통한 참조용 컨텍스트일 뿐, target 문서 자체의 diff 가 아니다. 실제 변경은
`git diff origin/main...HEAD -- code_areas` 섹션의 4개 파일(전부 `codebase/`)과
`plan/in-progress/deps-peer-gating-and-eslint10.md`(plan 갱신) + `review/code/**`(리뷰 산출물)
뿐이다. 즉 이번 PR 은 eslint 10 `preserve-caught-error` 룰 대응으로 기존 §6.3.1(C1/C2) 계약을
**테스트로 잠그는** 작업이며, spec 이 새 요구사항 ID·엔티티·엔드포인트·이벤트·환경변수·spec
파일 경로를 도입하지 않는다.

## 변경분에서 확인한 "신규 식별자" 전수와 충돌 여부

1. **신규 파일**: `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts`
   - 같은 디렉터리의 `disambiguate-labels.spec.ts`·`expression.spec.ts` 와 동일한
     `<name>.spec.ts` 명명 컨벤션을 따른다. 저장소 전체에 동명 파일 없음(`find . -iname
     "*error-shape*"` = 이 파일 1건). 충돌 없음.
2. **신규 로컬 헬퍼 함수**: `captureThrown`(`expression-resolver.service.spec.ts`),
   `captureRejected`(`code.handler.spec.ts`)
   - `git grep -n "captureThrown\|captureRejected" -- codebase/` 결과 각각 정의 파일
     내부에서만 쓰인다(모듈-로컬, export 없음). 동명의 기존 유틸·다른 의미의 사용처 없음.
     충돌 없음.
3. **테스트가 참조하는 클래스명** (`ExpressionSyntaxError`/`ExpressionReferenceError`/
   `ExpressionTypeError`/`ExpressionFunctionError`/`ExpressionTimeoutError`/
   `ExpressionDepthExceededError`, `ErrorCode.EXPR_*`)
   - `codebase/packages/expression-engine/src/errors.ts` 확인 결과 **이번 PR 이전부터 존재**하는
     클래스/enum 이다(신규 도입 아님). 신규 식별자 충돌 검토 대상이 아니다.
4. **plan 문서**(`deps-peer-gating-and-eslint10.md`)에 추가된 것은 완료 기록·라운드별 뮤테이션
   실측 표뿐이며, 새 요구사항 ID·spec 참조 ID 를 발급하지 않는다.
5. **spec 본문(§6.3.1, C1/C2, error-codes.md, audit-actions.md 등)** 은 이번 diff 에 포함되지
   않아 기존 정의와 대조할 신규 항목이 없다.

## 발견사항

없음 — 이번 변경분에 요구사항 ID·엔티티/타입명·API endpoint·이벤트/메시지명·환경변수·spec
파일 경로 중 어느 축으로도 **신규 식별자 도입**이 없다(테스트 전용 diff). 따라서 기존
사용처와 충돌할 표면 자체가 존재하지 않는다.

## 요약

이번 PR 은 spec 변경이 아니라 eslint 10 대응 테스트 보강(`captureThrown`/`captureRejected`
헬퍼 추출 + `error-shape.spec.ts` 신설 + `secret-resolver.service.ts` 주석 1건 추가)이다.
target 으로 지정된 `spec/5-system/` 범위에는 실제 diff 가 없고, 코드 변경분에서 도입된
유일한 신규 식별자(신규 파일 경로 1개, 로컬 헬퍼 함수 2개)는 기존 컨벤션과 일치하며 저장소
전역에서 동명 충돌이 확인되지 않았다. 신규 식별자 충돌 관점에서 이번 변경은 안전하다.

## 위험도

NONE
