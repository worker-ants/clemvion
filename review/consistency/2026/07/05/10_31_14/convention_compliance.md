# 정식 규약 준수 검토 — spec-draft-auth-webauthn-list-format

## 발견사항

- **[WARNING]** `swagger.md §2-5` "유일한 예외" 문구와 신규 예외 추가의 정합성 미표기
  - target 위치: `## 변경 1` (api-convention §5.2 뒤 삽입 문단), `## 변경 3` Rationale subsection
  - 위반 규약: `spec/conventions/swagger.md` §2-5 — "종전 헬퍼가 선언하던 double-wrap … 은 의도된 결정이 아니라 pass-through 를 간과한 버그였다 … **single-wrap 을 double-wrap 으로 되돌리지 말 것**" 및 해당 섹션이 `PaginatedResponseDto`(`{data, pagination}`)를 "성공 응답을 `{ data }` 로 감싼다는 보편 규칙의 **유일한 예외**"로 명시.
  - 상세: draft 가 추가하려는 문구(`{ data: { items } }` 도 이미 `data` 키를 가지므로 pass-through)는 기술적으로는 옳지만(핸들러가 `{data:{items}}` 객체를 직접 반환하면 `'data' in data` 분기로 pass-through), `swagger.md §2-5` 는 pass-through 예외를 `PaginatedResponseDto` **하나**로 못박아 놓았다. draft 가 `api-convention.md`(§5.2 뒤)와 그 Rationale 에만 두 번째 예외(비-페이징 고정 컬렉션)를 추가하고, `swagger.md §2-5` 자체는 갱신 대상에서 빠졌다. 두 conventions 문서가 "pass-through 예외" 라는 같은 메커니즘을 다루면서 한쪽만 갱신되면, `swagger.md` 를 읽는 후속 작업자는 여전히 "예외는 PaginatedResponseDto 뿐" 이라고 오인할 수 있다 — 정보 저장 위치 단일 진실 원칙(CLAUDE.md) 관점에서 두 SoT 가 갈라지는 상황.
  - 제안: `## 변경 1` 또는 별도 `## 변경 4` 로 `spec/conventions/swagger.md §2-5` 에도 "비-페이징 고정 컬렉션(`items` 단일 배열)도 동일한 pass-through 메커니즘의 두 번째 사례" 라는 한 줄 상호 참조를 추가할 것을 권고. 최소한 `api-convention.md` 변경 1 문단에 "swagger.md §2-5 의 pass-through 예외 목록에도 이 사례가 해당함" 을 명시해 두 문서가 서로를 가리키게 한다.

- **[INFO]** `spec/2-navigation/9-user-profile.md` API 표의 동일 엔드포인트 미동기
  - target 위치: draft 전체 (`## 변경 1/2/3`, 갱신 대상 파일 목록)
  - 위반 규약: 직접적인 conventions 위반은 아니나, CLAUDE.md "정보 저장 위치(단일 진실 원칙)" 상 API 엔드포인트 표는 `spec/<영역>/*.md` 본문이 SoT 이고, 동일 리소스가 복수 문서에 표 형태로 중복 등재된 경우 한쪽만 정정하면 문서 간 드리프트가 생긴다.
  - 상세: `GET /api/users/me/sessions`(및 revoke/revoke-others) 는 `spec/5-system/1-auth.md` 뿐 아니라 `spec/2-navigation/9-user-profile.md` §API 표(line 329-331)에도 별도로 등재돼 있고, 이 표 역시 응답 포맷을 명시하지 않은 채 남아 있다(`활성 세션 목록 (family 단위, isCurrent 플래그 포함)` 만 서술, wrapper 형태 언급 없음). draft 는 `1-auth.md` line 469(webauthn)만 정정 대상으로 잡았고 `9-user-profile.md` 의 sessions 표는 건드리지 않는다 — sessions 쪽은 애초에 bare-array 오기(誤記)가 없어 "코드 버그 아님" 케이스에 해당하지만, 이번 기회에 `api-convention §5.2` 신설 note 를 상호 참조해 두면 향후 동일 혼선(webauthn 처럼 bare-array 로 잘못 적히는 사례) 재발을 막을 수 있다.
  - 제안: 필수 아님(현재 `9-user-profile.md` 표는 오기가 없으므로 정정 대상은 아님). 선택적으로 `9-user-profile.md` sessions 행에 `api-convention §5.2 비-페이징 고정 컬렉션` 각주를 추가하는 후속 INFO 로 남겨도 됨.

- **[INFO]** 변경 3 Rationale 위치의 헤딩 레벨 확인 필요
  - target 위치: `## 변경 3` — "Rationale 말미에 추가" 되는 `### 비-페이징 고정 컬렉션은 …` subsection
  - 위반 규약: 문서 구조 규약(CLAUDE.md, Overview/본문/Rationale 3섹션) 자체 위반은 아님 — `2-api-convention.md` 는 이미 최상위 `## Rationale` 섹션을 갖고 있고 draft 는 그 하위에 `###` subsection 을 추가하는 정상 패턴(예: `audit-actions.md` 도 동일 패턴으로 `### 왜 …` subsection 다수 사용).
  - 상세: 문제 없음 — 기존 conventions 문서들의 Rationale 서브섹션 관행과 일치함을 확인차 기록. 별도 조치 불요.

## 요약

Draft 가 제시하는 3개 변경은 코드 근거(`webauthn.controller.ts` line 281-288 `WebAuthnCredentialListDto{items}`, `sessions.controller.ts` line 74/120/164 `{data:{items}}`, frontend `res.data.data.items` 소비)를 실제로 검증한 결과 정확하며, `api-convention.md §5.2`(페이징 목록 전용 규정) 의 공백을 메우는 방향도 conventions 구조상 자연스럽다(Overview/본문/Rationale 기존 패턴 준수, `###` Rationale subsection 관행도 `audit-actions.md` 등과 일치). 다만 pass-through 메커니즘을 규율하는 `swagger.md §2-5` 가 "PaginatedResponseDto 가 유일한 예외" 라고 명시적으로 못박아 둔 상태에서, draft 는 `api-convention.md` 한 곳에만 두 번째 예외를 추가하고 `swagger.md` 를 갱신 대상에서 누락했다 — 두 conventions 문서가 같은 메커니즘의 예외 목록에 대해 서로 다른 사실(하나는 "유일", 하나는 "두 번째 사례 존재")을 말하게 되는 문서 간 드리프트 위험이 유일한 WARNING 이다. 그 외 명명 규약·API 문서 규약(DTO/데코레이터)·금지 항목 위반은 발견되지 않았다.

## 위험도
LOW
