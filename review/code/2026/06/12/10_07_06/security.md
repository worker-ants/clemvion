# 보안(Security) 리뷰 결과

리뷰 대상: HTTP Request / Database Query / Code 노드 하드닝, 에러 코드 카탈로그, 관련 spec 및 consistency review 산출물
diff-base: origin/main

---

## 발견사항

### [INFO] SSRF 가드 — 이중 검사(URL 리터럴 + DNS rebinding) 설계 확인

- **위치**: `spec/4-nodes/4-integration/1-http-request.md` §4 step 8
- **상세**: HTTP Request 는 `assertSafeOutboundUrl` (호스트 리터럴 검사) → `assertSafeOutboundHostResolved` (DNS resolve 후 IP 재검사) 이중 단계로 DNS rebinding 공격까지 방어한다. Database Query 는 host/port 분리형 자격증명 구조상 `assertSafeOutboundHostResolved` 단계만 적용하는 것이 명시됐다. 두 경로 모두 SSRF 방어 원칙을 충족한다.
- **제안**: 없음. 다만 코드 구현에서 `assertSafeOutboundUrl` 의 커버리지(IPv6 bracket notation, encoded percent, non-printable 포함 여부)는 별도 단위 테스트로 확인 권장.

---

### [INFO] dry-run 시 SSRF 가드 생략 — 구현 보증 필요

- **위치**: `spec/4-nodes/4-integration/1-http-request.md` §4 step 8 (신규 문구)
- **상세**: `dry-run 실행은 실제 fetch 가 없으므로 SSRF 가드 이전에 mock 을 반환하고 가드를 생략한다`는 문구가 추가됐다. 이는 아웃바운드 요청이 발생하지 않는다는 근거로 생략을 정당화한다. 그러나 구현 코드에서 dry-run 분기가 실제로 fetch 를 호출하지 않음을 보장하지 못하면 가드 없이 아웃바운드가 발생하는 보안 사고가 가능하다.
- **제안**: dry-run 분기가 실제 fetch 를 수행하지 않도록 구현 단의 통합 테스트/e2e 커버리지를 갖출 것을 권장. spec 기재만으로는 구현 오류를 방어할 수 없다.

---

### [INFO] 에러 메시지에 host/IP 정보 미포함 — 정찰면 축소 설계 확인

- **위치**: `spec/4-nodes/4-integration/2-database-query.md` §4 (참조), `spec/2-navigation/4-integration.md` DB_HOST_BLOCKED 행
- **상세**: `DB_HOST_BLOCKED` 에러 메시지가 host/IP 정보를 포함하지 않도록 일반화된 것이 spec 에 명시됐다. 공격자가 SSRF 차단 응답으로 내부 네트워크 토폴로지를 정찰하는 것을 방지하는 올바른 설계다.
- **제안**: `HTTP_BLOCKED` 및 `EMAIL_HOST_BLOCKED` 에 대해서도 에러 메시지의 host/IP 미포함 정책을 spec 에 명시적으로 확인/추가 권장.

---

### [INFO] `md5`/`sha1` 알고리즘 경고 문구 추가 — 보안 가이던스 개선

- **위치**: `spec/4-nodes/5-data/2-code.md` §3 helpers 표
- **상세**: `$helpers.crypto.hash` 에 허용 알고리즘 목록이 명시되고, `md5`/`sha1` 에 대해 "암호학적 용도(서명·비밀번호·무결성 보증) 금지 — 충돌 공격에 취약" 경고가 추가됐다. spec 수준의 가이던스로서 적절하다. 다만 이 제약이 런타임에 강제되지 않아 사용자는 여전히 자유롭게 `md5` 를 호출할 수 있다.
- **제안**: 구현(`code.handler.ts` 또는 helpers 모듈)에서 `algorithm` 파라미터를 화이트리스트로 검증하거나, 금지된 알고리즘 사용 시 경고 로그를 남기는 것을 고려. 현재는 spec 기재만 있고 런타임 강제가 없다.

---

### [INFO] `output.error.details.stack` 프로덕션 노출 제어 — 올바른 설계

