# 유지보수성(Maintainability) 리뷰

## 리뷰 범위

실질 코드 변경은 파일 1(`codebase/backend/test/terminal-duration-sql.e2e-spec.ts`, 신규 154줄)
하나뿐이다. 파일 2·3 은 plan 문서, 파일 4~11 은 이전(10:48) `--impl-prep` consistency-check
산출물(생성 리포트)이라 "가독성/네이밍/함수 길이/중첩/매직넘버/중복/복잡도" 같은 코드 유지보수성
기준이 적용되지 않는다 — 문서·산출물 성격은 documentation/plan_coherence reviewer 영역이므로
본 리뷰에서는 코드 파일에 집중했다.

### 발견사항

- **[INFO]** `toPgSql()` 이 같은 `.split(needle)` 연산을 두 번 수행한다(치환 개수 계산용, 실제
  치환용) — 결과가 같은 배열인데 두 번 만든다.
  - 위치: `codebase/backend/test/terminal-duration-sql.e2e-spec.ts:57`~`61` (`toPgSql` 함수)
  - 상세: `const occurrences = TERMINAL_DURATION_MS_SQL.split(needle).length - 1;` 과
    `return TERMINAL_DURATION_MS_SQL.split(needle).join('$1');` 이 각각 독립적으로
    `.split()` 을 호출한다. 실행 빈도(테스트당 1회)상 성능 문제는 아니지만, 같은 배열을
    두 번 만드는 것은 "한 번 계산해서 재사용" 이라는 통상적 가독성 기대와 어긋난다.
  - 제안: `const parts = TERMINAL_DURATION_MS_SQL.split(needle);` 로 한 번만 계산하고
    `parts.length - 1` 과 `parts.join('$1')` 양쪽에 재사용.

- **[INFO]** 클램프 테스트의 종료 시각이 왜 그 값인지 계산 근거가 주석에 없다.
  - 위치: `codebase/backend/test/terminal-duration-sql.e2e-spec.ts:118` (`it('[클램프] …')`
    안의 `durationMs('2026-01-01T00:00:00.000Z', '2026-04-11T00:00:00.000Z')`)
  - 상세: `2026-01-01` → `2026-04-11` 은 약 100일로, `PG_INT4_MAX`(≈24.8일)를 충분히 초과하도록
    고른 값으로 보이지만, 그 계산이 코드·주석 어디에도 드러나지 않는다. 바로 위 JSDoc(`111`~
    `115` 게이트)은 "왜 클램프가 필요한가" 는 설명하지만 "왜 하필 이 날짜인가" 는 설명하지 않아,
    처음 보는 사람은 `PG_INT4_MAX` 가 며칠에 해당하는지 암산해야 값의 의도를 확인할 수 있다.
  - 제안: `// ≈100일 — PG_INT4_MAX(≈24.8일)를 넉넉히 초과` 같은 한 줄이면 충분.

- **[INFO]** `toPgSql()` 안의 `expect(occurrences).toBeGreaterThan(0)` 이 유틸리티 함수의
  부작용으로 숨어 있고, `durationMs()` 를 호출하는 모든 `it` 마다(사실상 모든 테스트 케이스에서)
  반복 실행된다.
  - 위치: `codebase/backend/test/terminal-duration-sql.e2e-spec.ts:59`~`60`
  - 상세: SQL 문자열 자체의 정적 성질(런타임 입력과 무관)을 검증하는 assertion이 실행 시점마다
    반복되는 것은 기능적으로는 무해(멱등)하지만, "SQL 빌더 헬퍼가 왜 `expect` 를 호출하는가"는
    함수 서명만 보고는 바로 드러나지 않는다. 주석(`vacuous 방지`)이 있어 의도 파악은 가능하지만,
    같은 검증을 파일 로드 시 1회(또는 별도 `it`)로 분리하면 "빌더는 빌드만 한다"는 단일 책임이
    더 명확해진다.
  - 제안: 선택 사항. 현재도 명확한 주석이 있어 실질적 위험은 낮음 — 우선순위 낮음.

### 요약

유일한 실코드 변경(`terminal-duration-sql.e2e-spec.ts`)은 함수가 모두 짧고 단일 책임(엔티티
메타데이터 조회 2개, SQL 파라미터 치환 1개, 쿼리 실행 헬퍼 1개)이며, 중첩은 최대 1단계
(`describe` 안 `describe`)로 얕고, 기존 e2e 스펙 컨벤션(`@jest/globals`, `createDbClient()`,
`[태그] 설명` 형식의 `it` 이름)과 일관되게 맞춰져 있다. 각 함수·블록에 "왜"를 설명하는 JSDoc이
충실해 가독성이 높다. 발견된 사항은 모두 INFO 수준의 사소한 중복 계산·매직값 설명 부족이며,
동작이나 향후 유지보수에 실질적 장애가 되지 않는다.

### 위험도

LOW
