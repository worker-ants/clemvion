# 신규 식별자 충돌 검토

## 검토 범위 확인

- target scope `spec/5-system/` 델타: **0개 파일** — 이 브랜치는 `spec/5-system/` 을 변경하지 않았다. 즉 이 영역이 "새로 부여하는" 요구사항 ID·엔티티명·endpoint·이벤트명·ENV var·파일 경로가 **없다**.
- 구현 diff(8개 파일 / 134줄, HEAD 워킹트리 `close-two-residuals-e5f7a9` 기준)를 직접 확인한 결과, 아래와 같이 전부 기계적 수정이며 신규 공개 식별자를 도입하지 않는다.

| 파일 | 변경 내용 | 신규 식별자 도입 여부 |
|---|---|---|
| `codebase/packages/ai-end-reason/package.json` | `lint` 스크립트의 glob 을 quote 처리 (`eslint src/**/*.ts` → `eslint "src/**/*.ts"`) | 없음 |
| `codebase/packages/chat-channel-validation/package.json` | 동일 | 없음 |
| `codebase/packages/expression-engine/package.json` | 동일 | 없음 |
| `codebase/packages/graph-warning-rules/package.json` | 동일 | 없음 |
| `codebase/packages/masked-markers/package.json` | 동일 | 없음 |
| `codebase/packages/node-summary/package.json` | 동일 | 없음 |
| `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts` | `SUBCLASSES` 전수성 단언의 타입을 명시 배열 대신 모듈에서 유도(`ErrorsModule`, `SubclassName` 타입 별칭 신규 도입) | **테스트 파일 로컬 스코프**(`describe` 블록 내부) 타입 별칭 — 모듈 export 도, spec 문서가 정의하는 엔티티/DTO/요구사항 ID 도 아님. 충돌 표면 없음 |
| `codebase/packages/expression-engine/src/parser.ts` | `case TokenType.LParen:` 를 블록(`{ }`)으로 감싸 TDZ/`no-case-declarations` 회피 (동작 동일, 순수 스코프 정정) | 없음 (기존 `TokenType.LParen` case 의 재구성일 뿐, 신규 식별자 없음) |

이 diff 는 patch 파일 헤더(`diff --git a/... b/...`) 기준 정확히 8개 파일이며 "8개 파일 / 134줄" 명세와 일치 — 예산 절단으로 diff 가 누락되었을 가능성은 없다(별도로 위 워킹트리를 절대경로로 재확인할 필요가 없을 만큼 diff 자체가 완결적).

## 점검 관점별 결과

1. **요구사항 ID 충돌** — 신규 부여된 요구사항 ID 없음(spec 델타 0). 해당 없음.
2. **엔티티/타입명 충돌** — diff 에서 도입된 유일한 타입(`ErrorsModule`, `SubclassName`)은 테스트 파일 내부 로컬 타입 별칭으로 export 되지 않으며, 어떤 spec 문서의 엔티티/DTO 명명 공간과도 겹치지 않는다. 충돌 없음.
3. **API endpoint 충돌** — 신규 endpoint 정의 없음(코드·spec 어디에도 새 controller route 추가 없음).
4. **이벤트/메시지명 충돌** — 신규 webhook/queue/SSE 이벤트명 없음.
5. **환경변수·설정키 충돌** — 신규 ENV var/config key 없음. `package.json` 변경은 lint 스크립트의 shell glob quoting 뿐, `config` 필드나 env 참조 변경 없음.
6. **파일 경로 충돌** — 신규 spec 파일 없음(스코프 델타 0). 코드 측 신규 파일도 없음(전부 기존 파일 수정).

## 발견사항

없음 — 이번 변경은 신규 식별자를 도입하지 않는다.

## 요약

이번 diff 는 `spec/5-system/` 을 전혀 건드리지 않았고(스코프 델타 0), 실제 구현 변경 8개 파일도 (a) 5개 패키지의 `lint` npm 스크립트 glob quoting 수정, (b) `expression-engine` 테스트 파일의 로컬 스코프 타입 유도(export 되지 않음), (c) `parser.ts` 의 `case` 블록 스코프 정정(TDZ 회피, 동작 불변)뿐이다. 요구사항 ID·엔티티/DTO 명·API endpoint·이벤트명·ENV var·설정키·spec 파일 경로 등 신규 식별자 충돌 검토 대상이 되는 어떤 새 이름도 도입되지 않았으므로 충돌 표면 자체가 존재하지 않는다.

## 위험도

NONE