- **위치**: `spec/4-nodes/5-data/2-code.md` §5.3 공통 필드 표 및 §5.3.1 note
- **상세**: `details.stack` 이 `NODE_ENV !== 'production'` 일 때만 포함된다는 사실이 명시됐다. 프로덕션에서 isolate 내부 파일 경로 및 라인 정보가 노출되지 않도록 제어한다. 에러 처리의 정보 노출 방지 원칙을 올바르게 준수한다.
- **제안**: 없음.

---

### [INFO] `output.response.error` Deprecated 필드 — 레거시 필드 sanitize 확인 필요

- **위치**: `spec/4-nodes/4-integration/1-http-request.md` §5.5 표
- **상세**: `output.response.error` 필드가 "Deprecated (legacy 호환 잔재)" 로 명시됐다. `output.error.details.url` 에는 "URL sanitize 적용"이 명시돼 있으나, 레거시 `output.response.error` 필드에 transport 실패 메시지 전문이 담길 경우 자격증명이나 URL 에 포함된 토큰 정보가 sanitize 없이 노출될 가능성이 있다.
- **제안**: `output.response.error` 에 대한 sanitize 처리 여부를 구현에서 확인 권장. 자격증명 정보(Bearer 토큰, API 키 등)가 에러 메시지에 포함되지 않도록 보장해야 한다.

---

### [INFO] `ALLOW_PRIVATE_HOST_TARGETS` 환경변수 — 단일 opt-out 플래그 운영 위험

- **위치**: `spec/4-nodes/4-integration/1-http-request.md` §4 SSRF 가드, `spec/5-system/3-error-handling.md` §1.4
- **상세**: HTTP / DB / Email 전체를 단일 환경변수 `ALLOW_PRIVATE_HOST_TARGETS=true` 로 opt-out 하는 설계는 편의성을 제공하지만, 이 플래그가 설정된 환경에서는 모든 통합 노드의 SSRF 방어가 동시에 무력화된다. 개발 환경에서 실수로 활성화된 상태가 프로덕션으로 전파될 경우 전면 SSRF 취약점이 발생한다.
- **제안**: 프로덕션 배포 파이프라인에서 이 플래그가 `true` 로 설정될 경우 경고 로그(또는 CI 게이트)가 작동하도록 구현 수준 보호를 추가 권장. spec 에 이미 "기본은 차단(secure-by-default)"이 명시돼 있으나 운영 사고 방지 차원의 추가 보호가 필요하다.

---

### [INFO] `_retry_state.json` 에 절대 경로 포함 — 내부 경로 노출

- **위치**: `review/consistency/**/_retry_state.json` 파일들 (다수)
- **상세**: `_retry_state.json` 에 `/Volumes/project/private/clemvion/` 로 시작하는 절대 경로가 하드코딩돼 있다. 이 경로는 개발자 로컬 머신의 디렉토리 구조를 노출한다. review/ 디렉토리가 git 리포지터리에 커밋된다면 이 경로 정보가 이력에 남는다.
- **제안**: 해당 파일이 내부 전용이고 공개 저장소가 아닌 경우 현행 유지 가능. 공개 저장소라면 `.gitignore` 에 `_retry_state.json` 추가 또는 경로를 상대 경로로 저장하는 방식 검토.

---

## 요약

이번 변경은 HTTP Request / Database Query / Send Email 통합 노드의 SSRF 가드를 전 인증 방식(none/integration/custom) 공통으로 강화하고, `DB_HOST_BLOCKED` 에러 코드를 신설해 HTTP/Email SSRF 차단 코드와 대칭을 달성하는 보안 강화 작업이다. SSRF 이중 방어(URL 리터럴 + DNS rebinding), 에러 메시지 host/IP 미포함 일반화, 프로덕션 스택 트레이스 억제 등 핵심 보안 원칙이 올바르게 적용됐다. `md5`/`sha1` 경고 문구 추가도 적절한 보안 가이던스 강화다. 보안 개선 여지는 (1) dry-run 분기의 fetch 미발생을 구현 수준에서 검증하는 테스트, (2) `ALLOW_PRIVATE_HOST_TARGETS` opt-out 플래그의 프로덕션 실수 활성화 방지 운영 보호, (3) 레거시 `output.response.error` 필드의 자격증명 sanitize 여부 확인이다. 하드코딩된 시크릿, 인젝션 취약점, 인증 우회, 알려진 취약 의존성 사용은 이 diff 범위 내에서 발견되지 않았다.

## 위험도

LOW

STATUS: SUCCESS
