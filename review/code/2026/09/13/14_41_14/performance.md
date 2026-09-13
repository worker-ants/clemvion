# 성능(Performance) 리뷰 — guide-identifier-existence

## 범위 안내

이번 변경은 프로덕션 런타임 코드가 아니라 **CI/vitest 시점에만 실행되는 문서-실재성 가드**다
(`guide-error-code-existence.test.ts`/`guide-error-code-scan.ts` 삭제 →
`guide-identifier-existence.test.ts`/`guide-identifier-scan.ts` 신설, 1:1 대체). 따라서 아래
발견사항은 사용자 요청 경로의 지연시간이 아니라 **테스트 스위트 실행 비용**에 대한 것이다.
`PROJECT.md`·`plan/**`·`review/consistency/**` 는 문서/리포트 산출물이라 성능 관점에서 스킵했다.

## 발견사항

- **[INFO]** 판정 축이 하나 줄면서(문맥 게이팅 제거) 부가 연산도 함께 줄었다 — 순회는 그대로 O(n)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` `scanIdentifierCitations` (110~127행)
  - 상세: 구 `guide-error-code-scan.ts` 는 축 3′ 판정을 위해 `codeTableRows(lines)` 로 표 경계를
    찾는 추가 선형 패스(제거된 `TABLE_HEADER_WITH_CODE` 순회)를 두고 있었다. 신규 `backtick` 축은
    문맥 게이팅을 버리고 매 줄 무조건 `BACKTICK` 정규식을 돌리므로 그 추가 패스가 사라졌다.
    순수 성능 관점에서는 **개선**(줄당 작업량 감소)이며, `UPPER_SNAKE` 정규식(`[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+`)
    자체도 `_` 로 각 반복이 분리돼 있어 중첩 정량자로 인한 이차 백트래킹(ReDoS) 형태가 아니다 —
    선형 패턴으로 판단했다(별도 벤치마크는 생략, 정적 형태로 충분히 판별 가능한 패턴).
  - 제안: 조치 불요. 참고로만 기록.

- **[INFO]** 기준집합(basis) 병합이 오늘은 판정에 기여하지 않는 채로 매 테스트 실행마다 전체 계산됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:44-55`
    (`envExampleTexts`/`composeTexts` 로딩 → `collectEnvDeclarations` 호출 → `basis` 병합),
    구현부는 `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:167-189`
    (`collectEnvDeclarations`)
  - 상세: 코드 주석 자체가 "이 병합은 오늘 판정을 지탱하지 않는다 — 뮤턴트가 그것을 반증했다"
    (`guide-identifier-scan.ts:158-165`)고 명시한다. `.env.example` 2개 파일 read +
    `fs.readdirSync(root)` 로 저장소 루트의 `.yml`/`.yaml` 전부를 필터링해 read 하는 비용이
    매 테스트 실행마다 발생하지만, 오늘 시점엔 그 결과가 어떤 `expect` 도 바꾸지 않는다.
    절대량은 작아(compose 파일 수 개) 무시할 수준이지만, "내일의 오탐 방지"라는 선제적 목적이
    코드/plan 양쪽에 명시돼 있어 의도된 트레이드오프로 보인다 — 결함이 아니라 참고 사항.
  - 제안: 조치 불요(이미 트레이드오프가 문서화됨). 다만 `fs.readdirSync(root)` 가 저장소 루트에
    `.yml`/`.yaml` 파일이 늘어나는 시나리오(예: 향후 CI 워크플로 YAML 다수 추가)에서 스캔 대상이
    조용히 늘어날 수 있다는 점만 인지하면 된다 — 오늘 실측으로는 문제 없음.

- **[INFO]** 이 가드 계열 전체가 `codebase/backend/src` + `codebase/packages` 를 파일별로 독립적으로
  재순회·재적재한다 (이번 diff 가 새로 만든 문제는 아니고, 1:1 대체이므로 비용 증가는 없음)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:35-38`
    (`walkTree(root, ["codebase/backend/src", "codebase/packages"], …).map(f => fs.readFileSync(...))`)
  - 상세: 자매 가드(`impl-anchor-existence.test.ts` 등)도 같은 두 디렉터리를 독립적으로 walk 하고
    `.ts` 전량을 메모리에 올려 정규식 스캔한다. 이번 PR 은 기존 `guide-error-code-existence.test.ts`
    가 하던 동일 작업을 그대로 대체한 것이라 **이번 변경으로 인한 신규 비용 증가는 없다**. 다만
    가드 파일 수가 늘수록(이번 PR 로 이름만 바뀌었을 뿐 개수는 그대로) 스위트 전체의 I/O+정규식
    스캔 총량은 가드 개수에 비례해 선형으로 커진다 — 모듈 스코프 메모이제이션(예: 프로세스 내
    공유 토큰 인덱스)이 없다는 점은 구조적 여지로 남아 있다.
  - 제안: 이번 PR 범위에서 조치 불요(회귀 아님). 가드가 더 늘어날 계획이면 후속으로
    "backend+packages 소스 텍스트 1회 로딩을 여러 테스트 파일이 공유"하는 헬퍼(예: 모듈 top-level
    캐시)를 검토할 가치가 있다는 점만 기록해 둔다.

- **[INFO]** `basis` 구성 시 중간 배열 스프레드로 인한 추가 할당 — 규모가 작아 무해
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:55`
    (`const basis = new Set([...sourceTokens, ...envTokens]);`)
  - 상세: `Set` 두 개(합계 ~1,764 종, 실측치 plan 문서 §B 기준)를 배열로 스프레드한 뒤 다시
    `Set` 생성자에 넣는다 — 중간 배열 할당이 한 번 더 생기지만 원소 수가 수천 단위라 실측 영향은
    없다. `sourceTokens` 를 복사해 `envTokens` 를 `for...of` 로 추가하는 방식이 미세하게 더
    가볍지만 이 규모에서는 차이가 무의미하다.
  - 제안: 조치 불요.

## 요약

이번 변경은 순수 테스트/가드 코드로, 알고리즘 복잡도는 전부 코퍼스 크기에 선형이고(정규식도
`_` 구분자 덕에 이차 백트래킹 위험이 없는 형태), N+1 호출·블로킹 I/O 병목·불필요한 메모리 누적
같은 실질적 성능 결함은 발견되지 않았다. 유일하게 짚을 만한 것은 (1) 오늘 판정에 기여하지 않는
`collectEnvDeclarations`/compose 스캔이 매 실행마다 도는 점과 (2) 가드 파일마다 backend+packages
소스를 독립적으로 재적재하는 기존 패턴을 이번 PR 이 그대로 이어받는 점인데, 둘 다 절대 비용이
작고 전자는 코드 주석에 트레이드오프가 이미 명시돼 있어 결함이 아니라 참고사항 수준이다. 프로덕션
경로에는 영향이 없다.

## 위험도

NONE
