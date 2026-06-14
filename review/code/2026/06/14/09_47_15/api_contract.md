# API 계약(API Contract) 리뷰 결과

## 발견사항

### [INFO] POST /auth-configs 요청 바디 — 신규 필드 두 개 (ipWhitelist, config.headerName) 추가
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` L282–288 (createMutation)
- 상세: 기존 POST `/auth-configs` 바디 `{ name, type, config }` 에 `ipWhitelist` (최상위 배열)와 `config.headerName` (api_key type 한정) 가 추가된다. 백엔드 DTO(`create-auth-config.dto.ts`, `update-auth-config.dto.ts`)는 이미 두 필드를 지원한다고 spec 에 명시돼 있으므로 하위 호환성 문제는 없다. `ipWhitelist` 는 비어 있을 때 미송신(`...(ipWhitelist.length > 0 ? { ipWhitelist } : {})`)하므로 기존 요청 계약과의 충돌 없음.
- 제안: 해당 없음 (INFO 수준).

### [INFO] ipWhitelist 클라이언트 측 유효성 검증 부재 — CIDR/IP 형식 검사 없음
- 위치: `authentication/page.tsx` L279–283
- 상세: 프런트엔드는 빈 줄·공백 제거만 수행하고 `10.0.0.0/8`, `203.0.113.42` 등의 형식 유효성은 전혀 검사하지 않는다. 유효하지 않은 IP 문자열이 그대로 백엔드로 송신된다. 백엔드 DTO 가 `@IsIP()` / `@IsCIDR()` 등의 class-validator 데코레이터로 검증한다면 400 응답이 반환되며 onError 에서 범용 toast 메시지만 노출된다. 백엔드가 이 검증을 담당한다는 전제가 맞다면 API 계약상 문제는 없으나, 사용자 경험 관점에서 클라이언트 측 검증 추가를 고려할 수 있다.
- 제안: 백엔드 DTO 검증이 충분한지 확인. 클라이언트 레벨 IP/CIDR 정규식 검증을 추가하면 불필요한 왕복을 줄일 수 있음 (리뷰 범위 내이나 차단 이슈 아님).

### [INFO] config.headerName — api_key type 비우면 미송신 처리 (백엔드 기본값 의존)
- 위치: `authentication/page.tsx` L270–273
- 상세: `formApiKeyHeader` 가 빈 문자열이 되면 `config.headerName` 을 송신하지 않는다. 백엔드가 `headerName` 누락 시 `X-API-Key` 기본값을 적용한다고 주석에 명시돼 있으며, spec §A.2 테이블과 일치한다. API 계약상 문제 없음.
- 제안: 해당 없음.

### [INFO] POST /auth-configs 응답 형식 소비 패턴 — 이중 fallback(`res.data.data ?? res.data`)
- 위치: `authentication/page.tsx` L289
- 상세: `res.data.data ?? res.data` 패턴이 이미 기존 코드에 존재하며 이번 변경에서 유지된다. 응답 래퍼 구조(`{ data: { data: <entity> } }`)가 백엔드와 정합하는 한 문제 없음. 테스트 mock에서도 `{ data: { data: { id, type, config } } }` 로 구조를 확인한다(파일 1, L94–97).
- 제안: 해당 없음.

### [INFO] 목록 API (`GET /auth-configs`) — 페이지네이션 파라미터 미사용
- 위치: `authentication/page.tsx` L454–458
- 상세: 기존 코드 이슈이며 이번 변경 범위 밖이나 기록. `apiClient.get("/auth-configs")` 에 `page`/`limit` 파라미터를 전달하지 않아 서버 기본값으로 동작한다. spec §3 API 표는 `page, limit, sort, order, search` 쿼리를 지원한다고 명시. 이번 변경은 이 패턴을 수정하지 않으므로 현 상태 유지.
- 제안: 후속 이슈로 분리 추적 권장 (본 PR 범위 밖).

---

## 요약

이번 변경은 프런트엔드 UI 레이어(create 폼)에 `ipWhitelist`(textarea → 줄 구분 배열)와 `config.headerName`(api_key type 한정) 두 필드를 추가하고, 이를 기존 `POST /auth-configs` 엔드포인트에 전송하는 것이다. 백엔드 DTO 가 이미 두 필드를 수용하므로 breaking change 나 하위 호환성 문제는 없다. 빈 값 미송신 처리(`ipWhitelist` 미포함, `headerName` 미포함)도 적절하다. 클라이언트 측 IP/CIDR 형식 검증 부재는 참고 사항(INFO)이며, 백엔드 DTO 검증이 거름망 역할을 한다는 전제에서 API 계약 위반이 아니다. URL/경로 설계·인증/인가·응답 형식·에러 응답 패턴 모두 기존 계약을 그대로 따른다.

## 위험도

NONE
