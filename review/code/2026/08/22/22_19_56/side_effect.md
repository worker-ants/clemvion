# 부작용(Side Effect) 리뷰

## 검토 범위

리뷰 대상 13개 파일 중 실질 코드 변경은 `codebase/backend/src/modules/executions/executions.service.ts` 1개뿐이다.
나머지 12개는 `plan/**`(작업 트래커 갱신·이동)와 `review/consistency/2026/08/22/21_53_41/**`(consistency-check
산출물 커밋)로, 런타임 부작용 관점에서 검토 대상이 아니다(문서/트래킹 파일).

핵심 변경: `ExecutionsService.reRun` 내부의 40줄 입력 해석 인라인 블록(스키마 로드 → 마커 거부
resolve → 검증 실패 응답 매핑)을 새 private 메서드 `resolveManualOverrideInput`으로 추출. 저자
스스로 "한 글자도 바꾸지 않는 것이 요건"이라고 명시한 순수 추출 리팩터.

## 발견사항

### [INFO] private 헬퍼 추출은 동작 보존 확인됨 — 부작용 없음

- 위치: `codebase/backend/src/modules/executions/executions.service.ts:483-490` (호출부),
  `:546-583` (`resolveManualOverrideInput` 신설)
- 상세: 원본 인라인 블록과 추출된 `resolveManualOverrideInput`을 대조한 결과 다음이 모두 보존된다.
  - 에러 코드(`INVALID_TRIGGER_PARAMETERS`) · 응답 필드(`details: toTriggerParameterErrorDetails(err.errors)`) 동일.
  - `try/catch`가 `resolveTriggerParametersRejectingMasked` 호출만 감싸고 `loadTriggerParameterSchema`는
    감싸지 않는 범위가 그대로 유지됨(catch 블록으로 잘못 넓어지지 않음).
  - 호출부 삼항 연산자(`useOriginal ? A : await this.resolveManualOverrideInput(...)`)는 JS의 지연
    평가(short-circuit) 특성상 `useOriginal === true`일 때 `resolveManualOverrideInput`(및 그 안의
    `loadTriggerParameterSchema` DB 조회)이 **호출되지 않는다** — 원본 `if/else` 구조가 갖던 "원본 입력
    재사용 시 스키마 로드 생략" 동작이 그대로 보존된다. 즉 새로 추가된 네트워크/DB 호출은 없다.
  - `resolveManualOverrideInput`은 `private` 메서드로, 클래스 외부에서 호출 불가 — 공개 인터페이스
    (컨트롤러·타 서비스·HTTP 계약)에 영향 없음. 시그니처 변경도 기존 공개 메서드(`reRun`/`getChain`/
    `stop`/`findById` 등)에는 없다.
- 제안: 없음 (확인 목적의 기록).

### [INFO] `masked-reject-callers-guard` 탐지 축에 영향 없음 확인

- 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` (이번 diff 밖,
  참고용으로 열람)
- 상세: 이 CI 가드는 base 함수 `resolveTriggerParameters`의 **식별자 사용 여부**를 파일 단위로 AST
  스캔하며, wrapper `resolveTriggerParametersRejectingMasked`와는 접두 겹침에도 별개 식별자로 정확히
  구분한다. `executions.service.ts`는 리팩터 전후로 여전히 wrapper만 호출하고 base는 호출하지 않으므로
  (호출 지점이 `reRun` 본문에서 `resolveManualOverrideInput` private 메서드로 옮겨간 것과 무관하게)
  이 가드는 파일 단위 판정이라 영향받지 않는다. plan(`rerun-input-resolution-extract.md`)이 이를
  뮤테이션(M3)으로 검증하겠다고 명시한 것과 일치한다.
- 제안: 없음 — 부작용 없음 확인.

### [INFO] instance state(`this.nodeRepository`/`this.logger`) 접근 방식 변화 없음

- 위치: `codebase/backend/src/modules/executions/executions.service.ts:550-554`
- 상세: 추출 전에는 `reRun` 메서드 본문에서 직접 `this.nodeRepository`/`this.logger`를 참조했고,
  추출 후에는 같은 클래스의 private 메서드에서 동일하게 `this.nodeRepository`/`this.logger`를
  참조한다. `this` 바인딩은 일반 클래스 메서드 정의(화살표 함수 아님)이고 호출부가
  `await this.resolveManualOverrideInput(...)`으로 명시적 `this.` 호출이라 바인딩 유실 위험 없음.
  인스턴스 캐시(`snapshotCache`)·다른 필드는 이 변경과 무관 — 새 전역/공유 상태 도입 없음.
- 제안: 없음.

### [INFO] `review/**` 산출물 커밋은 애플리케이션 부작용과 무관

- 위치: `review/consistency/2026/08/22/21_53_41/*` (신규 파일 6개), `plan/complete/masked-marker-test-gaps.md`(신규),
  `plan/in-progress/masked-marker-test-gaps.md`(삭제), `plan/in-progress/rerun-input-resolution-extract.md`(신규),
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(수정)
- 상세: 이 diff에 포함된 파일 삭제/생성/이동은 모두 **git 커밋 시점**의 저장소 변경(plan 이동, 리뷰
  산출물 아카이빙)이며, 애플리케이션 런타임이 실행 중에 파일시스템을 예상치 못하게 건드리는 부작용이
  아니다. 코드 경로(`ExecutionsService` 등)에는 파일 I/O를 새로 도입하는 변경이 없다.
- 제안: 없음 (범위 확인용).

## 요약

이번 변경 세트의 실질 코드 diff는 `ExecutionsService.reRun`의 입력 해석 블록을 `resolveManualOverrideInput`
private 헬퍼로 추출한 것 하나뿐이며, 에러 코드·응답 봉투·검증 순서·지연 평가(스키마 로드 스킵 조건)가
모두 원본과 동일하게 보존된 순수 리팩터다. 새 전역 변수·환경 변수 접근·네트워크 호출·이벤트/콜백 변경은
없고, 추출된 메서드가 `private`이라 공개 인터페이스나 기존 호출자에도 영향이 없다. `masked-reject-callers-guard`
같은 관련 CI 가드도 파일 단위 판정이라 이 리팩터로 무뎌지지 않는다. 나머지 12개 파일은 plan 문서 이동/갱신과
consistency-check 산출물 커밋으로, 부작용 관점에서 검토할 실행 코드가 없다.

## 위험도

NONE
