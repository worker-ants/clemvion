# 보안(Security) 리뷰

## 발견사항

### 파일 1: codebase/backend/src/nodes/data/code/code.handler.ts

- **[INFO]** `sha1`·`md5` 가 허용 알고리즘 목록에 포함됨
  - 위치: `ALLOWED_HASH_ALGORITHMS` (line 50–56)
  - 상세: `sha1`과 `md5`는 암호학적으로 취약(충돌 공격 가능)하며 OWASP A02(Cryptographic Failures) 대상이다. `$helpers.crypto.hash` API가 데이터 무결성 용도로 사용될 경우 사용자가 의도치 않게 안전하지 않은 알고리즘을 선택할 수 있다.
  - 제안: 문서(API hint)에 "sha1/md5는 레거시 호환용이며 보안 목적에 사용하지 말 것"을 명시하거나, spec 결정에 따라 해당 알고리즘을 목록에서 제거. 단순 체크섬/비보안 해시 용도라면 현재 구성도 허용 가능하나 Warning 수준으로 기록.

- **[INFO]** `__host_b64decode` — 잘못된 Base64 입력에 대한 묵시적 실패
  - 위치: `jail.set('__host_b64decode', ...)` (line 423–428)
  - 상세: `Buffer.from(String(data), 'base64').toString('utf-8')` 는 잘못된 Base64 입력 시 예외를 던지지 않고 쓰레기 바이트를 반환한다. 테스트(line 1169–1179)가 이 동작을 명시적으로 검증하고 있어 의도된 설계임을 알 수 있다. 그러나 사용자가 디코드 결과를 신뢰하여 추가 처리(JSON.parse 등)를 수행할 경우 예기치 않은 동작이 발생할 수 있다. 정보 누출 위험은 없지만 API 계약이 불명확하다.
  - 제안: API 문서/hint에 "잘못된 Base64 입력 시 부정확한 문자열이 반환될 수 있음" 을 명시. 또는 Base64 정규식 사전 검증 후 예외를 발생시키는 엄격 모드 옵션 고려.

- **[INFO]** 스택 트레이스 노출 — `NODE_ENV !== 'production'` 조건부 포함
  - 위치: `failure()` 메서드 (line 553, 567)
  - 상세: `process.env.NODE_ENV !== 'production'`일 때 `outputDetails.stack`에 V8 스택 트레이스가 포함된다. 개발/스테이징 환경에서 내부 파일 경로, 라이브러리 버전, VM 라인 번호 등이 응답에 포함될 수 있다. 이는 `output.error.details.stack` 경로로 API 클라이언트에게 노출된다.
  - 제안: 현재 구현은 주석(line 549–552)에서 이미 이 tradeoff를 명시하고 있어 의도된 설계다. 다만 스테이징 환경이 실제 사용자 트래픽을 처리한다면 `NODE_ENV` 이외의 별도 플래그(`EXPOSE_ERROR_STACK=true` 등)로 제어하는 것이 더 안전하다.

- **[INFO]** `config.code` 에코 — 에러 응답에 사용자 코드 전체가 포함됨
  - 위치: `failure()` 메서드 (line 572, `config.code`)
  - 상세: 에러 포트 응답의 `config.code` 필드에 원본 사용자 코드 전체가 포함된다. 코드에 민감 정보(하드코딩된 API 키, 비밀번호)가 있을 경우 해당 정보가 응답 로그/API 응답에 노출될 수 있다. 주석(line 568–570)에서 "UI에 의해 바운드됨" 이라고 언급하나, 서버 로그 파이프라인에서의 민감 정보 노출 가능성은 잔재한다.
  - 제안: 상류(엔진 레벨)에서 코드 내 민감 정보 사용을 사용자에게 경고하거나, 코드 에코를 최대 N 바이트로 잘라 로그 과부하·우발적 노출을 줄이는 옵션을 고려.

- **[INFO]** `syntaxIsolate` — 공유 모듈 수준 인스턴스의 단일 스레드 가정
  - 위치: `syntaxCheck()` 함수 (line 264–276)
  - 상세: `syntaxIsolate`는 모듈 레벨 변수로 여러 validate() 호출 간에 공유된다. 주석에서 "JS는 싱글 스레드이므로 안전" 이라고 명시하고 있다. Node.js Worker Threads 환경에서 각 스레드는 별도 모듈 인스턴스를 가지므로 현재 설계는 유지되나, 향후 Worker Threads 도입 시 이 가정이 성립하는지 검토가 필요하다.
  - 제안: 현재 단일 스레드 Node.js 환경에서는 문제없음. Worker Threads 사용 시 `syntaxIsolate`를 스레드 로컬로 관리하도록 리팩토링 고려.

---

### 파일 2: codebase/backend/src/nodes/data/code/code.handler.spec.ts

- **[INFO]** 스포핑 방지 테스트 — "Isolate was disposed" 메시지가 regex에 일치하므로 의도와 다른 분류를 허용
  - 위치: `classifyCodeNodeError` 테스트, line 1455–1467
  - 상세: 테스트 주석이 "important thing is that without an *actual* disposed isolate, no structural spoofing of priority-2 is possible" 이라고 설명하지만, 우선순위-3 regex(`RE_ISOLATE_DISPOSED`)가 "Isolate was disposed" 메시지와 일치하여 `EXECUTION_MEMORY_EXCEEDED`로 분류된다. 즉, 사용자가 `throw new Error("Isolate was disposed")`를 던지면 메모리 초과로 잘못 분류된다. 이는 DoS는 아니나 에러 포트에서 잘못된 `CODE_MEMORY_LIMIT` 코드가 반환된다.
  - 제안: 현재 구현에서 이 제한을 인지하고 있으나, `RE_ISOLATE_DISPOSED` regex가 priority-3 fallback에만 사용된다는 점을 명확히 문서화하거나, 메시지 패턴만으로는 정확한 분류가 불가능함을 API 문서에 명시.

---

## 요약

`code.handler.ts`는 `isolated-vm`을 통해 강력한 V8 격리 경계를 올바르게 구축하고 있으며, 위험 글로벌 삭제(`eval`, `Function`, `globalThis`, `Proxy`, `Reflect` 등), 메모리 상한(128MB), CPU 타임아웃, 호스트 콜백 알고리즘 허용 목록 등 다층 방어가 잘 적용되어 있다. SSRF, SQL 인젝션, XSS, 커맨드 인젝션, 경로 탐색, 하드코딩된 시크릿, 인증/인가 우회, 알려진 취약 의존성 등 주요 OWASP Top 10 항목에서 심각한 문제는 발견되지 않는다. 지적된 사항은 모두 INFO 등급으로, `sha1`/`md5` 알고리즘 포함 여부, 개발 환경 스택 트레이스 노출, Base64 묵시적 실패, 에러 응답의 코드 에코와 같이 설계 트레이드오프나 문서화 개선으로 해소 가능한 수준이다.

## 위험도

LOW
