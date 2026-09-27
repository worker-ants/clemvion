# 정식 규약 준수 검토 — patch-body-followups (`--impl-done`, scope=`spec/2-navigation/`)

## 검토 범위에 대한 메모

- scope(`spec/2-navigation/`) 의 spec 파일 델타는 **0개**다(이 PR 은 spec 을 바꾸지 않았다) — 이것 자체는 정상이며 CRITICAL 근거로 쓰지 않았다.
- 실제 구현 diff(11~12개 파일 / ~372줄, `_code_diff.patch`)는 `codebase/backend/src/modules/workflows/dto/**`(SoT: `spec/2-navigation/1-workflow-list.md`), `codebase/backend/src/modules/auth-configs/**`(SoT: `spec/2-navigation/6-config.md`), `codebase/backend/src/modules/nodes/**`(SoT: scope 밖이지만 같은 코드를 소유하는 `spec/3-workflow-editor/1-node-common.md`), 그리고 `omit-undefined.ts`/`.spec.ts`, `CHANGELOG.md` 를 건드린다. 이 diff 를 정식 규약(`spec/conventions/**`, 특히 `swagger.md` + 그 SoT 인 `spec/5-system/2-api-convention.md §5.4`)에 대조했다.
- plan(`plan/in-progress/patch-body-followups.md`)과 3 라운드 `/ai-review`(Critical 0 유지, Warning 은 각 라운드에서 처분·반증)를 함께 읽었다.

## 발견사항

특기할 CRITICAL/WARNING 위반을 찾지 못했다. 아래는 확인 근거와 INFO 1건이다.

- **[INFO]** `response-contract.ts` 의 `contractForDto` 를 요청(request) DTO 스키마 검사에 재사용
  - target 위치: `codebase/backend/src/modules/{workflows,nodes,auth-configs}/dto/*-validation.spec.ts` (신규 "선언 캐너리"), `auth-config-ip-whitelist.dto.spec.ts`
  - 위반 규약: 없음(강제 규약 없음) — `spec/conventions/swagger.md` §5-1 / `spec/5-system/2-api-convention.md §5.4 검증 층` 참고
  - 상세: 헬퍼 파일명·독스트링은 "**실제 응답 1건**을 광고 DTO 스키마와 대조"(response 대조)를 설명하는데, 이번 캐너리들은 `contractForDto(UpdateWorkflowDto)` 등 **요청** DTO 에 적용해 `schema.properties?.description` 의 `nullable` 선언만 정적으로 읽는다(런타임 응답 대조 없음). 같은 저장소에 이미 `workflow-response.dto.spec.ts`/`folder-response.dto.spec.ts` 가 응답 DTO 스키마만 뽑아 쓰는 선례가 있어 완전히 새로운 패턴은 아니지만, "response" 라는 이름의 헬퍼가 request DTO 검증에도 쓰이는 점은 다음 사람이 grep 할 때 혼동을 줄 수 있다.
  - 제안: 조치 불요 수준(INFO). 굳이 정리한다면 헬퍼를 `schemaForDto` 류의 더 중립적인 이름으로 부르거나, 해당 캐너리 주석에 "요청 DTO 지만 스키마 생성기만 재사용한다" 한 줄을 추가하는 정도로 충분하다. 규약을 갱신할 필요는 없다.

## 준수 확인 (참고용 — 위반은 아님)

