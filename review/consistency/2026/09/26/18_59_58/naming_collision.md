# 신규 식별자 충돌 검토 — `spec-draft-swagger-request-body.md`

## 검토 대상 신규 식별자

- 저장소 가드 이름: `request-body-advertised`
- 가드 파일 glob: `codebase/backend/src/repo-guards/__tests__/request-body-advertised*.ts`
- `swagger.md` §5-4 체크리스트 신규 한 줄: 「요청 본문을 받는 라우트(`@Body()`)는 본문 스키마를 광고한다」
- `swagger.md` Rationale 신규 절 제목: 「§5-4 요청 본문 스키마 — 왜 클래스로 받게 강제하지 않고, 왜 reflection 으로 세는가 (2026-09-26)」

## 발견사항

검토 관점 1~6(요구사항 ID·엔티티/타입명·API endpoint·이벤트/메시지명·환경변수/설정키·파일 경로) 전부에서 **충돌을 찾지 못했다.**

- **요구사항 ID**: 이 draft 는 새 ID 를 부여하지 않는다(§5-4 체크리스트 기존 불릿 사이에 이름 없는 한 줄 삽입).
- **가드 이름 `request-body-advertised`**: `grep -rn "request-body-advertised"` 결과 이 draft 와 구현 plan(`plan/in-progress/request-body-guard.md`) 두 곳에만 존재 — 기존 사용처 없음(신규). 형제 가드 `http-status-advertised`·`forbidden-response-codes` 와 같은 `<subject>-<qualifier>(-guard/.spec)` 명명 축을 그대로 따라 오히려 컨벤션 일관성이 있다.
- **가드 파일 경로**: `codebase/backend/src/repo-guards/__tests__/` 실측 목록에 `request-body-advertised*` 로 시작하는 기존 파일 없음. `code:` frontmatter 삽입 위치(`forbidden-response-codes*.ts` 줄 바로 뒤)도 실제 파일(`swagger.md` 29번째 줄 직전)과 일치.
- **§5-4 Rationale 절 제목**: `spec/` 전역에서 「왜 reflection 으로 세는가」·「왜 클래스로 받게 강제하지 않고」 문자열 재사용처 없음(`grep` 0건). 직전 절 「§5-4 403 설명의 거부 코드 — 왜 두 코드이고 왜 가드로 세는가」와 제목이 겹치지 않아 앵커 충돌도 없다.
- **DTO/타입명**: draft 는 문서 전용 요청 DTO 의 구체 이름(`<Domain><Action>RequestDto` 등)을 **의도적으로 이번 범위에서 제외**하고 트래커(`spec-draft-nullable-notation-followups.md` 5141행)에 남긴다 — 새 타입명을 아예 도입하지 않으므로 이 축의 충돌 표면 자체가 없다.
- **선례 인용의 정합성**: draft·구현 plan이 인용하는 `ExecuteWorkflowDto`(`codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts`)를 직접 Read 로 대조 — JSDoc 이 "파라미터는 인라인 유지, `@ApiBody` 로만 광고, 전역 `CustomValidationPipe` 가 `Object` metatype 은 건너뛴다"는 draft 의 설명과 실측(형태·이유)이 일치한다. 접두/접미 없는 이름이라는 draft 의 주장("`ExecuteWorkflowDto` 는 접미 없음")도 실물과 맞는다.
- **API endpoint / 이벤트 / ENV / config key**: 이번 draft 는 신규 라우트·webhook·queue·SSE 이벤트·ENV 변수·config key 를 전혀 도입하지 않는다(순수 convention 문서 + 가드 명명).
- **파일 경로 컨벤션**: `plan/in-progress/spec-draft-swagger-request-body.md` 파일명은 기존 `spec-draft-<topic>.md` 패턴(`spec-draft-eia-62-waiting-payload.md`, `spec-draft-nullable-notation-followups.md` 등)과 일치하며 기존 파일과 겹치지 않는다.

## 요약

target draft 가 새로 도입하는 유일한 실질 식별자는 저장소 가드 이름/파일 glob `request-body-advertised` 하나이며, 저장소 전체에서 이 문자열의 선행 사용처가 없고 형제 가드(`http-status-advertised`, `forbidden-response-codes`)와 같은 명명 축을 그대로 따른다. §5-4 체크리스트 한 줄과 Rationale 절 제목도 기존 절 제목·앵커와 겹치지 않으며, DTO/타입명은 이번 범위에서 의도적으로 도입을 보류해 그 축의 충돌 가능성 자체를 만들지 않았다. 새 API endpoint·이벤트·ENV·config key 도입이 없어 나머지 관점은 해당 사항 없음(vacuously pass)이다. 신규 식별자 충돌 관점에서 이 draft 는 문제가 없다.

## 위험도

NONE
