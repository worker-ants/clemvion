# 정식 규약 준수 검토 — spec/5-system (impl-done)

## 검토 범위 확인

- **검토 모드**: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- **spec 델타**: `spec/5-system/**` 변경 파일 0개 — 이 브랜치는 해당 spec 영역을 건드리지 않았다 (정상, CRITICAL 근거 아님)
- **구현 diff**: 8개 파일 / 134줄. 전량 확인:
  - `codebase/packages/{ai-end-reason,chat-channel-validation,expression-engine,graph-warning-rules,masked-markers,node-summary}/package.json` (6건): `"lint": "eslint src/**/*.ts"` → `"lint": "eslint \"src/**/*.ts\""` — glob 인용 수정 (쉘이 확장하기 전에 eslint 에 넘기기 위한 quoting)
  - `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts` — 기존 캐너리 테스트(§6.3.1 C2)의 서브클래스 판별 필터를, 명시 타입 캐스팅에서 `Object.entries` 원소 타입으로부터 유도한 `SubclassName` 타입으로 교체 (테스트 내부 타입 안전성 강화, 신규 에러 코드·식별자 도입 없음)
  - `codebase/packages/expression-engine/src/parser.ts` — `case TokenType.LParen:` 에 블록 스코프(`{ }`) 추가 (`no-case-declarations` lint 대응, 동작·식별자 변경 없음)
- `git -C <worktree> show HEAD:...` 로 각 파일의 diff 반영 상태를 직접 대조했고, 위 요약과 일치함을 확인했다.

## 발견사항

없음.

이 PR 의 구현 diff 는 (1) 6개 패키지의 `package.json` lint 스크립트 quoting 수정, (2) 테스트 파일 내부의 TypeScript 타입 유도 방식 변경, (3) `parser.ts` 의 `case` 블록 스코프 추가로 구성된다. 세 항목 모두:

- 새 식별자·API endpoint·DTO·파일을 도입하지 않는다 → **명명 규약**(관점 1) 대상 표면 없음.
- API 응답·이벤트 페이로드·에러 코드 문자열을 추가·변경하지 않는다 (`error-shape.spec.ts` 는 기존 `ErrorCode` enum 값을 그대로 참조만 하며, 매핑 테이블(`SUBCLASS_TO_CODE`)·enum 값 자체는 diff 밖) → **출력 포맷 규약**(관점 2, [`spec/conventions/error-codes.md`](../../../../../../spec/conventions/error-codes.md), [`spec/conventions/node-output.md`](../../../../../../spec/conventions/node-output.md)) 대상 표면 없음.
- `spec/5-system/**` 문서 자체를 건드리지 않는다 → **문서 구조 규약**(관점 3) 대상 표면 없음.
- OpenAPI/Swagger 데코레이터·컨트롤러·DTO 를 건드리지 않는다 → **API 문서 규약**(관점 4, [`spec/conventions/swagger.md`](../../../../../../spec/conventions/swagger.md)) 대상 표면 없음.
- `spec/conventions/` 전체를 대상으로 "eslint"/"lint script"/"package.json" 를 검색한 결과 관련 규약은 [`spec/conventions/frontend-layering.md`](../../../../../../spec/conventions/frontend-layering.md) 하나뿐이며, 이는 `codebase/frontend/eslint.config.mjs` 의 계층 import 규칙 전용으로 이번 diff(backend 패키지들의 lint 스크립트 quoting) 와 무관하다. 다른 금지 항목에 저촉되는 패턴도 diff 내에 없다 → **금지 항목**(관점 5) 위반 없음.

## 요약

이번 diff 는 순수 빌드 도구/lint 스크립트 quoting 수정과 테스트 코드 내부의 TypeScript 타입 안전성 리팩터, 그리고 lint 규칙(`no-case-declarations`) 대응을 위한 문법적 블록 스코프 추가로 구성되어 있다. 새 식별자·API·에러 코드·문서를 도입하거나 변경하지 않으므로 `spec/conventions/**` 이 규율하는 명명·출력 포맷·문서 구조·API 문서·금지 패턴 어느 항목에도 해당 표면이 없다. `spec/5-system/**` 자체도 이번 PR 에서 변경되지 않았다(델타 0). 정식 규약 준수 관점에서 위반 사항 없음.

## 위험도

NONE
