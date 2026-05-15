## 발견사항

### [INFO] `findMatchingBrace`에서 싱글쿼트 문자열 처리
- 위치: `recover-leaked-plan.ts` — `findMatchingBrace` 함수, `inString` 로직
- 상세: JSON 표준은 싱글쿼트 문자열을 허용하지 않으나, 함수가 `"'"` 도 문자열 구분자로 처리한다. `tryParseObject`가 `JSON.parse`를 사용하므로 실질적으로 싱글쿼트 JSON은 파싱 단계에서 거부된다. brace scanner의 싱글쿼트 처리는 동작에 영향이 없는 불필요한 일반화이나, 정확성을 해치지는 않는다.
- 제안: 현재 동작에 영향이 없으므로 수정 불필요. 단, 향후 유지보수자가 의아할 수 있으므로 짧은 주석 추가를 고려할 수 있다.

---

### [INFO] 시스템 프롬프트 테스트의 패턴 매칭 범위
- 위치: `system-prompt.spec.ts` — 새 테스트 케이스의 `(a)` 검증
- 상세: `expect(prompt).toMatch(/\{\s*"title"\s*:/)` 및 `expect(prompt).toMatch(/\{\s*"steps"\s*:/)` 패턴은 새로 추가된 self-check 섹션 외에도 프롬프트의 다른 예시 영역(Ex2 등)에서도 매칭될 수 있다. 즉, self-check 섹션이 삭제되어도 테스트가 통과할 가능성이 있다.
- 제안: `BAD ❌` 라벨과 결합하여 해당 섹션에 특정한 앵커 문구를 검증하거나, 인접 문구와 함께 매칭(`/Self-check[\s\S]+?"title"\s*:/)`)하면 회귀 포착력이 높아진다.

---

## 요약

변경 범위는 명확하게 정의된 단일 문제(LLM의 `propose_plan` payload가 text 채널로 누출되는 현상)에 집중되어 있다. 프롬프트 강화(option A: `system-prompt.ts` + 대응 테스트)와 서버사이드 복구(option B: 신규 `recover-leaked-plan.ts` 모듈 + 통합 + 테스트)로 구성된 두 겹 방어선이며, 수정된 모든 파일과 코드 영역이 이 목적에 직접 연결된다. 무관한 리팩토링, 불필요한 포맷팅 변경, 의도하지 않은 설정 수정은 발견되지 않았다.

## 위험도

**NONE**