- **요청 DTO nullable 선언**: `UpdateWorkflowDto.description` / `UpdateNodeDto.description` / `UpdateAuthConfigDto.ipWhitelist` 셋 다 `@ApiPropertyOptional({ …, nullable: true })` + `field?: T | null` 조합으로 바뀌었다. 이는 `spec/5-system/2-api-convention.md §5.4` 도입부가 명시적으로 정당화하는 **요청 바디 tri-state 예외**(선례로 `UpdateAssistantSessionDto.llmConfigId` 를 직접 인용)와 정확히 같은 패턴이다 — 규약이 예시로 든 형태를 그대로 재현한 사례.
- **DTO 명명**: 셋 다 기존 `Update<Entity>Dto` 최상위 요청 바디 접두 규칙(`swagger.md §1-7`)을 유지하며 이름을 바꾸지 않았다. `Patch` 접두 등 금지 패턴 없음.
- **JSDoc/설명 분리**: 바뀐 필드 JSDoc(`설명. null 이면 설명을 지운다` 등)은 소비자가 알아야 하는 동작을 담아 `swagger.md §3` "JSDoc 은 공개 OpenAPI 로 나간다" 원칙과 정합한다. 내부 경위(왜 이렇게 됐는지)는 테스트 파일의 `//` 주석에 두고 DTO JSDoc 에는 넣지 않았다.
- **가드 정합**: swagger 가드(`swagger-dto-contract.spec.ts`)가 데코레이터·타입 중 한쪽만 되돌리는 회귀를 잡는다는 것을 뮤턴트 D1~D3 로 실측했고, 둘을 함께 되돌리는(원래의 과소광고로 복귀) 회귀는 그 가드가 못 보는 지점이라 신설 "선언 캐너리"가 D4~D6 로 그 공백을 메운 것을 확인했다 — `spec/5-system/2-api-convention.md §5.4 검증 층` 표가 말하는 "선언이 양쪽 다 틀린 경우를 못 본다"는 한계와 정확히 일치하는 처방이다.
- **응답 wrapping**: 신규 e2e(E1~E3)는 `patched.body.data` 형태로 단언해 `swagger.md §2-5` 의 `{ data: … }` 래핑 규약을 그대로 따른다. 새 엔드포인트·에러코드·이벤트 페이로드는 추가되지 않아 §5.3/§6 관련 규약은 영향 없음.
- **CHANGELOG**: 신설 항목(`## Unreleased — OpenAPI: …`)이 파일 최상단 규칙("새 항목은 맨 위에 `## Unreleased — <무엇이 바뀌었나>`")과 "OpenAPI 로 광고하는 계약의 변화" 기준에 맞게 삽입됐다. 다만 이 채점 기준(`plan/complete/changelog-criteria.md`)은 `spec/conventions/` 밖에 있어 본 검토의 정식 규약 스코프는 아니다(참고로만 기록).
- **`code:` frontmatter 증거**: 변경된 DTO/서비스/스펙 파일은 모두 기존 glob(`modules/workflows/dto/**`, `modules/auth-configs/**`, `modules/nodes/**`)에 포섭돼 `spec-impl-evidence.md` §4 가드(≥1 매치 의무)를 깨지 않는다. `omit-undefined.ts`/`patch-partial-body.e2e-spec.ts` 는 특정 spec 문서에 개별 등재돼 있지 않지만, 이는 이 PR 이 새로 만든 파일이 아니라 기존 cross-cutting 유틸/e2e 파일에 대한 추가 편집이라 이번 diff 가 새로 만든 규약 위반이 아니다(R-1: glob 기반 영역 소유가 정식 허용 패턴).

## 요약

이번 PR(`patch-body-followups`)은 spec 델타 없이 3개 요청 DTO(`UpdateWorkflowDto.description` · `UpdateNodeDto.description` · `UpdateAuthConfigDto.ipWhitelist`)의 nullable 선언을 실제 런타임 동작에 맞춰 정정하고, 그 회귀를 잡는 선언 캐너리·e2e·단위 테스트·CHANGELOG 항목을 추가한 좁고 정밀한 변경이다. 적용된 패턴은 `spec/5-system/2-api-convention.md §5.4`(요청 바디 tri-state 예외)와 `spec/conventions/swagger.md §1-7`(DTO 명명)가 명시한 규칙을 정확히 재현하며, DTO 클래스명·JSDoc/설명 분리·응답 래핑·CHANGELOG 형식 어디에서도 명명·출력 포맷·API 문서·금지 항목 규약 위반을 찾지 못했다. `code:` frontmatter 증거 요건도 기존 glob 으로 충족된다. 유일하게 적은 INFO(response-contract 헬퍼의 요청 DTO 재사용)는 조치 불요 수준의 명명 관찰일 뿐이다.

## 위험도

NONE
