# 요구사항(Requirement) Review — §5.4 응답 계약 검증기 (`response-contract.ts`) + 4개 e2e 배선

## 발견사항

- **[CRITICAL]** §5.4 계약 검증기가 **중첩 객체 필드를 재귀 검증하지 않아**, `AuditLogDto.user` 를 통한 실제 민감정보 노출(비밀번호 해시·TOTP 복구코드 등)을 놓친다
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts` — `findContractViolations` 함수 (게이트 74~141, 특히 92행 `const props = (schema.properties ?? {}) as Record<string, PropertyContract>;` 와 97행 `for (const [name, prop] of Object.entries(props))` 루프)
  - 연쇄 확인 지점(diff 밖, 실측용으로 직접 `Read`):
    - `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts:25-26` — `AuditLogDto.user` 가 `AuditLogUserDto`(id/name/email 3필드) 로 선언됨
    - `codebase/backend/src/modules/audit-logs/entities/audit-log.entity.ts:24-29` — 실제 `AuditLog.user` 는 `User` 엔티티(전체 컬럼) 타입
    - `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:36` `leftJoinAndSelect('al.user', 'user')` + `getMany()` — 매핑 없이 raw `User` 엔티티를 그대로 로드
    - `codebase/backend/src/modules/audit-logs/audit-logs.controller.ts:36-41` — 서비스 반환값을 가공 없이 그대로 반환 (pass-through, DTO 클래스 미사용)
    - `codebase/backend/src/common/interceptors/transform.interceptor.ts` — `{data}` 래핑만 하고 필드 제거 없음
    - `codebase/backend/src/modules/users/entities/user.entity.ts` — `passwordHash`, `totpRecoveryCodes`, `webauthnRecoveryCodes` 등에 `@Exclude()` 없음. 저장소 전체에 `ClassSerializerInterceptor` 등록 없음(grep 확인)
  - 상세: 이번 diff 가 추가한 `audit-logs.e2e-spec.ts:74-80` 의 `assertMatchesDtoSchema(rows[0], await schemaForDto(AuditLogDto), 'AuditLogDto')` 는 정확히 이 응답을 대상으로 "선언과 실제 응답이 맞는지" 를 검증하겠다고 명시한다. 그러나 `findContractViolations` 는 **최상위(top-level) 키만** 검사한다 — `user` 키가 스키마에 선언돼 있고 값이 null 이 아니기만 하면(`nullable` 여부와 무관하게, `user` 는 optional 이라 present 이든 아니든 통과) 통과 처리되며, `user` **값 내부**의 서브필드(`passwordHash`, `totpRecoveryCodes`, `webauthnRecoveryCodes`, `emailVerifyToken`, `passwordResetToken`, `emailChangeToken`, `twoFactorSecret` 등)가 `AuditLogUserDto` 가 선언한 3필드(`id`/`name`/`email`)를 훨씬 초과해도 **전혀 감지되지 않는다.** 실제로 이 테스트가 삽입하는 시드 행(`INSERT INTO audit_log ... user_id = $2`, `ownerUserId`)은 join 이 성립하므로, 실 HTTP 응답의 `data[0].user` 에는 **owner 의 bcrypt 비밀번호 해시와 TOTP/WebAuthn 복구 코드가 실제로 그대로 실린다** — 이는 새로 추가된 검증이 "통과" 로 보고하는 것과 무관하게 이미 존재하는 라이브 보안 결함이다. `response-contract.ts` 의 JSDoc(게이트 25~28)은 이 도구의 존재 이유를 "엔티티를 그대로 반환하는 경로에서 DTO 선언을 강제하는 유일한 수단" 이라고 명시하는데, 정작 **엔티티 pass-through 로 인해 실제 위험이 가장 큰 자리(중첩 관계 필드)를 못 잡는 것**은 그 존재 이유와 정면으로 배치된다. 이는 diff 가 새로 만든 도구 자체의 완전성 결함(§9 spec fidelity — §5.4 는 "응답이 선언과 어긋나면 안 된다" 는 원칙을 필드 단위로 요구하는데 중첩 객체는 그 원칙 검증에서 통째로 빠져 있음)이며, 동시에 diff 가 새로 wiring 한 e2e 가 실제로는 이 결함을 은폐(거짓 안전 신호)한다.
  - 제안: (1) 최소 조치로 `AuditLogsService.findAll` 이 raw entity 대신 `AuditLogDto`/`AuditLogUserDto` 로 명시 매핑하도록 고치거나 `class-transformer`(`plainToInstance(AuditLogDto, row, { excludeExtraneousValues: true })`) 를 적용해 실제 응답에서 민감 필드를 제거한다 — 이는 이 diff 범위 밖(별도 시급 보안 fix, `project-planner`/`developer` 트랙 별도 등재 권장). (2) `findContractViolations` 자체를 값이 객체(또는 객체 배열)이고 스키마 프로퍼티가 `$ref`/`allOf` 로 다른 DTO 를 가리키는 경우 **재귀 검증**하도록 확장하거나, 최소한 JSDoc 에 "중첩 객체 필드는 존재/null 여부만 검증하고 내부 스키마는 검증하지 않는다" 는 스코프 제한을 명시해 다음 사람이 이 도구의 커버리지를 과신하지 않도록 한다.

- **[WARNING]** JSDoc 이 §5.4 규칙을 "그대로 옮긴 것" 이라 주장하지만, 표의 4번째 행("스키마에 없는 키 → undeclared")은 §5.4 본문에 명시된 규칙이 아니라 검증기가 독자적으로 추가한 확장이다
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts` 게이트 30~40 (JSDoc 표) 대 `spec/5-system/2-api-convention.md` §5.4 (176~199행)
  - 상세: `spec/5-system/2-api-convention.md` §5.4 본문은 "값이 없음을 나타내는 두 가지 표현(`null` vs 키 생략)" 과 그 선택 기준만 규정한다 — "선언에 없는 키가 응답에 왔을 때" 에 대한 규칙은 §5.4 절 자체에 없다(관련 규약은 있다면 `conventions/swagger.md` 쪽일 가능성이 높으나 본 diff 프롬프트 범위에서 그 절이 §5.4 규칙이라고 직접 확인되지 않았다). JSDoc 은 "`spec/5-system/2-api-convention.md` §5.4 를 그대로 옮긴 것" 이라고 단정적으로 적어, 다음 독자가 §5.4 를 열어봐도 4번째 행의 근거를 못 찾을 수 있다. 실제 3개 행(required+non-nullable / required+nullable / 키 생략형)은 §5.4 문언과 line-level 로 정확히 일치한다(검증 완료 — "required 아님(키 생략형) → 키가 없어도 된다. 있으면 null 이 아니어야 한다" 문구가 스펙 원문 "**키를 생략**하는 필드 → `@ApiPropertyOptional()` + `field?: T` (`| null` 금지)" 와 동일).
  - 제안: JSDoc 표 제목을 "§5.4 를 그대로 옮긴 것" 대신 "§5.4(앞 3행) + 응답 계약 일반 원칙(4번째 행, undeclared)" 정도로 스코프를 분리해 명시하면 spec 대조 시 혼선이 줄어든다. spec 자체를 고칠 필요는 없다(코드가 spec 보다 엄격한 검증을 추가한 것은 정당하며, 문서 문구만 정정하면 됨).

