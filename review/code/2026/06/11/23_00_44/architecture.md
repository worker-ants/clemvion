# Architecture Review

**대상**: HTTP Request 노드 SSRF 가드 전 인증 방식 적용 (refactor 04 C-3)
**검토일**: 2026-06-11
**범위**: `error-codes.ts`, `http-request.handler.ts`, `http-request.handler.spec.ts`, spec/plan 문서

---

## 발견사항

### [INFO] SSRF 가드 위치: 핸들러 내 인라인 vs. 별도 미들웨어 레이어
- **위치**: `http-request.handler.ts` lines 335~294 (변경 블록)
- **상세**: SSRF 가드(`assertSafeOutboundUrl` + `assertSafeOutboundHostResolved`)가 핸들러의 `execute()` 내부에 직접 배선돼 있다. 이 변경의 핵심은 `if (authentication === 'integration')` 게이트 제거이며, 로직 자체는 이미 `http-safety.ts`에 캡슐화돼 있어 핸들러는 호출만 한다. 현재 아키텍처(handler → http-safety 함수 호출)는 책임 분리가 적절하다. 다만 `ALLOW_PRIVATE_HOST_TARGETS` 환경변수 읽기가 `http-safety.ts` 내부에 위치해 핸들러가 직접 제어하지 않는 구조는 의존성 역전(DIP) 관점에서 허용 가능한 수준이다 — 가드 함수 자체가 환경 설정을 캡슐화하는 역할을 하며, 핸들러는 호출 결과에만 의존한다.
- **제안**: 현행 구조 유지. `http-safety.ts`가 SSRF 판단의 단일 책임 모듈로 충분히 기능하고 있으며 핸들러가 직접 IP 범위 판정 로직을 포함하지 않는다.

### [INFO] `configEcho` 명시 열거: 개방-폐쇄 원칙과 유지보수 트레이드오프
- **위치**: `http-request.handler.ts` lines 164~177
- **상세**: `{ ...rawConfig, url: rawUrl }` spread 방식을 `schema.ts` 정의 필드 명시 열거로 교체했다. 이는 credential leak 방지(보안)와 의도치 않은 필드 노출 차단(정합성) 측면에서 올바른 결정이다. 단, 이로 인해 `http-request.schema.ts`에 새 필드가 추가될 때 핸들러의 `configEcho` 블록도 함께 갱신해야 하는 유지보수 의존이 생긴다. 이는 OCP(개방-폐쇄) 관점에서 사소한 마찰 지점이다. 현재 spec 주석("Spreading would auto-leak any future credential-shaped config field")이 이 트레이드오프를 명시하고 있어 의도가 문서화돼 있다.
- **제안**: `http-request.schema.ts`의 스키마 필드에서 configEcho 객체를 빌드하는 헬퍼를 별도 함수로 추출하거나(`buildConfigEcho(rawConfig)`), 필드 목록을 schema 파일에서 const 배열로 export해 핸들러가 구조적으로 참조할 수 있게 하면 두 파일 간 동기화 위반을 컴파일 타임에 탐지 가능해진다. 단, 현재 코드도 동작에 문제가 없으며 이 제안은 향후 schema 확장 빈도에 따라 선택적으로 고려한다.

### [INFO] 레이어 책임: 사용 로그(Usage) 조건 처리가 핸들러에 인라인
- **위치**: `http-request.handler.ts` lines 269~279 (변경 블록 catch 내부)
- **상세**: SSRF 차단 catch 블록에서 `if (authentication === 'integration' && integrationId)` 조건으로 Usage 로그를 선택적으로 기록한다. 이 조건 분기는 비즈니스 규칙(`integration` 인증만 활동 로그 생성)을 핸들러에 직접 인코딩한 것으로, 비즈니스 레이어와 인프라(로깅) 레이어 경계가 핸들러 안에서 혼합된 형태다. 단, 동일 패턴이 이미 integration resolve 실패 catch(lines 220~237)에서도 사용되고 있으며 이번 변경이 새로 도입한 것이 아니다. 기존 패턴을 일관되게 유지한 것이다.
- **제안**: 현행 유지. Usage 로그 조건(`integration` 인증 한정)을 `logUsageIfIntegration(authentication, integrationId, ...)` 같은 헬퍼로 추출하면 이 조건이 여러 catch 블록에서 반복되는 것을 DRY화할 수 있으나, 현재 2~3개 호출 지점 수준에서는 과도한 추상화일 수 있다.

### [INFO] 테스트 구조: `process.env` 직접 조작 패턴
- **위치**: `http-request.handler.spec.ts` lines 140~167
- **상세**: `ALLOW_PRIVATE_HOST_TARGETS` 환경변수를 테스트 내에서 `process.env`에 직접 쓰고 `finally`로 복원하는 패턴은 기능적으로 올바르나, 병렬 테스트 실행 시 전역 상태 오염 가능성이 있다. 현재 Jest 설정이 테스트 파일 단위로 격리(worker per file)돼 있다면 실제 문제가 되지 않는다. 패턴 자체는 프로젝트 내 다른 환경변수 테스트에서도 동일하게 사용되고 있어 일관성은 있다.
- **제안**: 현행 유지. Jest 환경이 파일 단위 격리를 보장한다면 문제 없다. 추후 이 패턴이 여러 테스트 파일에 확산될 경우 `jest.replaceProperty` 또는 `jest.spyOn(process.env, ...)` 방식으로 통일을 검토한다.

---

## 요약

이번 변경의 핵심은 `http-request.handler.ts`의 SSRF 가드에서 `if (authentication === 'integration')` 단일 게이트 조건을 제거해 전 인증 방식에 가드를 적용하는 것이다. 아키텍처 관점에서 이 변경은 단일 책임 원칙을 강화(SSRF 판단 로직은 `http-safety.ts`에 유지, 핸들러는 게이트 제거만)하고, 기존 opt-out 인프라(`ALLOW_PRIVATE_HOST_TARGETS`)를 재사용해 확장성을 보존한다. `configEcho`의 spread-to-enumeration 교체는 보안 응집도를 높이는 올바른 방향이나 schema와의 구조적 동기화 보장 장치가 없는 점이 약간의 유지보수 취약점이다. 전반적으로 결합도 변화가 최소화됐고 레이어 경계를 새로 위반하지 않으며, 기존 패턴과 일관성을 유지한 안전한 리팩터링이다. SOLID 원칙 위반이나 순환 의존성, 안티패턴은 식별되지 않는다.

---

## 위험도

LOW
