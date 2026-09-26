# 보안(Security) 리뷰 — export-workflow-typed

## 발견사항

- **[INFO]** `config`/`condition` 필드가 여전히 임의 키-값을 허용하는 열린 맵으로 광고된다
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts` — `ExportedNodeDto.config`(169행), `ExportedEdgeDto.condition`(218행)
  - 상세: `@ApiProperty({ type: 'object', additionalProperties: true })` 로 선언돼 OpenAPI 상 스키마가 임의 키를 허용한다. 노드 `config`(예: `http_request` 의 URL·헤더 등)에 자격증명류 값이 들어갈 수 있는 노드 타입이 존재한다면 export 응답을 통해 그대로 노출될 수 있다. 다만 이 PR 은 `nodes`/`edges` 원소를 타입 없는 배열에서 `ExportedNodeDto`/`ExportedEdgeDto` 참조로 **광고만** 바꾼 것이고, `config`/`condition` 자체의 열린-맵 형태·값의 실제 노출 여부는 이 PR 이전부터 동일하다(plan 실측: "서버는 원래 이 형태를 돌려주고 있었다 — 응답 자체는 그대로다"). 즉 이 diff 가 새로 만든 노출은 아니며, 인가/필터링 로직도 diff 범위 밖(컨트롤러·서비스 미변경)이다.
  - 제안: 노드 설정에 시크릿이 저장될 수 있는 타입이 있다면(예: API 키를 `config.headers` 에 직접 넣는 구 노드), export 이전에 마스킹/치환하는 정책이 있는지 별도로 확인 권장. 이번 PR 범위의 조치는 불요.

- **[INFO]** 인가 검사가 diff 범위 밖에 있어 이번 변경으로 검증되지 않음
  - 위치: `GET /workflows/:id/export` 컨트롤러/서비스 (이번 diff 에 미포함)
  - 상세: 이번 변경은 응답 DTO 타입 선언과 테스트뿐이며, 워크스페이스 소속·권한 검사 로직 자체는 건드리지 않는다. e2e 테스트도 동일 owner 토큰으로만 접근하므로 교차 워크스페이스 접근 차단은 이번 diff 로 새로 검증되지 않는다(기존 `workspace-rbac.e2e-spec.ts` 소관이라는 점을 스펙 코멘트가 명시).
  - 제안: 별도 조치 불요 — 참고용 범위 확인.

인젝션(SQL/XSS/커맨드/경로 탐색), 하드코딩된 시크릿, 인증 우회, 안전하지 않은 암호화, 민감정보 에러 노출, 신규 취약 의존성 — 해당 사항 없음. 변경된 파일은 다음과 같다:

- `CHANGELOG.md` — 문서 항목 추가만.
- `workflow-response.dto.ts` — 기존에 `items: { type: 'object' }` 로 느슨하게 광고되던 export 응답 `nodes`/`edges` 원소를 `ExportedNodeDto`/`ExportedEdgeDto` 로 정확히 타입화(런타임 동작 변화 없음, OpenAPI 계약 강화).
- `workflow-response.dto.spec.ts` — 스키마 회귀 가드 유닛 테스트 추가/재구성.
- `workflow-crud.e2e-spec.ts` — 기존 duplicate(C) 케이스에 export 응답을 `ExportWorkflowDto` 와 대조하는 계약 단언 추가. 파라미터화된 쿼리(`$1`) 사용, 자격증명 하드코딩 없음.
- `plan/in-progress/*.md`, `review/consistency/**` — 계획·리뷰 산출물 문서, 실행 코드 아님.

## 요약

이번 변경은 `GET /workflows/:id/export` 응답의 `nodes`/`edges` 필드를 이미 서버가 반환하던 형태 그대로 OpenAPI 스키마에 정확히 광고하는 순수 타입/문서화 작업이며, 컨트롤러·서비스·인가 로직·쿼리 로직에는 손을 대지 않는다. 인젝션, 하드코딩 시크릿, 인증/인가 우회, 안전하지 않은 암호화, 에러 메시지 정보 노출, 취약 의존성 등 OWASP Top 10 관점의 신규 취약점은 발견되지 않았다. `config`/`condition` 이 여전히 임의 값을 허용하는 열린 맵이라는 점은 PR 이전부터 존재하던 기존 설계이며 이번 diff 범위 밖으로 판단된다.

## 위험도
NONE
