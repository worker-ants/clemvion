## 발견사항

---

### **[HIGH]** SSRF via `baseUrl` — IP 대역 필터링 미적용 (DTO 레이어)
- **위치**: `preview-llm-models.dto.ts:39` `@IsUrl({ require_tld: false, protocols: ['http', 'https'] })`
- **상세**: scheme 제한(`http`/`https`만 허용)은 적용되어 있으나, `require_tld: false` 옵션이 TLD 없는 내부 호스트도 통과시킨다. `editor` 권한 사용자가 `http://169.254.169.254/latest/meta-data/`(AWS IMDS), `http://10.0.0.1/`, `http://192.168.1.1/` 등을 전달하면 DTO 단에서 차단되지 않는다. RESOLUTION.md(`2026-04-23_18-19-38`)는 `llm.service.ts`에 `isPrivateHost()` 서비스 레이어 필터를 추가했다고 명시하나, 해당 파일이 이번 리뷰 범위에 포함되지 않아 실제 적용 여부를 검증할 수 없다. 서비스 레이어 방어가 누락되거나 우회될 경우 DTO에 방어선이 없다.
- **제안**:
  ```typescript
  // DTO 레이어에서 IP 대역 차단 (서비스 레이어와 심층 방어)
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  @Validate(NoPrivateIpConstraint) // custom validator 또는 @IsNotIn 활용
  baseUrl?: string;
  ```
  최소한 `preview-llm-models.dto.spec.ts`에 `http://169.254.169.254`, `http://10.0.0.1`, `http://192.168.1.1` 케이스를 추가하여 서비스 레이어 방어가 동작하는지 검증하고, DTO 레벨 차단이 없음을 테스트로 문서화할 것.

---

### **[WARNING]** SSRF 방어 테스트 커버리지 불완전
- **위치**: `preview-llm-models.dto.spec.ts:47-58` ("rejects baseUrl with a non-http(s) scheme (SSRF guard)")
- **상세**: `file:///etc/passwd` 스킴 차단 테스트는 존재하나, 실제 SSRF 공격의 주요 벡터인 내부 IP 대역(`169.254.169.254`, `10.x.x.x`, `192.168.x.x`, `127.0.0.1`)에 대한 테스트가 없다. 주석 이름이 "SSRF guard"임에도 스킴 수준 차단만 검증한다. 서비스 레이어에 `isPrivateHost()` 가 존재하더라도 이 수준의 통합 검증이 없으면 회귀 시 무음으로 통과된다.
- **제안**:
  ```typescript
  it('rejects cloud metadata endpoint (SSRF guard)', async () => {
    await expectValidationError(
      { provider: 'openai', apiKey: 'k', baseUrl: 'http://169.254.169.254/latest/meta-data/' },
      'baseUrl',
    );
  });
  it('rejects private network addresses for non-local providers', async () => {
    await expectValidationError(
      { provider: 'openai', apiKey: 'k', baseUrl: 'http://10.0.0.1/' },
      'baseUrl',
    );
  });
  ```

---

### **[WARNING]** 로컬 프로바이더 SSRF 예외 처리 — 테스트 검증 없음
- **위치**: `preview-llm-models.dto.spec.ts:26-31`, `preview-llm-models.dto.ts` 전체
- **상세**: RESOLUTION.md는 `local` 프로바이더에 대해 `localhost` SSRF 차단을 예외 처리한다고 명시한다. 그러나 DTO 스펙 테스트에는 이 예외 처리가 `local` 프로바이더에만 적용되고 `openai`/`anthropic`/`google`에는 적용되지 않음을 검증하는 케이스가 없다. 서비스 레이어에서 `provider !== 'local'` 조건이 잘못 구현되면 모든 프로바이더에서 내부 IP가 허용될 수 있다.
- **제안**: `provider: 'local'`에서는 `http://localhost:11434/v1`이 허용되고, `provider: 'openai'`에서는 동일 URL이 차단됨을 검증하는 케이스 추가.

---

### **[WARNING]** 프론트엔드 API 테스트 — 평문 API 키 전송 계약 고정
- **위치**: `frontend/src/lib/api/__tests__/llm-configs.test.ts:69-76`
- **상세**: 테스트가 `apiKey: "sk-xxx"`를 POST 바디에 그대로 전달하는 것을 `toHaveBeenCalledWith`로 계약으로 명시화한다. 설계상 의도된 동작이나, 해당 경로가 HTTPS를 통해서만 호출됨을 보장하는 검증이 없다. 내부 개발/테스트 환경에서 HTTP 사용 시 API 키가 평문 전송된다.
- **제안**: 즉각적 코드 변경보다는 문서화 수준에서 "이 엔드포인트는 반드시 TLS 전송만 허용" 조건을 명시. `apiClient` 설정에서 `baseURL`이 HTTPS임을 강제하는 것도 고려.

---

### **[INFO]** 캐시 격리 검증 — 보안 설계 올바름
- **위치**: `llm-config.controller.spec.ts:55-57`
- **상세**: `expect(mockLlmService.clearClientCache).not.toHaveBeenCalled()` 검증이 명시적으로 존재한다. preview 작업이 per-config 클라이언트 캐시를 오염시키지 않음을 테스트로 보장한다.
- **제안**: 현행 유지.

---

### **[INFO]** 테스트 코드 내 하드코딩된 시크릿 없음
- **위치**: 모든 테스트 파일
- **상세**: `sk-xxx`, `k`, `bad` 등 플레이스홀더 값만 사용. 실제 API 키나 민감 자격증명이 코드에 포함되지 않음.

---

### **[INFO]** `apiKey` 누락 필드 차단 확인
- **위치**: `preview-llm-models.dto.spec.ts:40-42`
- **상세**: `@IsString()` 데코레이터가 `apiKey` 필드 자체 누락 시 검증 실패를 유발함을 테스트("rejects missing apiKey field")로 확인. `@IsOptional()` 부재로 인해 의도된 동작.

---

## 요약

이번 변경의 핵심 보안 리스크는 `baseUrl` SSRF 방어가 DTO 레이어에서 스킴 제한(http/https)만 적용되고 내부 IP 대역 차단은 서비스 레이어에만 의존하는 단층 방어 구조다. RESOLUTION.md는 `llm.service.ts`에 `isPrivateHost()` 추가를 완료로 기재하나 해당 파일이 이번 리뷰 범위 밖이라 검증 불가하며, DTO 스펙 테스트에 내부 IP 케이스가 없어 회귀 감지 수단이 없다. 스킴 수준 SSRF 차단(`file://` 등), 캐시 격리 검증, 에러 sanitize 흐름은 적절히 구현되어 있다. Rate Limiting과 Timeout은 이전 리뷰에서 조치 완료로 확인된다.

## 위험도

**MEDIUM** — SSRF 방어의 DTO/서비스 레이어 분리 구조상 서비스 레이어 방어 누락 시 노출 위험이 있으며, `editor` 권한 제한으로 공격 면은 제한적