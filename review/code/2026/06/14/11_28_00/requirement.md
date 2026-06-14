# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [INFO] 테스트 중복 배치 — CRUD audit describe 블록 내 config 병합 테스트
- 위치: `auth-configs.service.spec.ts` 신규 추가 블록 (diff lines 36–112)
- 상세: 새로 추가된 4개 테스트("config 병합", "마스킹 역류", "config 미전달", "ipWhitelist 비움")가 diff 에는 `CRUD audit 기록 (spec/5-system/1-auth.md §4.1)` describe 블록 바깥에 추가된 것처럼 보이지만, 전체 파일 컨텍스트 기준 동일 테스트가 `CRUD audit 기록` describe 블록 안에도 그대로 존재한다(lines 357–433). diff 에 보이는 추가분과 전체 파일 컨텍스트 내 위치가 `CRUD audit 기록` describe 안이라 의미상 위치는 적절하나, 두 `describe` 블록 사이의 중복이 아닌지 확인이 필요하다. 구조상 `describe('CRUD audit 기록')` 바로 이전에 삽입된 것으로 보이는데, 이 경우 중복 삽입 없이 블록 이동으로 처리됐을 가능성이 있다. 실제로는 중복이 아닐 수 있으나, 파일 최종 상태 확인 권장.
- 제안: 파일 전체를 실행해 4개 테스트가 한 번만 실행되는지 확인. 중복이면 diff 에 추가된 블록(232 라인 앞)을 제거하고 `CRUD audit 기록` 블록에만 보관.

### [WARNING] `formStateFromAuthConfig` — hmacAlgorithm 이진 분기로 인한 spec 불일치 위험
- 위치: `auth-config-form.ts` `formStateFromAuthConfig` 함수 내 `algorithm` 판별 로직
- 상세: spec/1-data-model.md §2.17.1 에서 hmac `algorithm` 은 `"sha256" | "sha512"` 두 값만 허용(허용 목록 고정). `formStateFromAuthConfig` 의 구현도 `cfg.algorithm === "sha512" ? "sha512" : AUTH_CONFIG_DEFAULTS.hmacAlgorithm`으로 이진 처리해 sha512/sha256 외 값은 모두 default(sha256)으로 낙하하므로 사실상 안전하다. 그러나 미래에 sha384 등이 추가될 경우 이 이진 분기가 조용히 잘못된 기본값을 반환할 수 있다. 현재는 spec 범위 내이므로 WARNING 수준이나, 허용 목록을 기반으로 체크하는 방식이 더 견고하다.
- 제안: `AUTH_CONFIG_ALGORITHMS = ["sha256", "sha512"] as const` 상수를 두고 `AUTH_CONFIG_ALGORITHMS.includes(cfg.algorithm) ? cfg.algorithm : default` 패턴으로 대체.

### [INFO] `handleUpdate` — basic_auth password 편집 차단 미검증
- 위치: `page.tsx` `handleUpdate` 함수
- 상세: 편집 모드에서 `basic_auth` 의 `formPassword` 는 항상 빈 문자열로 초기화되고, 편집 폼에서 password 입력 UI 자체가 `dialogMode === "create"` 조건으로 숨겨진다. `buildAuthConfigUpdatePayload`도 password를 config에 포함하지 않는다. 이는 의도한 동작이며 구현이 정확하다. 단, `handleUpdate` 에서 `basic_auth` 의 `username` 이 비어있으면 "fillRequired" 에러를 표시하는 가드가 있지만, 이 검증이 빈 username을 허용하지 않는다는 것은 spec §A.2 의 "Username: 식별 보조 메타" 서술과는 미세하게 다르다(spec은 username을 "사용자 입력" 으로만 기술하며 빈 값 거부를 명시하지 않음). 실제 webhook 인증 시 username이 없으면 인증 실패이므로 이 가드는 적절하다.
- 제안: INFO — 현재 구현 유지. spec §A.2 Basic Auth 표에 "Username은 편집 필수(비워두면 인증 불가)" 를 명시하면 더 명확.

### [INFO] `updateMutation.mutationFn` — `editTargetId` null 가드 부재
- 위치: `page.tsx` `updateMutation` mutationFn 내 `apiClient.patch(`/auth-configs/${editTargetId}`, payload)`
- 상세: `editTargetId` 는 `string | null` 타입이나, `mutationFn` 내에서 null 체크 없이 URL에 직접 삽입된다. `editTargetId` 가 null인 상태에서 `updateMutation.mutate()`가 호출되면 `/auth-configs/null` 로 PATCH를 보내게 된다. 실제로 `handleUpdate` 는 `dialogMode === "edit"` 버튼에서만 호출되고, `dialogMode === "edit"` 는 `handleEditClick` 이 `setEditTargetId(config.id)` 를 선행하므로 정상 흐름에서는 null이 아니다. 그러나 방어적 코딩 관점에서 `if (!editTargetId) return;` 가드를 추가하면 더 안전하다.
- 제안: INFO — 현재 흐름에서 null이 도달하지 않으므로 기능상 문제없음. 선택적으로 `if (!editTargetId) return;` 추가 가능.

