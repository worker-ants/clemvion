# Rationale 연속성 검토 — `spec/5-system/` (--impl-prep, keyset-cursor-uuid-validation)

## 검토 배경

`plan/in-progress/keyset-cursor-uuid-validation.md` 가 착수 전 세운 두 처분을
`spec/5-system/` 의 기존 `## Rationale`(및 body 에 박힌 설계 원칙)에 대조했다.

1. **A. `GlobalExceptionFilter` 에 SQLSTATE 22P02 → 400 분기를 추가하지 않는다** (직전 트래커
   항목의 처방을 번복)
2. **B. `login-history.service.ts`/`background-runs.service.ts` 의 `decodeCursor` 가 id 성분을
   `isUuidShaped` 로 검증**, 각 디코더의 기존 실패 계약(무시 vs 400)은 유지
3. **가드는 만들지 않는다** (회귀 테스트로만 고정)

## 발견사항

### [INFO] `isUuidShaped` 재사용 문맥이 spec Rationale 원문보다 넓다

- target 위치: `plan/in-progress/keyset-cursor-uuid-validation.md` §B (78~81행) — 구현 예정
  코드는 `login-history.service.ts`/`background-runs.service.ts` `decodeCursor`
- 과거 결정 출처: `spec/data-flow/12-workspace.md` `## Rationale` §"`X-Workspace-Id` 헤더 vs
  `:id` 경로 파라미터 — UUID 검증 강도 비대칭 (2026-08-09)" (spec/5-system/1-auth.md §2.3 주석,
  spec/5-system/3-error-handling.md §1.3 `VALIDATION_ERROR` 행에서도 동일 근거로 인용)
- 상세: 이 Rationale 항목의 서술은 "헤더는 **인가 판정의 입력**이므로 403→400 뒤바뀜을 막아야
  한다" 는 **인가 컨텍스트에 특정된 논거**를 중심으로 쓰여 있다(§ 왜 헤더는 느슨한가). 반면
  plan 이 재사용하는 문맥(로그인 이력·백그라운드 실행 커서의 id 성분)은 인가 판정과 무관하고,
  실제로 막으려는 것은 "Postgres 가 파싱 못 하는 값이 22P02 → 500 으로 마스킹된다" 는 **다른
  결과**다. 다행히 `common/utils/uuid.ts` 의 `isUuidShaped` **JSDoc 자체**는 이미 이 두 번째
  이유("클라이언트 입력 오류가 서버 오류로 보이는 것이 이 술어가 막는 것이다")를 명시하고
  있어 코드 레벨에서는 재사용 근거가 충분하다 — **원칙 위반이 아니라, spec 문서(Rationale)가
  코드 docstring 보다 좁게 서술돼 있는 정합 격차**다.
- 제안: 이번 배치가 spec/5-system/*.md 를 직접 건드리지 않는다면 지금 당장 수정할 필요는
  없다. 다만 plan 체크리스트 "C. 등재만 하는 것"(또는 후속 배치)에 *"`isUuidShaped` 의 적용
  범위가 워크스페이스 헤더 이외의 커서 검증까지 넓어졌다"* 는 한 줄을 남겨, 다음 사람이
  `data-flow/12-workspace.md` Rationale 을 "워크스페이스 헤더 전용" 으로 오독해 이 코드를
  반례로 오인하지 않게 한다.

## 결론적으로 위반이 아닌 것 (확인만 하고 기록)

- **A (필터 won't-do)는 기각이 아니라 기존 원칙의 재확인이다.** §1.3 `VALIDATION_ERROR`
  행이 이미 "JWT 클레임은 검증하지 않는다(서버가 서명한 값이라 거기서 400 을 내면 서버
  버그를 클라이언트 오류로 보고하게 된다)" 는 원칙과 "입구마다 조기 거부" 패턴
  (`workspace-context.util.ts` 선례)을 명시하고 있고, plan 의 A 절은 정확히 이 원칙을
  근거로 필터 레벨의 일괄 22P02→400 매핑을 기각한다. 직전 트래커 항목(`22P02 → 400 분기`
  처방)은 spec 의 `## Rationale` 이 아니라 아직 열린 plan tracker 의 제안이었고, plan 은
  이를 뒤집으며 새 근거(§A 전문)를 **함께** 적어 두었으므로 "무근거 번복"(관점 3) 에도
  해당하지 않는다.
- **B (`INVALID_CURSOR` 400)는 신규 결정이 아니라 기존 계약의 확장이다.**
  `spec/4-nodes/1-logic/12-background.md:298` 에 이미 `400 INVALID_CURSOR`("cursor 디코딩
  실패")가 등재돼 있고, `background-runs.service.ts` 의 `decodeCursor` 는 이미 이 코드로
  다른 실패(base64·JSON·필드 타입·날짜)를 throw 한다. id 검증 실패도 같은 코드로 합류시키는
  것은 기존 계약을 그대로 따르는 것이다.
- **login-history 의 `null` 폴백 유지는 spec 무관 영역이다.** `spec/2-navigation/9-user-profile.md`
  §6.1 은 `/api/users/me/login-history` 를 "커서 페이징" 이라고만 적고 커서 오류 계약을
  규정하지 않는다(`spec/5-system/2-api-convention.md §8.2` 도 동일 — 커서 디코딩 실패 시의
  응답 형식은 스펙 밖). 따라서 기존 디코더의 관측된 동작(무시 → 1페이지)에 맞춘 plan 의
  선택은 어떤 spec 문서의 Rationale 도 건드리지 않는다.
- **가드 미생성 결정은 spec Rationale 대상이 아니다.** `#1328` 의 정적 가드 선례는
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 트래커 항목이며
  `spec/5-system/` 의 `## Rationale` 에 "모든 유사 결함 클래스는 가드로 고정해야 한다" 는
  합의 원칙이 등재돼 있지 않다 — 이 결정은 code-review/testing 관례의 영역이지 본 checker
  의 스코프(spec Rationale 연속성) 밖이다.

## 요약

`plan/in-progress/keyset-cursor-uuid-validation.md` 가 세운 두 처분(필터 won't-do, 커서
id `isUuidShaped` 검증)은 모두 `spec/5-system/3-error-handling.md` §1.3 의 "JWT 클레임
미검증" 원칙, `spec/4-nodes/1-logic/12-background.md` 의 기존 `INVALID_CURSOR` 계약,
`spec/data-flow/12-workspace.md` Rationale "UUID 검증 강도 비대칭" 의 **판정 술어
선택**과 정합한다 — 오히려 직전 트래커가 제안했던 "필터 일괄 22P02→400" 쪽이 §1.3 원칙과
충돌할 뻔한 안이었고, 이번 plan 은 그 원칙을 근거로 스스로 기각·정정했다. 유일한 잔여
지점은 `isUuidShaped` 재사용이 spec 상의 Rationale 서술(인가-컨텍스트 중심)보다 넓은
문맥에 걸쳐 있다는 것으로, 코드 docstring 은 이미 그 확장을 뒷받침하지만 spec 쪽에는
아직 명시적 cross-reference 가 없다(INFO, 비차단).

## 위험도

LOW
