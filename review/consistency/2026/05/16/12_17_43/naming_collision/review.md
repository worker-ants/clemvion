# 신규 식별자 충돌 검토 — spec/2-navigation/4-integration.md

검토 모드: `--impl-prep` (구현 착수 전)
검토 시각: 2026-05-16

---

## 발견사항

### INFO — `IntegrationDto.appUrl` 와 `OAuthBeginResponseDto.appUrl` 의 의미 동일·타입 상이

- **target 신규 식별자**: `IntegrationDto.appUrl: string | null`
  (`GET /api/integrations/:id` 응답 — Cafe24 Private 시 App URL, 그 외 null)
- **기존 사용처**:
  - `backend/src/modules/integrations/dto/responses/integration-response.dto.ts` line 214 — `OAuthBeginResponseDto.appUrl?: string` (optional, Cafe24 Private 분기에서만 존재)
  - `backend/src/modules/integrations/integration-oauth.service.ts` line 1173 — `requestScopes` Cafe24 Private 분기 응답 내 `appUrl: string`
  - `frontend/src/lib/api/integrations.ts` line 17 — `Cafe24PrivatePendingBase.appUrl: string` (신규 등록·request-scopes 응답 전용)
- **상세**: 세 곳의 `appUrl` 은 모두 동일한 의미(Cafe24 Private App URL = `${APP_URL}/api/3rd-party/cafe24/install/:installToken`)를 가리킨다. 따라서 이름 충돌이 아니라 같은 개념의 다른 응답 DTO 에서의 재사용이다. 차이점은 시멘틱 타입뿐이다 — `OAuthBeginResponseDto` 와 `Cafe24PrivatePendingBase` 에서는 항상 `string` (optional field 이므로 해당 분기에서만 존재), `IntegrationDto` 에서는 `string | null` (항상 존재, Cafe24 Private 아닌 경우 null). 이 차이가 프론트엔드 클라이언트에서 타입 혼동을 일으킬 가능성은 낮다 — 두 응답 DTO 는 호출 경로가 다르고 (`/oauth/begin` vs `/integrations/:id`), 프론트엔드가 각각 별도 변수로 바인딩할 것이기 때문이다.
- **제안**: 충돌 없음. 다만 `IntegrationDto` 에 `appUrl` 필드를 추가할 때 JSDoc/ApiProperty 설명에 "Cafe24 Private 통합에서만 string, 그 외 null" 의미를 명시해 `OAuthBeginResponseDto.appUrl` (항상 string) 와의 타입 차이를 문서화할 것을 권장한다. `spec/2-navigation/4-integration.md §9.1` 에 이미 `string | null` 명시가 있으므로 코드 주석만 보강하면 된다.

---

### INFO — `Cafe24AppUrlCard` 컴포넌트명 신규 도입 — 코드베이스 내 중복 없음

- **target 신규 식별자**: `Cafe24AppUrlCard` (React 컴포넌트, 통합 상세 페이지 Overview 탭)
- **기존 사용처**: `frontend/` 전역 grep 결과 해당 이름 없음. 기존 유사 컴포넌트는 `Cafe24PrivatePendingStep` (`frontend/src/app/(main)/integrations/new/page.tsx` line 803) 이며 등록 흐름 전용.
- **상세**: 충돌 없음. `Cafe24PrivatePendingStep` 은 등록 흐름 전용 스텝 컴포넌트이고, `Cafe24AppUrlCard` 는 상세 페이지 카드 컴포넌트이므로 역할·이름 모두 구분된다.
- **제안**: 현행 명명 유지 가능. 다만 두 컴포넌트가 동일한 "라벨 + 모노스페이스 URL + 복사 버튼" UX 패턴을 공유한다면, spec §4.2 에 명시된 대로 `Cafe24PrivatePendingStep` 내부 복사 UI 를 sub-컴포넌트로 분리·재사용하는 리팩토링을 병행하면 파편화를 줄일 수 있다. 이는 구현 선택 사항이지 식별자 충돌 이슈는 아니다.

---

### INFO — `spec/data-flow/integration.md §1.2.1` 수정 대상 라인 이미 정정됨

- **target 신규 식별자**: 해당 없음 (삭제·수정이지 신규 식별자 도입 아님)
- **기존 사용처**: `spec/data-flow/integration.md` line 90
- **상세**: plan(`spec-update-cafe24-app-url-detail.md`) 의 Critical 수정 대상인 `spec/data-flow/integration.md §1.2.1` line 90 이 현재 이미 `install_token + install_token_issued_at 보존 — post-install navigation 식별 키` 표기로 정정된 상태다. 옛 `install_token=NULL` 표현은 존재하지 않는다. 식별자 충돌 없음.
- **제안**: Critical 항목은 이미 반영 완료. plan 의 해당 체크박스를 완료 표기한 후 다음 단계로 진행하면 된다.

---

## 요약

신규 식별자 충돌 관점에서 CRITICAL 또는 WARNING 등급 문제는 발견되지 않았다. 주요 신규 식별자인 `IntegrationDto.appUrl: string | null` 은 기존 `OAuthBeginResponseDto.appUrl?: string` / `Cafe24PrivatePendingBase.appUrl: string` 과 동일한 의미를 가지지만 다른 DTO 클래스·다른 API 응답 경로에서 사용되므로 런타임 충돌이 없다. 타입 시그니처 차이(항상 존재 vs optional, `string|null` vs `string`)를 코드 주석으로 명시하는 것이 권장된다. `Cafe24AppUrlCard` 컴포넌트명은 코드베이스 어디에도 기존 사용처가 없어 충돌 없다. `spec/data-flow/integration.md` 의 Critical 수정 대상 라인은 이미 정정 완료 상태임을 확인했다.

## 위험도

NONE
