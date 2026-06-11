# 부작용(Side Effect) 리뷰 결과

**대상**: SSRF 가드 전 인증 방식 적용 (refactor 04 C-3)
**검토일**: 2026-06-11

---

## 발견사항

### 1. **[WARNING]** SSRF 가드 적용 범위 확장 — `none`/`custom` 호출자의 의도하지 않은 동작 변경
- **위치**: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` — `if (authentication === 'integration')` 게이트 제거 (구 line 233, 신 무조건 실행)
- **상세**: 변경 전 `authentication='none'` 또는 `'custom'` 으로 사설 IP(RFC1918, 169.254.x.x, loopback 등)를 호출하던 워크플로는 정상 진행됐다. 변경 후 동일 호출이 `HTTP_BLOCKED` error 포트로 차단된다. 이는 의도된 secure-by-default 이나, 기존 self-host 배포에서 `authentication=none`으로 내부 서비스를 호출하는 모든 워크플로가 **사전 고지 없이 즉시 실패**하는 외부 부작용이다. `ALLOW_PRIVATE_HOST_TARGETS=true` 설정으로 opt-out 가능하지만, 기존 사용자가 이 플래그를 모르는 경우 서비스 중단이 발생한다.
- **제안**: PR 본문과 릴리스 노트에 breaking change 명시 (plan 문서에 이미 경고 포함됨 — 실제 배포 공지 확인 필요). 마이그레이션 가이드(`ALLOW_PRIVATE_HOST_TARGETS=true`)가 문서화됐는지 확인.

### 2. **[INFO]** `configEcho` 빌드 방식 변경 — spread에서 명시 열거로
- **위치**: `http-request.handler.ts` line 198–211 (구 `{ ...rawConfig, url: rawUrl }` → 신 명시 열거)
- **상세**: 기존 spread 방식은 `rawConfig`에 미래에 추가되는 모든 필드를 자동으로 echo에 포함시켰다. 변경 후 명시 열거로 전환하면, 새 스키마 필드가 `http-request.schema.ts`에 추가될 때 `configEcho` 빌드 코드도 함께 갱신하지 않으면 해당 필드가 출력에서 누락된다. 이는 의도치 않은 "silent omission" 부작용이다.
- **제안**: `http-request.schema.ts`의 필드 목록과 `configEcho` 열거를 동기화하는 린트 규칙 또는 테스트를 추가하거나, 스키마 변경 시 `configEcho`도 반드시 함께 갱신한다는 주석/TODO를 명시한다.

### 3. **[INFO]** 테스트에서 `process.env.ALLOW_PRIVATE_HOST_TARGETS` 직접 변경 — 테스트 격리 수준 확인 필요
- **위치**: `http-request.handler.spec.ts` line 141–167 (`allows none-auth private targets when ALLOW_PRIVATE_HOST_TARGETS=true` 테스트)
- **상세**: 테스트가 `process.env.ALLOW_PRIVATE_HOST_TARGETS`를 직접 설정하고 `finally` 블록에서 복원한다. 이 패턴 자체는 정상이나, Jest의 병렬 실행 모드(`--runInBand`가 아닌 경우)에서 동일 env var를 읽는 다른 테스트와 경합 상태(race condition)가 발생할 수 있다. 단일 워커 내에서는 동기 복원으로 안전하지만, 멀티 워커 환경에서는 전역 env 오염이 다른 테스트 파일에 영향을 줄 수 있다.
- **제안**: 환경 변수 변경 테스트는 `jest.isolateModules` 또는 별도 describe 블록으로 격리하거나, 해당 env var를 직접 읽는 모듈을 jest mock으로 대체하여 프로세스 전역 상태 의존을 제거한다.

### 4. **[INFO]** `HTTP_BLOCKED` enum 추가 — 기존 `error-codes.ts` 사용자에 대한 영향
- **위치**: `codebase/backend/src/nodes/core/error-codes.ts` — `HTTP_BLOCKED: 'HTTP_BLOCKED'` 신규 추가
- **상세**: 새 상수 추가는 기존 코드를 깨지 않는다(additive change). 다만 이전에 `HTTP_BLOCKED`를 string literal로 직접 사용하던 코드가 있다면, 타입 안전성 관점에서 `ErrorCode.HTTP_BLOCKED`로 교체가 필요하다. 현재 변경 자체는 부작용 없으나, 구현 일관성 측면에서 기존 literal 사용처(`http-request.handler.ts` 내 `'HTTP_BLOCKED'` 직접 사용)를 `ErrorCode.HTTP_BLOCKED`로 교체하지 않으면 enum 추가 효과가 없다.
- **제안**: `http-request.handler.ts`에서 `'HTTP_BLOCKED'` string literal을 `ErrorCode.HTTP_BLOCKED`로 교체하여 타입 안전성을 확보한다.

### 5. **[INFO]** Usage 로그 조건부 실행 — `none`/`custom` SSRF 차단 시 로그 미생성
- **위치**: `http-request.handler.ts` catch 블록 내 `if (authentication === 'integration' && integrationId)` 조건
- **상세**: 이전 코드에서는 `none`/`custom` 인증이 SSRF 가드 자체에 도달하지 않았으므로 Usage 로그 미생성이 암묵적이었다. 변경 후 `none`/`custom`도 가드에 도달하지만 로그는 명시적으로 건너뛴다. 이는 의도된 동작(spec §4.2)이나, 보안 감사 관점에서 `none`/`custom` 인증의 SSRF 차단 이벤트가 어디에도 기록되지 않는다는 점은 운영 가시성 공백을 만든다.
- **제안**: 보안 감사 요건이 있다면 `none`/`custom` SSRF 차단 시에도 별도 security log(Usage 로그와 다른 채널)를 남기는 것을 검토한다. 현재 스펙 범위 내에서는 INFO 수준.

---

## 요약

이번 변경의 핵심 부작용은 `authentication='none'`/`'custom'` HTTP 요청이 사설망·loopback 대상을 호출하는 기존 워크플로가 `HTTP_BLOCKED`로 즉시 차단된다는 점이다. 이는 의도된 secure-by-default 결과이나 기존 self-host 배포에 대한 breaking change이므로, 릴리스 노트와 배포 공지에 `ALLOW_PRIVATE_HOST_TARGETS=true` 마이그레이션 경로가 명확히 포함되어야 한다(plan 문서에 경고가 이미 포함됨). 코드 레벨에서는 `configEcho` 명시 열거로의 전환이 미래 스키마 필드 누락 위험을 내포하며, 테스트의 `process.env` 직접 조작은 병렬 테스트 환경에서 경합 가능성이 있다. 전역 변수 오염·네트워크 부작용·이벤트 콜백 변경은 없으며, 인터페이스 시그니처는 변경되지 않았다.

---

## 위험도

**MEDIUM**

(의도된 breaking change — `none`/`custom` 인증 사설망 호출 차단. 운영 영향이 있으나 마이그레이션 경로 단순. 코드 레벨 의도치 않은 부작용 없음.)
