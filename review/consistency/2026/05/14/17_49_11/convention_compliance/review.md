## 발견사항

### [INFO] DRAFT 1D — 인덱스 마이그레이션 V번호 플레이스홀더

- **target 위치**: DRAFT 1D 인덱스 전략 섹션 마지막 주석 (`V0XX`)
- **위반 규약**: `spec/conventions/migrations.md §2 V번호 정책` — "신규 V번호는 항상 현재 main 의 max(V) **+1**이다. gap 금지."
- **상세**: `후속 V0XX` 는 spec 초안 내 미결 번호 참조. 실제 migration 파일을 작성할 때는 반드시 당시 max(V)+1 의 단조 정수를 사용해야 하며, spec 본문에 박힌 `V0XX` 가 실제 파일 이름으로 굳어지지 않도록 주의 필요.
- **제안**: 현 상태(spec 초안)에서는 허용. 구현 착수 시 developer 가 `ls backend/migrations | tail -2` 로 실제 번호를 확정하고 spec 에 반영할 것을 plan 에 명시하면 충분.

---

### [INFO] DRAFT 2E/2C/3C — URL path parameter 표기 `:installToken` (camelCase)

- **target 위치**: DRAFT 2C §3.2 응답 예시, DRAFT 2E §9.2 표, DRAFT 2J-1 §9.4 step 3, DRAFT 3C §1.2.1 시퀀스 다이어그램
- **위반 규약**: 명시적 위반 규약 없음. 기존 API 패턴 (`/api/integrations/:id/reauthorize`) 과의 일관성 관점.
- **상세**: 기존 path param 은 단일 소문자 단어 (`:id`, `:service`) 이고 신규 param 은 camelCase (`:installToken`). `spec/conventions/` 에 path parameter 명명 규약이 없어 CRITICAL/WARNING 은 아니지만, TypeScript Express 프로젝트의 통상 관행은 camelCase multi-word path param 이므로 현 표기 자체는 합리적.
- **제안**: 문제 없음. 단, swagger 규약 파일(`spec/conventions/swagger.md` 등)이 추후 생길 경우 이 precedent 를 반영할 것.

---

### [INFO] DRAFT 2F-bis / 2F — `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 에러 코드 prefix 불일치

- **target 위치**: DRAFT 2F §9.4 공통 응답 포맷 에러 코드 추가 줄, DRAFT 2F-bis §9.2 begin 응답 주석
- **위반 규약**: 명시적 에러 코드 prefix 규약은 없으나, 기존 코드 집합의 암묵적 도메인 prefix 구조 참조
- **상세**: 새 에러 코드 5종 중 4종 (`CAFE24_INSTALL_INVALID_TOKEN`, `CAFE24_INSTALL_INVALID_HMAC`, `CAFE24_INSTALL_REPLAY`, `CAFE24_INSTALL_LEGACY_PATH`)은 `CAFE24_INSTALL_` prefix 로 install 흐름을 표현하는데, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 만 `CAFE24_PRIVATE_` prefix 를 사용. 기능적으로 begin 흐름에서 발생하는 에러이므로 `CAFE24_BEGIN_ALREADY_CONNECTED` 또는 `CAFE24_PRIVATE_ALREADY_CONNECTED` 등 단일 도메인 그룹핑도 가능.
- **제안**: `spec/conventions/` 위반이 아니므로 채택 전 번복은 불필요. 단, 향후 에러 코드 규약을 정식화할 때 이 케이스를 포함해 `CAFE24_{FLOW}_{DESCRIPTION}` 형식을 확정하면 깔끔함.

---

## 요약

본 spec draft 는 `spec/conventions/` 소재 세 규약(`cafe24-api-metadata.md`, `migrations.md`, `node-output.md`) 에 대해 **CRITICAL 및 WARNING 위반이 없다**. 에러 코드 전체가 UPPER_SNAKE_CASE 를 따르고, DB `status_reason` 의 snake_case 와 API 에러 코드의 UPPER_SNAKE_CASE 를 의도적으로 분리해 §10.4 에서 매핑하는 구조는 node-output 규약 Principle 3.2 와 정합한다. 마이그레이션 V번호 플레이스홀더(`V0XX`)는 spec 초안 단계에서 허용 범위이며 구현 착수 시 확정된다. `cafe24-api-metadata.md §6` 에 추가하는 용어 정의 블록은 기존 암묵 표기를 명문화하는 방향으로 규약 강화이지 위반이 아니다.

## 위험도

**NONE**