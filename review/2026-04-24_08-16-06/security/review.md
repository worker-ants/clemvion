## 발견사항

---

**[WARNING] SSRF — `@IsUrl` 스킴 제한만으로는 사설 IP 대역 차단 불충분**
- **위치**: `preview-llm-models.dto.ts:42-43` — `@IsUrl({ require_tld: false, protocols: ['http', 'https'] })`
- **상세**: `file://`, `gopher://` 스킴은 차단되지만 `http://169.254.169.254/latest/meta-data/`(AWS IMDS), `http://10.0.0.1/`, `http://192.168.x.x/` 등 내부망 주소는 class-validator의 `IsUrl`이 통과시킨다. `require_tld: false` 옵션은 `local` 프로바이더의 `http://localhost:...` 허용을 위해 필요하지만, 그 부작용으로 TLD 없는 사설 IP 전체가 허용된다. `editor` 권한 + `@Throttle(10/60s)` 로 공격 면은 좁지만 계정 탈취·내부자 위협 시나리오에서 인프라 정보 수집 경로가 된다.
- **제안**: 서비스 레이어에서 `baseUrl` 소비 전 호스트 필터링 추가. `local` 프로바이더는 예외 처리:
  ```typescript
  const parsed = new URL(params.baseUrl);
  const PRIVATE = /^(169\.254\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/;
  if (params.provider !== 'local' && PRIVATE.test(parsed.hostname)) {
    throw new BadRequestException('Invalid endpoint URL');
  }
  ```

---

**[INFO] 서버 에러 메시지 직접 렌더링**
- **위치**: `model-combobox.tsx:75-82` — `onError` 콜백 → `setErrorMessage(msg || fallback)`
- **상세**: `err.response?.data.message`를 그대로 `setErrorMessage`에 저장 후 JSX에 출력한다. React의 기본 HTML 이스케이핑으로 XSS는 방지되나, 백엔드 `sanitizeErrorMessage` 계약이 깨지면 내부 경로·설정 정보가 UI에 표시된다. 현재는 배열 join도 `raw.join(", ")`으로 React가 이스케이프하므로 XSS 위험 없음.
- **제안**: 현행 유지 가능. 단, 배열 요소 수를 상한(예: 5개)으로 제한하면 응답이 과도하게 길어질 때 UI 오염을 방지할 수 있음.

---

**[INFO] 프론트엔드 `baseUrl` URL 형식 검증 부재**
- **위치**: `model-combobox.tsx:44-57` — `mutationFn` 내 `trimmedBaseUrl` 처리
- **상세**: `baseUrl?.trim()` 만 수행하고 형식·스킴 검증 없이 API로 전달한다. SSRF 방어가 백엔드 DTO 단일 레이어에만 의존한다. 프론트 레이어에서도 `http`/`https` 스킴을 검증하면 불필요한 네트워크 왕복을 줄이고 defense-in-depth를 강화할 수 있다.
- **제안**: `canLoad` useMemo 내 `baseUrl` 스킴 체크 추가:
  ```typescript
  if (baseUrl?.trim()) {
    try { 
      const { protocol } = new URL(baseUrl.trim());
      if (protocol !== 'http:' && protocol !== 'https:') return false;
    } catch { return false; }
  }
  ```

---

**[INFO] 테스트 파일 내 API 키 패턴 하드코딩**
- **위치**: `llm-config.controller.spec.ts:31` — `apiKey: 'sk-xxx'`, `llm-configs.test.ts:27` — `apiKey: 'sk-xxx'`
- **상세**: 현재 값은 명백히 더미이며 실제 키가 아니다. 다만 향후 개발자가 실제 키로 임시 테스트 후 커밋하는 패턴 오염 가능성이 있다.
- **제안**: CI에 `gitleaks` 또는 유사한 시크릿 스캔 룰(`sk-[a-zA-Z0-9]{20,}` 패턴) 추가 권장. 현재 테스트 값은 문제없음.

---

**[INFO] `as never` 타입 단언으로 mock 인터페이스 drift 무음 허용**
- **위치**: `llm-config.controller.spec.ts:24-26` — `mockLlmConfigService as never`, `mockLlmService as never`
- **상세**: 보안 취약점은 아니나, 서비스 인터페이스 변경 시 타입 시스템이 mock 불일치를 감지하지 못한다. 권한·인가 관련 메서드가 추가·변경될 때 테스트가 실제 계약과 무음으로 diverge할 수 있다.
- **제안**: `jest.Mocked<Pick<LlmService, 'previewModels' | 'listModels' | ...>>` 로 명시적 타입 선언.

---

## 요약

RESOLUTION 적용 후의 코드는 이전 라운드에서 제기된 주요 보안 이슈(에러 sanitize 순서, Rate Limiting, Timeout, `@IsUrl` 스킴 제한, apiKey/baseUrl trim)가 대부분 반영된 상태다. 잔존하는 실질적 위험은 `@IsUrl`이 사설 IP 대역(`169.254.x.x`, `10.x.x.x`, `192.168.x.x`)을 차단하지 않아 인증된 editor가 SSRF 벡터로 활용할 수 있는 경로다. 이는 `editor` 권한 제한과 Rate Limit으로 공격 면이 좁으나, 클라우드 배포 환경에서는 서비스 레이어에 호스트 기반 차단 로직을 추가하는 것이 권장된다. 프론트엔드는 React 자동 이스케이핑으로 XSS 위험이 없으며, 에러 메시지 표시는 백엔드 sanitize에 올바르게 위임하고 있다.

## 위험도

**MEDIUM** — SSRF 이슈가 editor 권한 제한으로 다소 완화되어 있으나, 내부망 IP 대역 차단 로직이 미구현 상태