# 요구사항(Requirement) 리뷰 — keyset 커서 id 성분 UUID 검증

## 검증 방법

diff 로 제시된 두 서비스(`login-history.service.ts`, `background-runs.service.ts`)와
공용 유틸(`common/utils/uuid.ts`, diff 밖이지만 신규 참조)을 직접 열어 대조했고, 인용된 spec
3곳(`spec/data-flow/12-workspace.md` §"UUID 검증 강도 비대칭", `spec/5-system/3-error-handling.md`
§1.3, `spec/5-system/2-api-convention.md` §8.2)을 grep 으로 원문 대조했다. 두 대상 스펙 파일의
`@PrimaryGeneratedColumn('uuid')` 선언을 엔티티에서 직접 확인했고, `GlobalExceptionFilter`
(`http-exception.filter.ts`)가 23505 만 분기하고 22P02 분기가 없음을 확인했다. 마지막으로
`npx jest login-history.service.spec.ts background-runs.service.spec.ts` 를 직접 실행해 35/35
통과를 재현했다(저장소 파일은 전혀 수정하지 않음 — `git status --short` 로 원본 상태 유지 확인,
잔여물은 workflow 자신이 만든 미커밋 review 산출물 3개 디렉터리뿐이고 이 리뷰 세션이 생성한 것이 아니다).

## 발견사항

- **[INFO]** spec 갭 3건(에러코드 카탈로그 미등재·§8.2 단일표준과 `login_history` 예외 미기재·
  §1.6 각주 분류 불일치)은 developer 권한 밖(`spec/**` 편집)이라 정당하게 코드를 고치지 않고
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 **planner 항목**으로만
  등재했다. grep 으로 세 갭 모두 실측 확인됨 — `3-error-handling.md` 에 `INVALID_CURSOR`·
  `INVALID_LIMIT`·`BACKGROUND_RUN_NOT_FOUND` 0건, `2-api-convention.md §8.2` 는 base64 opaque
  단일 표준만 서술. 코드 결함이 아니라 정당한 스코프 경계 준수.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (게이트 3190~3211)
  - 상세: CLAUDE.md 의 "developer 는 spec 변경 시 planner 위임" 원칙을 정확히 지켰다.
  - 제안: 조치 불필요 — planner 턴에서 처리될 항목.

- **[INFO]** 두 keyset 커서 디코더의 실패 계약이 여전히 비대칭이다(`login-history`=무시하고
  1페이지, `background-runs`=400 `INVALID_CURSOR`). plan §C 에 "완전 해소 아님"으로 명시
  이미 등재돼 있고, CHANGELOG 에도 "두 엔드포인트의 처분이 다른 것은 의도다"라고 명시했다. 감춰진
  갭이 아니라 자기 신고된 잔여 결정 사항이다.
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts` `decodeCursor` vs
    `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts`
    `decodeCursor`
  - 제안: 조치 불필요 — 별도 제품 결정으로 이미 트래커에 등재됨.

## 항목별 점검 결과 (요약)

1. **기능 완전성**: 완전하다. 사용자 입력 커서가 바인딩되는 두 자리(전수 확인 대상, plan §B 가
   "정확히 2곳"이라 밝힘)에 모두 `isUuidShaped` 검증이 들어갔다.
2. **엣지 케이스**: nil UUID·v6/v7 형태(대조군 테스트로 고정), 빈 `id`(`!id` 조기 return),
   과도한 limit(`caps limit`/`rejects out-of-range limit` 기존 테스트 유지) 모두 커버.
3. **TODO/FIXME/HACK/XXX**: diff 전체에 없음.
4. **의도-구현 괴리**: 없음. 주석이 `isUuidShaped`(아닌 `isValidUuid`)를 쓰는 이유·22P02 메커니즘을
   정확히 서술하고 실제 구현과 일치.
5. **에러 시나리오**: `login-history` → `null` 반환(무시, 1페이지), `background-runs` → catch 블록에서
   `BadRequestException({code:'INVALID_CURSOR'})`. 둘 다 각자의 **기존** 실패 계약과 일치(날짜·형태
   오류와 동일 처분) — 새 비대칭을 만들지 않았다.
6. **데이터 유효성**: `isUuidShaped` 는 canonical 8-4-4-4-12 hex 형태만 검증하며, `spec/data-flow/12-workspace.md`
   Rationale 이 요구하는 "Postgres 가 파싱 가능한가"라는 질문에 정확히 대응한다 — 실측상 두 컬럼 모두
   `@PrimaryGeneratedColumn('uuid')`라 이 질문이 맞는 질문이다.
7. **비즈니스 로직**: `GlobalExceptionFilter` 를 고치는 대신 입구에서 막는 처분은 spec
   `3-error-handling.md §1.3`("JWT 클레임은 검증하지 않는다 — 서버가 서명한 값에 400 을 내면 서버
   버그를 클라이언트 오류로 보고")과 정확히 일치하는 논거이며 인용문이 원문과 정확히 일치함을 grep 으로 확인했다.
8. **반환값**: `decodeCursor` 두 함수 모두 모든 경로에서 명시적 반환/throw. 누락 경로 없음.
9. **spec fidelity**: `spec/data-flow/12-workspace.md` §"UUID 검증 강도 비대칭" 인용이 원문과
   일치하며, plan 문서가 스스로 "적용 범위가 넓어진다"(원래 주어는 워크스페이스 헤더인데 커서 id 로
   확장)를 INFO 로 명시해 무단 확장이 아니라 인지된 확장임을 밝혔다 — SPEC-DRIFT 로 볼 필요 없이
   정당한 재사용. `3-error-handling.md §1.3` 인용도 원문과 일치. `2-api-convention.md §8.2` 갭도
   실측과 일치하며 planner 항목으로 올바르게 이관.

테스트 실행 결과(직접 재현): `login-history.service.spec.ts` + `background-runs.service.spec.ts`
= 35/35 통과. entity 컬럼 타입(`uuid`), 필터 분기(23505 only) 등 모든 핵심 주장을 소스에서 직접
대조해 반증되는 것이 없었다.

## 요약

이 변경은 두 keyset 커서 디코더의 id/i 성분에 `isUuidShaped` 검증을 추가해, 인증된 사용자가 비-UUID
문자열로 22P02 → 500 마스킹을 유발할 수 있던 결함을 각 엔드포인트의 **기존** 실패 계약(무시 vs 400)에
맞춰 닫았다. 필터 레벨 수정 대신 입구 검증을 택한 근거가 spec 원문과 정확히 일치하고, 술어 선택
(`isUuidShaped` vs `isValidUuid`)의 근거도 기존 Rationale과 grep 대조로 검증됐다. 회귀 테스트(대조군
포함)와 뮤테이션 테스트(6/6)가 핵심 주장을 실증하고, 직접 재실행한 unit 테스트도 전부 통과했다.
남은 갭(에러코드 카탈로그 미등재, §8.2 예외 미기재, 계약 비대칭)은 모두 developer 권한 밖이거나
의도적으로 유지된 제품 결정으로 이미 투명하게 트래커에 등재돼 있어 이번 PR 의 결함이 아니다.

## 위험도
NONE
