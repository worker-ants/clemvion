# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done` (구현 완료 후 검토)  
Target 범위: `spec/4-nodes/4-integration/` (0-common · 1-http-request · 2-database-query · 3-send-email · 4-cafe24 · 5-makeshop)  
Diff base: `origin/main`

---

## 발견사항

### [INFO] `node-output.md` CONVENTIONS D4 주석이 `HTTP_BLOCKED` 만 언급 — `DB_HOST_BLOCKED`·`EMAIL_HOST_BLOCKED` 누락

- **target 위치**: `spec/4-nodes/4-integration/2-database-query.md §4 SSRF 가드` · `spec/4-nodes/4-integration/3-send-email.md §4 step 7`
- **충돌 대상**: `spec/conventions/node-output.md` line 110 — D4 주석 `"SSRF 차단(HTTP_BLOCKED)"` 가 HTTP Request 노드 코드만 예시로 인용하고 `DB_HOST_BLOCKED` / `EMAIL_HOST_BLOCKED` 는 열거하지 않는다.
- **상세**: D4 주석의 원래 작성 시점에는 Database Query / Send Email 의 SSRF 전용 코드가 정의돼 있지 않았다 (DB는 `INTEGRATION_CALL_FAILED` fallback, Email 은 미정의 상태). 이번 target 에서 `DB_HOST_BLOCKED` 와 `EMAIL_HOST_BLOCKED` 가 각 노드의 전용 코드로 명확히 정의됐으므로, D4 주석의 `HTTP_BLOCKED` 단독 예시는 불완전한 서술이 됐다. 기능적 충돌이 아닌 문서 동기화 필요 사항이다.
- **제안**: `spec/conventions/node-output.md` line 110 의 D4 주석에서 `HTTP_BLOCKED` 를 `HTTP_BLOCKED` / `DB_HOST_BLOCKED` / `EMAIL_HOST_BLOCKED` 로 확장하거나 "각 Integration 노드의 SSRF 전용 코드" 로 추상화한다.

---

### [INFO] `spec/5-system/3-error-handling.md` main 브랜치 Database 에러 표 — `DB_HOST_BLOCKED` 미기재 (워크트리는 이미 반영)

- **target 위치**: `spec/4-nodes/4-integration/2-database-query.md §6.2` (`DB_HOST_BLOCKED` 정의)
- **충돌 대상**: `spec/5-system/3-error-handling.md` §1 (line 80) 및 §2 (line 223) — main 브랜치에서 Database 에러 목록이 `DB_QUERY_FAILED` / `DB_CONNECTION_ERROR` / `DB_CONSTRAINT_VIOLATION` / `DB_PERMISSION_DENIED` 4종만 열거하며 `DB_HOST_BLOCKED` 가 없다.
- **상세**: 워크트리의 `spec/5-system/3-error-handling.md` 는 이미 `DB_HOST_BLOCKED` 를 포함해 동기화돼 있어 이 브랜치 내에서는 일관성이 유지된다. PR merge 전에 main 의 해당 파일이 워크트리 버전으로 갱신되지 않으면 merge conflict 또는 이후 main 조회자에게 혼란이 생길 수 있으므로 확인이 필요하다. 워크트리 자체 검토 범위에서는 이미 정합하다.
- **제안**: PR에서 `spec/5-system/3-error-handling.md` 변경이 포함돼 있는지 확인. 이미 포함됐다면 INFO 레벨 무시 가능.

---

### [INFO] `spec/conventions/node-output.md` D4 주석 참조 링크가 `1-http-request.md §5.8` 만 가리킴

- **target 위치**: `spec/4-nodes/4-integration/2-database-query.md §5.8` · `spec/4-nodes/4-integration/3-send-email.md §5.8`
- **충돌 대상**: `spec/conventions/node-output.md` line 110 — D4 주석의 참조 링크가 HTTP Request 만 가리킨다.
- **상세**: target 의 `2-database-query.md §5.8` / `3-send-email.md §5.8` 도 동일한 D4 결정(execute 안의 실패는 error 포트 라우팅)을 기술하고 있으므로, CONVENTIONS 주석이 단일 링크만 제공하면 독자가 DB/Email 의 D4 구현 위치를 찾기 어렵다.
- **제안**: CONVENTIONS D4 주석의 참조 링크를 세 노드 §5.8 로 확장하거나 "Integration 노드별 §5.8" 로 추상화.

---

## 요약

`spec/4-nodes/4-integration/` 의 이번 변경은 `spec/5-system/3-error-handling.md`·`spec/2-navigation/4-integration.md` 등 연관 spec 과의 일관성이 **worktree 내부에서 이미 정합하게 유지**되고 있다. `DB_HOST_BLOCKED` 신설·HTTP Request SSRF 가드 전 인증 방식 공통 적용·Send Email SSRF 코드 통일 모두 참조 spec 과 대칭된다. 지적된 세 항목은 모두 INFO 등급의 문서 동기화 누락으로, CONVENTIONS `node-output.md` D4 주석이 `HTTP_BLOCKED` 단독 예시를 아직 갱신하지 않은 점이 가장 넓은 독자층에게 오해를 줄 수 있는 항목이다. 기능적·계약적 모순은 발견되지 않았다.

## 위험도

LOW

---

STATUS: SUCCESS