### [INFO] spec fidelity — spec/2-navigation/6-config.md §A.2 업데이트 확인
- 위치: `spec/2-navigation/6-config.md` (파일 11)
- 상세: 본 PR에서 spec §A.2 구현 현황 callout 및 R-2 Rationale 에 편집 폼 동작이 정확히 반영됐다. spec §A.2 "Basic Auth" 표의 Password 행은 "사용자 입력, masked input" 으로만 기술되어 있는데, 편집 폼에서는 password를 입력받지 않는다는 사실이 표 레벨에서 명시되지 않았다. R-2 및 구현 현황 callout에 서술됐으므로 중복 기술 필요는 없으나, 테이블 행에 "(생성 시에만 입력, 편집 불가)" 를 추가하면 더 명확하다.
- 제안: INFO — 코드는 spec과 일치. spec 테이블 개선은 선택 사항.

### [INFO] spec fidelity — spec/1-data-model.md §2.17.2 마스킹 정책과 구현 일치
- 위치: `auth-configs.service.ts` `SECRET_CONFIG_KEYS` + `maskConfig`
- 상세: spec §2.17.2 는 `config.key`, `config.token`, `config.secret`, `config.password` 를 마스킹 대상으로 명시한다. 코드의 `SECRET_CONFIG_KEYS = new Set(['key', 'token', 'secret', 'password'])` 와 완전 일치. `update` 의 shallow-merge 에서도 동일 Set을 재사용해 일관성 확보. spec 정합 양호.

### [INFO] spec fidelity — spec/1-data-model.md §2.17.1 자동 발급 prefix 확인
- 위치: `auth-configs.service.ts` `create`, `regenerate` 함수
- 상세: spec §2.17.1 에 따르면 `api_key`: `wfk_<hex24>`, `bearer_token`: `wft_<hex32>`, `hmac`: `whs_<hex32>`. 코드: `wfk_${randomBytes(24).toString('hex')}` = `wfk_` + 48 hex chars (24바이트 → 48 hex). spec 표기 `<hex24>` 는 "24 hex digits"인지 "24 바이트(48 hex)"인지 모호할 수 있으나, 기존 테스트(`/^wfk_[0-9a-f]{48}$/`)가 통과하고 있으므로 spec의 `hex24`는 "24바이트 = 48 hex" 의도. bearer 마찬가지로 `randomBytes(32)` = 64 hex, hmac `randomBytes(32)` = 64 hex. 전체 일치.

### [INFO] `formStateFromAuthConfig` — `ipWhitelistRaw` 조인 구분자
- 위치: `auth-config-form.ts` `formStateFromAuthConfig` 함수 끝
- 상세: `(c.ipWhitelist ?? []).join("\n")` 로 조인하고, `parseIpWhitelist` 는 `\r?\n` 으로 분리한다. `buildAuthConfigUpdatePayload` 가 `parseIpWhitelist(state.ipWhitelistRaw)` 로 재파싱하므로 왕복 일관성이 유지된다. 테스트 `formStateFromAuthConfig` 에서 `["10.0.0.0/8", "203.0.113.42"]` → `"10.0.0.0/8\n203.0.113.42"` 확인됨.

---

## 요약

이번 변경은 AuthConfig 편집 폼(§A.2)을 신규 구현하고, 기존 `update` 서비스 메서드의 config wholesale-replace 버그를 shallow-merge + SECRET_CONFIG_KEYS 무시 방식으로 수정한다. 핵심 기능 완전성은 양호하다: 백엔드 `update`가 비밀값을 보존하고 마스킹된 역류값을 무시하는 동작이 4개의 서비스 테스트로 검증된다. 프론트엔드는 `buildAuthConfigUpdatePayload`/`formStateFromAuthConfig` 순수 함수로 편집 페이로드를 안전하게 조립하고, `dialogMode` 상태로 생성/편집 다이얼로그를 분기한다. spec/1-data-model.md §2.17.1·§2.17.2 마스킹·자동발급 정책과 구현이 line-level로 일치하며, spec/2-navigation/6-config.md §A.2·R-2 도 이번 PR에서 함께 동기화됐다. 발견된 WARNING은 `formStateFromAuthConfig`의 hmacAlgorithm 이진 분기(현재 spec 범위에서는 안전하나 허용 목록 기반으로 리팩토링하면 더 견고)이며, 나머지는 모두 INFO 수준이다. 비즈니스 규칙(type 변경 차단, 비밀값 편집 차단, ipWhitelist 빈 배열=전체 삭제)이 프론트엔드·백엔드 양측에 일관되게 구현됐다.

## 위험도

LOW
