# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] package.json — devDependencies 추가 (범위 적합)
- 위치: `codebase/backend/package.json` — `jsonwebtoken: 9.0.3` + `@types/jsonwebtoken: ^9.0.0`
- 상세: 이번 fix(W9)의 정확한 목적에 부합하는 최소한의 변경이다. 전이 의존성이던 `jsonwebtoken`을 직접 선언으로 명시한 것으로, 다른 devDependencies에 대한 정리나 순서 변경 없이 정확히 두 항목만 추가됐다. 범위 이탈 없음.

### [INFO] main.ts — LLM_STUB_MODE production 가드 추가 (범위 적합)
- 위치: `codebase/backend/src/main.ts` L200–211
- 상세: W1 fix 목적 그대로 `OAUTH_STUB_MODE` 가드 직후에 동일 패턴으로 삽입됐다. 기존 파일의 어떠한 코드도 수정·이동·삭제하지 않았고, 포맷팅 변경도 없다. 주석도 OAUTH_STUB_MODE 와의 관계를 명확히 하는 최소 설명에 그친다. 범위 이탈 없음.

### [INFO] stub.client.spec.ts — 신규 파일 추가 (범위 적합)
- 위치: `codebase/backend/src/modules/llm/clients/stub.client.spec.ts`
- 상세: W2 fix 목적(StubLlmClient 단위 테스트 부재 해소)에 정확히 대응한다. `chat`, `embed`, `listModels`, `testConnection` 4개 공개 메서드만 커버하며, 관련 없는 다른 모듈을 import하거나 test 대상 외 행동을 검증하지 않는다. 범위 이탈 없음.

### [INFO] llm.service.spec.ts — LLM_STUB_MODE describe 블록 추가 (범위 적합)
- 위치: `codebase/backend/src/modules/llm/llm.service.spec.ts` L725–642
- 상세: W3 fix 목적(LLM_STUB_MODE 분기 미검증)에 정확히 대응한다. 기존 describe 블록 구조 변경 없이 맨 끝에 `describe('LLM_STUB_MODE (createClient) — review W3')` 블록만 추가됐고, 기존 테스트 케이스에 대한 수정은 전혀 없다. 범위 이탈 없음.

### [INFO] llm.service.ts — createClient 캐시·stub 분기 순서 변경 (범위 적합)
- 위치: `codebase/backend/src/modules/llm/llm.service.ts` L664–695
- 상세: W5/I7 fix 목적(stub 분기가 캐시 체크 뒤에 위치해 오염 위험)에 정확히 대응한다. 로직 블록의 실행 순서만 재배치됐고, 각 블록의 내부 코드는 그대로다. `instanceof StubLlmClient` 체크 한 줄이 추가됐고, 기존 캐시 체크 코드가 stub 분기 이후로 이동됐다. 관련 없는 메서드나 속성에는 손대지 않았다. 범위 이탈 없음.

### [INFO] review/ 산출물 파일들 — 이전 리뷰 세션 산출물 (범위 외 판단 대상)
- 위치: `review/code/2026/06/06/11_22_25/RESOLUTION.md`, `SUMMARY.md`, `_retry_state.json`, `dependency.md`, `maintainability.md`, `meta.json`, `requirement.md`, `security.md`, `side_effect.md`, `testing.md`
- 상세: 이 파일들은 이번 fix PR이 아닌, 이전 리뷰 세션(11_22_25)의 산출물로서 review workflow 자동 생성 파일들이다. 코드 변경 범위 심사 대상이 아니며, 리뷰 프로세스 내부 운영 파일로 분류된다.

## 요약

이번 변경(PR-B2a fix: W1/W2/W3/W5/W9)은 다섯 파일 모두 각 Warning에 1:1 대응하는 최소 범위 변경만 포함한다. `main.ts`에는 LLM_STUB_MODE 가드 블록 추가만, `package.json`에는 두 devDependency 항목만, `stub.client.spec.ts`는 신규 테스트 파일 추가, `llm.service.spec.ts`에는 끝에 describe 블록 추가, `llm.service.ts`에는 createClient 내 분기 순서 재배치만 이루어졌다. 불필요한 리팩토링·포맷팅 변경·무관한 파일 수정·임포트 정리는 발견되지 않았다. 의도된 fix 범위를 벗어나는 변경 없음.

## 위험도

NONE
