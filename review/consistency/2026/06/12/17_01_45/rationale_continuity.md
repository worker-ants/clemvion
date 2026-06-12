# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/conventions/, diff-base=origin/main)
실제 변경 파일: `spec/conventions/error-codes.md` (1개), `spec/5-system/15-chat-channel.md` (Rationale 추가), `spec/5-system/1-auth.md` (1줄 보강), `spec/5-system/11-mcp-client.md` (행 추가)

---

## 발견사항

- **[WARNING]** §5 예외 track 진입 조건 — "외부 노출" 기준 묵시적 확대
  - target 위치: `spec/conventions/error-codes.md` §5 Rename 이력 — intro 단락 수정 및 신규 row
  - 과거 결정 출처: `spec/conventions/error-codes.md ## Rationale` ("왜 rename 대신 신설인가") · §5 기존 intro ("외부에 노출된 적이 없다")
  - 상세: 기존 §5 intro 는 "외부에 노출된 적이 없다"를 §5 track 진입의 전제로 명시했다. `WORKSPACE_REQUIRED` 는 user-docs 목록에 노출된 코드라 이 전제에 정확히 부합하지 않는다. PR 은 intro 문구를 "외부 client 코드에 분기로 노출된 적이 없다 (문서 목록에만 노출됐던 코드는 신규 코드로 동기화)"로 수정해 §5 의 진입 조건을 "client 분기 미존재"로 좁히고, "문서 노출"은 허용 범위로 포함했다. 이 변경은 §5 예외 정책을 실질적으로 넓히는 내용이지만 `## Rationale`에 별도 항을 추가하지 않았다. 기존 두 LLM_CONFIG 항목은 "외부에 노출된 적이 없다"는 전제를 충족했으므로, 신규 `WORKSPACE_REQUIRED` 항목 추가와 정책 문구 변경이 같은 커밋에서 이뤄지는 것이 Rationale 비문서화 번복에 해당할 수 있다.
  - 제안: `## Rationale`에 "§5 진입 기준 — '외부 client 코드 분기 미존재'" 항을 추가해 "문서 목록 노출만으로는 client 분기가 생기지 않으므로 breaking impact 0" 논거를 명문화할 것. 예: `### §5 진입 기준 완화 — client 분기 기준 채택` 항 신설.

- **[WARNING]** `spec/5-system/15-chat-channel.md` §5.4 에러 응답 표 — 변경 반영 누락
  - target 위치: `spec/5-system/15-chat-channel.md` §5.4 실패 응답 표 (line 340)
  - 과거 결정 출처: 동 파일 내 신설 Rationale `R-CC-18` (`rotate-bot-token` workspace 검증 — 공용 `@WorkspaceId()` 데코레이터 통일)
  - 상세: R-CC-18 는 "응답을 `400 WORKSPACE_ID_REQUIRED`로 둔다"고 명시하지만, §5.4 에러 응답 표는 여전히 `| 401 | WORKSPACE_REQUIRED | ...`를 유지한다. 같은 spec 문서 내에서 본문 표(§5.4)와 Rationale(R-CC-18)가 충돌한다. Rationale 이 새 결정의 SoT 이므로 표가 stale 상태.
  - 제안: §5.4 표의 해당 row를 `| 400 | WORKSPACE_ID_REQUIRED | X-Workspace-Id 헤더 누락 또는 JWT workspaceId 미포함 (@WorkspaceId() 데코레이터) |`로 갱신하고, 구 코드 참조 링크 혹은 "→ error-codes.md §5 Rename 이력" 주석을 추가할 것.

- **[INFO]** `spec/conventions/error-codes.md` §5 HTTP status 컬럼 — 구 `401` vs 신 `400` 표기
  - target 위치: `spec/conventions/error-codes.md` §5 신규 row HTTP 컬럼 값 `400`
  - 과거 결정 출처: 해당 없음 (신규 항목)
  - 상세: §5 표의 HTTP 컬럼은 "대체 코드의 HTTP status"를 기록한다. `WORKSPACE_REQUIRED`는 `401` 이었고 `WORKSPACE_ID_REQUIRED`는 `400`으로 변경됐으므로, 이 경우 HTTP status 자체도 바뀐 케이스다. 기존 LLM_CONFIG 항목 2건은 HTTP status 변화 없이 코드명만 바꿨다. 현행 §5 intro 는 "HTTP status 변경" 여부를 별도로 언급하지 않는다. HTTP status 변경까지 포함한 rename 은 더 넓은 의미의 계약 변경이므로, 신규 row 비고에 "(HTTP status 도 401→400 정정)"을 이미 명시한 점은 적절하나, §5 intro 또는 Rationale 에 "HTTP status 변경을 수반한 rename 의 허용 조건"을 구체화하면 후속 케이스에 대한 가이드가 된다.
  - 제안: 선택적 보완. §5 Rationale 또는 intro에 "HTTP status 변경을 수반하는 경우 비고에 명기한다" 한 줄을 추가해 패턴을 명문화할 것.

---

## 요약

`spec/conventions/error-codes.md`의 실제 변경은 §5 Rename 이력 표에 `WORKSPACE_REQUIRED → WORKSPACE_ID_REQUIRED` 한 row를 추가하고, §5 intro 문구를 "외부에 노출된 적이 없다" → "외부 client 코드에 분기로 노출된 적이 없다 (문서 목록에만 노출됐던 코드는 신규 코드로 동기화)"로 바꾼 것이다. 이 문구 변경은 §5 진입 조건을 묵시적으로 완화하며, 그 논거가 `## Rationale`에 별도 항으로 문서화되지 않은 것이 주요 연속성 갭이다. 기각된 대안의 재도입이나 합의된 invariant의 직접 위반은 발견되지 않는다. 추가로 `spec/5-system/15-chat-channel.md` 는 R-CC-18 Rationale이 선언한 `400 WORKSPACE_ID_REQUIRED`를 §5.4 본문 표에 반영하지 않아 spec 내부 불일치가 존재한다. 전체 위험도는 LOW로 판단한다.

---

## 위험도

LOW
