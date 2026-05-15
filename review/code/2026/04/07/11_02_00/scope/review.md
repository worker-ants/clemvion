### 발견사항

- **[INFO]** `use-expression-context.ts`에서 테이블 노드의 기본 mode가 `"dynamic"`으로 fallback 처리됨
  - 위치: `use-expression-context.ts:120`
  - 상세: `const mode = (config?.mode as string) ?? "dynamic"` — mode가 미설정된 테이블 노드가 자동으로 `$sourceItem` 컨텍스트를 받게 됨. 이 fallback이 의도된 설계인지 확인 필요.
  - 제안: 명시적으로 dynamic 모드만 지원한다면 `?? "static"` 또는 `if (mode === "dynamic")` 조건을 명확히 주석으로 문서화

- **[INFO]** 테스트에서 `$dataSource` 미노출 케이스를 검증하지 않음
  - 위치: `use-expression-suggestions.test.ts:248-256`
  - 상세: `"does not show $sourceItem when sourceItemSample is null"` 테스트에서 `$sourceItem`, `$sourceItemIndex`만 검증하고 `$dataSource`는 누락됨 (노출 케이스에서는 검증함)
  - 제안: `expect(labels).not.toContain("$dataSource")` 추가

---

### 요약

4개 파일 모두 `$sourceItem` / `$sourceItemIndex` / `$dataSource` 변수 지원을 테이블 노드의 표현식 에디터에 추가하는 단일 기능 구현에 집중되어 있습니다. 불필요한 리팩토링, 무관한 파일 수정, 포맷팅 변경, 미사용 임포트 추가 등 범위를 벗어난 변경은 없습니다. 변경 범위가 매우 깔끔하게 유지되었습니다.

### 위험도

**NONE**