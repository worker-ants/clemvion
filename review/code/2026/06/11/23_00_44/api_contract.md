# API 계약(API Contract) 리뷰 결과

**대상**: HTTP Request 노드 SSRF 가드 전 인증 방식 적용 (refactor 04 C-3)
**검토 파일**: `codebase/backend/src/nodes/core/error-codes.ts`, `http-request.handler.ts`, `http-request.handler.spec.ts`
**검토일**: 2026-06-11

---

## 발견사항

### 1. **[WARNING]** Breaking change — `authentication=none`/`custom` 으로 사설망/loopback 타겟 호출 시 기존 성공 응답이 `HTTP_BLOCKED` 에러 응답으로 변경

- **위치**: `/codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` line 266-296 (SSRF 가드 ungate 블록)
- **상세**: 기존에는 `authentication=none` 또는 `custom` 으로 `10.x`, `192.168.x`, `169.254.169.254` 등 사설/loopback/CGNAT 대상을 호출하면 성공 응답(또는 실제 네트워크 응답)이 반환됐다. 변경 후에는 `port: 'error'`, `output.error.code = 'HTTP_BLOCKED'` 가 반환된다. `ALLOW_PRIVATE_HOST_TARGETS=true` env var 미설정 self-host 환경에서 기존 워크플로가 즉시 중단된다. plan 문서(`plan/in-progress/http-ssrf-all-auth.md`) 에 "운영 영향(breaking)" 이 명시되어 있고 PR 본문·릴리스 노트 기재 의무도 기술돼 있으나, 코드 레벨에서 마이그레이션 가이드 주석이나 deprecation 경고 로그가 없다.
- **제안**: SSRF 블록 시 에러 메시지(`err.message`)에 `ALLOW_PRIVATE_HOST_TARGETS=true` 설정 방법을 안내하는 문자열을 포함시켜 운영자가 에러 로그만으로도 조치 방법을 파악할 수 있도록 한다. 예: `"SSRF_BLOCKED: target is a private/loopback address. To allow, set ALLOW_PRIVATE_HOST_TARGETS=true (see spec §4)."` — 현재 `err.message` 를 그대로 전달하므로 `assertSafeOutboundUrl` 내부 메시지에 이 안내가 포함돼 있지 않으면 클라이언트는 차단 이유를 `output.error.code` 로만 파악해야 한다.

---

### 2. **[WARNING]** 에러 응답 형식 — `none`/`custom` 인증 SSRF 차단 시 `output.error.code = 'HTTP_BLOCKED'` 인데 `HTTP_BLOCKED` 가 공식 에러 코드 열거(`error-codes.ts`)에 방금 추가됐으나 스키마/OpenAPI 정의에 전파 여부 미확인

- **위치**: `codebase/backend/src/nodes/core/error-codes.ts` lines 38-40 (`HTTP_BLOCKED` enum 추가)
- **상세**: `HTTP_BLOCKED` 가 `ErrorCode` enum 에 추가됐다. 이 enum 이 API 응답 스키마나 클라이언트 SDK 타입(예: `packages/sdk`)에 re-export 되는 경우, 클라이언트 측 타입 정의도 갱신돼야 breaking change 없이 처리 가능하다. 특히 채널 웹챗 위젯(`codebase/channel-web-chat`) 이나 외부 워크플로 클라이언트가 `output.error.code` 를 exhaustive switch 처리 중이라면 `HTTP_BLOCKED` 케이스가 누락될 수 있다. diff 상 SDK 또는 공개 타입 정의 갱신이 보이지 않는다.
- **제안**: `ErrorCode` 가 SDK public 타입으로 노출되는지 확인하고, 노출된다면 SDK 패키지 버전을 bump 하거나 타입 정의를 함께 배포한다. `HTTP_BLOCKED` 는 이미 `integration` 인증에서 사용되던 코드이므로 신규 코드명은 아니지만, `none`/`custom` 경로에서도 발생하는 점이 클라이언트 에러 핸들링 분기에 새로운 케이스를 추가한다.

---

### 3. **[INFO]** 에러 응답 형식 일관성 — `none`/`custom` SSRF 차단 시 Usage 로그 미생성 동작이 API 응답 계약에 명시되지 않음

