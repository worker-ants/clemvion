# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

- **[WARNING]** 프로덕션 검출 로직과 self-test 로직의 이중 구현 (drift 위험)
  - 위치: `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts` — `findSubGlobalTimeouts()` (모듈 최상위) vs `scanLine()` (`검출 로직 true/false positives` describe 블록 내부)
  - 상세: 두 함수 모두 `line.matchAll(TIMEOUT_LITERAL)` → `toNumber(m[1])` → `v < global` 필터링을 각각 독립적으로 재구현한다. `scanLine`(self-test)의 존재 목적은 주석에 명시된 대로 "정규식/파싱 실수로 가드가 조용히 무력화되는 것"을 막는 것인데, 실제로는 프로덕션 함수 `findSubGlobalTimeouts`를 호출/재사용하지 않고 판정 로직(`v < global`)을 별도로 복제했다. 따라서 향후 누군가 프로덕션 쪽 임계값 비교(예: `<` → `<=`, 또는 다른 필터 조건 추가)를 바꿔도 self-test는 그 변경을 전혀 감지하지 못하고 계속 통과한다 — self-test가 가드의 실제 동작이 아닌 "복제본의 동작"만 보증하는 상태가 된다. 이는 본 파일이 스스로 명시한 설계 의도(가드 로직 약화 방지)와 어긋난다.
  - 제안: 라인 단위 판정 로직을 `matchSubGlobalTimeoutsInLine(line: string, global: number): number[]` 같은 단일 헬퍼로 추출하고, `findSubGlobalTimeouts`(파일 순회 오케스트레이션)와 self-test(`it.each` 케이스) 양쪽이 이 헬퍼를 공유하도록 리팩터링한다. 그러면 프로덕션 로직 변경이 self-test에 즉시 반영되어 회귀를 실제로 잡아낸다.

- **[WARNING]** 주석 의도와 실제 동작이 어긋나는 템플릿 리터럴 (오도하는 코드)
  - 위치: `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts` 의 메인 `it(...)` 타이틀
    ```ts
    it(`has no bare-numeric timeout below the global expect.timeout (${
      // 표시용 — 실패 메시지에 전역값 노출
      "parsed from playwright.config.ts"
    })`, () => { ... });
    ```
  - 상세: 인라인 주석은 "표시용 — 실패 메시지에 전역값 노출"이라고 명시해, 템플릿 리터럴 보간이 실제 파싱된 `GLOBAL` 숫자값을 테스트 타이틀에 노출하려는 의도임을 밝히고 있다. 그러나 `${...}` 안의 실제 표현식은 `GLOBAL` 변수가 아니라 고정 문자열 리터럴 `"parsed from playwright.config.ts"`이므로, 실패 시에도 타이틀에는 항상 같은 정적 문자열만 나타나고 실제 전역 timeout 숫자는 노출되지 않는다. 주석과 코드의 의도 불일치로, 향후 유지보수자가 "타이틀에서 실제 임계값을 확인할 수 있다"고 오인하거나 리팩터링 중 잔재 코드로 착각하기 쉽다.
  - 제안: 의도대로 `` `...(${GLOBAL})` `` 로 실제 값을 보간하거나, 값 노출이 필요 없다면 이 트릭 없이 평범한 정적 문자열 타이틀로 단순화해 오해 소지를 없앤다.

- **[INFO]** 근거 주석 없는 매직 넘버
  - 위치: `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts` — `expect(collectE2eFiles().length).toBeGreaterThan(10);`
  - 상세: "가드가 fail-open 하지 않는다" 테스트에서 e2e 파일 수가 10개 초과인지 검사하는데, 왜 10인지(최소 기대 스펙 파일 수라는 근거)에 대한 설명이 없다. 값 자체는 합리적인 sanity bound 로 보이나 의미가 코드만 봐서는 드러나지 않는다.
  - 제안: 짧은 인라인 주석으로 근거(예: "e2e 스펙 최소 예상 개수")를 남기거나 이름 있는 상수로 추출.

## 요약

변경분 대부분은 문서(`PROJECT.md`, plan follow-up) 갱신과 신규 unit 가드(`e2e-no-sub-global-timeout.test.ts`) 추가, 그리고 기존 spec 파일의 변수 참조를 올바른 로컬 인스턴스(`svcMetrics`)로 고치는 1줄 수정으로 구성되어 전반적으로 범위가 작고 목적이 명확하다. 신규 가드 테스트는 기존 `hardcoded-korean-ratchet.test.ts` 등과 동일한 "재귀 파일 수집 + 정규식 스캔 + self-test" 패턴을 따라 코드베이스 컨벤션과 일관되며, 함수 길이·중첩 깊이·네이밍 모두 양호하다. 다만 self-test(`scanLine`)가 프로덕션 함수(`findSubGlobalTimeouts`)를 재사용하지 않고 판정 로직을 복제해 향후 두 곳의 로직이 벌어질(drift) 위험이 있고, 메인 테스트 타이틀의 템플릿 리터럴이 주석이 약속한 동작(전역값 노출)을 실제로 수행하지 않아 오도할 소지가 있다. 두 WARNING 모두 기능적으로 즉시 위험하지는 않으나 가드 코드 자체의 신뢰성·자기 정합성에 관한 것이라 조치를 권장한다.

## 위험도

LOW
