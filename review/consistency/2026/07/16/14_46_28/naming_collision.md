# 신규 식별자 충돌 검토 — spec/4-nodes/3-ai/ (--impl-done)

검토 대상 신규 식별자 (후속 PR #3, `claude/ai-agent-provider-schema-dedup`, base `693e52fe1` #955 이후):

- 파일: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/operation-tool-schema.ts`
- 함수: `buildOperationJsonSchema`, `makeEnabledToolsFilter`
- 구조적 타입: `OperationFieldSpec`, `OperationSchemaSource`

이 변경은 cafe24/makeshop MCP tool provider 가 라인 단위로 중복 보유하던
`build{Cafe24,Makeshop}JsonSchema` / `apply{Cafe24,Makeshop}Allowlist` 를 구조적
타입(`OperationSchemaSource`) 기반 shared 순수 함수로 통합한 순수 리팩터다
(신규 요구사항 ID·API endpoint·이벤트명·ENV var 없음).

## 조사 방법

HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/funny-mahavira-50d003`,
커밋 `b2990accb`)를 대상으로 `git grep` 전수 검색:

- 5개 신규 식별자 각각의 전체 codebase(`codebase/`)·spec(`spec/`)·plan(`plan/`) 사용처
- 근접 명명(예: `FieldSpec`, `Operation*`, `buildJsonSchema`, `Allowlist`, `EnabledToolsFilter`) 기존 정의
- 구 심볼(`buildCafe24JsonSchema`/`applyCafe24Allowlist`/`buildMakeshopJsonSchema`/`applyMakeshopAllowlist`) 잔존 여부
- `spec/conventions/cafe24-api-metadata.md` / `makeshop-api-metadata.md` 의 구현 위치 포인터 정합성
- 파일 경로 `tool-providers/operation-tool-schema.ts` 의 디렉터리 내 명명 컨벤션 일치 여부·git 이력(신규 단일 커밋인지, 과거 다른 의미로 존재했는지)

## 발견사항

### [INFO] `OperationFieldSpec` / `OperationSchemaSource` 가 기존 `Cafe24FieldSpec` / `MakeshopFieldSpec` 과 개념적으로 인접

- target 신규 식별자: `OperationFieldSpec`, `OperationSchemaSource`
  (`codebase/backend/src/nodes/ai/ai-agent/tool-providers/operation-tool-schema.ts:26`, `:40`)
- 기존 사용처: `Cafe24FieldSpec` (`codebase/backend/src/nodes/integration/cafe24/metadata/types.ts:20`),
  `MakeshopFieldSpec` (`codebase/backend/src/nodes/integration/makeshop/metadata/types.ts:27`)
- 상세: 새 `OperationFieldSpec`/`OperationSchemaSource` 는 `Cafe24FieldSpec`/`MakeshopFieldSpec`
  의 **구조적 부분집합**(스키마 매핑에 필요한 `type`/`enum`/`description`/`default`만 추출,
  `location` 등 제외)이다. 이름은 정확히 겹치지 않아(`Operation*` vs `Cafe24*`/`Makeshop*`
  prefix) 실제 식별자 충돌(동일 이름·다른 의미)은 아니다. 다만 "Operation" 이라는 provider-무관
  이름이 두 concrete 타입을 모두 대표하는 상위형이라는 관계를, 이름만 보고는 유추하기 어렵다.
