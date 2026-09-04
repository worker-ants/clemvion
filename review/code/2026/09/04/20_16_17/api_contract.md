# API 계약(API Contract) 리뷰

## 범위 확정

실질적인 API 계약 변경은 다음 4개 파일이다. 나머지(파일 6~26)는 직전 리뷰 라운드
(`19_43_18`, `review/consistency/.../20_05_42`)의 산출물이 git에 커밋되며 diff 에 딸려 온
것으로, 그 자체는 이번 리뷰의 API 계약 판단 대상이 아니다(메타 리포트).

1. `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` —
   `AlertRuleDto.threshold`: `number` → `string`, `@ApiProperty({ example: 10 })` →
   `@ApiProperty({ type: String, example: '10.0000' })`.
2. `CHANGELOG.md` — 위 변경의 breaking-change 고지 섹션 추가.
3. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — 회귀 방지용
   술어 `findNumericAsNumber` 신설(제3의 계약 검증 축).
4. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` — 위 술어의
   저장소 전수 테스트 + 대조군 3방향.
5. `plan/in-progress/spec-draft-nullable-notation-followups.md` — 위 코드 변경에 대응하는
   planner 트래커 갱신(코드 아님).

이번 diff 는 직전 라운드(`19_43_18`) `api_contract` 리뷰가 지적한 WARNING 4건에 대한
`RESOLUTION.md` 조치를 반영한 상태다. 아래는 그 조치가 실제로 유효한지 코드를 직접 열어
독립 재검증한 결과다.

## 발견사항

- **[INFO]** `threshold` 타입 정정은 wire·엔티티·프런트엔드 소비자 전부와 line-level 로 재확인됨
  - 위치: `codebase/backend/src/modules/alerts/entities/alert-rule.entity.ts` (`threshold: string`,
    `@Column({ type: 'numeric', precision: 12, scale: 4 })`), `codebase/frontend/src/lib/api/alerts.ts:11`
    (`threshold: string;`, 읽기), `:21`(`threshold: number;`, 쓰기), `alerts.controller.ts`
    (`list`/`create`/`update` 세 핸들러 모두 반환 타입 미명시 — `grep` 재확인)
  - 상세: `RESOLUTION.md` 의 "list/create/update 세 응답 모두" 주장, "저장소의 numeric 컬럼은
    둘뿐"(`alert_rule.threshold`, `llm_usage_log.cost_usd`) 주장을 직접 코드로 재확인했다.
    `llm_usage_log.cost_usd` 는 `LlmUsageLogDto` 라는 1:1 대응 DTO 가 없고
    (`statistics-response.dto.ts` 의 `LlmUsageByModelDto`/`LlmUsageTimeseriesItemDto` 만
    `costUsd?: number | null` 로 노출) 서비스가 `SUM(...)::float`+`Number(...)` 로 집계하므로
    `number` 노출이 정확 — 세 주장 모두 실측과 부합한다. 순수 문서 정합화이며 런타임 파손 없음.
  - 제안: 없음.

- **[INFO]** 직전 라운드 WARNING(회귀 테스트 부재)이 실제 회귀 가드로 닫혔고, 저장소 전수
  테스트로 CI 에 배선돼 있음을 확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:216-269`
    (`findNumericAsNumber`), `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:291-294`
    (`expect(findNumericAsNumber(collectTsFiles(SRC_ROOT))).toEqual([])`)
  - 상세: `collectTsFiles(SRC_ROOT)` 로 backend `src` 전체를 스캔하므로 backend jest 표준
    실행(`RESOLUTION.md` 의 "unit: PASS — 9,328건")에 자연히 포함된다 — 별도 opt-in 이 필요 없는
    상시 가드다. 대조군 3방향(잡음/`string`이면 안 잡음/`numeric` 아닌 컬럼은 안 잡음)도
    확인했다. 다만 이 술어는 **`XxxDto` ↔ `Xxx` 이름 대응이 있는 엔티티-그대로-반환 DTO만**
    겨눈다(문서화된 의도적 스코프 축소). `LlmUsageLogDto` 처럼 이름이 대응하지 않는 aggregate
    DTO 는 애초에 검사 대상 밖이므로, 향후 새 엔티티-그대로-반환 DTO가 관례와 다른 클래스명을
    쓰면(예: `AlertRuleResponseDto` 처럼 `Dto` 접미사 앞에 추가 토큰) 조용히 못 잡는다. 현재
    시점엔 실질 갭이 없음(전수 확인).
  - 제안: 없음(스코프는 문서화돼 있고 정당함) — 다만 이 명명 규약 전제를
    `spec/conventions/swagger.md` W2 항목(이미 plan 에 등재됨)에 술어의 매칭 규칙으로도 명시하면
    다음 사람이 "왜 이 DTO는 안 걸렸지"를 재조사할 필요가 줄어든다.