- **위치**: `http-request.handler.ts` lines 272-282 (Usage 로그 `authentication === 'integration'` 한정 가드)
- **상세**: `none`/`custom` 인증 SSRF 차단 시 `port: 'error'` + `HTTP_BLOCKED` 응답은 반환되지만 Usage 로그는 생성되지 않는다. 이는 spec §4.2 에 부합하는 의도된 동작이다. 그러나 API 클라이언트 관점에서 동일한 에러 코드(`HTTP_BLOCKED`)가 `integration` 인증에서는 Usage 로그와 함께, `none`/`custom` 에서는 로그 없이 발생한다는 비대칭 동작이 API 계약 문서화(spec §4.2 Usage 로깅 매트릭스)에 충분히 기술됐는지 확인이 필요하다. consistency-check 산출물(`22_39_51/cross_spec.md`) 에서 "SSRF 차단 행에 `authentication='integration'` 전용 표시 누락" 이 INFO 로 지적됐다.
- **제안**: 추가 코드 변경 불필요. spec §4.2 Usage 로깅 매트릭스 갱신(별도 spec 작업)으로 해소 가능.

---

### 4. **[INFO]** 응답 형식 — config echo 명시 열거 전환으로 미래 스키마 필드 자동 echo 중단

- **위치**: `http-request.handler.ts` lines 201-214 (configEcho 명시 열거 블록)
- **상세**: 기존 `{ ...rawConfig, url: rawUrl }` spread 패턴에서 명시 열거로 전환됐다. 이는 Principle 7 D1 준수(credential leak 방지)를 위한 올바른 변경이다. 그러나 향후 `http-request.schema.ts` 에 새 필드가 추가될 때 이 configEcho 블록도 수동으로 갱신해야 한다. 현재 주석("adding a new schema field is automatically echoed without a maintenance step here" 문구가 제거됐음)이 이를 인지한 상태이지만, 신규 스키마 필드가 추가될 때 echo 블록 갱신을 강제하는 메커니즘(lint rule, 단위 테스트 등)이 없다면 향후 API 응답에 새 필드가 누락될 수 있다.
- **제안**: `http-request.schema.ts` 의 스키마 필드 목록과 configEcho 필드 목록을 자동 동기화하는 단위 테스트를 추가하는 것을 권장한다. 예: 스키마의 `keyof` 를 순회해 configEcho 에 포함됐는지 검증.

---

### 5. **[INFO]** 요청 검증 — `authentication='custom'` 시 URL 검증 선행 여부

- **위치**: `http-request.handler.ts` line 266 (SSRF 가드 try-catch 위치)
- **상세**: SSRF 가드가 `authentication` 분기 제거 후 무조건 실행되므로 `custom` 인증에서도 URL 안전성 검증이 먼저 수행된다. 이는 올바른 순서다. `custom` 인증의 헤더/토큰 주입 로직이 SSRF 가드 이후에 위치하는지(즉, 사설 IP 차단 시 credential 이 네트워크에 노출되지 않는지) 확인이 필요하다. diff 상 SSRF 가드가 실제 fetch 호출보다 앞에 위치하므로 credential 노출 경로는 없어 보인다.
- **제안**: 추가 변경 불필요 (확인용 INFO).

---

## 요약

이 변경의 핵심 API 계약 위험은 **breaking change** 다. `authentication=none` 또는 `custom` 으로 사설망·loopback·CGNAT 대상을 호출하던 기존 self-host 워크플로는 `ALLOW_PRIVATE_HOST_TARGETS=true` 설정 전까지 `HTTP_BLOCKED` 에러 응답을 받게 된다. 변경 자체는 secure-by-default 원칙에 부합하고 spec §105 와의 모순을 해소하는 올바른 방향이며, plan 문서에 breaking 명시, 마이그레이션 경로(기존 env 1개), 테스트 커버리지(none/custom 차단·opt-out 통과·credential-leak 가드)가 모두 갖춰져 있다. 에러 코드 열거형(`HTTP_BLOCKED`) 추가는 기존 코드명을 재사용하므로 에러 코드 네이밍 breaking은 없다. config echo 명시 열거 전환은 API 응답 계약 안전성을 높이지만 향후 스키마 필드 추가 시 수동 동기화 의무가 생긴다. 에러 메시지에 opt-out 플래그 안내를 포함시키는 것이 운영 친화성을 높이는 가장 효과적인 개선이다.

---

## 위험도

MEDIUM

(Breaking change 가 존재하나 plan 에 명시·릴리스 노트 의무 기재·마이그레이션 경로 단일 env var 로 제한되어 있어 CRITICAL 에 해당하지 않음. 에러 메시지 opt-out 안내 부재와 SDK 타입 전파 미확인이 WARNING 2건으로 MEDIUM 판정.)
