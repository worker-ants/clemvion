# 신규 식별자 충돌 검토 — interaction-type-registry.md

## 검토 방법

`git diff origin/main -- spec/conventions/interaction-type-registry.md` 로 target 문서가
base 대비 실제로 변경한 범위를 확정한 뒤, 그 변경분에서 **새로 도입되는 식별자**가
있는지 점검했다.

## 변경 범위 확인 (중요 전제)

target 커밋의 실제 diff 는 4개 지점, 총 51 라인 변경으로 — 전부 `grep` → `AST(코드
리터럴) 스캔` / `AST 로 스캔한다` 로의 **용어 정정**이다:

1. §1.2 규칙 3: `등록된 grep 대상 파일` → `등록된 AST(코드 리터럴) 스캔 대상 파일`, `grep 가드` → `AST 가드`, `두 가드(grep·TS exhaustive)` → `두 가드(AST·TS exhaustive)`
2. §2.1 매트릭스 `system_error`/`rag` 행: `grep 검증 대상`/`grep 가드 비대상` → `AST(코드 리터럴) 스캔 검증 대상`/`AST 가드 비대상` (2곳)
3. §4 endReason 표: `grep 할 사본이 없다` → `스캔할 사본이 없다`
4. §5 Rationale: `코드 grep 결과를 build 단계에서 비교` → `코드 AST 파싱 결과를 build 단계에서 비교`, `등장하는지 grep 한다` → `등장하는지 AST 로 스캔한다`

**새로 부여되는 요구사항 ID·엔티티/타입명·API endpoint·이벤트/메시지명·환경변수/설정키·
파일 경로가 diff 안에 전혀 없다.** 문서가 이미 참조하던 기존 식별자
(`WaitingInteractionType`, `REGISTRY_SITES`, `SOURCE_REGISTRY_SITES`,
`ENUM_VALUES`/`SOURCE_ENUM_VALUES`, `interaction-type-exhaustiveness.test.ts`,
`@workflow/ai-end-reason` 등)는 이번 diff 이전부터 이미 본 문서·코드베이스에 존재했고
값·의미 변경 없이 그대로 남아 있다. "AST 가드"라는 표현 자체도 diff 이전 원본에 이미
등장하던 기존 라벨이며(예: 원본의 `AST 가드 (\`interaction-type-exhaustiveness.test.ts\`
의 \`REGISTRY_SITES\`)` 문구), 이번 변경은 그 라벨과 어긋나 있던 잔여 `grep` 표현을
동일 라벨로 맞춘 것이다.

## 참고: "AST" 용어의 기존 사용처와 비교

- `spec/conventions/conversation-thread.md:363` — 동일 대상(`interaction-type-exhaustiveness.test.ts`)을 가리키는 "frontend AST 가드"로 이미 같은 의미로 사용 중. target 의 표현 정정과 정합.
- `spec/5-system/5-expression-language.md:439-446` — Expression Language 파서의 "AST(Abstract Syntax Tree)"는 표현식 엔진 자체 문맥의 범용 CS 용어이며, target 이 도입/재정의하는 대상이 아니다. 두 문서의 "AST" 는 이름만 같은 서로 다른 표준 용어(파서 산출물 vs 코드 스캔 가드 명칭)로, 실제 참조 지점·문맥이 명확히 분리돼 있어 혼동 가능성은 낮다. 신규 식별자가 아니므로 본 리뷰의 채점 대상은 아니다.

## 발견사항

없음 — target diff 가 새로 도입하는 요구사항 ID·엔티티/DTO/인터페이스명·API
endpoint·이벤트/메시지명·환경변수/설정키·spec 파일 경로가 존재하지 않는다. 모든 변경은
기존에 이미 확립된 "AST 가드" 용어로 잔여 "grep" 표현을 정정하는 순수 서술 정합화이며,
새 식별자를 도입하지 않으므로 정의상 충돌 대상이 없다.

## 요약

target 커밋은 `spec/conventions/interaction-type-registry.md` 에서 가드 메커니즘을
가리키는 잔여 "grep" 표현 4곳을 문서 전반에 이미 정착된 "AST(코드 리터럴) 스캔 /
AST 가드" 용어로 통일하는 순수 용어 정정이며, 새 요구사항 ID·엔티티·API endpoint·
이벤트명·환경변수·파일 경로를 전혀 도입하지 않는다. 따라서 신규 식별자 충돌 관점에서
검토할 대상 자체가 없다.

## 위험도

NONE
