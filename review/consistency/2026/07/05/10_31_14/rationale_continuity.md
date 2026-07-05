### 발견사항

- **[INFO]** swagger.md §6 "레거시 패턴 제거" 항목과의 구분을 target 새 Rationale에 명시 권장
  - target 위치: `plan/in-progress/spec-draft-auth-webauthn-list-format.md` 변경 3 (`api-convention.md ## Rationale` 신설 subsection)
  - 과거 결정 출처: `spec/conventions/swagger.md` `## Rationale` → "§5 ApiOkPaginatedResponse single-wrap (pass-through 예외)" 항, 및 본문 §6 "레거시 패턴 제거": `{ data: { items, totalItems, page, limit } }` 형태는 "서비스 실제 반환 형태(`{ data, pagination }`)와 다른 스키마는 버그" 라고 명시적으로 기각.
  - 상세: swagger.md §6이 기각한 패턴은 **pagination 필드(`totalItems`/`page`/`limit`)가 `items`와 함께 `data` 아래 중첩**된 경우이며, target이 채택하려는 `{data:{items}}`는 pagination 필드가 전혀 없는 순수 비-페이징 컬렉션이다. 실제로 `SessionListDto`/`WebAuthnCredentialListDto` 어디에도 pagination 필드가 없음을 코드로 확인했다(`codebase/backend/src/modules/auth/dto/responses/session.dto.ts`, `webauthn/dto/responses/webauthn-response.dto.ts`). 즉 두 결정은 형태는 비슷해 보이지만 실질적으로 다른 케이스를 다루므로 **직접 충돌은 아니다**. 다만 향후 독자가 swagger.md §6 문구만 보고 target의 `{data:{items}}` 도입을 "이미 버그로 기각된 패턴의 재도입"으로 오인할 위험이 있다.
  - 제안: 변경 3의 새 Rationale subsection에 "본 결정은 swagger.md §6이 기각한 `{data:{items,totalItems,page,limit}}` 페이징 double-wrap 버그와 무관하다 — pagination 필드가 없는 순수 비-페이징 컬렉션에 한정된다"는 한 문장을 명시적으로 추가해 두 결정의 경계를 문서 차원에서 분리해 둘 것을 권장.

### 요약

target draft(`{data:{items}}` 비-페이징 목록 spec 정정)는 기존 Rationale 체계와 직접 충돌하지 않는다. `api-convention.md §5.2`의 "top-level 형제(중첩 아님)" note는 **페이징 목록**(pagination 필드 포함) 한정 규칙임이 스스로(및 PR #729 커밋 메시지: "비-paginated 도메인은 {data} 단일 wrap이 context-accurate")로 이미 밝혀져 있어, target이 그 note 바로 뒤에 비-페이징 케이스를 별도 규정으로 추가하는 것은 기존 결정의 번복이 아니라 scope 명확화다. `1-auth.md`의 Rationale에도 WebAuthn 목록 응답 포맷에 대한 기존 결정이 없어 "기각된 대안의 재도입"에 해당하지 않는다. 유일한 잠재 혼선은 swagger.md §6이 기각한 "페이징+items 혼합 double-wrap 버그" 문구와 표면적으로 유사해 보인다는 점인데, pagination 필드 유무로 실질 구분되므로 WARNING 수준까지는 아니고 문서 명확화 INFO로 충분하다. target 변경 3의 새 Rationale 작성 자체는 "결정 번복 시 근거 동반" 원칙을 잘 지키고 있다.

### 위험도
LOW
