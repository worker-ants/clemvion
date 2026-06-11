# Documentation Review

## 발견사항

### **[INFO] `LEGACY_TO_NORMALIZED` 상수의 위치 — 파일 하단 선언**
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` — `LEGACY_TO_NORMALIZED` 선언부(모듈 하단)
- 상세: `LEGACY_TO_NORMALIZED` 상수는 `CodeHandler` 클래스보다 아래에 선언되어 있다. plan 파일에서 "파일 상단 이동은 순수 가독성 항목으로 보류"라고 명시하였으나, 현재 위치에서 JSDoc 이 클래스 이후에 등장해 독자가 `failure()` 메서드 안에서 `LEGACY_TO_NORMALIZED` 를 읽으면 정의를 아래에서 찾게 된다.
- 제안: 보류 결정이 plan 주석에 이미 명시되어 있으므로 Critical/Warning 수준은 아님. 향후 이동 시 관련 인라인 주석("W8/INFO#9 — avoid per-call GC pressure" 등)도 함께 이동해야 함을 주석으로 남기면 좋다.

### **[INFO] `error-codes.ts` — `ALLOW_PRIVATE_HOST_TARGETS` 환경변수가 주석에 추가되었지만 배포 가이드 문서화 여부 불확실**
- 위치: `codebase/backend/src/nodes/core/error-codes.ts` lines 534-536
- 상세: `ALLOW_PRIVATE_HOST_TARGETS=true` 로 opt-out 한다는 설명이 주석에 추가되었다. 이 환경변수는 SSRF 가드를 비활성화하는 보안 관련 설정이지만, `.env.example` 또는 배포 문서에 기재되어 있는지 확인이 필요하다. 기존 `EMAIL_HOST_BLOCKED` 주석과 대칭적으로 서술되어 일관성은 있다.
- 제안: `.env.example` 또는 운영 가이드에 `ALLOW_PRIVATE_HOST_TARGETS=true` (기본값 false, SSRF 가드 opt-out 용도, 보안 위험 경고 포함)가 기재되어 있는지 확인하고, 없다면 추가한다.

### **[INFO] `classifyCodeNodeError` JSDoc의 `@internal` 마커 — TypeScript 컴파일 수준 효과 없음**
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` — `classifyCodeNodeError` JSDoc
- 상세: `@internal Exported only for unit testing (code.handler.spec.ts).` 라고 명시되어 있으나, TypeScript는 `@internal` JSDoc 태그를 자동으로 처리하지 않는다(API Extractor 등 별도 도구 필요). 문서화 의도는 명확하게 전달되지만, 다른 모듈에서 이 함수를 import 해도 컴파일 타임 경고는 발생하지 않는다.
- 제안: 현 상태로 주석 목적은 달성됨. 향후 API Extractor 를 도입한다면 `@internal` 이 실제 효과를 가질 수 있음을 주석에 보충하거나, 현재 lint 규칙으로 external import 를 차단하는 방안을 고려할 수 있다.

### **[INFO] plan 파일 상태 — 완료 항목 반영 정확**
- 위치: `plan/in-progress/code-node-isolated-vm-followups.md`, `plan/in-progress/http-ssrf-all-auth-followups.md`
- 상세: 두 plan 파일 모두 완료된 항목(W1 classifier 등재, W2 rename, INFO LEGACY_TO_NORMALIZED, HTTP_BLOCKED enum 참조화)에 `[x]` 체크박스와 `**(완료, PR errcode-wiring)**` 상세 노트가 적절히 추가되어 있다. 변경 이력 관점에서 plan 상태가 코드 변경과 정확히 일치한다.
- 제안: 없음. 적절히 관리되고 있다.

### **[INFO] 테스트 파일 W1 인라인 주석 — 변경 의도와 테스트 단언이 일치**
- 위치: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.spec.ts` lines 196-200
- 상세: 추가된 W1 테스트 블록 앞 주석이 변경 의도(CCH-ERR-04 warn 로그 제거, UX 불변)를 명확하게 설명한다. 주석 내용과 테스트 코드(`warnSpy.not.toHaveBeenCalled()` 단언)가 일치한다.
- 제안: 없음. 주석이 정확하게 코드를 서술하고 있다.

### **[INFO] `execution-failure-classifier.ts` 내 인라인 주석 — PR 내부 약어 의존**
- 위치: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` lines 365-370
- 상세: `HTTP_BLOCKED` 주석의 "refactor 04 C-3" 참조는 특정 PR/리팩터 시리즈 내부 약어이다. 코드베이스 전반에서 동일 패턴이 사용되고 있어 일관성은 있지만, 코드베이스에 처음 진입하는 독자에게는 맥락이 불명확할 수 있다.
- 제안: 현 코드베이스 컨벤션과 일치하므로 필수 변경은 아님. 향후 `spec/conventions/chat-channel-adapter.md §3.1` 참조처럼 spec 링크로 교체하거나 보완하면 장기 가독성이 향상된다.

## 요약

이번 변경은 `CODE_MEMORY_LIMIT`/`HTTP_BLOCKED` 에러 코드의 classifier 등재, `classifyError` 함수 rename, `LEGACY_TO_NORMALIZED` 안전성 강화로 구성된 좁은 범위의 wiring PR이다. 공개 함수·클래스의 JSDoc은 기존 수준을 유지하고 있으며, 추가된 주석들은 변경 이유와 spec 참조를 명확하게 서술한다. plan 파일의 완료 상태 반영도 코드 변경과 정확히 일치한다. 문서화 측면에서 주요 간격은 보안 opt-out 환경변수 `ALLOW_PRIVATE_HOST_TARGETS` 가 인라인 주석에는 언급되었지만 배포 가이드나 `.env.example` 에 기재되어 있는지 확인이 필요한 사소한 사항뿐이다. 전반적으로 문서화 품질이 양호하다.

## 위험도

LOW
