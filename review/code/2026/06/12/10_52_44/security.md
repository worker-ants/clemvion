# 보안(Security) 리뷰

## 발견사항

### 1. 스냅샷 격리 경계 검증 (핵심 변경)

- **[INFO]** `DAYJS_SNAPSHOT`은 `ivm.Isolate.createSnapshot()`으로 생성되며, 이 API는 host 바인딩 없는 bare 환경에서 실행되므로 host ref가 스냅샷에 베이크되는 구조적 불가능성이 보장된다.
  - 위치: `code.handler.ts` L1041–1049 (`DAYJS_SNAPSHOT` IIFE 블록)
  - 상세: `createSnapshot`은 `ivm.Callback` 등 host-realm 객체를 허용하지 않으며, 설령 시도해도 오류가 발생한다. `DAYJS_LOAD_SCRIPT`에는 순수 JS(dayjs UMD + `globalThis.dayjs = dayjs` 대입)만 포함되어 있어 per-exec 상태(logs 배열, 콜백 참조)가 스냅샷 외부로 새는 경로가 없다. 이 점은 설계 수준에서 충분히 닫혀 있다.
  - 제안: 현재 구조 유지. 별도 액션 불필요.

### 2. §7.3 하드닝·W13 capture-then-delete 순서 (스냅샷 경로에서의 유지)

- **[INFO]** `BOOTSTRAP_SOURCE`는 스냅샷 여부와 무관하게 **항상** per-exec 컨텍스트에서 실행된다. `BOOTSTRAP_SOURCE` 내에서 위험 글로벌(`eval`, `Function`, `Reflect`, `Proxy`, `globalThis` 등)은 closures 캡처 이후에 삭제되므로 W13 순서가 스냅샷 경로에서도 동일하게 유지된다.
  - 위치: `code.handler.ts` L1211–1282 (`BOOTSTRAP_SOURCE`), L1498–1501 (실행 순서)
  - 상세: 스냅샷에서 복원된 isolate에는 `globalThis.dayjs`가 이미 존재한다. `BOOTSTRAP_SOURCE` 내 `const __dayjs = globalThis.dayjs` 캡처 후 `delete globalThis.dayjs`가 실행되므로, 스냅샷 경로에서 dayjs가 외부에 노출되는 경우가 없다. `typeof Function`, `typeof eval`, `typeof globalThis`, `typeof Reflect`가 모두 `undefined`임을 확인하는 신규 테스트(`still applies §7.3 hardening through the snapshot path`)가 이 계약을 핀한다.
  - 제안: 현재 구조 유지.

### 3. 실행 간 프로토타입 오염 비캡처

- **[INFO]** 각 exec마다 `new ivm.Isolate({ snapshot })` → `isolate.createContext()` 경로를 따르므로, 이전 exec에서 dayjs 프로토타입을 오염시켜도 다음 exec는 immutable 스냅샷으로부터 복원된 fresh heap을 사용한다. 실행 간 상태 누출이 없다.
  - 위치: `code.handler.ts` L1436–1441, `code.handler.spec.ts` L82–110 (프로토타입 오염 비캡처 테스트)
  - 상세: 스냅샷이 shared/mutable 객체가 아니라 `ExternalCopy<ArrayBuffer>` 형태의 직렬화된 바이트임을 확인. isolated-vm의 `createSnapshot` 반환값은 ArrayBuffer로, 각 `new ivm.Isolate({ snapshot })` 호출이 해당 바이트에서 독립적으로 heap을 복원한다. 테스트 케이스 `does NOT capture in-isolate dayjs mutations`가 이를 end-to-end로 검증한다.
  - 제안: 현재 구조 유지.

### 4. `createSnapshot` 오류 무음 억제

- **[WARNING]** `DAYJS_SNAPSHOT` 생성 IIFE에서 예외를 catch해 `undefined`를 반환하나, 오류 로그 출력이 없다. 플랫폼 문제로 스냅샷 생성이 조용히 실패하면 fallback 경로(per-exec 컴파일)로 투명하게 전환되지만, 운영자는 이를 인지할 수 없다.
  - 위치: `code.handler.ts` L1042–1049
  ```ts
  try {
    return ivm.Isolate.createSnapshot([...]);
  } catch {
    return undefined;
  }
  ```
  - 상세: 보안 관점에서 fallback 경로 자체는 안전하다(per-exec 컴파일은 기존 경로). 그러나 스냅샷 생성 실패가 다른 isolated-vm 이상 신호일 수 있으며 무음 억제 시 디버깅이 어렵다. 스택 트레이스 없이 `undefined` 반환되면 성능 저하도 관측되지 않는다.
  - 제안: `catch (err) { console.warn('[CodeHandler] DAYJS_SNAPSHOT build failed, falling back to per-exec compile:', err); return undefined; }` 형태로 최소한 warn 로그를 추가할 것.

### 5. `__host_b64decode` — 비문자열 입력 묵시적 처리

