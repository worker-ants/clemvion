# Cross-Spec 일관성 검토 — forbidden-helper-sentences

## 검토 대상 요약

이번 diff(7파일/262줄)는 순수 Swagger `@ApiForbiddenResponse` **설명 문자열** 리팩터다 — 손으로 보간하던 403 설명 3곳과, 가드
문장 뒤에 서비스 문장을 `, 또는`(comma)으로 잇던 8곳을 공용 헬퍼 `forbiddenWithService(guard, service)` (`${guard} 또는
${service}`) 로 통일했다. Route guard 로직·실제 HTTP 상태 코드·에러 코드(`NOT_A_MEMBER` / `EDITOR_REQUIRED` /
`RERUN_PERMISSION_DENIED` / `ADMIN_REQUIRED` 등)·RBAC 판정 자체는 변경되지 않았다 — 변경은 OpenAPI 문서 문자열의 구두점과
조립 경로뿐이다. spec 델타는 0파일이며 plan 도 `spec_impact: none` 으로 명시했다.

## 대조한 spec 근거

- `spec/conventions/swagger.md` §5-4 — "문장은 공용 헬퍼 `FORBIDDEN_NOT_A_MEMBER` · `forbiddenForRole(role)` 로 만들고, 서비스가
  내는 403 은 그 뒤에 덧붙인다" 는 규약을 이미 명문화하고 있다. 이번 구현은 그 "덧붙인다" 를 헬퍼 함수로 구체화한 것으로, 규약과
  방향이 일치한다.
- `spec/conventions/swagger.md` Rationale "§5-4 403 설명의 거부 코드 — 왜 두 코드이고 왜 가드로 세는가 (2026-09-26)" — "서비스
  거부는 세지 않는다. … 헬퍼 문장 뒤에 덧붙이도록 안내만 한다" 와도 상충하지 않는다.
- `spec/data-flow/12-workspace.md` "가드 거부의 오류 코드 (2026-09-25)" 표 — `NOT_A_MEMBER` / `EDITOR_REQUIRED` /
  `ADMIN_REQUIRED` / `OWNER_REQUIRED` 코드 체계와 diff 의 `forbiddenForRole` 호출이 참조하는 코드가 일치한다.
- `spec/5-system/13-replay-rerun.md` RR-PL-06 — reRun 은 `NOT_A_MEMBER` / `EDITOR_REQUIRED` / `RERUN_PERMISSION_DENIED` 세
  코드, getChain 은 `NOT_A_MEMBER` / `RERUN_PERMISSION_DENIED` 두 코드로 문서화되어 있고, diff 의
  `forbiddenWithService(forbiddenForRole('editor'), …RR-PL-06…)` / `forbiddenWithService(FORBIDDEN_NOT_A_MEMBER, …RR-PL-06…)`
  가 정확히 이 코드 집합을 실어 문서와 일치한다.
- `spec/0-overview.md` §6.1 "워크스페이스 단위 Integration 공유·RBAC" 행 — "Organization-scope 의 생성·수정·전환은 Admin+" 라고
  적혀 있고, `integrations.controller.ts` 의 `FORBIDDEN_MEMBER_OR_ORG_ADMIN` / `FORBIDDEN_EDITOR_OR_ORG_ADMIN` 이 여전히
  `ROLE_REQUIRED.admin.code` 를 참조해 Admin+ 요구를 유지한다 — 값 변경 없이 조립 방식만 바뀌었다.

## 발견사항

없음 — CRITICAL/WARNING 급 충돌을 찾지 못했다.

- **[INFO]** 이음 구두점(` 또는 ` vs `, 또는 `)의 결정 근거가 spec 이 아니라 코드 JSDoc 에만 있다
  - target 위치: `codebase/backend/src/common/swagger/forbidden-descriptions.ts` `forbiddenWithService` JSDoc
  - 충돌 대상: `spec/conventions/swagger.md` §5-4 / Rationale "§5-4 403 설명의 거부 코드"
  - 상세: §5-4 본문은 "서비스가 내는 403 은 그 뒤에 덧붙인다" 라고만 적고 구체 구두점(join 문자열)이나 헬퍼 이름
    `forbiddenWithService` 를 명시하지 않는다. 실제 충돌은 아니다 — 이번 PR 의 plan(`--impl-prep` 검토 INFO2)이 이미 "형식 결정은
    헬퍼를 쓰는 사람이 읽는 코드 JSDoc 에 싣는다" 는 것을 의도적 선택으로 기록했고(spec Rationale 로 승격하지 않음), spec 은 여전히
    상위 규칙(무엇을 붙이는가)만 규정하는 층위 분리가 유지된다.
  - 제안: 조치 불필요. 향후 이 헬퍼가 구두점을 다시 바꾸는 일이 생기면 그때는 spec Rationale 승격을 고려할 정도로만 낮은 우선순위.

## 요약

diff 는 라우트 가드·에러 코드·RBAC 판정을 바꾸지 않는 순수 OpenAPI 설명 문자열 통합이며, `spec/conventions/swagger.md` §5-4·그
Rationale, `spec/data-flow/12-workspace.md` 가드 거부 코드 표, `spec/5-system/13-replay-rerun.md` RR-PL-06 코드 집합,
`spec/0-overview.md` 의 Organization-scope Admin+ RBAC 서술과 모두 값·의도가 일치한다. 데이터 모델·API 계약 shape·요구사항
ID·상태 전이·RBAC 모델·계층 책임 어느 관점에서도 다른 spec 영역과의 모순을 발견하지 못했다.

## 위험도

NONE