- **[INFO]** 배열(array) payload 는 "객체가 아닌 경우" 가드를 통과해 버려 의도한 `(payload)` 단일 위반으로 보고되지 않는다
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts` 게이트 79 `if (payload === null || typeof payload !== 'object') { ... }`
  - 상세: `typeof []` 는 `'object'` 이므로 배열이 오면 이 가드를 통과해 `Object.entries(props)`/`Object.keys(body)` 로 진입한다. 결과가 완전히 무의미하진 않다(대개 required 필드들이 배열 인덱스와 이름이 안 겹쳐 `missing` 위반 다수가 나옴 — 조용히 통과하지는 않음) 하지만, `response-contract.spec.ts` 의 "payload 가 객체가 아닌 경우" `it.each` (게이트 145~153, `null`/`문자열`/`undefined` 3케이스)는 배열 케이스를 캐너리로 포함하지 않아 "배열이 왔을 때 정확히 `(payload)` 1건으로 보고된다" 는 것이 검증되지 않은 채 남는다.
  - 제안: `it.each` 목록에 `['배열', []]` 케이스를 추가하고, 필요하면 가드를 `Array.isArray(payload) || payload === null || typeof payload !== 'object'` 로 넓혀 배열도 `(payload)` 단일 위반으로 통일한다.

- **[INFO]** `findContractViolations` 는 문서화된 대로 `nullable` 축 하나만 검증하고 `type`(string/number/enum 등) 불일치는 검증하지 않는다 — 이는 주석(게이트 90~91 "이 검증자가 실제로 보는 축은 그 한 칸뿐")에 명시적으로 스코프 고지가 돼 있어 결함이 아니라 의도된 한계다. 참고용으로만 기록.

## 정합성 확인 (문제 없음 — 참고)

- `codebase/backend/src/shared/testing/response-contract.spec.ts` 의 픽스처(`ProbeDto`: required+non-null/`id`, required+nullable/`label`, 키 생략형/`note`, 키 생략형+nullable/`legacy`)가 4축을 모두 포함하고, "[전제]" 테스트가 스키마가 실제로 비어있지 않음을 먼저 확인한 뒤 각 규칙의 대조군(RED 유도)까지 갖춰 vacuous-test 패턴을 스스로 배제하고 있다 — mutation 결과(plan 문서 기재: payload `{}` 뮤턴트 4곳 각각 RED)도 이 설계와 일치.
- `assertMatchesDtoSchema`/`formatViolations` 의 에러 메시지 포맷(`ProbeDto 응답이 선언과 어긋난다 (N건):\n  - field [kind] detail`)과 대응 정규식 단언(`/ProbeDto.*1건[\s\S]*id \[missing\]/`)이 line-level 로 일치.
- 4개 e2e 배선(`AuditLogDto`/`SessionDto`/`WorkflowDto`/`ExecutionDto`) 각각의 required 필드 수(8/7/10/12)가 실제 DTO 클래스의 `@ApiProperty` vs `@ApiPropertyOptional` 개수와 정확히 일치 — plan 문서(`spec-draft-nullable-notation-followups.md`)의 수치 주장도 재검증 결과 정확하다.
- `SessionDto`(`sessions.service.ts` 의 `toDto()` 명시적 매퍼)와 `WorkflowDto`/`ExecutionDto`(스칼라/원시 배열/`Record<string,unknown>` 필드만 보유, 중첩 DTO 타입 없음)는 위 CRITICAL 항목과 같은 부류의 재귀 검증 공백에 노출되지 않는다 — `AuditLogDto.user` 가 4개 배선 중 유일하게 다른 DTO 클래스를 참조하는 필드다.
- `workflow-crud.e2e-spec.ts` 는 `expect(mine).toBeDefined()` 로 `find()` 결과가 `undefined` 인 경우를 먼저 가드해, `assertMatchesDtoSchema` 가 모호한 에러 대신 명확한 실패를 내도록 방어적으로 작성됐다.
- TODO/FIXME/HACK/XXX 주석 없음(grep 확인).
- `plan/in-progress/*.md` 2개 파일과 `review/consistency/2026/09/05/12_48_13/**` 는 이전 라운드 consistency-check 산출물과 그 반영 기록으로, 새로운 요구사항 불일치를 추가로 발견하지 못했다(해당 라운드 자체가 BLOCK:NO·Critical 0 으로 이미 보고됨).

## 요약

새로 추가된 `response-contract.ts`(§5.4 응답-vs-DTO 대조기)와 그 unit spec 은 §5.4 의 핵심 3축(required+non-nullable/required+nullable/키생략형)을 spec 원문과 line-level 로 정확히 구현하고, 대조군·전제 검증·mutation 근거까지 갖춘 성숙한 테스트다. 그러나 이 검증기는 **최상위 키만** 검사하는 얕은(non-recursive) 설계라, 4개 배선 대상 중 유일하게 중첩 DTO(`AuditLogUserDto`)를 참조하는 `AuditLogDto.user` 필드에서 실제 라이브 보안 결함(엔티티 pass-through 로 인해 `passwordHash`/TOTP·WebAuthn 복구 코드가 그대로 노출)을 놓친다 — 이 diff 가 정확히 그 엔드포인트를 겨눈 새 e2e 단언을 추가했음에도 통과 판정을 낸다는 점에서, "충족했다" 는 신호 자체가 오도적이다. 이 결함의 근본 원인(엔티티 미매핑)은 이번 diff 파일 목록 밖(`audit-logs.service.ts`/`.controller.ts`)에 있지만, 새 검증 도구의 커버리지 주장과 정면으로 충돌하므로 최우선 후속 조치로 등재할 것을 권고한다. 그 외에는 배열 payload 미검증(INFO)·JSDoc 의 "§5.4 그대로 옮김" 표현이 4번째 행(undeclared)까지 포함하는 과잉 주장(WARNING)만 발견됐다.

## 위험도

CRITICAL
