# 요구사항(Requirement) 리뷰 — `AlertRuleDto.threshold` wire 타입 정정 (+ CHANGELOG/plan 반영)

## 범위
- `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` — `threshold: number` → `string` (실제 코드 변경)
- `CHANGELOG.md` — 위 수정을 서술하는 Unreleased 항목 추가 (문서)
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — §5.4 drift 배치 2단계의 검증자 옵션 (a) 를 실측으로 기각하고 (b) 로 좁히는 갱신 (문서)

## 검증 절차
저장소를 직접 열어 다음을 실측 대조했다(저장소 변형 없음, 읽기만 수행):
- `alert-rule.entity.ts` — `@Column({ type: 'numeric', precision: 12, scale: 4 }) threshold: string;` 확인. Migration(`V016`) 은 `threshold NUMERIC(12, 4) NOT NULL` — DTO 의 `type: String, example: '10.0000'`(소수점 4자리) 와 정합.
- `alerts.controller.ts` — `list()`/`create()`/`update()` 모두 반환 타입 애노테이션이 없고 `{ data: rule(s) }` 로 엔티티를 그대로 반환. `ClassSerializerInterceptor` 저장소 전체 0건 — DTO 는 Swagger 문서 전용이고 런타임 직렬화에 관여하지 않음을 확인. 즉 **이 diff 는 wire 바이트를 바꾸지 않는다**는 CHANGELOG 의 주장이 성립.
- `codebase/frontend/src/lib/api/alerts.ts` — `AlertRule.threshold: string`(읽기) / `CreateAlertRulePayload.threshold: number`(쓰기)로 이미 손수 분리돼 있음을 확인. 프런트가 `AlertRuleDto` 를 코드젠으로 소비하는 지점 없음(0건) — OpenAPI 정정이 별도 클라이언트 코드 변경을 요구하지 않음.
- `alerts.service.ts` — `create`/`update` 모두 `String(dto.threshold)` 로 저장 — "읽기/쓰기 비대칭은 의도" 주장과 일치.
- `alerts-evaluator.service.ts` — `Number(rule.threshold)` 로 entity 의 string 값을 변환해 사용 — 기존에도 `threshold` 를 string 으로 다뤄왔음을 뒷받침(회귀 없음).
- 저장소 전체에서 `AlertRuleDto` 를 리터럴로 구성/타입 단언하는 지점 0건 — `threshold: string` 으로 좁혀도 컴파일 파손 지점 없음.
- `spec/2-navigation/9-user-profile.md` §6.3 — `POST /api/alerts` body 의 `threshold(number, ≥0, ...)` 서술은 **쓰기 DTO**(`CreateAlertRuleDto`, 이 diff 로 불변)에 대한 것이라 이번 변경과 충돌하지 않음.

## 발견사항

