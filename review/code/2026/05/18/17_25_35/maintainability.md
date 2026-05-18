# 유지보수성(Maintainability) 리뷰

## 발견사항

### 서식·포매터 일관성

- **[INFO]** 이번 변경의 대부분(약 22개 파일)은 80/100자 줄 제한 초과 줄을 Prettier가 자동 재포매팅한 결과다. 실질적 로직 변경 없이 따옴표 통일(`"` → `'`, `\'` → `"`)과 줄 바꿈 삽입이 중심이다.
  - 위치: 파일 1, 2, 3, 4, 5, 6, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 26, 27 전반
  - 상세: Prettier의 printWidth 규칙이 일관되게 적용됐으며, 프로젝트 전체 스타일이 균일해졌다. 유지보수성에 긍정적이다.
  - 제안: 특이사항 없음. CI에서 `prettier --check`가 통과하는지 확인한다.

---

- **[INFO]** `community.ts`(파일 20)에서 따옴표가 `\'` 이스케이프 → `"..."` 쌍따옴표로 변경됐고, `customer.ts`(파일 21)에서는 반대로 `"..."` → `'...'`로 바뀌었다. 두 방향이 혼재하는 것처럼 보이지만, 단순히 내부 아포스트로피(`'s`) 포함 여부에 따른 Prettier 최적 선택이다.
  - 위치: `community.ts` L49, L63 / `customer.ts` L206, L234
  - 상세: 로직상 문제 없음. Prettier 결정 기준(따옴표 이스케이프 최소화)에 따른 자연스러운 결과다.
  - 제안: 별도 개입 불필요.

---

### 실질 로직 변경 — 가독성·명확성

- **[INFO]** `cafe24-mcp-tool-provider.ts`(파일 14) 임포트에서 `McpServerSummary` 타입이 제거됐다.
  - 위치: `cafe24-mcp-tool-provider.ts` 상단 import 블록
  - 상세: 사용처가 없어진 타입 임포트를 제거함으로써 의존성이 명시적으로 줄었다. 불필요한 임포트를 정리한 좋은 사례다.
  - 제안: 특이사항 없음.

---

- **[INFO]** `integrations.service.ts`(파일 8)에 `pending_install` 상태 가드가 추가됐다.
  - 위치: `integrations.service.ts` L863~875, `testConnection` 메서드 내부
  - 상세: 인라인 주석이 4줄(`spec/...` 참조, 의도 설명 포함)로 충분히 작성되어 있다. 단일 `if` 블록으로 복잡도 증가가 최소화됐다.
  - 제안: 현재 구현은 읽기 쉽다. 향후 가드 조건이 늘어날 경우 별도 `assertNotPendingInstall(entity)` 헬퍼로 추출하면 복잡도를 낮출 수 있다.

---

- **[INFO]** `catalog-sync.spec.ts`(파일 18)에서 fallback 경로 해석이 `join(__dirname, '..', '..', '..', '..', '..', '..', '..')` 7단계 상위 이동으로 작성되어 있다.
  - 위치: `catalog-sync.spec.ts` resolveRepoRoot 함수 catch 블록
  - 상세: 이 코드는 이번 변경으로 도입된 것이 아니라 재포매팅만 됐다. 그러나 `..` 7개를 직접 나열하는 패턴은 디렉토리 구조 변경 시 사일런트하게 잘못된 경로를 반환할 수 있어 유지보수 취약점이다.
  - 제안: `path.resolve(__dirname, '../../../../../../../')` 또는 `node:path`의 `fileURLToPath`를 활용하거나, 기존 `git rev-parse` 경로(try 블록)가 실패하는 경우를 테스트 환경 CI 설정으로 제거해 catch fallback 자체를 없애는 것이 더 견고하다.

---

