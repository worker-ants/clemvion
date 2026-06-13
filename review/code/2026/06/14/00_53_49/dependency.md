# 의존성(Dependency) 리뷰 결과

## 발견사항

### **[INFO]** 새 외부 패키지 추가 없음
- 위치: `codebase/backend/package.json`
- 상세: 이번 변경(commit 409dbe71)에서 `package.json` 및 `package-lock.json`이 수정되지 않았다. 7개 변경 파일 모두 프로젝트 내부 TypeScript 소스 파일이다.
- 제안: 해당 없음.

### **[INFO]** 내부 모듈 의존 관계 — 신규 export `extractFormTitle` 추가
- 위치:
  - `/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` (export 추가)
  - `/codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` (import 추가)
  - `/codebase/backend/src/modules/chat-channel/shared/form-mode.spec.ts` (테스트 import 추가)
- 상세: `shared/form-mode.ts` 에서 `extractFormTitle` 가 새로 export 되었고, `chat-channel.dispatcher.ts` 가 이를 named import 방식으로 소비한다. 기존 `extractFormFields` 와 동일한 모듈 경로(`./shared/form-mode`)를 사용하며 의존 방향이 유지된다(shared ← dispatcher). 순환 의존 없음.
- 제안: 이상 없음.

### **[INFO]** 내부 모듈 의존 관계 — `types.ts` 인터페이스 확장 (backward-compatible)
- 위치: `/codebase/backend/src/modules/chat-channel/types.ts`
- 상세: `ChatChannelConfig.botIdentity`, `FormModalField`, `OpenFormModalParams`, `ChannelConversationState.pendingFormModal` 에 선택적 필드(`?`)가 추가되었다. 모두 optional 이므로 기존 소비자(Telegram 어댑터 등)에 대한 런타임 호환성 파괴 없음.
- 제안: 이상 없음.

### **[INFO]** `@nestjs/common`, `typeorm`, `rxjs` 등 기존 의존성만 사용
- 위치: 전체 변경 파일 import 구문
- 상세: 변경된 코드가 사용하는 외부 패키지는 `@nestjs/common`(`Injectable`, `Logger`, `OnModuleInit`, `OnModuleDestroy`), `typeorm`, `rxjs` 등 이미 `package.json` 에 등록된 패키지뿐이다. 신규 취약점 노출 없음.
- 제안: 해당 없음.

## 요약

이번 변경은 외부 패키지를 일절 추가하지 않았으며, `package.json` 변경도 없다. 모든 변경은 `chat-channel` 모듈 내부(`shared/form-mode.ts`, `types.ts`, `discord/discord.adapter.ts`, `chat-channel.dispatcher.ts`)의 순수 내부 로직 확장과 타입 추가이다. 내부 모듈 의존 방향은 기존 아키텍처(shared ← provider/dispatcher)를 유지하고, 인터페이스 확장은 모두 optional 필드로 backward-compatible하다. 의존성 관점에서 식별되는 위험은 없다.

## 위험도

NONE