- 근거: 신규 파일 상단 JSDoc(`operation-tool-schema.ts:1-19`)이 이 관계("구조적 타입만
  의존, cafe24/makeshop metadata 무import, 두 concrete 타입이 이 부분집합 인터페이스에
  구조적으로 대입 가능")를 명시적으로 문서화하고 있어 혼동 리스크는 낮다.
- 제안: 조치 불요(문서화 충분). 향후 세 번째 provider(예: 신규 이커머스 연동)가 추가돼
  4번째 concrete `*FieldSpec` 이 생길 경우, `OperationFieldSpec` 이 계속 "provider 공통
  구조적 상위형"이라는 의미를 유지하는지 재확인 권장.

### [INFO] `Operation*` 네이밍 공간이 이미 다른 모듈(Integration 운영 카탈로그 DTO)에서 사용 중이나 실충돌 없음

- target 신규 식별자: `OperationSchemaSource`, `OperationFieldSpec`
- 기존 사용처: `OperationCatalogEntryDto` / `OperationCatalogDto`
  (`codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:151`, `:177`),
  `OperationCatalogEntry` / `OperationCatalogResponse`
  (`codebase/frontend/src/lib/api/integrations.ts:194`, `:202`)
- 상세: 둘 다 "cafe24/makeshop operation" 도메인을 다루지만 완전히 다른 관심사다 —
  기존 것은 Integration 관리 UI 에 노출되는 **operation 카탈로그 조회 API DTO**, 신규
  것은 AI Agent MCP tool provider 내부 **JSON Schema 생성용 구조적 타입**이다. 이름
  suffix(`CatalogEntryDto`/`CatalogDto` vs `SchemaSource`/`FieldSpec`)와 소속 모듈
  (`modules/integrations/dto` vs `nodes/ai/ai-agent/tool-providers`)이 뚜렷이 달라
  동일 import scope 에서 충돌할 가능성은 없다.
- 제안: 조치 불요. 기록 목적의 INFO.

## 충돌 없음으로 확인된 항목 (참고용 근거)

- **파일 경로**: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/operation-tool-schema.ts`
  — 동일 경로에 과거 다른 내용이 존재한 이력 없음(`git log --follow` 단일 커밋
  `40de25889`로 신규 생성). 디렉터리 내 기존 파일(`cafe24-mcp-tool-provider.ts`,
  `makeshop-mcp-tool-provider.ts`, `kb-tool-provider.ts`, `mcp-diagnostics.ts`,
  `render-tool-provider.ts`)과 `<domain>-<role>.ts` 명명 패턴 일치. 다른 영역
  (frontend/channel-web-chat/packages)에 동명 파일 없음.
- **함수명 `buildOperationJsonSchema` / `makeEnabledToolsFilter`**: codebase 전체
  `git grep` 결과 신규 정의(`operation-tool-schema.ts`) + 소비처(`cafe24-mcp-tool-provider.ts`,
  `makeshop-mcp-tool-provider.ts`) + 테스트만 존재. 이전에 사용되던
  `buildCafe24JsonSchema`/`applyCafe24Allowlist`/`buildMakeshopJsonSchema`/`applyMakeshopAllowlist`
  는 두 provider 파일에서 완전히 제거되어 코드베이스에 잔존하지 않음(git grep 0건) —
  구·신 식별자 병존으로 인한 혼선 없음.
- **타입명 `OperationFieldSpec`/`OperationSchemaSource`**: 신규 정의 파일 + 소비 테스트
  (`operation-tool-schema.spec.ts`) 외 사용처 없음. exact-name 재사용 없음.
- **spec 포인터 정합성**: `spec/conventions/cafe24-api-metadata.md` §2(:153)·§7(:391, :398)
  가 `tool-providers/operation-tool-schema.ts` 의 `buildOperationJsonSchema()` 를 정확히
  가리키도록 이미 갱신됨(`b2990accb`, ai-review W1 fix). `spec/conventions/makeshop-api-metadata.md`
  는 cafe24-api-metadata.md §2 를 SoT 로 참조하는 기존 패턴을 유지하며 별도 stale 포인터
  없음(중복 서술 없음, 재확인 완료). `spec/4-nodes/3-ai/` 하위 문서에는 이 5개 식별자에
  대한 참조가 없음(해당 spec 영역은 provider 내부 구현 세부를 직접 지목하지 않음) — 충돌
  대상 자체가 없음.
- **API endpoint / 이벤트·메시지명 / 환경변수·설정키**: 본 변경은 순수 내부 리팩터
  (동작 불변, drift-0 회귀 테스트로 검증)로 신규 endpoint·webhook/queue/SSE 이벤트·ENV var
  를 도입하지 않음. 해당 관점은 checklist 상 N/A.
- **요구사항 ID**: 본 변경은 `spec/4-nodes/3-ai/` 문서 자체를 수정하지 않으며(코드 전용
  리팩터), 신규 요구사항 ID 부여 없음.

## 요약

이번 변경은 `buildOperationJsonSchema`/`makeEnabledToolsFilter`/`OperationFieldSpec`/
`OperationSchemaSource`/`operation-tool-schema.ts` 5개 신규 식별자를 도입하는 cafe24/makeshop
provider 중복 제거 리팩터다. 전체 codebase(`codebase/`)·spec(`spec/`)·plan(`plan/`) 대상
`git grep` 전수 조사 결과 이들 식별자가 기존에 다른 의미로 사용된 사례는 없으며, 구
심볼(`build{Cafe24,Makeshop}JsonSchema`/`apply{Cafe24,Makeshop}Allowlist`)도 완전히
제거되어 신·구 병존 혼선이 없다. 파일 경로는 디렉터리 명명 컨벤션과 일치하고, spec
포인터(`cafe24-api-metadata.md`)도 이미 신규 위치·심볼명으로 정정된 상태다. `OperationFieldSpec`/
`OperationSchemaSource` 가 기존 `Cafe24FieldSpec`/`MakeshopFieldSpec`·`OperationCatalogEntryDto`
류와 "Operation" 네이밍 공간을 공유하는 점은 실제 충돌은 아니되 인접성이 있어 INFO 2건으로
기록했다(조치 불요, 문서화로 충분히 완화됨). API endpoint·이벤트명·ENV var·요구사항 ID
관점은 이번 변경이 순수 내부 코드 리팩터라 해당 사항 없음.

## 위험도

NONE
