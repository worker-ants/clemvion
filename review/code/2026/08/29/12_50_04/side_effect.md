# 부작용(Side Effect) 리뷰

## 검증 방법

- `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts`,
  `codebase/backend/src/nodes/data/code/code.handler.spec.ts`,
  `codebase/backend/src/modules/secret-store/secret-resolver.service.ts`,
  `codebase/packages/expression-engine/src/errors.ts` 를 `Read` 로 전문 확인(프롬프트가
  크기 제한으로 전체 컨텍스트를 못 실은 4개 파일).
- 신규 `captureThrown`/`captureRejected` 헬퍼가 모듈 스코프에 공유 가변 상태를 두는지,
  `beforeEach` 밖에서 전역/env 를 건드리는지 직접 대조.
- `errors.ts` 를 열어 `Object.entries(errors)` 로 열거되는 클래스들이 import 시점에
  부수효과(싱글턴 생성·네트워크·파일 접근)를 일으키지 않는지 확인.
- 저장소 트리에는 아무것도 쓰지 않았다(`git status --short` = 본 리뷰 산출물 디렉터리만
  untracked, 원복 불필요).

## 발견사항

없음. 세부 근거:

1. **의도치 않은 상태 변경 / 전역 변수**: 신규 `captureThrown`(동기, expression-resolver
   spec) / `captureRejected`(비동기, code.handler spec) 헬퍼는 각각 `let thrown: unknown`
   을 함수 스코프 로컬로만 선언하며 호출마다 새로 생성된다. 모듈 스코프 공유 변수·전역
   객체 변경은 없다. `it.each` 로 4회 반복 호출되는 신규 C2 캐너리도 `service`/`handler`
   인스턴스를 매 `beforeEach` 마다 새로 만드는 기존 패턴을 그대로 쓴다 — 반복 사이에
   상태가 누적될 여지가 없다.
2. **파일시스템 부작용**: 4개 코드/주석 변경 파일 자체는 파일 I/O 를 수행하지 않는다.
   신규 `error-shape.spec.ts` 도 `Object.entries(errors)`/`new Cls(...)` 로 순수 인메모리
   객체만 다룬다. (참고: 같은 diff 에 `review/code/2026/08/29/{11_58_35,12_23_45}/*` 하위
   신규 파일 22개가 포함돼 있으나, 이는 이전 리뷰 라운드의 산출물을 저장소에 커밋하는
   프로젝트 표준 워크플로우이고 이번 코드 변경의 실행이 만든 부작용이 아니다.)
3. **시그니처/인터페이스 변경**: `ExpressionResolverService.resolveConfig`,
   `CodeHandler.execute` 등 프로덕션 공개 API 시그니처는 변경되지 않았다. 신규 헬퍼
   `captureThrown(fn: () => unknown): Error` / `captureRejected(fn: () => Promise<unknown>): Promise<Error>`
   는 각 spec 파일 내부 전용(비-export)이라 외부 호출자에 영향이 없다.
   `secret-resolver.service.ts` 변경은 주석 4줄 추가뿐, 런타임 로직·시그니처 불변.
4. **환경 변수**: `envAllowlist`/`ConfigService` mock 은 기존 `beforeEach` 패턴 그대로이고
   이번 diff 로 새로 추가되거나 변경된 env 읽기/쓰기는 없다.
5. **네트워크 호출**: 신규/변경 코드 전부가 순수 함수 호출·인메모리 예외 캡처이며 외부
   서비스 호출을 만들지 않는다.
6. **이벤트/콜백**: `it.each` fixture 4종은 각기 다른 `service.resolveConfig` 호출을
   트리거하지만, 이는 기존 테스트가 이미 하던 것과 같은 형태의 동기 호출이며 새 콜백·
   이벤트 발행 경로를 추가하지 않는다.

`plan/in-progress/deps-peer-gating-and-eslint10.md` 변경은 체크박스·서술 갱신뿐인 문서
변경이라 부작용 분석 대상 밖이다.

## 요약

이번 diff 는 두 스펙 파일에 예외 캡처 헬퍼(`captureThrown`/`captureRejected`)와
`it.each` 기반 C2 캐너리 테스트를 추가하고, `secret-resolver.service.ts` 에 주석 한
문단을 보강하고, 신규 패키지 테스트 파일(`error-shape.spec.ts`)과 plan 문서를 갱신한
것으로 프로덕션 런타임 로직·공개 시그니처·전역 상태·환경 변수·파일시스템·네트워크
경로를 전혀 건드리지 않는다. 부작용 관점에서 위험 요소가 없다.

## 위험도

NONE
