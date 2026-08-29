# 부작용(Side Effect) 리뷰 결과

## 발견사항

이번 diff 는 6개 파일 전부 **주석/문서 텍스트 변경뿐**이며, 실행 코드(로직·시그니처·throw 대상·조건문)는 변경 전과 바이트 단위로 동일하다. 각 파일을 개별 확인한 결과:

- **[INFO]** 실질 코드 변경 없음 — 주석 재배치만
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts:316-318`
  - 상세: diff 는 기존 `throw new Error(..., { cause: err })` (변경 전부터 존재하던 코드, 컨텍스트 319-321행) 바로 위에 설명 주석 3줄만 추가한다. `cause: err` 부착 여부·조건·throw 시그니처는 변경되지 않았다.
  - 제안: 없음(기능 변경 없음을 확인하는 차원의 기록).

- **[INFO]** 실질 코드 변경 없음 — 주석 재배치만
  - 위치: `codebase/backend/src/nodes/data/code/code.handler.ts:454-457`
  - 상세: `throw new Error(\`code has a syntax error: ${message}\`, { cause: err })` (458행, 변경 전부터 존재) 위에 설명 주석 4줄만 추가. 로직·예외 처리 흐름 동일.
  - 제안: 없음.

- **[INFO]** 실질 코드 변경 없음 — 주석 블록 치환
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` 함수 `resolve` 내부 catch 블록 (전체 컨텍스트 82-100행)
  - 상세: `eslint-disable-next-line preserve-caught-error` 지시문과 `throw new Error('Secret decryption failed')` (100행) 는 diff 전후로 동일 — `cause` 를 계속 부착하지 않는다(secret 상세 비노출 의도 유지). 위에 붙는 근거 설명 주석만 재작성되었다.
  - 제안: 없음.

- **[INFO]** 테스트 스펙 주석만 변경, 단언·fixture 불변
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts` 의 `it('원본 예외를 \`cause\` 로 보존한다 (cause 제거 시 RED)', ...)` 케이스 (전체 컨텍스트 144-159행)
  - 상세: 테스트 본문(`expect` 체인)은 변경 전과 동일. 케이스 위 설명 주석만 §6.3.1 정본을 가리키는 형태로 재작성됨.
  - 제안: 없음.

- **[INFO]** 테스트 스펙 주석만 변경, 단언·fixture 불변
  - 위치: `codebase/backend/src/nodes/data/code/code.handler.spec.ts` 의 `it('원본 컴파일 예외를 \`cause\` 로 보존한다 (cause 제거 시 RED)', ...)` 케이스 (전체 컨텍스트 204-226행)
  - 상세: 위와 동일 패턴 — 주석만 교체.
  - 제안: 없음.

- **[INFO]** plan 문서 전용 변경, codebase 영향 없음
  - 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md` (체크리스트 §, `## 체크리스트` 항목)
  - 상세: 과거 서술("등재됐다")이 거짓이었음을 스스로 정정하는 텍스트 삽입 + 다른 plan 문서(`spec-draft-error-cause-criterion.md`, 이미 `complete/` 로 이동된 상태)에 대한 경로 참조 업데이트. 이 diff 자체는 파일 이동을 수행하지 않으며(이미 과거 커밋 `#1228` 에서 이동됨을 기술), 단순 참조 경로 텍스트 교정이다. 애플리케이션 동작·전역 상태·API 에 영향 없음.
  - 제안: 없음.

## 부작용 관점 개별 체크

1. 의도치 않은 상태 변경 — 없음 (실행 코드 diff 없음).
2. 전역 변수 — 없음 (신규/수정 전역 변수 없음).
3. 파일시스템 부작용 — 없음. `plan/*.md` 텍스트 편집은 리뷰 대상 changeset 자체가 만드는 것이고, 런타임 코드가 파일을 생성·삭제하지 않는다.
4. 시그니처 변경 — 없음. `throw new Error(...)` 호출부의 인자(message, `{ cause }`)는 diff 전후 동일.
5. 인터페이스 변경 — 없음. 공개 API(`ExpressionResolverService`, `SecretResolverService`, `CodeHandler`)의 메서드 시그니처·반환 타입·에러 계약 모두 불변.
6. 환경 변수 — 없음. diff 범위 내 `process.env` 읽기/쓰기 신규 없음(파일 내 기존 `process.env.EXPR_TEST_*` 테스트 조작은 이번 diff 대상이 아닌 기존 코드).
7. 네트워크 호출 — 없음.
8. 이벤트/콜백 — 없음. throw/catch 흐름, 로거 호출 등 모두 기존과 동일.

## 요약

리뷰 대상 6개 파일의 diff 는 전부 주석(코드 3곳) 및 테스트 설명 주석(2곳)·plan 문서(1곳) 텍스트 변경으로, 실행되는 코드·시그니처·throw 인자·조건 분기·전역 상태·파일시스템·환경 변수·네트워크 호출·이벤트 콜백 중 어느 것도 변경하지 않는다. `eslint 10` `preserve-caught-error` 룰 대응으로 이미 붙어 있던 `cause: err` 부착/비부착 로직 자체는 이번 diff 이전 커밋에서 확정된 것이고, 이번 변경은 그 판단 근거를 spec 정본(`spec/5-system/3-error-handling.md` §6.3.1)으로 재정렬하는 문서화 작업이다. 부작용 관점에서 위험 요소를 발견하지 못했다.

## 위험도

NONE
