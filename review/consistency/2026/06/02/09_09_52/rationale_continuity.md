# Rationale 연속성 검토 결과

검토 범위: `spec/2-navigation/` (구현 착수 전 검토, --impl-prep)
검토 일시: 2026-06-02

---

## 발견사항

- **[WARNING]** `trigger-list.md` R-2와 R-14 간의 인라인 인증 필드 처리 충돌
  - target 위치: `spec/2-navigation/2-trigger-list.md` §Rationale R-2 (L202-210)
  - 과거 결정 출처: 같은 문서의 Rationale R-14 "authConfigId v1 — inline 인증 필드 제거" (L284-291)
  - 상세: R-2는 "API 도 동일 분리: `PATCH /api/triggers/:id { config.hmacSecret }` (v1) vs `POST /api/triggers/:id/auth/rotate-secret` (v1.1)"라고 명시하여 v1에서 inline `hmacSecret` PATCH를 허용하는 설계를 기술하고 있다. 그러나 R-14에서는 "인라인 인증 필드 없음: `authType` / `hmacHeader` / `hmacSecret` / `bearerToken` 인라인 행은 두지 않고, `Auth Config | authConfigId` 단일 행만 둔다"고 명시하여 inline 인증 필드 자체를 제거했음을 선언한다. §3 API 주석도 "인증 관련 inline 키 (`config.authType` / `hmacHeader` / `hmacSecret` / `bearerToken`) 는 제거됨 — 인증은 `authConfigId` binding 으로만 (Rationale R-14)"으로 확정하고 있다. R-2는 R-14보다 먼저 작성된 것으로 보이며, R-14에 의해 R-2의 v1 API 경로(`PATCH /api/triggers/:id { config.hmacSecret }`)가 폐기됐으나 R-2 본문 자체가 갱신되지 않았다. 또한 §3 하단 "과거 v1.1 예약 행 `POST /api/triggers/:id/auth/rotate-secret` 은 신설되지 않은 채 본 PR 에서 폐기됐다 (Rationale R-14)"라는 주석이 R-2의 v1.1 rotate 경로도 폐기됐음을 확인한다.
  - 제안: R-2 본문을 "hmacSecret inline 편집은 AuthConfig 도메인으로 이관되어 폐기됨 (R-14 참조). 본 Rationale 항목은 이관 결정 전 설계 이력으로만 보존한다."는 주석으로 갱신하거나, R-2를 별도 항목 "R-2 (폐기됨)"으로 명시 표기하여 구현자가 R-2를 현재 설계로 오인하지 않도록 한다.

- **[INFO]** `spec/2-navigation/14-execution-history.md` Re-run chain badge 와 `spec/5-system/13-replay-rerun.md`의 참조 — Rationale 부재
  - target 위치: `spec/2-navigation/14-execution-history.md` §3.7 Re-run 액션, EH-DETAIL-11
  - 과거 결정 출처: 동 spec 본문 내 (Rationale 섹션 없음)
  - 상세: Re-run chain 기능(EH-DETAIL-11, chain badge, "View chain" 드롭다운)은 `spec/5-system/13-replay-rerun.md`를 SoT로 참조하고 있으나 `14-execution-history.md` 자체에는 `## Rationale` 섹션이 없다. spec 규약(각 spec 문서 끝 `## Rationale`)에 따르면 결정 근거가 있어야 한다. chain badge를 실행 상세 헤더에 배치한 이유, "View chain" 드롭다운의 API 조회 방식(`GET /api/executions/:id/chain`)을 별도 엔드포인트로 분리한 이유 등이 Rationale 없이 기술되어 있다.
  - 제안: `14-execution-history.md` 끝에 `## Rationale` 섹션을 추가하고, chain badge 위치 선택·drill-down Link 패턴 등의 근거를 간략히 기록한다. (`trigger-list.md` R-13의 drill-down Link 이유 기술 방식 참고.)

- **[INFO]** `spec/2-navigation/10-auth-flow.md` §5.3 "decision A, 2026-05-31" 인라인 기록 — Rationale 섹션으로 승격 권고
  - target 위치: `spec/2-navigation/10-auth-flow.md` §5.3 OAuth 콜백 처리 상세 (리다이렉트 행)
  - 과거 결정 출처: 동 문서 §5.3 인라인 "(decision A, 2026-05-31 — URL history/Referer/프록시 로그 노출 차단)"
  - 상세: Access token을 URL에 싣지 않고 Refresh Token만 httpOnly Cookie로 전달하는 결정이 "decision A, 2026-05-31"로 인라인에만 기록되어 있다. `## Rationale` 섹션의 R-1, R-2 항목은 UI 레이아웃에 관한 것이며, OAuth 토큰 전달 방식에 관한 결정 근거는 Rationale 섹션에 정식으로 등재되어 있지 않다. 인라인 결정 메모는 누락·override 되기 쉽다.
  - 제안: `10-auth-flow.md ## Rationale` 섹션에 "R-3. OAuth callback — Access Token URL 제외, Refresh Token httpOnly Cookie"를 추가하고 decision A의 내용(URL history/Referer/proxy log 노출 차단)을 정식 Rationale로 승격한다.

- **[INFO]** `spec/2-navigation/12-workflow-version-history.md` — Rationale 섹션 없음
  - target 위치: `spec/2-navigation/12-workflow-version-history.md` 전체
  - 과거 결정 출처: 없음 (Rationale 섹션 없음)
  - 상세: 워크플로우 버전 이력 spec에 `## Rationale` 섹션이 없다. §9의 "캔버스 저장 실패 시 버전 생성 실패는 다음 저장에서 따라잡힌다"는 동작 보장이나, "복원 시 페이지 리로드" 선택(in-memory 상태와 서버 상태 교체 이유), 불변 스냅샷(immutable snapshot) 설계 선택 등에 대한 근거가 없다.
  - 제안: `## Rationale` 섹션을 추가하고 최소한 "페이지 리로드 방식 선택 이유"와 "불변 스냅샷 선택 이유"를 기록한다.

---

## 요약

`spec/2-navigation/` 전체에서 Rationale 연속성 관점의 심각한 위반은 발견되지 않았다. 가장 주목할 점은 `trigger-list.md` R-2가 R-14에 의해 설계가 폐기됐음에도 R-2 본문 자체가 갱신되지 않아 구현자가 deprecated된 API 경로(`PATCH /api/triggers/:id { config.hmacSecret }`)를 유효한 v1 설계로 오해할 수 있다는 점이다(WARNING). 나머지 발견은 Rationale 섹션 부재 또는 인라인 결정 메모의 정식 승격 권고로, 합의된 원칙이나 invariant를 직접 위반하는 사항은 없다.

---

## 위험도

LOW