- **[INFO]** `integrations.service.spec.ts`(파일 7)에서 `pending_install` 가드 테스트 두 케이스가 모두 `makeIntegration(...)` 팩토리 패턴을 사용하고 credentials 구조가 일부 중복된다.
  - 위치: `integrations.service.spec.ts` L790~840 (신규 추가 블록)
  - 상세: 두 테스트 케이스가 각기 독립적인 `credentials` 객체를 인라인으로 정의한다. 프로젝트의 기존 `makeIntegration` 팩토리 사용 패턴과 일치하므로 심각한 중복은 아니다. 단, 두 케이스 모두 `expect(result).toEqual({ success: false, code: 'INTEGRATION_INCOMPLETE', message: expect.stringContaining('pending_install') })`를 동일하게 작성하고 있어 미래에 응답 형식이 바뀌면 두 곳을 모두 수정해야 한다.
  - 제안: 공통 기대값을 `const INCOMPLETE_RESULT = { success: false, code: 'INTEGRATION_INCOMPLETE', message: expect.stringContaining('pending_install') }` 형태로 상수화하면 중복 수정 포인트를 줄일 수 있다.

---

- **[WARNING]** `websocket.service.spec.ts`(파일 11)에서 magic number `12`가 사용된다.
  - 위치: `websocket.service.spec.ts` L1089: `for (let i = 0; i < 12; i++) deep = { next: deep };`
  - 상세: 주석에 `MAX_SANITIZE_DEPTH = 10 — 11단계 깊이 페이로드 끝에 credential을 박아`라고 설명되어 있으나, 코드의 `12`와 주석의 `10`/`11` 사이의 관계가 직관적으로 파악되지 않는다. `MAX_SANITIZE_DEPTH + 2`나 `OVER_MAX_DEPTH`와 같은 명명 상수를 쓰면 의도가 명확해진다. 현재는 주석이 있어 파악 가능하지만, `MAX_SANITIZE_DEPTH`가 변경될 경우 이 숫자도 함께 변경해야 한다는 관계가 코드에 드러나지 않는다.
  - 제안: `const OVER_LIMIT_DEPTH = MAX_SANITIZE_DEPTH + 2;`로 상수화하거나, 테스트 파일 상단에서 프로덕션 코드의 `MAX_SANITIZE_DEPTH`를 임포트해 `MAX_SANITIZE_DEPTH + 2`로 직접 표현한다.

---

- **[INFO]** `executions.service.ts`(파일 4)에서 `snapshotCache` 타입 선언과 `readSnapshotCache` 메서드 시그니처가 Prettier에 의해 다줄 형식으로 재포매팅됐다.
  - 위치: `executions.service.ts` L61~77
  - 상세: 타입 `Map<string, ExecutionDetailWithTrigger>`가 3줄로 펼쳐지고 반환 타입도 줄 바꿈됐다. 가독성 측면에서 어느 쪽이 낫다는 주관적 판단이 갈릴 수 있으나, Prettier가 일관되게 처리하므로 별도 개입 불필요.
  - 제안: 특이사항 없음.

---

## 요약

이번 변경의 핵심은 Prettier 자동 포매팅 적용(25개 파일 이상)과 `pending_install` 상태 가드 추가(실질 로직)다. 대부분의 diff는 줄 길이 초과 교정과 따옴표 통일이며, 유지보수성 관점에서 코드베이스 일관성을 높이는 방향이다. 주목할 지점은 `websocket.service.spec.ts`의 magic number `12`로, `MAX_SANITIZE_DEPTH`와의 연관 관계가 코드에 명시되지 않아 추후 상수 변경 시 사일런트 버그가 될 수 있다. `catalog-sync.spec.ts`의 7단계 `..` 경로 나열도 구조 변경에 취약한 패턴이나, 이번에 도입된 코드가 아니므로 별도 리팩토링 티켓으로 처리하는 것이 적절하다. 전반적으로 네이밍, 함수 길이, 중첩 깊이, 중복 코드 면에서 심각한 문제는 없으며 기존 코드베이스 스타일·패턴을 충실히 따르고 있다.

## 위험도

LOW