- **[WARNING]** 실측 총계 불일치 — "불일치 **59**건"이라 적은 문장과 바로 아래 표의 합계가 어긋난다(46+6+4+1 = **57**, 59 아님).
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:276`(문장) / `:281`-`:284`(표 4행). 같은 내용이 이번 커밋(`a65a4f85e`) 메시지 본문에도 동일하게 반복돼 있어 일회성 오타가 아니라 원 실측 자체의 계산 오류로 보인다.
  - 상세: 이 표는 "엔티티↔응답 DTO 23개 필드 타입 전수 대조 결과"를 4개 범주(Date→string, enum→string, 관계 축소, 실제 불일치)로 **완전 분할**한다고 서술한다. 완전 분할이라면 합계가 총계와 일치해야 하는데 2건이 비어 있다. 두 가능성이 있다 — (i) "59"가 단순 오기(정확히는 57)이거나, (ii) 표의 어느 범주가 실제로는 그 값보다 2건 더 커야 하는데 누락됐다 — 후자라면 이 diff 가 고친 `AlertRuleDto.threshold` 1건 외에 **아직 발견되지 않은 실제 DTO/엔티티 불일치가 최대 2건 더 있을 수 있다**는 뜻이 된다. 이 수치는 "검증자 (a)(반환 타입 명시로 tsc 가 구조를 검사하게 하는 안)를 기각하고 (b)(응답 대조 테스트)만 남긴다"는 §5.4 drift 2단계의 의사결정 근거로 쓰이므로, 계산이 맞는지가 향후 작업 범위 산정에 직접 영향을 준다.
  - 제안: 2단계(§5.4 drift 배치 — 검증자 없는 응답 DTO 78곳) 착수 전에 원 실측(엔티티↔DTO 23쌍 필드 대조) 스크립트/방법을 재실행해 46/6/4/1 합계와 "59"를 재대조하고, 어느 쪽이 맞는지 확정해 문서(plan 파일)와 커밋 메시지 서술 중 최소 plan 파일 쪽을 정정한다. 만약 (ii) 로 판명되면 그 2건이 `AlertRuleDto.threshold` 와 같은 성격의 실제 계약 거짓인지 확인이 필요하다.

- **[INFO]** `spec/1-data-model.md:873` (§2.25 AlertRule) 이 `threshold` 를 `Float` 로 표기한다 — "임계치 (DB 는 `NUMERIC(12,4)` 고정소수)"라는 각주로 DB 타입이 다름을 인지하고는 있으나, 이 PR 이 코드/문서(엔티티 `string`, 이번에 고친 `AlertRuleDto.threshold: string`)로 명확히 해 둔 "wire·엔티티는 문자열" 사실과 라벨이 어긋난다. 같은 파일의 `cost_usd` 필드는 동일하게 numeric 컬럼인데 `Numeric(12,6)?` 로 DB 타입을 그대로 라벨링해 표기 관례가 필드마다 다르다.
  - 위치: `spec/1-data-model.md:873`
  - 상세: 이 diff 범위 밖(해당 파일은 변경되지 않음)이고 이번 PR 이 만든 회귀도 아니다 — 선재하던 데이터 모델 문서의 표기 스타일 차이다. 코드 결함은 아니므로 CRITICAL/WARNING 이 아니라 참고용 INFO로 남긴다.
  - 제안: 수정은 이 reviewer 의 권한 밖(`spec/` 은 planner 트랙)이며, 굳이 지금 처리할 필요는 없다 — 다만 이번 PR 이 정확히 이 필드(`threshold`)의 표시 타입 정합성을 다루는 만큼, 후속 spec 정리 때 §2.25 의 "Float" 라벨을 "String"(또는 DB 타입 그대로 `Numeric(12,4)`)으로 맞추는 것을 고려할 만하다.

## 그 외 확인된 사항 (결함 아님)
- DTO 변경 자체(`threshold: number` → `string`, `@ApiProperty({ type: String, example: '10.0000' })`)는 엔티티·DB 컬럼·프런트엔드 소비 코드·서비스 계층과 전부 line-level 로 정합한다. TODO/FIXME/HACK/XXX 없음.
- 반환값·에러 경로 변화 없음(순수 Swagger 문서 정정, `ClassSerializerInterceptor` 부재로 런타임 wire 불변 확인).
- CHANGELOG 항목은 "동작 변경 없음"을 정확히 서술하고, breaking 여부도 올바르게(문서만 정정) 표기했다.
- 쓰기 DTO(`CreateAlertRuleDto`/`UpdateAlertRuleDto`, `threshold: number`)는 손대지 않았고 spec §6.3 의 "threshold(number, ≥0)" 서술과 계속 일치한다 — 읽기/쓰기 비대칭이 spec 과 충돌하지 않는다.

## 요약
핵심 코드 변경(`AlertRuleDto.threshold: number → string`)은 엔티티·DB 컬럼(`NUMERIC(12,4)`)·프런트엔드 기존 소비 패턴·서비스 계층 저장 로직과 전수 대조로 정합함을 확인했고, 런타임 wire 를 바꾸지 않는 순수 문서 정정이라는 CHANGELOG 서술도 `ClassSerializerInterceptor` 부재 확인으로 뒷받침된다. 다만 동반된 plan 문서(및 커밋 메시지)에 실측 총계 "불일치 59건"과 분류 표 합계(57)가 어긋나는 산술 불일치가 있고, 이는 §5.4 drift 2단계 착수 범위를 정하는 근거 수치이자 — 최악의 경우 아직 발견되지 않은 실제 DTO/엔티티 계약 거짓 최대 2건을 가리고 있을 가능성이 있어 재검증이 필요하다. 그 외 기능 완전성·에러 시나리오·spec 정합성 관점에서 이 diff 자체의 결함은 발견되지 않았다.

## 위험도
LOW
