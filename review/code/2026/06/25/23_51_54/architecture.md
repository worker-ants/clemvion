# Architecture Review

## 발견사항

### **[INFO]** 모듈 수준 Logger 인스턴스 생성 패턴 — DI 외부 생성의 아키텍처적 선택
- 위치: `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.ts` (`const logger = new Logger('ChatChannel.Telegram')`) 및 `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts` (`const logger = new Logger('ChatChannel.LanguageHint')`)
- 상세: 두 파일 모두 순수 함수 모음으로 `@Injectable()` 클래스가 아니다. NestJS Logger 는 DI 없이도 동작하므로 기능적으로 문제없으나, 로거 어댑터를 DI 단에서 교체할 때 이 인스턴스들은 DI 교체 대상에서 벗어난다. 비즈니스/헬퍼 레이어가 프레임워크 객체를 모듈 스코프 전역 상태로 고착시키는 구조다.
- 제안: 현 단계에서 `console.*` 대비 명백한 개선이며 실용적으로 수용 가능하다. 장기적으로 Logger 를 함수 파라미터로 선택적 주입하거나 클래스로 격상하는 방향을 별도 과제로 검토할 수 있다.

### **[INFO]** `code.handler.ts` 인라인 eslint-disable 면제 — module-load 경계 명확성
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` (`resolveMemoryLimitMb` 내 2곳, `DAYJS_SNAPSHOT` IIFE 내 1곳)
- 상세: 세 곳 모두 "NestJS Logger 컨텍스트 이전 module-load 경로"를 이유로 면제한다. DAYJS_SNAPSHOT IIFE 는 진짜 module-load IIFE이므로 면제 근거가 확실하다. `resolveMemoryLimitMb` 는 `@exported` 순수 함수로 단위 테스트에서도 직접 호출되므로 "로더 컨텍스트 이전"이라는 면제 근거가 호출 시점에 의존하는 점은 경계가 다소 모호하나, 이 함수가 실제로 모듈 초기화 시 즉시 평가되는 상수(`ISOLATE_MEMORY_LIMIT_MB`)를 생성하는 용도로만 사용되므로 의도는 정당하다.
- 제안: 현상 유지가 적절하다. 각 면제에 이유가 명시되어 있어 향후 감사 가능성도 확보되어 있다.

### **[INFO]** 테스트의 `Logger.prototype.warn` 프로토타입 스파이 — 구현 내부 결합
- 위치: `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.spec.ts` 및 `codebase/backend/src/nodes/core/node-handler.registry.spec.ts`
- 상세: 모듈 수준 `const logger = new Logger(...)` 패턴을 사용하는 경우 테스트에서 인스턴스를 교체할 수 없으므로 `Logger.prototype.warn` 프로토타입 스파이가 유일한 선택이다. `NodeHandlerRegistry` 는 `@Injectable()` 클래스임에도 Logger 를 직접 생성(`new Logger(NodeHandlerRegistry.name)`)하여 동일한 테스트 결합이 발생한다. 이는 로거 구현이 교체되거나 NestJS Logger 내부 구조가 변경될 경우 테스트 수정 범위가 넓어지는 위험이 있다.
- 제안: `NodeHandlerRegistry` 는 DI Injectable 클래스이므로 향후 `LoggerService` 인터페이스를 생성자 주입으로 받도록 전환하면 테스트에서 mock 을 주입할 수 있어 프로토타입 스파이 의존을 제거할 수 있다. 현 변경 범위에서는 수용 가능하다.

### **[INFO]** eslint 면제 glob 패턴 — 정책 범위의 자동 확장 위험
- 위치: `codebase/backend/eslint.config.mjs` (override: `src/scripts/**/*.ts`)
- 상세: `src/scripts/**/*.ts` 글로브는 현재 CLI 독립 실행 스크립트를 대상으로 하지만, scripts 디렉터리에 새 파일이 추가될 때 자동으로 면제 범위가 확장된다. scripts 디렉터리가 CLI 전용으로 엄격히 관리되지 않으면 서비스 코드가 혼입되어 no-console 가드를 우회하는 경로가 열릴 수 있다.
- 제안: scripts 디렉터리를 CLI 독립 실행 전용으로 명확히 제한하는 컨벤션(README 또는 디렉터리 인덱스)을 별도로 두는 것을 권장한다. 현 시점에서는 수용 가능하다.

## 요약

이번 변경은 `console.*` → NestJS Logger 전환이라는 cross-cutting 로깅 규약을 일괄 정합하는 유지보수 리팩터링이다. 전반적으로 아키텍처 관점의 심각한 문제는 없다. 핵심 관찰점은 순수 헬퍼 모듈(`telegram-message.renderer.ts`, `language-hint-defaults.ts`)과 `NodeHandlerRegistry` 가 Logger 를 직접 생성하여 DI 교체 가능성을 제한하는 패턴인데, 이는 현 실용적 범위에서 정당화된 선택이며 `console.*` 대비 명백한 개선이다. eslint `no-console: error` 가드 신규 추가로 규약 drift 재발을 구조적으로 차단한 점이 특히 긍정적이다. 레이어 정책의 eslint 면제 세분화, SOLID 원칙 준수, 순환 의존성 미발생 등 핵심 아키텍처 지표 모두 양호하다.

## 위험도

NONE
