# Cross-Spec 일관성 검토 — `spec/2-navigation/` (impl-done)

## 검토 범위에 대한 메모

`--impl-done` scope=`spec/2-navigation/`, diff-base=`origin/main` 로 지정되었으나, 이 브랜치는
`spec/2-navigation/**` 자체를 바꾸지 않았다(spec 델타 0, 정상). 실제 구현 diff(3파일/213줄)는
`codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts`
(`AlertRuleDto.threshold`: `number` → `string`)와 그 회귀 방지용 `swagger-dto-contract` 신규 축
(repo-guard) 두 파일이다. `AlertRule` 은 `spec/2-navigation/` 안에서는
`spec/2-navigation/9-user-profile.md §5.4/§6.3`(알림 규칙 화면·API)이 유일한 접점이라, 이 문서와
그 SoT인 `spec/1-data-model.md §2.25 AlertRule`, `spec/data-flow/9-observability.md` 를 절대경로로
직접 열어 대조했다 (프롬프트 번들은 `spec/2-navigation/9-user-profile.md` 를 포함해 대부분
예산 절단되어 있었다).

## 발견사항

- **[INFO]** `AlertRule.threshold` 읽기/쓰기 비대칭이 코드에는 문서화됐지만 spec 양쪽엔 없음
  - target 위치: `spec/2-navigation/9-user-profile.md §6.3`(`POST /api/alerts` body
    `threshold(number, ≥0, ...)`) — 이 표는 쓰기(body) 타입만 기술하고 `GET /api/alerts` /
    `PATCH` 응답의 `threshold` wire 타입은 명시하지 않는다.
  - 충돌 대상: `spec/1-data-model.md §2.25 AlertRule`의 `threshold | Float | 임계치 (DB 는
    NUMERIC(12,4) 고정소수)` 행. "Float" 표기만 보면 응답도 JS number 로 오해할 수 있다.
  - 상세: 이번 diff 로 `AlertRuleDto.threshold`(응답)는 `string`(예: `"10.0000"`)이 되고
    `CreateAlertRuleDto.threshold`(쓰기)는 종전대로 `number` 를 유지한다 — 읽기/쓰기 비대칭은
    코드 JSDoc·CHANGELOG 엔트리에는 명시돼 있으나, 두 spec 문서(`1-data-model.md`,
    `2-navigation/9-user-profile.md`) 어디에도 "GET 응답은 문자열" 이라는 문장이 없다. `Float`
    표기는 DB/도메인 타입 주석(선례: Date 계열 필드도 `Timestamp` 로 적혀 있으나 wire 는
    string — 이번 fix 의 rationale 이 그 46건을 "정상 동작" 으로 이미 구분함)과 같은 관례로
    볼 수 있어 직접적 모순(CRITICAL)은 아니지만, 이 필드는 **바로 이 비대칭 때문에 실제
    OpenAPI 거짓말 버그가 났던 자리**라 재발 방지 관점에서 spec 쪽에도 흔적을 남기는 편이
    안전하다.
  - 제안: `spec/2-navigation/9-user-profile.md §6.3` 의 `GET /api/alerts` 행에 "응답 `threshold`
    는 numeric(12,4) 컬럼을 문자열로 직렬화(정밀도 보존)해 반환 — 쓰기 body 의 `number` 와
    비대칭" 한 줄을 추가하거나, `spec/1-data-model.md §2.25` 의 `threshold` 셀에 위 diff와
    동일한 각주를 다는 것을 권장. 강제 아님(INFO) — 새 repo-guard(`findNumericAsNumber`)가
    코드 레벨 회귀는 이미 잡는다.

- **[INFO]** `CHANGELOG.md` 신규 항목의 라우트 표기 오류
  - target 위치: `CHANGELOG.md` "Unreleased — `AlertRuleDto.threshold` 가 `number` 라고 했지만
    wire 는 문자열이었다" 항목, 첫 문단 `GET /api/alerts/rules`.
  - 충돌 대상: `spec/2-navigation/9-user-profile.md §6.3`(`GET /api/alerts`) 및 실제 컨트롤러
    (`alerts.controller.ts` `@Controller('alerts')` + `@Get()` → 실제 경로는 `/api/alerts`,
    `/rules` 서브경로 없음).
  - 상세: `spec/` 문서는 아니지만 프로젝트 공개 변경 이력이 spec 이 정의한 라우트와 다른
    경로(`/api/alerts/rules`)를 언급해 향후 독자를 오도할 수 있다. 코드·spec 은 일치하며
    실제 결함은 아님 — CHANGELOG 서술만 어긋난다.
  - 제안: `CHANGELOG.md` 해당 문구를 `GET /api/alerts` 로 정정 (선택 사항, 문서 동기화 수준).

## 그 외 확인했으나 충돌 없음으로 판정한 항목

- `spec/1-data-model.md` 의 `Float` 타입이 붙은 다른 필드(`position_x`/`position_y`,
  `rerank_score_threshold`)는 실제 엔티티가 각각 `double precision`/`float`류 컬럼이라 이번
  이슈(`numeric`→string) 대상이 아님을 엔티티 정의로 직접 확인 — `threshold` 는 유일하게
  `NUMERIC(12,4)` 인 케이스이며 spec 자체도 이미 그 사실을 괄호로 명기하고 있어 새로 발생한
  모순이 아니다.
- `spec/data-flow/9-observability.md` 의 breach 평가 로직(`observed <= threshold` strict 초과
  판정) 은 서버 내부 계산이며 이번 wire 타입 변경(HTTP 응답 직렬화)과 무관 — 영향 없음.
- 신규 repo-guard 파일 배치(`codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-*`)
  는 기존 guard·spec 쌍(`nullable-type-lie-cast-guard.ts` 등)과 동일 패턴이라 계층 책임
  충돌 없음.
- RBAC·요구사항 ID·상태 전이 축은 이번 diff 가 건드리지 않아 검토 대상 없음.

## 요약

이번 브랜치는 `spec/2-navigation/` 문서 자체를 바꾸지 않았고, 실제 구현 diff(`AlertRuleDto.threshold`
number→string 정정 + 관련 repo-guard)는 `spec/2-navigation/9-user-profile.md §6.3`(AlertRule API)
와 `spec/1-data-model.md §2.25`가 이미 알고 있던 `NUMERIC(12,4)` 컬럼 한 자리에 좁게 국한된다.
직접적인 데이터 모델·API 계약·RBAC·상태 전이 모순은 발견되지 않았다. 다만 이번 fix 자체가
"OpenAPI 만 거짓말하고 있었다" 는 실제 결함을 정정한 사례인 만큼, 같은 필드에 대해 spec 문서
(`1-data-model.md`/`2-navigation/9-user-profile.md`) 쪽에도 읽기/쓰기 비대칭을 한 줄 남겨 재발
방지 폭을 넓히는 것을 권장(INFO)하며, `CHANGELOG.md` 의 라우트 오기 정정도 함께 권장한다. 둘 다
채택을 막을 수준은 아니다.

## 위험도

LOW
