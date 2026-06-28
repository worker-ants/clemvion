# Cross-Spec 일관성 검토 결과

대상: `plan/in-progress/spec-draft-m1-integration-errorcode.md` (draft)
실제 적용 파일: `spec/2-navigation/4-integration.md`
검토일: 2026-06-28

---

## 발견사항

충돌 발견 없음.

---

### INFO — `error-codes.md` 미등재 결정의 근거가 해당 문서의 자기 선언과 일치

- target 위치: draft "error-codes.md 미등재 결정" 섹션
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/spec-sync-m1-integration-75cbc2/spec/conventions/error-codes.md` §Overview, §3
- 상세: `error-codes.md` Overview 가 명시하는 "본 문서가 유일하게 소유하는 것: ① 의미 기반 명명 원칙 ② rename 안정성 정책 ③ historical-artifact 예외 레지스트리" 와, draft 의 "카탈로그 SoT 는 §9.4, error-codes.md 는 명명 규율 전용" 판단이 완전히 일치한다. 또한 `error-codes.md §3` 은 명시적으로 "원칙(§1)을 따르지 않는 기존 코드" 등록부로 한정하므로, §1 UPPER_SNAKE_CASE 의미 기반 명명을 준수하는 `INTEGRATION_INVALID_SERVICE` 를 §3 에 등재하지 않는 결정은 해당 레지스트리의 목적 범위와 일치한다.
- 제안: 충돌 없음. 판단 정확.

---

### INFO — `preview-test` body 필드명 `serviceType` 이 `oauth/begin` 의 `service` 필드와 구별되는 별도 DTO 임을 확인

- target 위치: draft "변경 2" 및 `spec/2-navigation/4-integration.md §9.2` line 809
- 충돌 대상: `spec/2-navigation/4-integration.md §9.2` line 804 (`oauth/begin` 엔드포인트)
- 상세: `oauth/begin` 의 `body: { service, scopes[], mode, integrationId? }` 의 `service` 필드는 `OAuthBeginDto` 전용이며 `preview-test` 의 `PreviewTestDto` 와 별개 DTO 다. draft 가 이 차이를 명시적으로 "범위 밖(미변경)" 으로 구분하고 있으며, spec §9.2 의 두 엔드포인트 행도 각각 다른 필드명을 사용 — 모순 없음.
- 제안: 충돌 없음. draft 의 "범위 밖" 명기가 정확하므로 추가 조치 불필요.

---

### INFO — `spec/5-system/11-mcp-client.md` 의 `preview-test` 참조가 DTO 필드명과 무관

- target 위치: draft "변경 2"
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/spec-sync-m1-integration-75cbc2/spec/5-system/11-mcp-client.md` lines 456, 522
- 상세: `11-mcp-client.md` 는 `preview-test` 의 실패 응답 형식(HTTP 200 OK + `{ success: false, code, message }`)과 MCP 전용 에러 코드(`MCP_HTTPS_REQUIRED` 등)를 언급하지만, request body 필드명(`service` vs `serviceType`)을 어디서도 명시하지 않는다. 따라서 `serviceType` 정정의 영향이 없다.
- 제안: 충돌 없음. 추가 동기화 불필요.

---

## 요약

Cross-Spec 일관성 관점에서 두 변경(`INTEGRATION_INVALID_SERVICE` §9.4 등재, `preview-test` body 필드명 `service` → `serviceType`)은 다른 spec 영역과 충돌하지 않는다. `INTEGRATION_INVALID_SERVICE` 는 `error-codes.md` 를 포함한 어떤 다른 spec 파일에서도 다른 의미로 선점되지 않았다. `error-codes.md` 미등재 결정은 해당 문서의 자기 선언(명명 규율 전용·§3=명명 위반 예외만)과 일치한다. `preview-test` 의 `serviceType` 수정은 `oauth/begin` 의 별도 DTO `service` 필드와 구별되며, 다른 영역의 spec 이 이 endpoint 의 request body 필드명을 명시하는 경우가 없어 파급 없다. 데이터 모델·RBAC·상태 전이·계층 책임 어느 축에서도 충돌이 발견되지 않는다.

---

## 위험도

NONE
