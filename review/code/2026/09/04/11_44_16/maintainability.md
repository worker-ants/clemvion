# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `nullable-type-lie-cast.spec.ts` 가 공유 `withFixture` 를 재사용하지 않고 같은 이름·같은 동작의 함수를 다시 만들었다 — 바로 이 PR 이 "사본을 없애려고" 추출한 헬퍼 옆에서 새 사본이 생겼다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:51-55`
  - 상세: `common/__test-utils__/temp-fixture.ts` 는 이미 `export function withFixture<T>(content, fn, name = 'probe.ts')` 를 내보낸다 — 이름→내용 하나짜리 맵으로 `withFiles` 를 감싸는 바로 그 로직이다. 그런데 이 파일은 `withFixture` 를 import 하지 않고 `withFiles` 만 import 한 뒤, 파일명을 `'probe.entity.ts'` 로 고정한 **거의 동일한 함수를 로컬로 재정의**한다:
    ```ts
    function withFixture<T>(content: string, fn: (file: string) => T): T {
      return withFiles({ 'probe.entity.ts': content }, (paths) =>
        fn(paths['probe.entity.ts']),
      );
    }
    ```
    형제 소비처 `swagger-dto-contract.spec.ts:37,47-51` 은 정확히 같은 상황에서 공유 `withFixture` 를 직접 import 해 `withFixture(source, fn, 'probe.dto.ts')` 로 쓴다 — 두 소비처 중 하나만 추출의 취지를 따르고 있다. 이 로컬 함수 바로 위 JSDoc(파일 43-50행)은 스스로 "공유 헬퍼에 파일명을 고정한 **얇은 래퍼**" 라고 설명하는데, 실제 구현은 공유 함수에 위임(delegate)하지 않고 그 내부 로직을 그대로 복제한다 — 서술과 구현이 어긋난다. `temp-fixture.ts` 자신의 파일 헤더가 "사본 5개를 없앤 직후에 새 사본을 만들지 않기 위해서" 이 파일로 옮겼다고 명시하는 바로 그 파일에서, 그 사본 방지 취지가 부분적으로 무산됐다.
  - 제안: `function withFixture<T>(content: string, fn: (file: string) => T): T { return sharedWithFixture(content, fn, 'probe.entity.ts'); }` 처럼 공유 `withFixture` 를 import 해 위임하거나, 아예 로컬 함수를 지우고 소비 지점에서 `withFixture(content, fn, 'probe.entity.ts')` 를 직접 호출한다. 5줄(+JSDoc)이 완전히 사라진다.

