# 문서화(Documentation) 코드 리뷰

## 발견사항

- **[WARNING]** spec Rationale · 트래커가 아직 `plan/in-progress/` 인 계획 문서를 `plan/complete/` 경로로 3곳에서 미리 인용한다
  - 위치:
    - `spec/2-navigation/4-integration.md:1174` — `근거·실측: \`plan/complete/spec-draft-integration-connection-tests.md\`.`
    - `plan/in-progress/spec-draft-nullable-notation-followups.md:3594` — `**2026-09-19 해소** \`plan/complete/integration-db-http-testers.md\` — ...`
    - `plan/in-progress/spec-draft-nullable-notation-followups.md:4785` — `(planner — UX 결정, 2026-09-19 등재 · \`plan/complete/integration-db-http-testers.md\`)`
  - 상세: 세 인용 모두 대상 경로가 `plan/complete/`이지만, 실제로는 두 계획 문서(`spec-draft-integration-connection-tests.md`, `integration-db-http-testers.md`) 모두 `plan/in-progress/`에 있고 `plan/complete/<같은 파일명>` 은 존재하지 않는다(확인함 — `ls plan/complete/...` → No such file or directory). 이 저장소의 기존 관례(`spec/1-data-model.md:1019` `근거·실측: \`plan/complete/spec-draft-data-model-fk-actions.md\`.` — 실제로 그 경로가 존재)는 "근거·실측" 역참조가 **이동이 끝난 뒤에만** `plan/complete/`를 가리키는 것이다. `plan/in-progress/integration-db-http-testers.md` 자신의 체크리스트도 "트래커 반영 · 이 plan 과 spec draft `complete/` 이동"을 마지막 미완료 항목으로 남겨 두고 있어(`/ai-review`, `--impl-done` 도 아직 미완료), 이 셋이 시기상조로 앞서 쓰인 참조임을 스스로 인정하고 있다.
  - 제안: 이 PR이 최종적으로 병합되기 전에 두 plan 을 실제로 `plan/complete/`로 이동해 참조를 유효하게 만들거나, 이동 전까지는 세 인용을 `plan/in-progress/`로 임시 수정한다. 그대로 병합되면 커밋 이력에 깨진 경로가 영구히 남는다.

