# 신규 식별자 충돌 검토

## 검토 범위 확인

- `spec/5-system/` 델타(`origin/main` 대비): **0개 파일** — 이번 브랜치는 이 spec 영역을 바꾸지 않았다. 신규 요구사항 ID·엔티티명·endpoint·이벤트명·ENV·spec 파일 경로가 이 영역에서 새로 생기지 않았다.
- 실제 변경은 코드 8개 파일(`codebase/backend/...`) + plan 문서 2개 편집 + `CHANGELOG.md`. `--impl-done` 관례에 따라 이 코드 diff 를 "target 이 새로 도입하는 식별자" 로 보고 검토했다(prompt 의 예산 절단 안내에 따라 워킹트리를 절대경로/`git -C`로 직접 열어 확인).

## 신규 식별자 목록과 충돌 확인

1. **`AuditLogListItem`** (`codebase/backend/src/modules/audit-logs/audit-logs.service.ts:19`) — `Omit<AuditLog,'user'> & { user: Pick<User,'id'|'name'|'email'>|null }`. 전체 리포에서 이 이름의 다른 정의 없음(grep 전수). 기존 `AuditLogDto`/`AuditLogUserDto`(응답 DTO, `dto/responses/audit-log-response.dto.ts`)와 이름이 겹치지 않고 역할도 분리되어 있다(엔티티측 타입 vs 문서화 DTO). 충돌 없음.
2. **`response-contract.ts` 신설 모듈의 export 일체** — `ContractViolationKind`, `ContractViolation`, `PropertyContract`(비export), `ContractCheckOptions`, `DtoContract`, `findContractViolations`, `formatViolations`, `assertMatchesContract`, `contractForDto`. 전체 리포(`*.ts`, `*.md`) grep 결과 이번 PR 이전에 동일 이름의 정의가 없고, 사용처(4개 e2e + `.spec.ts`)도 전부 이번 PR 이 새로 추가한 import 다. 기존 `swagger-probe.ts`(pre-existing, 이번 diff 로 수정되지 않음)가 내보내는 `buildSwaggerDocument`/`schemasOf`/`schemaOf`/`SwaggerSchemaObject` 를 그대로 재사용할 뿐 이름을 재정의하지 않는다. 충돌 없음.
3. **API endpoint** — 이번 PR 은 새 endpoint 를 추가하지 않았다. `GET /api/audit-logs` 는 기존 경로 그대로이며, 변경은 응답 바디의 `user` 필드 셀렉트 범위를 3개 컬럼으로 좁힌 것(계약 준수 보안 수정)뿐이다. 신규 endpoint 충돌 해당 없음.
4. **이벤트/큐/webhook 이름** — 이번 diff 에 신규 이벤트·큐·메시지명 도입 없음(대상 코드가 감사 로그 조회 서비스 + 테스트 인프라뿐).
5. **환경변수·설정키** — 신규 ENV/config key 도입 없음.
6. **spec/파일 경로** — 신규 spec 파일 생성·경로 변경 없음(spec 델타 0). 다만 plan 문서(`spec-draft-nullable-notation-followups.md`)에 새 TODO 항목 하나가 등재됐다: *"`2-api-convention.md` frontmatter `code:` 에 `response-contract.ts` 등재"* — 이는 기존 §5.4(spec/5-system/2-api-convention.md:176, 사전 존재 섹션) 를 가리키는 것이며 새 섹션 ID 를 만드는 것이 아니다. §5.4 참조는 코드·plan·CHANGELOG 전체에서 일관되게 같은 기존 섹션을 가리킨다 — 충돌 없음.

## 부가 확인

- `qb.leftJoin`/`qb.addSelect` 로 TypeORM 쿼리빌더 메서드를 교체했으나 이는 라이브러리 표준 메서드로 신규 식별자 도입이 아니다.
- e2e 스펙에 추가된 지역 변수(`auditLogContract`, `sessionContract`, `workflowContract`, `executionContract`)는 함수/describe 스코프에 갇힌 로컬 바인딩이라 전역 충돌 위험 없음.

## 요약

이번 브랜치는 `spec/5-system/` 문서 자체를 바꾸지 않았고(델타 0), 코드 변경은 감사 로그 응답의 과다 노출 보안 수정(`AuditLogListItem` 신설)과 §5.4(기존 섹션) 응답-계약 검증 헬퍼(`response-contract.ts`) 신설로 구성된다. 두 변경이 도입하는 모든 신규 타입·함수 식별자(`AuditLogListItem`, `ContractViolation*`, `DtoContract`, `findContractViolations`, `assertMatchesContract`, `contractForDto` 등)를 리포 전체 grep 으로 대조한 결과 기존 사용처와 이름이 겹치는 사례가 없었고, 신규 API endpoint·이벤트명·ENV·spec 파일 경로 도입도 없었다. plan 문서가 인용하는 `§5.4` 는 새로 부여된 섹션 번호가 아니라 `spec/5-system/2-api-convention.md` 에 이미 존재하는 섹션을 가리키는 것으로 확인했다. 신규 식별자 충돌 관점에서 지적할 사항이 없다.

## 위험도

NONE