- **[WARNING]** 크로스플랫폼 경로 정규화 한 줄(`path.relative(...).split(path.sep).join('/')`)이 저장소 전체에 이제 7곳 중복돼 있다 — 이번 배치가 지적 하나(1곳)를 고치며 그 중복을 3곳 더 늘렸다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:51`, `:124`, `:257`, `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:128` (기존 `masked-reject-callers-guard.ts:140`, `production-build-devdep-guard.ts:119`, `production-build-devdep.spec.ts:61` 포함 총 7곳, `grep -rn "split(path.sep).join" codebase/backend/src/repo-guards/__tests__/*.ts` 로 실측)
  - 상세: 직전 라운드 WARNING(W3)은 `swagger-dto-contract-guard.ts` 한 자리의 정규화 누락을 지적했고, 수정 커밋(`RESOLUTION.md` W3)은 "같은 클래스의 결함이 세 곳 더 있다"며 `nullable-type-lie-cast-guard.ts` 세 함수에도 동일한 한 줄을 각각 복사해 넣었다 — "지적된 한 자리만 고치면 관례 이탈이 남는다" 는 진단은 맞았지만, 처방이 **추출이 아니라 복제**였다. 같은 디렉터리의 `common/__test-utils__/source-scan.ts` 는 자기 존재 이유를 정확히 이 상황을 위해 문서화해 뒀다 — *"세 번째 가드가 생겨도 여기만 고치면 되도록 둘의 계산을 여기로 모은다"*(파일 헤더). 이번 커밋으로 이 한 줄 정규화는 이미 **7번째 사본**이 됐는데도 그 모듈로 옮겨지지 않았다. 지금 라이브러리를 바꿔야 한다면(예: 유니코드 정규화 추가) 7곳을 동시에 고쳐야 하고, 그중 한 곳이라도 놓치면 플랫폼별 drift 가 다시 생긴다 — 이번에 놓쳤던 것과 같은 실패 모드다.
  - 제안: `source-scan.ts` 에 `toPosixRelative(root: string, file: string): string` 같은 이름으로 한 번만 정의하고 7곳(신규 4곳 포함)이 그것을 호출하도록 통일한다. 지금 당장 급하지 않다면 최소한 다음에 8번째 사본이 생기기 전에 추출한다.

- **[INFO]** `SRC_ROOT` 계산식이 여전히 두 파일에 각각 존재한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:21`, `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:43`
  - 상세: 둘 다 `path.resolve(__dirname, '..', '..')` 로 동일하다. 직전 라운드 architecture 리뷰가 이미 INFO 로 지적했고(2곳뿐이라 즉시 조치 불필요라는 판단도 동일), 이번 라운드에도 그대로 남아 있다. 세 번째 소비처가 생기면 위 정규화 헬퍼와 함께 `source-scan.ts` 로 합칠 만하다.
  - 제안: 지금은 조치 불요. 다음 가드 추가 시 함께 정리.

- **[INFO]** 변수명 `sf` 가 같은 패턴의 형제 가드 관례(`sourceFile`)와 다르다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:44-56, 62-74, 119-176` 전역
  - 상세: `production-build-devdep-guard.ts` 는 같은 개념을 `sourceFile` 로 전체 이름을 쓴다. 이 파일은 시그니처와 본문 전체에서 `sf` 로 줄여 쓴다 — 기능 영향은 없으나 같은 코드베이스 안에서 같은 개념에 다른 이름이 쓰이는 컨벤션 흔들림이다(직전 라운드에서도 지적됐고 이번 배치에서 미조치 상태로 남아 있음).
  - 제안: 급하지 않음. 다음 가드 추가 시 `sourceFile` 로 통일 권장.

- **[INFO]** presence 불일치 판정식이 이름 없는 동치 비교로만 표현돼 부호가 뒤집힌 채 읽힌다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:144` (`if (effectiveRequired === tsOptional) {`)
  - 상세: "OpenAPI required 와 TS `?` 는 정반대여야 한다" 는 규칙을 `===`(즉 "같으면 불일치")로 표현해 이 한 줄만 보면 재확인이 필요하다. 함수 상단 JSDoc(95-98행)에 서술은 있지만 코드 자체엔 이름이 없다. 직전 라운드에서도 같은 지적이 있었고 이번 배치에서 미조치 상태다.
  - 제안: `const presenceMismatch = effectiveRequired === tsOptional; // required 와 optional 은 반대여야 하므로 같으면 불일치` 처럼 이름을 붙이거나 인라인 주석을 단다.

## 요약

핵심 로직(`findSwaggerContractMismatches`, nullable 계약 정정 9곳)은 가독성·네이밍·복잡도 면에서 양호하고, AST 기반 재작성 근거·`@Transform` 예외 원리·픽스처 도입 배경이 docstring 에 충실히 남아 있다. 직전 라운드 WARNING 5건(W1~W5) 수정은 실제로 반영됐음을 코드 열람으로 확인했다. 다만 이번 배치 자체가 "중복을 없앤다"를 명시적 목표로 내세우면서(`temp-fixture.ts` 추출, W3 경로 정규화 통일) 그 과정에서 **새로운 중복을 만들었다** — 공유 `withFixture` 를 두고 거의 동일한 로컬 함수를 다시 만든 것(WARNING), 그리고 경로 정규화 한 줄을 추출 대신 복제로 4곳 더 늘려 7곳까지 벌린 것(WARNING)이 그것이다. 둘 다 기능적 결함은 아니고 수정 비용도 낮지만, 이 PR 이 스스로 세운 "사본을 만들지 않는다" 원칙에 정면으로 어긋나는 형태라 다음 사람이 같은 패턴을 또 복제할 근거가 된다. 그 외 INFO 3건은 직전 라운드에서 이미 지적된 채 이번 배치에서 조치되지 않고 남아 있는 사소한 컨벤션·가독성 항목이다.

## 위험도

LOW