- **[INFO]** 기존 이슈로 본 변경에서 새로 도입된 것은 아니지만, 스냅샷 경로에서도 동일하게 적용된다. `__host_b64encode/decode`는 `String(data)` 강제 변환으로 비문자열을 허용하며, `hostHash`의 TypeError와 일관성이 없다.
  - 위치: `code.handler.ts` L1474–1484
  - 상세: plan 파일에 INFO 항목으로 이미 추적 중. 보안 위험보다는 API 일관성 문제.
  - 제안: plan 항목(`INFO — $helpers.base64 비문자열 일관성`)에서 추적 중이므로 별도 액션 불필요.

### 6. `exposeStack` — 에러 스택 프로덕션 노출 제어

- **[INFO]** 기존 로직이나 스냅샷 변경과 함께 한 번 더 확인. `process.env.NODE_ENV !== 'production'` 조건으로 스택 트레이스를 `output.details.stack`에 포함하며, 프로덕션에서는 스택이 제거된다.
  - 위치: `code.handler.ts` L1605–1619
  - 상세: 스택에는 host 파일 경로와 라이브러리 버전 정보가 포함될 수 있다. 프로덕션 환경에서 `NODE_ENV`가 명시적으로 `'production'`으로 설정되지 않으면 스택이 노출된다. 이는 스냅샷 변경에 의해 새로 도입된 문제가 아니며 기존 설계.
  - 제안: 배포 파이프라인에서 `NODE_ENV=production` 설정이 강제되는지 확인. 현재 코드 자체는 올바른 패턴.

### 7. `deepClone` — JSON 직렬화를 통한 복제

- **[INFO]** `deepClone`은 `JSON.parse(JSON.stringify(value))`를 사용한다. `context.variables`가 JSON 비호환 값(함수, `undefined`, `Symbol`, 순환 참조)을 포함하면 실행 전 단계에서 예외가 발생하거나 손실이 발생할 수 있다. 이는 스냅샷 변경과 무관한 기존 동작.
  - 위치: `code.handler.ts` L1169–1172, L1431
  - 상세: 보안보다는 신뢰성 이슈. $vars copy-out 실패 시 varsClone fallback 경로가 있으므로 심각도 낮음.
  - 제안: 현재 구조 유지. 필요 시 별도 이슈화.

### 8. `DAYJS_SNAPSHOT` 타입 — `ExternalCopy<ArrayBuffer>`의 공유 참조

- **[INFO]** `DAYJS_SNAPSHOT`은 모듈 레벨 상수로, 모든 exec가 동일한 `ExternalCopy<ArrayBuffer>` 인스턴스를 `snapshot` 옵션으로 전달한다. isolated-vm의 `ExternalCopy`는 참조를 공유하되 각 `new ivm.Isolate({ snapshot })` 호출이 독립 heap을 생성하므로 공유 참조 자체가 보안 문제가 되지 않는다.
  - 위치: `code.handler.ts` L1041, L1436–1440
  - 상세: isolated-vm의 API 계약상 snapshot은 read-only 소스로만 사용되며 exec 간 공유로 인한 상태 오염이 없다.
  - 제안: 현재 구조 유지.

### 9. 하드코딩된 시크릿 — 없음

- **[INFO]** 변경된 코드 범위(code.handler.ts, code.handler.spec.ts, plan 파일)에서 API 키, 비밀번호, 토큰, 인증서 등 하드코딩된 시크릿은 발견되지 않았다.

### 10. 의존성 보안 — isolated-vm

- **[INFO]** 이번 변경에서 `isolated-vm`의 `createSnapshot` API를 신규 사용한다. `isolated-vm`은 V8 Isolate 경계를 활용하는 보안 라이브러리이며, 알려진 CVE는 현재 없다. 다만 `createSnapshot`은 V8 네이티브 API이므로 Node.js/V8 버전에 따라 동작이 달라질 수 있다.
  - 위치: `code.handler.ts` L1043
  - 상세: 플랫폼 비호환 시 `try/catch`로 fallback 처리되어 있음. 의존성 버전 고정은 `package-lock.json`으로 관리.
  - 제안: `isolated-vm` 버전을 정기적으로 보안 업데이트 확인.

---

## 요약

이번 변경은 dayjs UMD를 `ivm.Isolate.createSnapshot()`으로 1회 스냅샷화하여 per-exec 컴파일 오버헤드를 제거하는 성능 최적화다. 보안 관점에서 핵심 검증 포인트인 (1) 스냅샷에 host ref/per-exec 상태 비유출, (2) §7.3 하드닝·W13 capture-then-delete 순서 스냅샷 경로 유지, (3) 실행 간 프로토타입 오염 비캡처 모두 구조적으로 올바르게 구현되어 있다. `createSnapshot`은 host 바인딩이 없는 bare isolate에서만 동작하므로 설계 수준에서 host ref 유출이 차단된다. `BOOTSTRAP_SOURCE`는 항상 per-exec으로 실행되어 §7.3 위험 글로벌 삭제와 host 콜백 wiring이 스냅샷 경로에서도 동일하게 적용된다. 신규 테스트 5건이 이 보안 계약을 end-to-end로 검증한다. 유일한 실질적 지적 사항은 `createSnapshot` 실패 시 오류 로그 없이 무음 fallback되는 점(WARNING)으로, 보안 위험은 아니나 운영 가시성 측면에서 warn 로그 추가를 권장한다.

---

## 위험도

LOW