- **[INFO]** `POST /:id/rotate` Swagger 설명이 이제 Database·HTTP 에도 실제 아웃바운드 연결(최대 10초)이 걸린다는 사실을 반영하지 않는다
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` — `rotate()` 핸들러의 `@ApiOperation({ summary: '자격 증명 교체(rotate)', description: '저장된 자격 증명을 새 값으로 교체합니다. 관리자 권한이 필요할 수 있습니다.' })` (이번 diff 밖의 기존 줄, 소스 448번째 줄 부근)
  - 상세: 이번 변경으로 `rotate()`는 Database·HTTP 자격증명에 대해서도 내부적으로 최대 10초 걸리는 실제 연결 테스트를 통과해야 커밋된다(`integrations.service.ts`의 rotate 로직, `dispatchTest` 경유). `preview-test`의 Swagger 설명은 이번 diff에서 "MCP·Email·Database·HTTP는 실제로 접속해 확인합니다"로 갱신됐지만, 같은 성격의 부작용을 갖는 `rotate` 설명은 손대지 않아 API 소비자 입장에서 "왜 rotate 가 몇 초씩 걸리고 `INTEGRATION_TEST_FAILED`로 실패할 수 있는지"가 Swagger 문서만으로는 드러나지 않는다. (Email 은 이미 `verify()`로 같은 특성을 갖고 있었으므로 이번 PR이 새로 만든 결함은 아니고, 범위만 넓어진 것이다.)
  - 제안: `preview-test`와 같은 톤으로 한 줄 추가("MCP·Email·Database·HTTP 는 실제로 접속해 확인한 뒤에만 저장합니다" 등). 급하지 않음 — 우선순위 낮음.

## 확인한 항목 (문제 없음)

- `clamp-message.ts`, `database-connection-tester.ts`, `http-connection-tester.ts`, `http-redirect.ts`, `http-credentials.ts`, `database-connection.ts` 신규 모듈 전부 모듈/함수 단위 JSDoc이 spec 절 번호(§5.3·§5.4)까지 명시하며 정확하다 — 코드(에러 코드 분기, 타임아웃 값, 닫기 보장 등)와 실제로 대조해 검증했고 불일치 없음.
- `CHANGELOG.md`의 신규 Unreleased 항목은 동시 상한(`CONNECTION_TEST_MAX_CONCURRENCY=2`), 타임아웃(10초), 리다이렉트 홉 수(5), 에러 코드 목록을 실제 상수·분기와 대조했고 전부 일치.
- `integration-response.dto.ts`의 `PreviewTestResultDto.code` / `TestConnectionResultDto.code` 독스트링 갱신은 신설된 `DB_*`·`HTTP_*` 코드를 정확히 반영하고, 형제 DTO 상호 참조도 유효하다.
- `integrations.controller.ts`의 `preview-test` `@ApiOperation`/`@ApiOkWrappedResponse` 설명 갱신은 실제 `dispatchTest` 동작(구조 검증 우선, transport tester 있는 서비스만 실접속) 및 spec §9.2 참조와 일치.
- `spec/2-navigation/4-integration.md`의 §5.1/§5.2/§5.3/§5.4/§5.7/§9.2/§9.4/§10.3/§10.5/§14.1 및 새 Rationale 절은 구현·CHANGELOG·가이드 문서와 상호 일치(주소 미노출, 4xx 처리, DB_CONNECT_FAILED 모집합 차이 등 세부까지 대조).
- 프런트엔드 사용자 가이드(`integration-management.mdx`/`.en.mdx`)의 새 Callout은 한국어·영어판이 서로 대칭이고, 코드의 실제 타임아웃·상태코드 분류(401/403 vs 그 외 4xx vs 5xx)·SSRF 차단 문구 비노출과 정확히 일치. 한국어판 frontmatter `code:` 목록에 새 테스터 파일 2개가 추가돼 doc-sync 매트릭스도 갱신됨.
- `plan/in-progress/integration-db-http-testers.md`(구현 plan)와 `spec-draft-integration-connection-tests.md`(spec 초안), `spec-draft-nullable-notation-followups.md`에 새로 추가된 백로그 8건은 각각 파일·근거·측정 방법이 구체적으로 적혀 있어 추적 가능성이 높다.
- 신규 unit spec(`database-connection-tester.spec.ts`, `http-connection-tester.spec.ts`) 및 e2e spec(`integration-connection-test.e2e-spec.ts`)의 헤더 주석이 spec 절 번호를 인용하며 테스트 범위(실접속/인증 분기는 unit, 배선은 e2e)를 명확히 구분해 설명한다. `integration-cache-invalidate.e2e-spec.ts`에 추가된 인라인 주석(`base_url`을 뺀 이유)도 정확함.
- 새 환경변수·설정 옵션은 도입되지 않았다(`CONNECTION_TEST_MAX_CONCURRENCY`는 하드코딩 상수이며 문서화가 필요한 외부 설정이 아니다) — 기존 `ALLOW_PRIVATE_HOST_TARGETS` 재사용 부분도 spec·가이드 양쪽에 정확히 반영됨.

## 요약

전반적으로 문서화 품질이 매우 높다 — 새 모듈의 JSDoc, CHANGELOG, spec 갱신, 사용자 가이드(한/영), plan 백로그 전부 실제 구현과 대조해 불일치를 찾지 못했다. 유일하게 실체가 있는 문제는 spec Rationale과 트래커 문서 두 곳(총 3개 인용)이 아직 `plan/in-progress/`에 있는 계획 문서를 `plan/complete/` 경로로 앞서 인용한 것으로, 이는 이 저장소의 "이동 완료 후에만 complete/ 를 인용한다"는 기존 관례를 어긴다 — 다만 해당 plan의 체크리스트 자체가 이동을 마지막 미완료 항목으로 남겨 두고 있어 병합 전 자연히 해소될 가능성이 높다. 그 외 `rotate` 엔드포인트 Swagger 설명이 새로 넓어진 실접속 부작용을 아직 담지 않은 점은 경미한 개선 제안 수준이다.

## 위험도

LOW
