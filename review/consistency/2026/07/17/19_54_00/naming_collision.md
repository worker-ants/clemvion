# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 확인

payload 말미 "## 착수 예정 변경 (impl-prep 대상 — 이 변경을 기준으로 판정하세요)" 섹션이 실제 target 이다:

- 대상 파일(단일): `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts`
- 변경 내용: `REGISTRY_SITES` / `SOURCE_REGISTRY_SITES` 각 파일에서 enum 값 string literal 존재 여부를
  `new RegExp("['\"\`]" + value + "['\"\`]")` 정규식(주석까지 매칭)으로 검사하던 것을,
  TypeScript 컴파일러 API(`ts.createSourceFile` + `ts.forEachChild`)로 파싱해 **코드의 StringLiteral
  AST 노드만** 수집·비교하는 방식으로 교체.
- `spec/conventions/interaction-type-registry.md` 자체는 이번 변경으로 수정되지 않는다(frontmatter
  `code:` 에 이미 대상 파일이 등재돼 있어 spec-linked 상태 유지).

앞쪽에 덤프된 `spec/conventions/*`(audit-actions.md, cafe24-api-catalog/* 등), `spec/0-overview.md`,
`spec/1-data-model.md`, `plan/in-progress/*` 는 orchestrator 가 붙인 "영역 컨텍스트"이며 이번 target 변경과
직접 관련이 없다(별개 백로그 항목들). 실제 diff 대상 식별자만 신규 도입 여부를 판정한다.

## 신규 식별자 인벤토리 (target 변경분)

- 요구사항 ID: 신규 없음 (spec frontmatter/본문 미변경)
- 엔티티·타입·DTO: 신규 없음. 기존 `WaitingInteractionType`(4값: `form`/`buttons`/`ai_conversation`/
  `ai_form_render`), `ConversationTurnSource`(7값), `REGISTRY_SITES`/`SOURCE_REGISTRY_SITES`,
  `INTERACTION_TYPE_VALUES`/`CONVERSATION_SOURCE_VALUES` — 모두 기존 식별자 그대로 재사용
- API endpoint: 신규 없음
- 이벤트/메시지명: 신규 없음
- 환경변수·설정키: 신규 없음
- 파일 경로: 신규 없음 — 대상 파일은 이미 `interaction-type-registry.md` frontmatter `code:` 에 등재된
  기존 spec-linked 파일. `ts.createSourceFile`/`ts.forEachChild`/`StringLiteral` 는 프로젝트 신규
  식별자가 아니라 기존 devDependency `typescript`(frontend package.json, `^5`)의 공개 API 명칭

## 발견사항

- **[INFO]** "AST 가드" 용어는 이미 spec 에 선재 — 신규 식별자 충돌 아님
  - target 신규 식별자: (없음) — target 은 "AST 가드"라는 이름을 새로 만들지 않는다
  - 기존 사용처: `spec/conventions/interaction-type-registry.md:56,77,78,117,124,143` 이 이미 이 가드를
    "AST 가드"로 지칭하고 있다 (`3. AST 가드 (\`interaction-type-exhaustiveness.test.ts\` 의
    \`REGISTRY_SITES\`) 가 매트릭스의 모든 enum 값이 등록된 grep 대상 파일에 string literal 로
    등장하는지 검증한다`). 반면 현재 구현(변경 전)은 순수 정규식/grep 이었다.
  - 상세: 이번 target 변경은 새 이름을 도입하는 것이 아니라, **이미 spec 이 붙여둔 이름("AST 가드")에
    구현을 맞추는 방향**(정규식→실제 AST 파싱)이다. 따라서 "신규 식별자가 기존과 다른 의미로 충돌"하는
    사례가 아니다 — 오히려 기존에 spec 텍스트와 구현이 어긋나 있던 명칭-실체 불일치가 이번 변경으로
    해소되는 쪽에 가깝다. `interaction-type-registry.md` 본문에는 "grep 대상 파일", "매트릭스 vs 코드
    grep 결과", "grep 가드 비대상" 같은 "grep" 계열 표현도 다수 병존하는데, 이는 명명 충돌이라기보다
    prose 서술 차원의 shorthand 로 보인다(용어 통일 여부는 convention_compliance/cross_spec 판단 영역).
  - 제안: (신규 식별자 충돌 관점에서는 조치 불요) 용어 통일(spec 전체를 "AST 가드"로 정정하거나 "grep"을
    남길지)은 이 checker 의 스코프 밖이므로 convention_compliance/cross_spec 검토자 판단에 위임.

## 요약

target 변경은 `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` 내부의
검증 알고리즘을 정규식 매칭에서 TypeScript AST 파싱으로 교체하는 순수 구현 변경이며, 요구사항 ID·
엔티티/타입명·API endpoint·이벤트명·환경변수·파일 경로 중 어느 범주에서도 새로운 식별자를 도입하지
않는다. 사용되는 모든 이름(`WaitingInteractionType`, `ConversationTurnSource`, `REGISTRY_SITES`,
`SOURCE_REGISTRY_SITES`, `ts.createSourceFile` 등)은 기존 spec/코드에 이미 존재하거나 외부
라이브러리(`typescript`)의 기존 공개 API이다. 유일하게 언급할 만한 점은 spec 이 이 가드를 이미
"AST 가드"로 불러온 것과 실제 구현이 지금까지 정규식이었던 선재 명칭-실체 갭인데, 이는 신규 식별자
충돌이 아니라 이번 변경으로 오히려 정합이 맞춰지는 방향이라 CRITICAL/WARNING 대상이 아니다.

## 위험도

NONE
