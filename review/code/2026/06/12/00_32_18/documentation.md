# Documentation Review

## 발견사항

### [INFO] `ALLOW_PRIVATE_HOST_TARGETS` 환경변수 — .env.example 기재 확인됨
- 위치: `codebase/backend/.env.example`
- 상세: 이전 리뷰 세션(documentation.md INFO #2)에서 "배포 가이드 기재 여부 불확실"이라고 지적했으나, 실제로는 `.env.example`에 `ALLOW_PRIVATE_HOST_TARGETS=false`로 기재되어 있고 앞 2줄에 SSRF 목적 설명 주석도 포함되어 있다. 이번 PR의 `error-codes.ts` 주석 추가(`http-safety.ts` SoT 참조 + opt-out env 명시)는 코드-주석 대칭성을 개선한다.
- 제안: 없음. 기존 INFO 발견사항 해소됨.

### [INFO] `classifyCodeNodeError` JSDoc `@internal` 마커 — TypeScript 컴파일 효과 없음
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` — `classifyCodeNodeError` JSDoc
- 상세: `@internal Exported only for unit testing (code.handler.spec.ts).` 주석은 개발자에게 의도를 전달하지만, TypeScript는 `@internal` 태그를 자동으로 처리하지 않는다(API Extractor 등 별도 도구 필요). 현재 프로젝트에 그러한 도구가 없다면 다른 모듈에서 이 함수를 import해도 컴파일 타임 경고가 발생하지 않는다.
- 제안: 현 상태로 주석 목적(의도 전달)은 달성된다. 강제가 필요하다면 ESLint `no-restricted-imports` 규칙으로 외부 import를 차단하는 방안을 고려할 수 있다. 필수 변경 아님.

### [INFO] `execution-failure-classifier.ts` 인라인 주석 — PR 내부 약어 "refactor 04 C-3" 사용
- 위치: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` — `HTTP_BLOCKED` 항목 주석
- 상세: `HTTP_BLOCKED` 추가 주석에서 "refactor 04 C-3" 참조는 특정 PR 시리즈 내부 약어이다. 코드베이스 전반에서 동일 패턴이 사용되어 일관성은 있으나, 신규 진입자에게 맥락이 불명확할 수 있다. 바로 아래 줄에 `§3.1 매핑 표` 참조가 있어 spec 링크가 부분적으로 제공된다.
- 제안: 현 코드베이스 컨벤션과 일치하므로 필수 변경 아님. 향후 `spec/conventions/chat-channel-adapter.md §3.1` 링크만 남기고 약어 참조를 제거하면 장기 가독성이 향상된다.

### [INFO] `execution-failure-classifier.spec.ts` W1 테스트 블록 인라인 주석 — 의도와 단언이 일치
- 위치: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.spec.ts` L196-200
- 상세: 추가된 W1 테스트 블록 앞 주석이 변경 의도(CCH-ERR-04 warn 로그 제거, UX 불변)를 명확하게 서술하며 `warnSpy.not.toHaveBeenCalled()` 단언과 일치한다.
- 제안: 없음.

### [INFO] plan 파일 완료 상태 반영 — 코드 변경과 정확히 일치
- 위치: `plan/in-progress/code-node-isolated-vm-followups.md`, `plan/in-progress/http-ssrf-all-auth-followups.md`
- 상세: W1(classifier 등재), W2(rename + @internal), INFO(LEGACY_TO_NORMALIZED 안전성), HTTP_BLOCKED enum 참조화 — 4개 항목 모두 `[x]`와 `**(완료, PR errcode-wiring)**` 상세 노트가 추가되어 있다. 변경 이력 추적 관점에서 plan 상태가 코드와 정확히 동기화된다.
- 제안: 없음.

### [INFO] `code.handler.ts` 모듈 상수 및 `classifyCodeNodeError` — 클래스 이전으로 이동 완료
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` — `RE_*`, `LEGACY_TO_NORMALIZED`, `classifyCodeNodeError` 선언부
- 상세: 이번 PR에서 `RE_*`·`LEGACY_TO_NORMALIZED`·`classifyCodeNodeError` 블록이 `CodeHandler` 클래스 선언 이전으로 이동되어, `failure()` 메서드에서 참조 시 독자가 위에서 정의를 찾을 수 있다. plan W4 INFO 항목의 "모듈 상수 파일 상단 이동" 요건이 이번 PR에서 충족되었다.
- 제안: 없음. 이번 PR에서 개선됨.

### [INFO] `error-codes.ts` 신규 주석 — `http-safety.ts` SoT 참조 및 opt-out env 명시
- 위치: `codebase/backend/src/nodes/core/error-codes.ts` — `HTTP_BLOCKED` 항목
- 상세: 추가된 두 줄 주석이 가드 정책의 SoT(`http-request/http-safety.ts`), 기본값(ON), opt-out env(`ALLOW_PRIVATE_HOST_TARGETS=true`)를 명시하고 `EMAIL_HOST_BLOCKED` 주석과 대칭 구조를 유지한다. 이 개선으로 코드 주석만으로 정책 전체 맥락 파악이 가능해진다.
- 제안: 없음.

## 요약

이번 PR은 `CODE_MEMORY_LIMIT`·`HTTP_BLOCKED` 에러 코드 classifier 등재, `classifyError` → `classifyCodeNodeError` 이름 변경, `LEGACY_TO_NORMALIZED` 타입 안전성 강화, `HTTP_BLOCKED` 리터럴의 `ErrorCode.*` 참조 전환으로 구성된 좁은 범위의 wiring 정리 PR이다. 문서화 관점에서 핵심 변경에 대한 인라인 주석과 JSDoc이 충실하게 작성되어 있고, plan 완료 상태도 코드 변경과 정확히 동기화되어 있다. 이전 리뷰 세션에서 "배포 가이드 기재 불확실"로 지적한 `ALLOW_PRIVATE_HOST_TARGETS` 환경변수는 `.env.example`에 이미 기재되어 있음이 확인되어 해당 우려가 해소된다. 잔존 INFO 항목(PR 내부 약어 "refactor 04 C-3", `@internal` 컴파일 미강제)은 코드베이스 기존 패턴과 일치하므로 필수 변경 대상이 아니다. Critical 및 Warning 수준의 문서화 결함 없음.

## 위험도

LOW