- **[INFO]** CHANGELOG 의 breaking-change 고지가 직전 WARNING 지적대로 자매 항목과 동일 형식으로
  보강됨
  - 위치: `CHANGELOG.md` (Unreleased, `AlertRuleDto.threshold`)
  - 상세: "**영향**: OpenAPI 로 타입을 생성하는 클라이언트에서 `threshold` 가 `number` → `string`
    으로 바뀐다. **wire 는 불변**이므로 이는 생성 타입을 **실제에 맞추는** 방향이다…" 문단이
    추가돼, 같은 파일의 다른 DTO drift 항목들과 형식이 맞춰졌다. `list`/`create`/`update` 세
    응답 모두 영향받는다는 서술도 실측(컨트롤러 3곳 모두 반환 타입 미명시)과 일치한다.
  - 제안: 없음.

- **[INFO]** (경미) `@ApiProperty({ type: String, example: '10.0000' })` 에 스키마 힌트가 최소한임
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:28`
  - 상세: `threshold` 는 "숫자를 표현하는 10진 문자열"이라는 의미론이 있는데, OpenAPI 스키마상
    임의 문자열(`type: string`)과 구분되지 않는다. `pattern`(예: `^-?\d+(\.\d+)?$`) 이나 유사한
    `description` 내 명시 정도는 이미 JSDoc description 에 있어 소비자가 알 수 있지만, 코드젠
    도구가 `pattern` 기반으로 클라이언트 검증기를 만드는 경우엔 스키마 레벨 힌트가 없어 못 살린다.
  - 제안: 우선순위 낮음. 필요 시 `@ApiProperty({ type: String, example: '10.0000', pattern:
    '^-?\\d+(\\.\\d+)?$' })` 정도로 강화 검토(이번 PR 요구사항 아님, 후속 검토용).

- **[INFO]** 읽기(`AlertRuleDto.threshold: string`)/쓰기(`CreateAlertRuleDto.threshold: number`)
  비대칭은 이번 diff 범위 밖이며 의도된 기존 설계로 재확인
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` (응답) vs
    `codebase/backend/src/modules/alerts/dto/alert-rule.dto.ts`(diff 밖, 요청)
  - 상세: 직전 라운드에서 이미 참고용으로 짚었던 사항이며 이번 diff 가 만든 상태가 아니다.
    요청 검증(요청 바디 유효성) 관점에서 문제는 없다 — 사용자가 숫자를 입력하는 UX 가 자연스럽고
    서비스가 `String(...)` 으로 저장한다.
  - 제안: 조치 불요(범위 밖).

## 요약

이번 diff 는 `AlertRuleDto.threshold` 의 OpenAPI 선언(`number`)을 실제 wire·엔티티·프런트엔드
소비자와 일치시키는 순수 계약 **정합화**이며, 직전 리뷰 라운드가 지적한 4건의 WARNING(회귀
테스트 부재·영향범위 서술 축소·codegen 영향 고지 누락·plan 산술 불일치)이 코드·문서 양쪽에서
실제로 닫혔음을 엔티티·컨트롤러·프런트엔드 파일을 직접 열어 재확인했다. 신설된
`findNumericAsNumber` 가드는 저장소 전수 스캔으로 CI 에 상시 배선돼 있어 동일 결함의 재발을
구조적으로 막는다(단, `XxxDto`↔`Xxx` 이름 대응이라는 의도적으로 좁은 스코프 — 현재는 실질
갭 없음). breaking-change 고지·읽기/쓰기 비대칭 서술도 CHANGELOG 에 형식·내용 모두 자매 항목과
일관되게 보강됐다. 남은 항목은 스키마 힌트 강화 정도의 경미한 개선 제안뿐이며 모두 INFO
등급이다.

## 위험도
LOW
